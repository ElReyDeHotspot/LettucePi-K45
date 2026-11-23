package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const dir = "/etc/chester-cloudflare"
const runtimeDir = "/var/run/chester-cloudflare"
const iface = "cfwarp"
const table = "51830"

type Settings struct {
	DNS     string   `json:"dns"`
	IPv4    []string `json:"ipv4"`
	IPv6    []string `json:"ipv6"`
	WARP    bool     `json:"warp"`
	Block   bool     `json:"block"`
	Scope   string   `json:"scope"`
	Clients []string `json:"clients"`
}
type State struct {
	Ready   bool   `json:"ready"`
	IP      string `json:"ip"`
	WARP    string `json:"warp"`
	Checked string `json:"checked"`
	Error   string `json:"error,omitempty"`
	IPv6    bool   `json:"ipv6"`
}

func run(name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	c := exec.CommandContext(ctx, name, args...)
	var errout bytes.Buffer
	c.Stderr = &errout
	b, e := c.Output()
	if e != nil {
		return string(b), fmt.Errorf("%s: %s", name, strings.TrimSpace(errout.String()))
	}
	return strings.TrimSpace(string(b)), nil
}
func quiet(name string, args ...string) { _, _ = run(name, args...) }
func atomic(path string, v any, mode os.FileMode) error {
	b, e := json.MarshalIndent(v, "", "  ")
	if e != nil {
		return e
	}
	if e = os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		return e
	}
	if e = os.WriteFile(path+".new", b, mode); e != nil {
		return e
	}
	return os.Rename(path+".new", path)
}
func readJSON(path string, v any) error {
	b, e := os.ReadFile(path)
	if e != nil {
		return e
	}
	return json.Unmarshal(b, v)
}
func settings() Settings {
	s := Settings{DNS: "system", Scope: "all", IPv4: []string{}, IPv6: []string{}, Clients: []string{}}
	_ = readJSON(dir+"/settings.json", &s)
	return s
}
func validate(s Settings) error {
	if !contains([]string{"system", "cloudflare", "malware", "family", "manual"}, s.DNS) {
		return errors.New("Choose a valid DNS mode")
	}
	if s.Scope != "all" && s.Scope != "selected" {
		return errors.New("Choose all devices or selected devices")
	}
	if len(s.IPv4)+len(s.IPv6) > 8 || len(s.Clients) > 32 {
		return errors.New("Too many addresses")
	}
	for _, family := range []struct {
		ips []string
		v4  bool
	}{{s.IPv4, true}, {s.IPv6, false}} {
		for _, ip := range family.ips {
			a, e := netip.ParseAddr(ip)
			if e != nil || a.Is4() != family.v4 || a.Is4In6() || !a.IsGlobalUnicast() || a.Zone() != "" {
				return errors.New("Enter valid unicast IPv4 / IPv6 DNS addresses")
			}
		}
	}
	if s.DNS == "manual" && len(s.IPv4)+len(s.IPv6) == 0 {
		return errors.New("Enter at least one DNS server")
	}
	for _, ip := range s.Clients {
		p, e := netip.ParsePrefix(ip)
		if e != nil {
			a, e := netip.ParseAddr(ip)
			if e != nil || !a.IsGlobalUnicast() {
				return errors.New("Enter valid device IP addresses or CIDR subnets")
			}
			p = netip.PrefixFrom(a, a.BitLen())
		}
		if p.Bits() == 0 || p.Addr().Zone() != "" || !p.Addr().IsGlobalUnicast() {
			return errors.New("Use specific unicast device addresses or subnets")
		}
	}
	if s.WARP && s.Scope == "selected" && len(s.Clients) == 0 {
		return errors.New("Select at least one device IP or subnet")
	}
	return nil
}
func contains(a []string, b string) bool {
	for _, s := range a {
		if s == b {
			return true
		}
	}
	return false
}
func endpoint(s Settings) string {
	switch s.DNS {
	case "malware":
		return "https://security.cloudflare-dns.com/dns-query"
	case "family":
		return "https://family.cloudflare-dns.com/dns-query"
	default:
		return "https://cloudflare-dns.com/dns-query"
	}
}

