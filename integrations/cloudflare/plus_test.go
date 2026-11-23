package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testLicense = "AAAAAAAA-BBBBBBBB-CCCCCCCC"

func fakeWGCF(t *testing.T, accountType string, fail bool) accountRunner {
	return func(directory string, args ...string) ([]byte, error) {
		t.Helper()
		for _, arg := range args {
			if strings.Contains(arg, testLicense) {
				t.Fatal("license exposed in process arguments")
			}
		}
		switch args[0] {
		case "register":
			return nil, os.WriteFile(filepath.Join(directory, "wgcf-account.toml"), []byte("private_key = \"test-private\"\nlicense_key = \"original-free\"\n"), 0600)
		case "update":
			if fail {
				return nil, errors.New("provider failure with private detail")
			}
			data, e := os.ReadFile(filepath.Join(directory, "wgcf-account.toml"))
			if e != nil || !strings.Contains(string(data), testLicense) {
				t.Fatal("private account did not receive license")
			}
			return []byte("Account type : " + accountType + "\n"), nil
		case "generate":
			return nil, os.WriteFile(filepath.Join(directory, "wgcf-profile.conf"), []byte("[Interface]\nPrivateKey = test-private\nAddress = 172.16.0.2/32\n[Peer]\nPublicKey = test-public\nEndpoint = 162.159.192.1:2408\n"), 0600)
		}
		t.Fatal("unexpected command", args)
		return nil, nil
	}
}
func TestPremiumAccount(t *testing.T) {
	if !premiumAccount([]byte("Account type : unlimited\n")) {
		t.Fatal("missed paid subscription")
	}
	if premiumAccount([]byte("Account type : free\n")) {
		t.Fatal("free account mislabeled as premium")
	}
}
func TestPremiumJSON(t *testing.T) {
	for _, text := range []string{`{"account_type":"unlimited","warp_plus":true}`, `{"account_type":"limited","warp_plus":true,"quota":1000000}`} {
		if !premiumAccount([]byte(text)) {
			t.Fatal("authoritative premium flag ignored")
		}
	}
	for _, text := range []string{`{"account_type":"free","warp_plus":false}`, `{"account_type":"free","warp_plus":true,"quota":0}`, `{"account_type":"unlimited","warp_plus":true,"license_matches":false}`, `{"account_type":"unlimited","warp_plus":true,"plus_expires_at":"2000-01-01T00:00:00Z"}`, `{"warp_plus":"true"}`} {
		if premiumAccount([]byte(text)) {
			t.Fatal("unverified or expired subscription accepted")
		}
	}
}
func TestSubscriptionErrorPrivacy(t *testing.T) {
	err := subscriptionError([]byte(`HTTP 400 {"message":"Invalid license AAAAAAAA-BBBBBBBB-CCCCCCCC"}`))
	if strings.Contains(err.Error(), testLicense) || !strings.Contains(err.Error(), "HTTP 400") {
		t.Fatal("provider error was not safely redacted")
	}
}
func TestPendingRetryReusesRegistration(t *testing.T) {
	base := t.TempDir()
	pending := filepath.Join(base, "plus-pending")
	os.Mkdir(pending, 0700)
	os.WriteFile(filepath.Join(pending, "wgcf-account.toml"), []byte("private_key = 'existing'\nlicense_key = '"+testLicense+"'\n"), 0600)
	fake := fakeWGCF(t, "Unlimited", false)
	runner := func(directory string, args ...string) ([]byte, error) {
		if args[0] == "register" {
			t.Fatal("retry created another device registration")
		}
		return fake(directory, args...)
	}
	if e := linkPlusAt(base, linkRequest{Accepted: "1"}, runner); e != nil {
		t.Fatal(e)
	}
	if _, e := os.Stat(pending); !os.IsNotExist(e) {
		t.Fatal("pending credentials were not retired after confirmation")
	}
}
func TestReplacementKeyReusesPendingRegistration(t *testing.T) {
	base := t.TempDir()
	pending := filepath.Join(base, "plus-pending")
	os.Mkdir(pending, 0700)
	os.WriteFile(filepath.Join(pending, "wgcf-account.toml"), []byte("private_key = 'existing'\nlicense_key = 'ZZZZZZZZ-YYYYYYYY-XXXXXXXX'\n"), 0600)
	fake := fakeWGCF(t, "Unlimited", false)
	runner := func(directory string, args ...string) ([]byte, error) {
		if args[0] == "register" {
			t.Fatal("replacement key created another device")
		}
		return fake(directory, args...)
	}
	if e := linkPlusAt(base, linkRequest{License: testLicense, Accepted: "1"}, runner); e != nil {
		t.Fatal(e)
	}
}
func TestPlusLinkPreservesFree(t *testing.T) {
	base := t.TempDir()
	free := []byte("existing free registration")
	os.WriteFile(filepath.Join(base, "wgcf-account.toml"), free, 0600)
	e := linkPlusAt(base, linkRequest{License: testLicense, Accepted: "1"}, fakeWGCF(t, "Unlimited", false))
	if e != nil {
		t.Fatal(e)
	}
	got, _ := os.ReadFile(filepath.Join(base, "wgcf-account.toml"))
	if string(got) != string(free) {
		t.Fatal("free registration changed")
	}
	for _, file := range []string{"wgcf-account.toml", "wgcf-profile.conf", "entitlement.json"} {
		info, e := os.Stat(filepath.Join(base, "plus", file))
		if e != nil || info.Mode().Perm() != 0600 {
			t.Fatal("private file protection", file, e)
		}
	}
	ent, _ := os.ReadFile(filepath.Join(base, "plus", "entitlement.json"))
	if strings.Contains(string(ent), testLicense) {
		t.Fatal("license leaked into status metadata")
	}
}
func TestPlusLinkRejectsAndPreservesPrior(t *testing.T) {
	for _, scenario := range []struct {
		kind string
		fail bool
	}{{"Free", false}, {"Unlimited", true}} {
		base := t.TempDir()
		os.Mkdir(filepath.Join(base, "plus"), 0700)
		prior := []byte("old profile")
		os.WriteFile(filepath.Join(base, "plus", "wgcf-profile.conf"), prior, 0600)
		e := linkPlusAt(base, linkRequest{License: testLicense, Accepted: "1"}, fakeWGCF(t, scenario.kind, scenario.fail))
		if e == nil {
			t.Fatal("unverified subscription was accepted")
		}
		if strings.Contains(e.Error(), testLicense) || strings.Contains(e.Error(), "private detail") {
			t.Fatal("provider data exposed")
		}
		got, _ := os.ReadFile(filepath.Join(base, "plus", "wgcf-profile.conf"))
		if string(got) != string(prior) {
			t.Fatal("previous profile overwritten")
		}
		left, _ := filepath.Glob(filepath.Join(base, ".plus-link-*"))
		if len(left) > 0 {
			t.Fatal("private staging files left behind")
		}
	}
}
func TestPlusConsentAndValidation(t *testing.T) {
	for _, r := range []linkRequest{{License: testLicense}, {License: "bad-key", Accepted: "1"}, {License: testLicense + "\nreboot", Accepted: "1"}} {
		called := false
		e := linkPlusAt(t.TempDir(), r, func(string, ...string) ([]byte, error) { called = true; return nil, nil })
		if e == nil || called {
			t.Fatal("invalid request reached Cloudflare", r.Accepted)
		}
	}
}
