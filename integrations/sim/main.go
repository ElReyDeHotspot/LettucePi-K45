// Chester K45P SIM selection. Uses native QModem slot commands, never IMSIs.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var statePath = "/tmp/chester-sim/state.json"
var resultsPath = "/tmp/chester-sim/results.json"
var journalPath = "/tmp/chester-sim/journal.json"
var simLockPath = "/tmp/chester-sim.lock"
var cancelPath = "/tmp/chester-sim/cancel"
var command = systemCommand

type Config struct {
	Mode            string  `json:"mode"`
	Modem           string  `json:"modem"`
	Interface       string  `json:"interface"`
	Preferred       string  `json:"preferred"`
	Criteria        string  `json:"criteria"`
	MinDown         float64 `json:"min_down"`
	MinUp           float64 `json:"min_up"`
	Include1        bool    `json:"include1"`
	Include2        bool    `json:"include2"`
	CompareBoth     bool    `json:"compare_both"`
	OnlyThreshold   bool    `json:"only_threshold"`
	Signal          bool    `json:"signal"`
	RSRP            int     `json:"rsrp"`
	Dwell           int     `json:"dwell"`
	Connection      bool    `json:"connection"`
	Failures        int     `json:"failures"`
	Cooldown        int     `json:"cooldown"`
	MaxSwitches     int     `json:"max_switches"`
	Failback        bool    `json:"failback"`
	FailbackSeconds int     `json:"failback_seconds"`
	AttachSeconds   int     `json:"attach_seconds"`
	APN1            string  `json:"apn1"`
	APN2            string  `json:"apn2"`
}
type Card struct {
	identity  [32]byte
	Slot      string   `json:"slot"`
	Presence  string   `json:"presence"`
	Carrier   string   `json:"carrier"`
	ICCIDEnd  string   `json:"iccid_end,omitempty"`
	Ready     bool     `json:"ready"`
	Connected bool     `json:"connected"`
	IPv4      string   `json:"ipv4,omitempty"`
	RSRP      *int     `json:"rsrp,omitempty"`
	Seen      int64    `json:"seen"`
	Download  *float64 `json:"download,omitempty"`
	Upload    *float64 `json:"upload,omitempty"`
	Latency   *float64 `json:"latency,omitempty"`
	Server    string   `json:"server,omitempty"`
	Tested    int64    `json:"tested,omitempty"`
}
type State struct {
	Operation         string           `json:"operation,omitempty"`
	TestSlot          string           `json:"test_slot,omitempty"`
	Hotplug           string           `json:"hotplug"`
	Running           bool             `json:"running"`
	Busy              bool             `json:"busy"`
	Phase             string           `json:"phase"`
	Message           string           `json:"message"`
	Mode              string           `json:"mode"`
	Active            string           `json:"active"`
	Slots             []string         `json:"slots"`
	Supported         bool             `json:"supported"`
	Cards             map[string]*Card `json:"cards"`
	Events            []string         `json:"events"`
	Updated           int64            `json:"updated"`
	CooldownRemaining int              `json:"cooldown_remaining"`
	Winner            string           `json:"winner,omitempty"`
}
type Request struct {
	Action string `json:"action"`
	Queued bool   `json:"queued,omitempty"`
	Slot   string `json:"slot"`
}
type Entry struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