// Dial the published bootstrap addresses while retaining normal TLS hostname validation.
func dohClient() *http.Client {
	return &http.Client{Timeout: 8 * time.Second, Transport: &http.Transport{ForceAttemptHTTP2: true, MaxIdleConnsPerHost: 8, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		_, port, e := net.SplitHostPort(address)
		if e != nil {
			return nil, e
		}
		d := net.Dialer{Timeout: 4 * time.Second}
		var last error
		for _, ip := range []string{"1.1.1.1", "1.0.0.1"} {
			c, e := d.DialContext(ctx, "tcp", net.JoinHostPort(ip, port))
			if e == nil {
				return c, nil
			}
			last = e
		}
		return nil, last
	}}}
}
func doh(c *http.Client, url string, q []byte) ([]byte, error) {
	req, e := http.NewRequest("POST", url, bytes.NewReader(q))
	if e != nil {
		return nil, e
	}
	req.Header.Set("Content-Type", "application/dns-message")
	req.Header.Set("Accept", "application/dns-message")
	res, e := c.Do(req)
	if e != nil {
		return nil, e
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("DNS HTTPS status %d", res.StatusCode)
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, 65536))
	if e != nil || len(b) < 12 || len(b) > 65535 {
		return nil, errors.New("Invalid DNS response")
	}
	if len(q) >= 2 {
		copy(b[:2], q[:2])
	}
	return b, nil
}
func dnsFailure(q []byte) []byte {
	if len(q) < 12 {
		return nil
	}
	b := append([]byte(nil), q...)
	b[2] |= 0x80
	b[3] = (b[3] & 0xf0) | 2
	return b
}
func proxy(s Settings) error {
	c := dohClient()
	udp, e := net.ListenPacket("udp4", "127.0.0.1:5053")
	if e != nil {
		return e
	}
	defer udp.Close()
	tcp, e := net.Listen("tcp4", "127.0.0.1:5053")
	if e != nil {
		return e
	}
	defer tcp.Close()
	sem := make(chan struct{}, 64)
	go func() {
		for {
			conn, e := tcp.Accept()
			if e != nil {
				return
			}
			select {
			case sem <- struct{}{}:
				go func() {
					defer func() { conn.Close(); <-sem }()
					conn.SetDeadline(time.Now().Add(12 * time.Second))
					var size uint16
					if binary.Read(conn, binary.BigEndian, &size) != nil || size < 12 {
						return
					}
					q := make([]byte, int(size))
					if _, e := io.ReadFull(conn, q); e != nil {
						return
					}
					b, e := doh(c, endpoint(s), q)
					if e != nil {
						b = dnsFailure(q)
					}
					binary.Write(conn, binary.BigEndian, uint16(len(b)))
					conn.Write(b)
				}()
			default:
				conn.Close()
			}
		}
	}()
	for {
		buf := make([]byte, 4096)
		n, addr, e := udp.ReadFrom(buf)
		if e != nil {
			return e
		}
		if n < 12 {
			continue
		}
		q := buf[:n]
		select {
		case sem <- struct{}{}:
			go func() {
				defer func() { <-sem }()
				b, e := doh(c, endpoint(s), q)
				if e != nil {
					b = dnsFailure(q)
				}
				if len(b) > 1232 {
					b = append([]byte(nil), q...)
					b[2] |= 0x82
					b[3] |= 0x80
					for i := 6; i < 12; i++ {
						b[i] = 0
					}
				}
				udp.WriteTo(b, addr)
			}()
		default:
			udp.WriteTo(dnsFailure(q), addr)
		}
	}
}

type DNSBackup map[string]struct {
	Server      []string `json:"server"`
	Noresolv    string   `json:"noresolv"`
	HasNoresolv bool     `json:"has_noresolv"`
}

