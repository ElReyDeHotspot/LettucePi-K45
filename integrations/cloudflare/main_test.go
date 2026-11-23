package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSettingsValidation(t *testing.T) {
	valid := Settings{DNS: "manual", Scope: "all", IPv4: []string{"1.1.1.1"}, IPv6: []string{"2606:4700:4700::1111"}}
	if e := validate(valid); e != nil {
		t.Fatal(e)
	}
	for _, bad := range []string{"1.1.1.1;reboot", "1.1.1.1#53", "0.0.0.0", "127.0.0.1", "224.0.0.1", "1.2.3.999"} {
		s := valid
		s.IPv4 = []string{bad}
		if validate(s) == nil {
			t.Fatalf("accepted invalid IPv4 %s", bad)
		}
	}
	for _, bad := range []string{"fe80::1%wan", "::", "::1", "ff02::1", "2606:::1", "::ffff:1.1.1.1"} {
		s := valid
		s.IPv6 = []string{bad}
		if validate(s) == nil {
			t.Fatalf("accepted invalid IPv6 %s", bad)
		}
	}
	s := valid
	s.IPv4 = nil
	s.IPv6 = nil
	if validate(s) == nil {
		t.Fatal("accepted empty manual DNS")
	}
	s = valid
	s.WARP = true
	s.Scope = "selected"
	if validate(s) == nil {
		t.Fatal("accepted empty device selection")
	}
	s.Clients = []string{"192.168.100.50", "2001:db8::/64"}
	if e := validate(s); e != nil {
		t.Fatal(e)
	}
	for _, bad := range []string{"0.0.0.0/0", "192.168.1.1;reboot", "::/0", "ff00::/8"} {
		s.Clients = []string{bad}
		if validate(s) == nil {
			t.Fatalf("accepted bad device %s", bad)
		}
	}
}
func TestDNSHTTPS(t *testing.T) {
	q := []byte{0x43, 0x46, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.Header.Get("Content-Type") != "application/dns-message" {
			t.Error("incorrect DNS transport")
		}
		b, _ := io.ReadAll(r.Body)
		b[0] = 0
		b[1] = 0
		b[2] |= 0x80
		w.Write(b)
	}))
	defer server.Close()
	b, e := doh(server.Client(), server.URL, q)
	if e != nil || b[0] != q[0] || b[1] != q[1] {
		t.Fatal("DNS request ID not preserved", e)
	}
	if _, e = doh(http.DefaultClient, server.URL, q); e == nil {
		t.Fatal("untrusted TLS certificate was accepted")
	}
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer bad.Close()
	if _, e = doh(bad.Client(), bad.URL, q); e == nil {
		t.Fatal("HTTP error was accepted")
	}
}
func TestDeviceFamilySelection(t *testing.T) {
	s := Settings{Scope: "selected", Clients: []string{"192.168.100.50", "2001:db8::/64"}}
	v4 := clientRules(s, "-4")
	v6 := clientRules(s, "-6")
	if len(v4) != 1 || len(v6) != 1 || strings.Join(v4[0], " ") != "iif br-lan from 192.168.100.50" || strings.Join(v6[0], " ") != "iif br-lan from 2001:db8::/64" {
		t.Fatal(v4, v6)
	}
}

func TestOwnedRules(t *testing.T) {
	if !ownedRule(map[string]any{"priority": float64(6180), "table": "main", "iif": "br-lan", "dst": "192.168.0.0", "dstlen": float64(16)}) {
		t.Fatal("cannot retire own bypass rule")
	}
	for _, rule := range []map[string]any{{"priority": float64(5270), "table": "52"}, {"priority": float64(22220), "table": "222"}, {"priority": float64(6180), "table": "main", "iif": "br-lan", "dst": "8.8.8.8", "dstlen": float64(32)}} {
		if ownedRule(rule) {
			t.Fatal("claimed another service's policy rule", rule)
		}
	}
}
func TestKillSwitchScope(t *testing.T) {
	s := Settings{Scope: "selected", Clients: []string{"192.168.100.50", "2001:db8::/64"}, Block: true}
	rules := guardRules(s, false)
	if !strings.Contains(rules, "ip saddr 192.168.100.50") || !strings.Contains(rules, "ip6 saddr 2001:db8::/64") || !strings.Contains(rules, "oifname != \"cfwarp\" counter drop") {
		t.Fatal("missing scoped kill switch", rules)
	}
	s.Block = false
	if guardRules(s, false) != "" {
		t.Fatal("fallback mode blocks direct traffic")
	}
	if strings.Contains(guardRules(s, true), "meta nfproto ipv4") {
		t.Fatal("fallback IPv4 protection should follow routing only")
	}
}