var state = State{Running: true, Phase: "idle", Cards: map[string]*Card{}, Events: []string{}}
var cfg Config
var root = context.Background()
var weakSince, backoffUntil, lastReturn time.Time
var attempts []time.Time
var failures int
var validName = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$`)

func systemCommand(ctx context.Context, seconds int, name string, args ...string) ([]byte, error) {
	c, cancel := context.WithTimeout(ctx, time.Duration(seconds)*time.Second)
	defer cancel()
	return exec.CommandContext(c, name, args...).Output()
}
func native(method string) (map[string]any, error) {
	return call(root, method, map[string]string{"config_section": cfg.Modem})
}
func call(ctx context.Context, method string, args map[string]string) (map[string]any, error) {
	b, _ := json.Marshal(args)
	out, err := command(ctx, 40, "ubus", "-t", "35", "-S", "call", "qmodem", method, string(b))
	if err != nil {
		return nil, fmt.Errorf("modem %s request failed: %v", method, err)
	}
	var v map[string]any
	if json.Unmarshal(out, &v) != nil {
		return nil, errors.New("invalid modem response")
	}
	if v["error"] != nil {
		return nil, fmt.Errorf("modem %s is unavailable", method)
	}
	return v, nil
}
func str(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}
func entries(method string) map[string]string {
	v, err := native(method)
	out := map[string]string{}
	if err != nil {
		return out
	}
	b, _ := json.Marshal(v["modem_info"])
	var a []Entry
	json.Unmarshal(b, &a)
	for _, e := range a {
		out[strings.ToLower(e.Key)] = str(e.Value)
	}
	return out
}
func active() string {
	v, e := native("get_sim_slot")
	if e != nil {
		return ""
	}
	s := str(v["sim_slot"])
	if s != "1" && s != "2" {
		return ""
	}
	return s
}
func readAT(at string) string {
	port, _ := uciGet("qmodem." + cfg.Modem + ".at_port")
	if !strings.HasPrefix(port, "/dev/") {
		return ""
	}
	params, _ := json.Marshal(map[string]string{"port": port, "at": at, "use_ubus": "1"})
	v, e := call(root, "send_at", map[string]string{"config_section": cfg.Modem, "params": string(params)})
	if e != nil {
		return ""
	}
	a, ok := v["at_cfg"].(map[string]any)
	if !ok {
		return ""
	}
	return str(a["res"])
}
func insertionState(response string) string {
	m := regexp.MustCompile(`\+QSIMSTAT:\s*[01],\s*([012])`).FindStringSubmatch(response)
	if len(m) != 2 {
		return ""
	}
	if m[1] == "0" {
		return "absent"
	}
	if m[1] == "1" {
		return "present"
	}
	return "unknown"
}
func card(slot string) *Card {
	c := state.Cards[slot]
	if c == nil {
		c = &Card{Slot: slot, Presence: "unknown"}
		state.Cards[slot] = c
	}
	return c
}
func iface() (map[string]any, error) {
	b, e := command(root, 8, "ubus", "-S", "call", "network.interface."+cfg.Interface, "status")
	var v map[string]any
	if e == nil {
		e = json.Unmarshal(b, &v)
	}
	return v, e
}
func ping(ctx context.Context) bool {
	v, e := iface()
	if e != nil || v["up"] != true {
		return false
	}
	dev := str(v["l3_device"])
	if dev == "" {
		return false
	}
	c, cancel := context.WithCancel(ctx)
	defer cancel()
	ch := make(chan bool, 2)
	for _, ip := range []string{"1.1.1.1", "8.8.8.8"} {
		go func(ip string) { _, e := command(c, 3, "ping", "-q", "-c1", "-W1", "-I", dev, ip); ch <- e == nil }(ip)
	}
	for range 2 {
		select {
		case ok := <-ch:
			if ok {
				return true
			}
		case <-ctx.Done():
			return false
		}
	}
	return false
}
func snapshot() {
	s := active()
	state.Active = s
	if s == "" {
		return
	}
	c := card(s)
	c.Presence = "unknown"
	sim := entries("sim_info")
	cell := entries("cell_info")
	status := strings.ToLower(sim["sim status"])
	c.Ready = status == "ready"
	c.Connected = false
	// No attach/registration failure is ever translated into physical absence.
	if c.Ready || strings.Contains(status, "pin") || strings.Contains(status, "puk") {
		c.Presence = "present"
	}
	if strings.Contains(status, "not inserted") || status == "absent" || status == "not present" {
		c.Presence = "absent"
	}
	if presence := insertionState(readAT("AT+QSIMSTAT?")); presence != "" {
		c.Presence = presence
		if presence != "present" {
			c.Ready = false
		}
	}
	if sim["isp"] != "" {
		c.Carrier = sim["isp"]
	}
	if id := strings.TrimRight(strings.TrimSpace(sim["iccid"]), "Ff"); regexp.MustCompile(`^[0-9]{16,22}$`).MatchString(id) {
		digest := sha256.Sum256([]byte(id))
		observeIdentity(c, digest)
		c.ICCIDEnd = id[len(id)-4:]
	}
	if c.Presence == "absent" {
		c.Carrier = ""
		c.ICCIDEnd = ""
		// Retain the previous test through temporary absence during switching.
		// A different observed ICCID invalidates it above.
	}
	c.RSRP = nil
	if fields := strings.Fields(cell["rsrp"]); len(fields) > 0 {
		if n, e := strconv.Atoi(fields[0]); e == nil && n >= -160 && n <= -20 {
			c.RSRP = &n
		}
	}
	v, e := iface()
	c.Connected = c.Ready && e == nil && v["up"] == true
	c.IPv4 = ""
	if c.Connected {
		if addresses, ok := v["ipv4-address"].([]any); ok {
			for _, entry := range addresses {
				if item, ok := entry.(map[string]any); ok {
					address := str(item["address"])
					if parsed, e := netip.ParseAddr(address); e == nil && parsed.Is4() {
						c.IPv4 = address
						break
					}
				}
			}
		}
	}
	c.Seen = time.Now().Unix()
}

// Cache only completed measurements and their SIM identity, never live status.
// Like Failover link results, this is runtime data and resets at router reboot.
type savedResult struct {
	Identity [32]byte `json:"identity"`
	Card     Card     `json:"result"`
}

func saveResults() {
	results := map[string]savedResult{}
	for slot, item := range state.Cards {
		if item.Tested > 0 && item.Download != nil && item.Upload != nil && item.identity != ([32]byte{}) {
			results[slot] = savedResult{Identity: item.identity, Card: Card{Download: item.Download, Upload: item.Upload, Latency: item.Latency, Server: item.Server, Tested: item.Tested}}
		}
	}
	data, err := json.Marshal(results)
	if err != nil {
		return
	}
	if os.WriteFile(resultsPath+".tmp", data, 0600) == nil {
		os.Rename(resultsPath+".tmp", resultsPath)
	}
}
func restoreResults() {
	data, err := os.ReadFile(resultsPath)
	if err != nil {
		return
	}
	results := map[string]savedResult{}
	if json.Unmarshal(data, &results) != nil {
		return
	}
	for slot, saved := range results {
		if (slot != "1" && slot != "2") || saved.Identity == ([32]byte{}) || saved.Card.Tested <= 0 || saved.Card.Download == nil || saved.Card.Upload == nil {
			continue
		}
		item := card(slot)
		item.identity = saved.Identity
		item.Download = saved.Card.Download
		item.Upload = saved.Card.Upload
		item.Latency = saved.Card.Latency
		item.Server = saved.Card.Server
		item.Tested = saved.Card.Tested
	}
}
func observeIdentity(item *Card, digest [32]byte) {
	if item.identity != ([32]byte{}) && item.identity != digest {
		item.Download = nil
		item.Upload = nil
		item.Latency = nil
		item.Server = ""
		item.Tested = 0
		item.identity = digest
		saveResults()
	} else {
		item.identity = digest
	}
}
func publish() {
	state.Mode = cfg.Mode
	state.Updated = time.Now().Unix()
	state.CooldownRemaining = 0
	if d := time.Until(backoffUntil); d > 0 && cfg.Mode == "auto_switch" {
		state.CooldownRemaining = int(d.Seconds())
	}
	b, _ := json.Marshal(state)
	os.WriteFile(statePath+".tmp", b, 0600)
	os.Rename(statePath+".tmp", statePath)
}
func phase(p, m string) { state.Phase = p; state.Message = m; publish() }
func event(m string) {
	stamp := time.Now().UTC().Format("15:04:05") + " UTC"
	if b, e := command(context.Background(), 2, "date", "+%T"); e == nil {
		stamp = strings.TrimSpace(string(b))
	}
	state.Events = append(state.Events, stamp+" "+m)
	if len(state.Events) > 20 {
		state.Events = state.Events[len(state.Events)-20:]
	}
	publish()
}
func load() (Config, error) {
	b, e := command(root, 5, "/usr/libexec/chester-sim-config")
	var c Config
	if e == nil {
		e = json.Unmarshal(b, &c)
	}
	if !validName.MatchString(c.Modem) || !validName.MatchString(c.Interface) {
		return c, errors.New("no configurable cellular modem")
	}
	if c.Mode != "manual" && c.Mode != "auto_select" && c.Mode != "auto_switch" {
		return c, errors.New("invalid SIM mode")
	}
	if c.AttachSeconds < 15 || c.AttachSeconds > 180 || c.Dwell < 5 || c.Dwell > 600 || c.Cooldown < 30 || c.Cooldown > 86400 || c.MaxSwitches < 1 || c.MaxSwitches > 12 || c.Failures < 1 || c.Failures > 12 {
		return c, errors.New("invalid SIM timing settings")
	}
	return c, e
}
func capabilities() {
	v, e := native("get_sim_switch_capabilities")
	if e != nil {
		state.Message = "Waiting for the modem's SIM controls"
		return
	}
	if state.Message == "Waiting for the modem's SIM controls" {
		state.Message = ""
	}
	state.Slots = []string{}
	state.Supported = e == nil && str(v["supportSwitch"]) == "1"
	if a, ok := v["simSlots"].([]any); ok {
		for _, x := range a {
			s := str(x)
			if s == "1" || s == "2" {
				state.Slots = append(state.Slots, s)
				card(s)
			}
		}
	}
	state.Supported = state.Supported && len(state.Slots) == 2
	state.Hotplug = "unknown"
	if m := regexp.MustCompile(`\+QSIMDET:\s*([01]),`).FindStringSubmatch(readAT("AT+QSIMDET?")); len(m) == 2 {
		if m[1] == "1" {
			state.Hotplug = "enabled"
		} else {
			state.Hotplug = "disabled"
		}
	}
}
func uciGet(key string) (string, bool) {
	b, e := command(root, 5, "uci", "-q", "get", key)
	return strings.TrimSpace(string(b)), e == nil
}
func setAPN(value string, exists bool) error {
	var e error
	if exists {
		_, e = command(root, 5, "uci", "set", "qmodem."+cfg.Modem+".apn="+value)
	} else {
		command(root, 5, "uci", "-q", "delete", "qmodem."+cfg.Modem+".apn")
	}
	if e != nil {
		return e
	}
	_, e = command(root, 5, "uci", "commit", "qmodem")
	return e
}
func wait(ctx context.Context, d time.Duration) bool {
	select {
	case <-time.After(d):
		return true
	case <-ctx.Done():
		return false
	}
}
func switchTo(ctx context.Context, slot string, apn string, apnExists bool) error {
	phase("switching", "Switching to SIM "+slot)
	current := active()
	previousAPN, previousExists := uciGet("qmodem." + cfg.Modem + ".apn")
	if current == slot && previousAPN == apn && previousExists == apnExists {
		snapshot()
		if card(slot).Ready && ping(ctx) {
			return nil
		}
	}
	if current != slot {
		// Once submitted, finish the native write/readback even if cancellation arrives.
		_, e := call(root, "set_sim_slot", map[string]string{"config_section": cfg.Modem, "slot": slot})
		if e != nil {
			return e
		}
	}
	if active() != slot {
		return errors.New("the modem did not confirm the selected slot")
	}
	if e := setAPN(apn, apnExists); e != nil {
		return errors.New("could not apply this SIM's APN")
	}
	command(root, 35, "/etc/init.d/qmodem_network", "reconfigure", cfg.Modem)
	phase("attaching", "Waiting for SIM "+slot+" to connect")
	previousRoot := root
	attachContext, attachCancel := context.WithTimeout(ctx, time.Duration(cfg.AttachSeconds)*time.Second)
	root = attachContext
	defer func() { root = previousRoot; attachCancel() }()
	deadline := time.Now().Add(time.Duration(cfg.AttachSeconds) * time.Second)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		snapshot()
		publish()
		if state.Active == slot && card(slot).Ready && ping(ctx) {
			card(slot).Connected = true
			publish()
			return nil
		}
		// Slot changes can temporarily report absent while the SIM initializes.
		// Give both the new slot and rollback the full attachment window.
		if !wait(ctx, 2*time.Second) {
			return ctx.Err()
		}
	}
	if card(slot).Presence == "absent" {
		return errors.New("no SIM is detected in slot " + slot + " after waiting for initialization")
	}
	return errors.New("SIM " + slot + " did not attach before the deadline")
}
func apnFor(slot, original string, existed bool) (string, bool) {
	a := cfg.APN1
	if slot == "2" {
		a = cfg.APN2
	}
	if a != "" {
		return a, true
	}
	return original, existed
}
func meets(c *Card) bool {
	if c.Download == nil || c.Upload == nil {
		return false
	}
	return (cfg.Criteria == "UL" || *c.Download >= cfg.MinDown) && (cfg.Criteria == "DL" || *c.Upload >= cfg.MinUp)
}
func score(c *Card) float64 {
	if c.Download == nil || c.Upload == nil {
		return -1
	}
	if cfg.Criteria == "DL" {
		return *c.Download
	}
	if cfg.Criteria == "UL" {
		return *c.Upload
	}
	return *c.Download + *c.Upload
}
func measure(ctx context.Context, slot string) error {
	a, _ := uciGet("failover.main.primary")
	b, _ := uciGet("failover.main.backup")
	role := ""
	if a == cfg.Interface {
		role = "primary"
	} else if b == cfg.Interface {
		role = "secondary"
	}
	if role == "" {
		return errors.New("add this cellular interface to Failover before using speed-based selection")
	}
	phase("testing", "Testing SIM "+slot+" with M-Lab NDT")
	c, stop := context.WithTimeout(ctx, 70*time.Second)
	defer stop()
	cmd := exec.CommandContext(c, "/usr/libexec/chester-link-test", "start", role)
	cmd.Env = append(os.Environ(), "CHESTER_SIM_TEST=1")
	out, e := cmd.Output()
	var result map[string]any
	if e != nil || json.Unmarshal(out, &result) != nil || result["success"] != true {
		return errors.New("another speed test is running or the link test could not start")
	}
	defer command(context.Background(), 5, "/usr/libexec/chester-link-test", "cancel")
	path := "/tmp/chester-link-test/" + role + "/"
	for c.Err() == nil {
		if exists(path+"failed") || exists(path+"cancelled") {
			return errors.New("the speed test failed on SIM " + slot)
		}
		data, _ := os.ReadFile(path + "output.jsonl")
		var summary map[string]any
		for _, line := range strings.Split(string(data), "\n") {
			var v map[string]any
			if json.Unmarshal([]byte(line), &v) != nil {
				continue
			}
			if str(v["Key"]) == "starting" {
				if val, ok := v["Value"].(map[string]any); ok {
					phase("testing_"+str(val["Test"]), "Testing SIM "+slot+" "+str(val["Test"]))
				}
			}
			if v["ServerFQDN"] != nil {
				summary = v
			}
		}
		if exists(path + "done") {
			dl, ok := measurement(summary, "Download")
			ul, ok2 := measurement(summary, "Upload")
			if !ok || !ok2 || active() != slot {
				return errors.New("could not verify per-SIM speed results")
			}
			item := card(slot)
			item.Download = &dl
			item.Upload = &ul
			item.Latency = nil
			if d, ok := summary["Download"].(map[string]any); ok {
				if l, ok := d["Latency"].(map[string]any); ok {
					if n, ok := l["Value"].(float64); ok {
						item.Latency = &n
					}
				}
			}
			item.Server = str(summary["ServerFQDN"])
			item.Tested = time.Now().Unix()
			saveResults()
			publish()
			return nil
		}
		if !wait(c, time.Second) {
			break
		}
	}
	return errors.New("SIM speed test cancelled or timed out")
}
func measurement(v map[string]any, key string) (float64, bool) {
	a, ok := v[key].(map[string]any)
	if !ok {
		return 0, false
	}
	b, ok := a["Throughput"].(map[string]any)
	if !ok {
		return 0, false
	}
	n, ok := b["Value"].(float64)
	return n, ok
}
func exists(path string) bool { _, e := os.Stat(path); return e == nil }

// Manual selection commits the requested slot, independently of data attachment.
func manualSelect(slot, apn string, apnExists bool) {
	state.Busy = true
	state.Operation = "switch"
	state.TestSlot = slot
	defer func() { state.Busy = false; snapshot(); publish() }()
	phase("switching", "Selecting SIM "+slot)
	// Recovery must honor the user's choice, including an offline/empty slot.
	j, _ := json.Marshal(map[string]any{"slot": slot, "apn": apn, "apn_exists": apnExists, "modem": cfg.Modem})
	if e := os.WriteFile(journalPath, j, 0600); e != nil {
		phase("failed", "Could not save the selected SIM context")
		return
	}
	if active() != slot {
		if _, e := call(root, "set_sim_slot", map[string]string{"config_section": cfg.Modem, "slot": slot}); e != nil {
			phase("failed", "The requested SIM could not be selected; retry the operation")
			return
		}
	}
	if active() != slot {
		phase("failed", "The modem did not confirm the selected SIM slot")
		return
	}
	command(root, 5, "uci", "set", "chester_sim.main.preferred="+slot)
	command(root, 5, "uci", "commit", "chester_sim")
	if e := setAPN(apn, apnExists); e != nil {
		phase("failed", "SIM "+slot+" stays selected, but its APN could not be applied")
		return
	}
	_, e := command(root, 35, "/etc/init.d/qmodem_network", "reconfigure", cfg.Modem)
	os.Remove(journalPath)
	if e != nil {
		phase("failed", "SIM "+slot+" stays selected. Data setup needs attention.")
		return
	}
	phase("completed", "SIM "+slot+" selected. It will stay selected even without data.")
	event("Manual selection: SIM " + slot + " retained independently of data connectivity")
}
func runJob(request Request) {
	defer func() { state.Busy = false; publish() }()
	state.Operation = request.Action
	state.TestSlot = request.Slot
	if request.Queued && exists(cancelPath) {
		os.Remove(cancelPath)
		phase("cancelled", "Operation cancelled before starting.")
		return
	}
	if !state.Supported {
		phase("failed", "This modem does not expose two switchable SIM slots")
		return
	}
	if e := os.Mkdir(simLockPath, 0700); e != nil {
		phase("failed", "A SIM operation is already running")
		return
	}
	defer os.RemoveAll(simLockPath)
	if exists("/tmp/chester-link-test.lock") {
		phase("failed", "Wait for the current link test to finish")
		return
	}
	if b, e := os.ReadFile("/tmp/lettucepi-speedtest/pid"); e == nil {
		p := strings.TrimSpace(string(b))
		if regexp.MustCompile(`^[0-9]+$`).MatchString(p) {
			if cmd, e := os.ReadFile("/proc/" + p + "/cmdline"); e == nil && strings.Contains(string(cmd), "lettucepi-speedtest") {
				phase("failed", "Wait for the Ookla test to finish")
				return
			}
		}
	}
	original := active()
	if original == "" {
		phase("failed", "The current physical SIM slot is unknown")
		return
	}
	originalAPN, apnExists := uciGet("qmodem." + cfg.Modem + ".apn")
	if request.Action == "switch" {
		if cfg.Mode != "manual" || (request.Slot != "1" && request.Slot != "2") {
			phase("failed", "Choose Manual and a valid SIM slot")
			return
		}
		a, p := apnFor(request.Slot, originalAPN, apnExists)
		manualSelect(request.Slot, a, p)
		return
	}
	journal := map[string]any{"slot": original, "apn": originalAPN, "apn_exists": apnExists, "modem": cfg.Modem}
	j, _ := json.Marshal(journal)
	os.WriteFile(journalPath, j, 0600)
	state.Busy = true
	state.Operation = request.Action
	state.TestSlot = request.Slot
	publish()
	if !request.Queued {
		os.Remove(cancelPath)
	}
	ctx, cancel := context.WithCancel(root)
	defer cancel()
	done := make(chan struct{})
	defer close(done)
	go func() {
		t := time.NewTicker(250 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-ctx.Done():
				return
			case <-t.C:
				if exists(cancelPath) {
					cancel()
					return
				}
			}
		}
	}()
	winner := ""
	restored := false
	var lastErr error
	if request.Action == "test" {
		if cfg.Mode != "manual" || (request.Slot != "1" && request.Slot != "2") {
			lastErr = errors.New("choose Manual and a valid SIM before testing")
		} else {
			a, p := apnFor(request.Slot, originalAPN, apnExists)
			lastErr = switchTo(ctx, request.Slot, a, p)
			if lastErr == nil {
				lastErr = measure(ctx, request.Slot)
			}
		}
	} else if request.Action == "select" {
		best := -1.0
		for _, slot := range []string{original, other(original)} {
			if (slot == "1" && !cfg.Include1) || (slot == "2" && !cfg.Include2) {
				continue
			}
			a, p := apnFor(slot, originalAPN, apnExists)
			e := switchTo(ctx, slot, a, p)
			if e == nil {
				e = measure(ctx, slot)
			}
			if e != nil {
				lastErr = e
				event("SIM " + slot + ": " + e.Error())
				if ctx.Err() != nil {
					break
				}
				continue
			}
			item := card(slot)
			eligible := !cfg.OnlyThreshold || meets(item)
			if eligible && score(item) > best {
				best = score(item)
				winner = slot
			}
			if !cfg.CompareBoth && meets(item) {
				break
			}
		}
		if winner == "" {
			lastErr = errors.New("no tested SIM met the selection requirements")
		}
	} else if request.Action == "automatic" {
		a, p := apnFor(request.Slot, originalAPN, apnExists)
		lastErr = switchTo(ctx, request.Slot, a, p)
		if lastErr == nil {
			winner = request.Slot
		}
	}
	if ctx.Err() != nil {
		winner = ""
		lastErr = errors.New("selection cancelled")
	}
	if winner != "" {
		a, p := apnFor(winner, originalAPN, apnExists)
		if active() != winner {
			lastErr = switchTo(ctx, winner, a, p)
			if lastErr != nil {
				winner = ""
			}
		}
	}
	if winner == "" {
		phase("restoring", "Restoring the original SIM and APN")
		previousRoot := root
		recovery, recoveryCancel := context.WithTimeout(context.Background(), time.Duration(cfg.AttachSeconds+50)*time.Second)
		root = recovery
		e := switchTo(root, original, originalAPN, apnExists)
		restored = e == nil
		root = previousRoot
		recoveryCancel()
		if e != nil {
			lastErr = fmt.Errorf("%v; original SIM needs attention: %v", lastErr, e)
		}
		if lastErr == nil && request.Action != "test" {
			lastErr = errors.New("SIM selection did not complete")
		}
		if request.Action == "test" && lastErr == nil && restored {
			phase("completed", "SIM "+request.Slot+" speed test completed. Original SIM restored.")
		} else if ctx.Err() != nil && restored {
			phase("cancelled", "Selection cancelled. Original SIM restored.")
		} else {
			phase("failed", lastErr.Error())
		}
		if lastErr != nil {
			event(lastErr.Error())
		} else {
			event("SIM " + request.Slot + " speed test completed; original SIM restored")
		}
	} else {
		state.Winner = winner
		phase("completed", "SIM "+winner+" is connected")
		event("SIM " + winner + " verified and connected")
	}
	if winner != "" || restored {
		os.Remove(journalPath)
	}
	os.Remove(cancelPath)
	state.Busy = false
	snapshot()
	publish()
	weakSince = time.Time{}
	failures = 0
	lastReturn = time.Now()
}
func other(slot string) string {
	if slot == "1" {
		return "2"
	}
	return "1"
}
func autoTick() {
	now := time.Now()
	if now.Before(backoffUntil) {
		phase("backoff", "Waiting before the next automatic SIM attempt")
		return
	}
	if state.Active == "" {
		return
	}
	ok := ping(root)
	if ok {
		failures = 0
	} else {
		failures++
	}
	current := card(state.Active)
	weak := cfg.Signal && current.RSRP != nil && *current.RSRP < cfg.RSRP
	if !weak {
		weakSince = time.Time{}
	} else if weakSince.IsZero() {
		weakSince = now
	}
	reason := ""
	target := other(state.Active)
	if cfg.Connection && failures >= cfg.Failures {
		reason = "cellular internet checks failed"
	}
	if weak && !weakSince.IsZero() && now.Sub(weakSince) >= time.Duration(cfg.Dwell)*time.Second {
		reason = "serving-cell signal stayed below the threshold"
	}
	if cfg.Failback && cfg.Preferred != "" && state.Active != cfg.Preferred && now.Sub(lastReturn) >= time.Duration(cfg.FailbackSeconds)*time.Second {
		reason = "checking the preferred SIM"
		target = cfg.Preferred
	}
	if reason == "" {
		phase("monitoring", "Monitoring cellular connectivity and serving-cell signal")
		return
	}
	recent := attempts[:0]
	for _, t := range attempts {
		if now.Sub(t) < time.Hour {
			recent = append(recent, t)
		}
	}
	attempts = recent
	if len(attempts) >= cfg.MaxSwitches {
		backoffUntil = now.Add(time.Hour)
		phase("backoff", "Hourly SIM-switch limit reached")
		return
	}
	attempts = append(attempts, now)
	event("Automatic switch: " + reason)
	runJob(Request{Action: "automatic", Slot: target})
	backoffUntil = time.Now().Add(time.Duration(cfg.Cooldown) * time.Second)
}
func main() {
	if len(os.Args) == 2 && os.Args[1] == "probe" {
		var e error
		cfg, e = load()
		if e != nil {
			fmt.Println(e)
			os.Exit(1)
		}
		v, e := native("get_sim_switch_capabilities")
		b, _ := json.Marshal(v)
		fmt.Println(string(b), e)
		return
	}
	if len(os.Args) != 2 || os.Args[1] != "daemon" {
		fmt.Fprintln(os.Stderr, "usage: chester-simd daemon")
		os.Exit(2)
	}
	if e := os.Mkdir("/tmp/chester-sim", 0700); e != nil && !os.IsExist(e) {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	dir, e := os.Lstat("/tmp/chester-sim")
	if e != nil || !dir.IsDir() || dir.Mode().Perm()&0077 != 0 || dir.Sys().(*syscall.Stat_t).Uid != 0 {
		fmt.Fprintln(os.Stderr, "SIM runtime directory is not private and root-owned")
		os.Exit(1)
	}
	f, e := os.OpenFile("/tmp/chester-sim/daemon.pid", os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		os.Exit(1)
	}
	if syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		os.Exit(1)
	}
	f.Truncate(0)
	fmt.Fprint(f, os.Getpid())
	defer f.Close()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	root = ctx
	cfg, e = load()
	if e != nil {
		phase("failed", e.Error())
		os.Exit(1)
	}
	restoreResults()
	capabilities()
	snapshot()
	publish()
	lastReturn = time.Now()
	first := !exists("/tmp/chester-sim/boot-seen")
	startupPending := first && cfg.Mode == "auto_select"
	startupDeadline := time.Now().Add(180 * time.Second)
	if !startupPending {
		os.WriteFile("/tmp/chester-sim/boot-seen", []byte("1"), 0600)
	}
	if exists(journalPath) {
		var j struct {
			Slot, APN, Modem string
			APNExists        bool `json:"apn_exists"`
		}
		b, _ := os.ReadFile(journalPath)
		json.Unmarshal(b, &j)
		if j.Modem == cfg.Modem && (j.Slot == "1" || j.Slot == "2") {
			event("Recovering an interrupted SIM operation")
			state.Busy = true
			phase("restoring", "Recovering the original SIM and APN")
			if active() != j.Slot {
				if _, e := call(root, "set_sim_slot", map[string]string{"config_section": cfg.Modem, "slot": j.Slot}); e != nil {
					phase("failed", "Recovery is waiting for modem control")
					os.Exit(1)
				}
			}
			if active() != j.Slot {
				phase("failed", "The original SIM slot could not be verified")
				os.Exit(1)
			}
			old, oldExists := uciGet("qmodem." + cfg.Modem + ".apn")
			if old != j.APN || oldExists != j.APNExists {
				if setAPN(j.APN, j.APNExists) != nil {
					phase("failed", "The original APN could not be restored")
					os.Exit(1)
				}
				command(root, 35, "/etc/init.d/qmodem_network", "reconfigure", cfg.Modem)
			}
			state.Busy = false
			snapshot()
			phase("idle", "Original SIM context restored")
		} else {
			phase("failed", "Interrupted SIM context does not match the selected modem")
			os.Exit(1)
		}
		os.Remove(journalPath)
		os.RemoveAll(simLockPath)
	}
	nextStatus := time.Now()
	for ctx.Err() == nil {
		fresh, e := load()
		if e == nil {
			if cfg.Modem != fresh.Modem {
				cfg = fresh
				capabilities()
				state.Cards = map[string]*Card{}
			} else {
				cfg = fresh
			}
		}
		if b, e := os.ReadFile("/tmp/chester-sim/request.json"); e == nil {
			var r Request
			if json.Unmarshal(b, &r) == nil {
				// Publish ownership before deleting the pending request. RPC
				// callers must never see a gap in which another click can win.
				state.Busy = true
				state.Operation = r.Action
				state.TestSlot = r.Slot
				publish()
				os.Remove("/tmp/chester-sim/request.json")
				if r.Action == "refresh" {
					snapshot()
					state.Busy = false
					publish()
				} else if r.Action == "switch" || r.Action == "select" || r.Action == "test" {
					runJob(r)
				}
			}
		}
		if time.Now().After(nextStatus) {
			if !state.Supported {
				capabilities()
			}
			snapshot()
			publish()
			if startupPending {
				if cfg.Mode != "auto_select" {
					startupPending = false
					os.WriteFile("/tmp/chester-sim/boot-seen", []byte("1"), 0600)
				} else if state.Supported && state.Active != "" {
					startupPending = false
					os.WriteFile("/tmp/chester-sim/boot-seen", []byte("1"), 0600)
					runJob(Request{Action: "select"})
				} else if time.Now().After(startupDeadline) {
					startupPending = false
					os.WriteFile("/tmp/chester-sim/boot-seen", []byte("1"), 0600)
					phase("failed", "The modem was not ready for startup SIM selection")
				} else {
					phase("waiting_modem", "Waiting for the modem before startup SIM selection")
				}
			}
			nextStatus = time.Now().Add(10 * time.Second)
			if cfg.Mode == "auto_switch" && state.Supported {
				autoTick()
			} else if state.Phase == "monitoring" || state.Phase == "backoff" {
				phase("idle", "Manual SIM selection is ready")
			}
		}
		if !wait(ctx, 2*time.Second) {
			break
		}
	}
	state.Running = false
	publish()
}