func dnsApply(s Settings) error {
	backup := DNSBackup{}
	_ = readJSON(dir+"/dns-backup.json", &backup)
	if s.DNS == "system" && len(backup) == 0 {
		return nil
	}
	show, e := run("uci", "-X", "show", "dhcp")
	if e != nil {
		return e
	}
	for _, line := range strings.Split(show, "\n") {
		if !strings.HasSuffix(line, "=dnsmasq") {
			continue
		}
		section := strings.TrimSuffix(line, "=dnsmasq")
		if s.DNS != "system" {
			if _, ok := backup[section]; !ok {
				server, _ := run("uci", "-q", "get", section+".server")
				value, err := run("uci", "-q", "get", section+".noresolv")
				backup[section] = struct {
					Server      []string `json:"server"`
					Noresolv    string   `json:"noresolv"`
					HasNoresolv bool     `json:"has_noresolv"`
				}{strings.Fields(server), value, err == nil}
				if e := atomic(dir+"/dns-backup.json", backup, 0600); e != nil {
					return e
				}
			}
		}
		original, ok := backup[section]
		if !ok {
			continue
		}
		quiet("uci", "-q", "delete", section+".server")
		if s.DNS == "system" {
			for _, v := range original.Server {
				if _, e := run("uci", "add_list", section+".server="+v); e != nil {
					return e
				}
			}
			if original.HasNoresolv {
				_, e = run("uci", "set", section+".noresolv="+original.Noresolv)
			} else {
				quiet("uci", "-q", "delete", section+".noresolv")
			}
		} else {
			_, e = run("uci", "set", section+".noresolv=1")
			servers := append(append([]string{}, s.IPv4...), s.IPv6...)
			if s.DNS != "manual" {
				servers = []string{"127.0.0.1#5053"}
			}
			for _, v := range servers {
				if _, e = run("uci", "add_list", section+".server="+v); e != nil {
					return e
				}
			}
		}
		if e != nil {
			return e
		}
	}
	if _, e = run("uci", "commit", "dhcp"); e != nil {
		return e
	}
	if _, e = run("/etc/init.d/dnsmasq", "reload"); e != nil {
		return e
	}
	if s.DNS == "system" {
		os.Remove(dir + "/dns-backup.json")
	}
	return nil
}

type Profile struct {
	Private   string
	Public    string
	Endpoint  string
	Addresses []string
}

func profile() (Profile, error) {
	b, e := os.ReadFile(dir + "/wgcf-profile.conf")
	p := Profile{}
	if e != nil {
		return p, errors.New("Register WARP on this router first")
	}
	for _, line := range strings.Split(string(b), "\n") {
		kv := strings.SplitN(line, "=", 2)
		if len(kv) != 2 {
			continue
		}
		k, v := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])
		switch k {
		case "PrivateKey":
			p.Private = v
		case "PublicKey":
			p.Public = v
		case "Endpoint":
			p.Endpoint = v
		case "Address":
			for _, a := range strings.Split(v, ",") {
				a = strings.TrimSpace(a)
				if !strings.Contains(a, "/") {
					ip, e := netip.ParseAddr(a)
					if e != nil {
						return p, e
					}
					a = netip.PrefixFrom(ip, ip.BitLen()).String()
				}
				if _, e := netip.ParsePrefix(a); e != nil {
					return p, e
				}
				p.Addresses = append(p.Addresses, a)
			}
		}
	}
	if p.Private == "" || p.Public == "" || p.Endpoint == "" || len(p.Addresses) == 0 {
		return p, errors.New("Incomplete WARP profile")
	}
	return p, nil
}
func ownedRule(rule map[string]any) bool {
	priority, _ := rule["priority"].(float64)
	tab := fmt.Sprint(rule["table"])
	dst := fmt.Sprint(rule["dst"])
	if bits, ok := rule["dstlen"]; ok {
		dst += fmt.Sprintf("/%v", bits)
	}
	return ((priority == 6181 || priority == 6182) && tab == table) || (priority == 6180 && tab == "main" && rule["iif"] == "br-lan" && (contains(bypass4, dst) || contains(bypass6, dst)))
}
func rulesClear() {
	for _, family := range []string{"-4", "-6"} {
		text, _ := run("ip", family, "-j", "rule", "show")
		var rules []map[string]any
		_ = json.Unmarshal([]byte(text), &rules)
		for _, rule := range rules {
			priority, _ := rule["priority"].(float64)
			tab := fmt.Sprint(rule["table"])
			owned := ownedRule(rule)
			if owned {
				quiet("ip", family, "rule", "del", "priority", fmt.Sprint(int(priority)), "table", tab)
			}
		}
	}
}

var bypass4 = []string{"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4"}
var bypass6 = []string{"fc00::/7", "fe80::/10", "ff00::/8"}

func clientRules(s Settings, family string) [][]string {
	if s.Scope == "all" {
		return [][]string{{"iif", "br-lan"}}
	}
	var out [][]string
	for _, v := range s.Clients {
		p, e := netip.ParsePrefix(v)
		a := p.Addr()
		if e != nil {
			a, _ = netip.ParseAddr(v)
		}
		if (family == "-4") == a.Is4() {
			out = append(out, []string{"iif", "br-lan", "from", v})
		}
	}
	return out
}
func guardRules(s Settings, active bool) string {
	var rules strings.Builder
	for _, family := range []string{"-4", "-6"} {
		if !(s.Block || active && family == "-6") {
			continue
		}
		proto := "ip"
		bypasses := bypass4
		if family == "-6" {
			proto = "ip6"
			bypasses = bypass6
		}
		for _, sel := range clientRules(s, family) {
			match := "iifname \"br-lan\" "
			if len(sel) > 2 {
				match += proto + " saddr " + sel[3] + " "
			}
			rules.WriteString(match + proto + " daddr { " + strings.Join(bypasses, ", ") + " } return\n")
			rules.WriteString(match + "meta nfproto " + map[string]string{"-4": "ipv4", "-6": "ipv6"}[family] + " oifname != \"cfwarp\" counter drop\n")
		}
	}
	return rules.String()
}
func bootGuard(s Settings) error {
	path := "/etc/nftables.d/90-chester-cloudflare-guard.nft"
	if !s.WARP || !s.Block {
		e := os.Remove(path)
		if os.IsNotExist(e) {
			return nil
		}
		return e
	}
	text := "# Generated from Chester Cloudflare settings.\nchain chester_cloudflare_guard {\n type filter hook forward priority -5; policy accept;\n" + guardRules(s, false) + "}\n"
	if e := os.WriteFile(path+".new", []byte(text), 0600); e != nil {
		return e
	}
	return os.Rename(path+".new", path)
}
func policy(s Settings, active bool, ipv6 bool, p Profile) error {
	// A separate early filter survives fw4 reloads. Local destinations and Tailscale stay reachable.
	var nft strings.Builder
	nft.WriteString("add table inet chester_cloudflare\nflush table inet chester_cloudflare\ntable inet chester_cloudflare { chain guard { type filter hook forward priority -5; policy accept;\n")
	nft.WriteString(guardRules(s, active))
	nft.WriteString("}\n}\n")
	c := exec.Command("nft", "-f", "-")
	c.Stdin = strings.NewReader(nft.String())
	if b, e := c.CombinedOutput(); e != nil {
		return fmt.Errorf("WARP firewall could not be applied: %s %s", e, b)
	}
	rulesClear()
	for _, family := range []string{"-4", "-6"} {
		bypasses := bypass4
		if family == "-6" {
			bypasses = bypass6
		}
		for _, dest := range bypasses {
			quiet("ip", family, "rule", "add", "priority", "6180", "iif", "br-lan", "to", dest, "lookup", "main")
		}
		for _, a := range p.Addresses {
			prefix, _ := netip.ParsePrefix(a)
			if (family == "-4") == prefix.Addr().Is4() {
				quiet("ip", family, "rule", "add", "priority", "6182", "from", prefix.Addr().String(), "lookup", table)
			}
		}
		if active && (family == "-4" || ipv6) {
			for _, selector := range clientRules(s, family) {
				args := append([]string{family, "rule", "add", "priority", "6181"}, selector...)
				quiet("ip", append(args, "lookup", table)...)
			}
		}
	}

	return nil
}
func firewall(enable bool) error {
	_, exists := run("uci", "-q", "get", "firewall.chester_cfwarp")
	if !enable && exists != nil {
		return nil
	}
	if enable && exists == nil {
		return nil
	}
	if enable {
		for _, kv := range []string{"chester_cfwarp=zone", "chester_cfwarp.name=cfwarp", "chester_cfwarp.device=cfwarp", "chester_cfwarp.input=REJECT", "chester_cfwarp.output=ACCEPT", "chester_cfwarp.forward=REJECT", "chester_cfwarp.masq=1", "chester_cfwarp.masq6=1", "chester_cfwarp.mtu_fix=1", "chester_cfwarp_forward=forwarding", "chester_cfwarp_forward.src=lan", "chester_cfwarp_forward.dest=cfwarp"} {
			if _, e := run("uci", "set", "firewall."+kv); e != nil {
				return e
			}
		}
	} else {
		quiet("uci", "-q", "delete", "firewall.chester_cfwarp")
		quiet("uci", "-q", "delete", "firewall.chester_cfwarp_forward")
	}
	if _, e := run("uci", "commit", "firewall"); e != nil {
		return e
	}
	_, e := run("/etc/init.d/firewall", "reload")
	return e
}
func setup(p Profile) (err error) {
	defer func() {
		if err != nil {
			quiet("ip", "link", "delete", iface)
		}
	}()
	if _, e := run("ip", "link", "show", iface); e == nil {
		return nil
	}
	if _, e := run("ip", "link", "add", iface, "type", "wireguard"); e != nil {
		return e
	}
	os.MkdirAll(runtimeDir, 0700)
	key := runtimeDir + "/private-key"
	if e := os.WriteFile(key, []byte(p.Private+"\n"), 0600); e != nil {
		return e
	}
	defer os.Remove(key)
	if _, e := run("wg", "set", iface, "private-key", key, "fwmark", "0x40000000", "peer", p.Public, "allowed-ips", "0.0.0.0/0,::/0", "endpoint", p.Endpoint, "persistent-keepalive", "25"); e != nil {
		return e
	}
	for _, a := range p.Addresses {
		if _, e := run("ip", "address", "replace", a, "dev", iface); e != nil {
			return e
		}
	}
	if _, e := run("ip", "link", "set", iface, "mtu", "1280", "up"); e != nil {
		return e
	}
	for _, family := range []string{"-4", "-6"} {
		quiet("ip", family, "route", "replace", "default", "dev", iface, "table", table)
	}
	return nil
}
func cleanup() {
	_ = firewall(false)
	rulesClear()
	quiet("nft", "delete", "table", "inet", "chester_cloudflare")
	quiet("ip", "link", "delete", iface)
	for _, f := range []string{"-4", "-6"} {
		quiet("ip", f, "route", "flush", "table", table)
	}
	os.Remove(runtimeDir + "/state.json")
}
func trace(address string) (State, error) {
	s := State{Checked: time.Now().UTC().Format(time.RFC3339)}
	a, e := netip.ParsePrefix(address)
	if e != nil {
		return s, e
	}
	network, target := "tcp4", "1.1.1.1:443"
	if a.Addr().Is6() {
		network, target = "tcp6", "[2606:4700:4700::1111]:443"
	}
	d := net.Dialer{Timeout: 5 * time.Second, LocalAddr: &net.TCPAddr{IP: net.ParseIP(a.Addr().String())}}
	client := &http.Client{Timeout: 9 * time.Second, Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) { return d.DialContext(ctx, network, target) }}}
	res, e := client.Get("https://one.one.one.one/cdn-cgi/trace")
	if e != nil {
		return s, e
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return s, errors.New("WARP trace failed")
	}
	b, _ := io.ReadAll(io.LimitReader(res.Body, 8192))
	for _, line := range strings.Split(string(b), "\n") {
		kv := strings.SplitN(line, "=", 2)
		if len(kv) != 2 {
			continue
		}
		if kv[0] == "warp" {
			s.WARP = kv[1]
		}
		if kv[0] == "ip" {
			s.IP = kv[1]
		}
	}
	s.Ready = s.WARP == "on" || s.WARP == "plus"
	if !s.Ready {
		return s, errors.New("Cloudflare did not confirm WARP")
	}
	return s, nil
}
func daemon() error {
	s := settings()
	if e := validate(s); e != nil {
		return e
	}
	if contains([]string{"cloudflare", "malware", "family"}, s.DNS) {
		go func() {
			if e := proxy(s); e != nil {
				log.Fatal(e)
			}
		}()
	}
	if !s.WARP {
		for {
			time.Sleep(time.Hour)
		}
	}
	p, e := profile()
	if e != nil {
		return e
	}
	if e = firewall(true); e != nil {
		_ = atomic(runtimeDir+"/state.json", State{Error: "WARP firewall could not be started", Checked: time.Now().UTC().Format(time.RFC3339)}, 0600)
		for {
			time.Sleep(time.Hour)
		}
	}
	var previous State
	first := true
	for {
		state := State{}
		if e = setup(p); e == nil {
			if first {
				if err := policy(s, false, false, p); err != nil {
					return err
				}
			}
			state, e = trace(p.Addresses[0])
			if state.Ready {
				for _, address := range p.Addresses {
					prefix, _ := netip.ParsePrefix(address)
					if prefix.Addr().Is6() {
						v6, err := trace(address)
						state.IPv6 = err == nil && v6.Ready
					}
				}
			}
		}
		if e != nil {
			state.Error = "Tunnel connection is unavailable"
			state.Checked = time.Now().UTC().Format(time.RFC3339)
		}
		if first || state.Ready != previous.Ready || state.IPv6 != previous.IPv6 {
			if err := policy(s, state.Ready, state.IPv6, p); err != nil {
				state.Ready = false
				state.Error = "WARP protection rules could not be applied"
			}
		}
		first = false
		previous = state
		_ = atomic(runtimeDir+"/state.json", state, 0600)
		time.Sleep(15 * time.Second)
	}
}
func dnsQuery(server string) bool {
	q := []byte{0x43, 0x46, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 7, 'e', 'x', 'a', 'm', 'p', 'l', 'e', 3, 'c', 'o', 'm', 0, 0, 1, 0, 1}
	conn, e := net.DialTimeout("udp", server, 3*time.Second)
	if e != nil {
		return false
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(10 * time.Second))
	if _, e = conn.Write(q); e != nil {
		return false
	}
	b := make([]byte, 4096)
	n, e := conn.Read(b)
	return e == nil && n >= 12 && b[3]&15 == 0 && binary.BigEndian.Uint16(b[6:8]) > 0
}
func dnsTest(s Settings) map[string]any {
	start := time.Now()
	encrypted := contains([]string{"cloudflare", "malware", "family"}, s.DNS)
	ok := dnsQuery("127.0.0.1:53")
	if encrypted {
		ok = dnsQuery("127.0.0.1:5053") && ok
	}
	out := map[string]any{"success": ok, "latency_ms": time.Since(start).Milliseconds(), "mode": s.DNS, "encrypted": encrypted}
	if !ok {
		out["error"] = "The configured DNS service did not return an answer"
	}
	return out
}

func status() map[string]any {
	s := settings()
	var state State
	_ = readJSON(runtimeDir+"/state.json", &state)
	_, e := os.Stat(dir + "/wgcf-profile.conf")
	running := processRunning()
	checked, _ := time.Parse(time.RFC3339, state.Checked)
	if !running || time.Since(checked) > 50*time.Second {
		state.Ready = false
	}
	return map[string]any{"success": true, "settings": s, "registered": e == nil, "tunnel": state, "running": running}
}
func processRunning() bool { _, e := run("/etc/init.d/chester_cloudflare", "running"); return e == nil }
func resourcesAvailable() error {
	for _, family := range []string{"-4", "-6"} {
		routes, _ := run("ip", family, "route", "show", "table", table)
		for _, line := range strings.Split(routes, "\n") {
			if strings.TrimSpace(line) != "" && !strings.Contains(line, "dev "+iface) {
				return errors.New("WARP routing table is already used by another service")
			}
		}
		text, _ := run("ip", family, "-j", "rule", "show")
		var rules []map[string]any
		_ = json.Unmarshal([]byte(text), &rules)
		for _, r := range rules {
			priority, _ := r["priority"].(float64)
			if priority < 6180 || priority > 6182 {
				continue
			}
			if !ownedRule(r) {
				return errors.New("WARP routing priority is already used by another service")
			}
		}
	}
	return nil
}
func save(s Settings) error {
	if e := validate(s); e != nil {
		return e
	}
	if s.WARP {
		if e := resourcesAvailable(); e != nil {
			return e
		}
		if _, e := profile(); e != nil {
			return e
		}
		output, _ := run("uci", "show", "misectel_interface")
		if strings.Contains(output, "qmodem_passthrough") {
			var section string
			for _, line := range strings.Split(output, "\n") {
				if strings.Contains(line, ".provider='qmodem_passthrough'") {
					section = strings.Split(line, ".provider=")[0]
					enabled, _ := run("uci", "-q", "get", section+".enabled")
					if enabled == "1" {
						return errors.New("Turn off IP Passthrough before enabling WARP")
					}
				}
			}
		}
	}
	old := settings()
	if e := bootGuard(s); e != nil {
		return e
	}
	if _, e := run("/etc/init.d/firewall", "reload"); e != nil {
		_ = bootGuard(old)
		return e
	}
	if e := atomic(dir+"/settings.json", s, 0600); e != nil {
		_ = bootGuard(old)
		quiet("/etc/init.d/firewall", "reload")
		return e
	}
	quiet("/etc/init.d/chester_cloudflare", "stop")
	if _, e := run("/etc/init.d/chester_cloudflare", "enable"); e != nil {
		return e
	}
	if _, e := run("/etc/init.d/chester_cloudflare", "start"); e != nil {
		return e
	}
	time.Sleep(600 * time.Millisecond)
	if e := dnsApply(s); e != nil {
		_ = atomic(dir+"/settings.json", old, 0600)
		_ = bootGuard(old)
		_ = dnsApply(old)
		quiet("/etc/init.d/chester_cloudflare", "restart")
		return e
	}
	return nil
}
func register() error {
	if _, e := os.Stat(dir + "/wgcf-profile.conf"); e == nil {
		return nil
	}
	os.MkdirAll(dir, 0700)
	os.Chmod(dir, 0700)
	for _, args := range [][]string{{"register", "--accept-tos"}, {"generate"}} {
		if args[0] == "register" {
			if _, e := os.Stat(dir + "/wgcf-account.toml"); e == nil {
				continue
			}
		}
		c := exec.Command("/usr/libexec/chester-wgcf", args...)
		c.Dir = dir
		c.Env = append(os.Environ(), "HOME="+dir)
		if _, e := c.Output(); e != nil {
			return errors.New("Cloudflare registration failed. Check internet access and try again")
		}
	}
	for _, f := range []string{"wgcf-account.toml", "wgcf-profile.conf"} {
		os.Chmod(dir+"/"+f, 0600)
	}
	return nil
}
func main() {
	syscall.Umask(0077)
	action := "status"
	if len(os.Args) > 1 {
		action = os.Args[1]
	}
	if action == "daemon" {
		if e := daemon(); e != nil {
			log.Fatal(e)
		}
		return
	}
	if action == "cleanup" {
		cleanup()
		return
	}
	if action != "status" {
		os.MkdirAll(runtimeDir, 0700)
		f, e := os.OpenFile(runtimeDir+"/lock", os.O_CREATE|os.O_RDWR, 0600)
		if e != nil {
			log.Fatal(e)
		}
		defer f.Close()
		if e = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); e != nil {
			json.NewEncoder(os.Stdout).Encode(map[string]any{"success": false, "error": "A Cloudflare operation is already running"})
			return
		}
	}
	var err error
	var out any = map[string]any{"success": true}
	switch action {
	case "status":
		out = status()
	case "save":
		var s Settings
		if len(os.Args) != 3 || len(os.Args[2]) > 8192 {
			err = errors.New("Invalid settings")
		} else if err = json.Unmarshal([]byte(os.Args[2]), &s); err == nil {
			err = save(s)
		}
	case "register":
		if len(os.Args) != 3 || os.Args[2] != "accepted" {
			err = errors.New("Accept Cloudflare application terms before registration")
		} else {
			err = register()
		}
	case "test_dns":
		out = dnsTest(settings())
	case "test_warp":
		var state State
		p, e := profile()
		if e == nil && settings().WARP {
			state, e = trace(p.Addresses[0])
			if state.Ready {
				for _, address := range p.Addresses {
					prefix, _ := netip.ParsePrefix(address)
					if prefix.Addr().Is6() {
						v6, err := trace(address)
						state.IPv6 = err == nil && v6.Ready
					}
				}
			}
		} else if e == nil {
			e = errors.New("Enable and apply WARP before testing")
		}
		if e != nil {
			err = e
		} else {
			out = map[string]any{"success": state.Ready, "tunnel": state}
		}
	default:
		err = errors.New("Unknown operation")
	}
	if err != nil {
		out = map[string]any{"success": false, "error": err.Error()}
	}
	json.NewEncoder(os.Stdout).Encode(out)
}
