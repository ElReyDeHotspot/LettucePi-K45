package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var licensePattern = regexp.MustCompile(`^[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-[A-Za-z0-9]{8}$`)
var licenseLine = regexp.MustCompile(`(?m)^license_key\s*=.*$`)
var accountTypeLine = regexp.MustCompile(`(?mi)^Account type\s*:\s*([a-z]+)\s*$`)
var providerMessage = regexp.MustCompile(`(?i)"message"\s*:\s*"([^"\n]{1,240})"`)
var providerHTTP = regexp.MustCompile(`\b(400|401|403|404|409|429|500|502|503)\b`)
var privateToken = regexp.MustCompile(`[A-Za-z0-9_+/=-]{32,}`)

type Entitlement struct {
	Type     string `json:"type"`
	Verified string `json:"verified"`
}
type CloudflareAccount struct {
	Type    string `json:"account_type"`
	Plus    bool   `json:"warp_plus"`
	Expires string `json:"plus_expires_at,omitempty"`
	Quota   int64  `json:"quota,omitempty"`
	Matches *bool  `json:"license_matches,omitempty"`
}

func activePremium(a CloudflareAccount) bool {
	if a.Matches != nil && !*a.Matches {
		return false
	}
	currentExpiry := false
	if a.Expires != "" {
		expires, e := time.Parse(time.RFC3339, a.Expires)
		if e != nil || !expires.After(time.Now()) {
			return false
		}
		currentExpiry = true
	}
	return strings.EqualFold(a.Type, "unlimited") || (a.Plus && (currentExpiry || (strings.EqualFold(a.Type, "limited") && a.Quota > 0)))
}

type linkRequest struct {
	License  string `json:"license"`
	Accepted string `json:"accepted"`
}
type accountRunner func(string, ...string) ([]byte, error)

func runWGCF(directory string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/libexec/chester-wgcf", args...)
	cmd.Dir = directory
	// Account output stays in memory: it contains account/device identifiers.
	cmd.Env = append(os.Environ(), "CHESTER_WARP_JSON=1")
	var output, details bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &details
	err := cmd.Run()
	if err != nil {
		return append(output.Bytes(), details.Bytes()...), err
	}
	return output.Bytes(), nil
}
func accountValue(data []byte, key string) string {
	expression := `(?m)^` + regexp.QuoteMeta(key) + `\s*=\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)')\s*$`
	match := regexp.MustCompile(expression).FindSubmatch(data)
	if len(match) > 2 {
		if len(match[1]) > 0 {
			return string(match[1])
		}
		return string(match[2])
	}
	return ""
}

func premiumAccount(output []byte) bool {
	var account CloudflareAccount
	if json.Unmarshal(output, &account) == nil {
		return activePremium(account)
	}
	m := accountTypeLine.FindSubmatch(output)
	return len(m) == 2 && strings.EqualFold(string(m[1]), "unlimited")
}
func subscriptionError(output []byte) error {
	text := string(output)
	message := "Check the license key, subscription and available device slots"
	if match := providerMessage.FindStringSubmatch(text); len(match) == 2 {
		message = licensePattern.ReplaceAllString(match[1], "[private key]")
		message = regexp.MustCompile(`[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-[A-Za-z0-9]{8}`).ReplaceAllString(message, "[private key]")
		message = privateToken.ReplaceAllString(message, "[private identifier]")
	}
	if code := providerHTTP.FindString(text); code != "" {
		message += " (HTTP " + code + ")"
	}
	return errors.New("Cloudflare could not link WARP+: " + message)
}
func replaceLicense(account []byte, license string) ([]byte, error) {
	if !licensePattern.MatchString(license) {
		return nil, errors.New("Enter the WARP+ license key from the 1.1.1.1 app")
	}
	if !licenseLine.Match(account) {
		return nil, errors.New("The WARP account file is incomplete")
	}
	return licenseLine.ReplaceAll(account, []byte(`license_key = "`+license+`"`)), nil
}
func linkPlusAt(base string, request linkRequest, runner accountRunner) error {
	request.License = strings.TrimSpace(request.License)
	if request.Accepted != "1" {
		return errors.New("Accept Cloudflare application terms before linking WARP+")
	}
	if request.License == "" {
		if pending, e := os.ReadFile(filepath.Join(base, "plus-pending", "wgcf-account.toml")); e == nil {
			request.License = accountValue(pending, "license_key")
		}
	}
	if !licensePattern.MatchString(request.License) {
		return errors.New("Enter the WARP+ license key from the 1.1.1.1 app")
	}
	if e := os.MkdirAll(base, 0700); e != nil {
		return errors.New("Could not prepare private WARP storage")
	}
	stage, e := os.MkdirTemp(base, ".plus-link-")
	if e != nil {
		return errors.New("Could not prepare private WARP storage")
	}
	defer os.RemoveAll(stage)
	target := filepath.Join(base, "plus")
	// Reuse the existing registration only when linking the same license again.
	old, e := os.ReadFile(filepath.Join(target, "wgcf-account.toml"))
	reuse := e == nil && accountValue(old, "license_key") == request.License
	if !reuse {
		old, e = os.ReadFile(filepath.Join(base, "plus-pending", "wgcf-account.toml"))
		// A pending identity has never been activated by Chester. Reuse it
		// even for a replacement key instead of registering another device.
		reuse = e == nil
	}
	if reuse {
		e = os.WriteFile(filepath.Join(stage, "wgcf-account.toml"), old, 0600)
	} else {
		_, e = runner(stage, "register", "--accept-tos")
	}
	if e != nil {
		return errors.New("Cloudflare could not register this router. Check internet access and retry")
	}
	account, e := os.ReadFile(filepath.Join(stage, "wgcf-account.toml"))
	if e != nil {
		return errors.New("Cloudflare did not create a usable account")
	}
	account, e = replaceLicense(account, request.License)
	if e != nil {
		return e
	}
	if e = os.WriteFile(filepath.Join(stage, "wgcf-account.toml"), account, 0600); e != nil {
		return errors.New("Could not save the private WARP account")
	}
	output, e := runner(stage, "update")
	if e != nil {
		pending := filepath.Join(base, "plus-pending")
		_ = os.RemoveAll(pending)
		_ = os.Rename(stage, pending)
		return subscriptionError(output)
	}
	if !premiumAccount(output) {
		var account CloudflareAccount
		_ = json.Unmarshal(output, &account)
		kind := "unverified"
		if contains([]string{"free", "limited", "unlimited", "plus", "team"}, strings.ToLower(account.Type)) {
			kind = strings.ToLower(account.Type)
		}
		pending := filepath.Join(base, "plus-pending")
		_ = os.RemoveAll(pending)
		if e = os.Rename(stage, pending); e == nil {
			_ = atomic(filepath.Join(pending, "verification.json"), map[string]any{"account_type": kind, "warp_plus": account.Plus, "checked": time.Now().UTC().Format(time.RFC3339)}, 0600)
		}
		return errors.New("Cloudflare reports " + kind + " entitlement for this registration; WARP+ is not active. The previous connection was kept")
	}
	if _, e = runner(stage, "generate"); e != nil {
		return errors.New("The subscription linked, but its tunnel profile could not be generated. Retry linking")
	}
	if _, e = readProfile(filepath.Join(stage, "wgcf-profile.conf")); e != nil {
		return errors.New("Cloudflare returned an incomplete tunnel profile")
	}
	for _, name := range []string{"wgcf-account.toml", "wgcf-profile.conf"} {
		if e = os.Chmod(filepath.Join(stage, name), 0600); e != nil {
			return errors.New("Could not protect the private WARP files")
		}
	}
	if e = atomic(filepath.Join(stage, "entitlement.json"), Entitlement{Type: "WARP+", Verified: time.Now().UTC().Format(time.RFC3339)}, 0600); e != nil {
		return errors.New("Could not save subscription confirmation")
	}
	previous := filepath.Join(base, ".plus-previous")
	if _, e = os.Stat(previous); e == nil {
		return errors.New("A previous WARP+ recovery folder needs review before replacing the registration")
	}
	hadPrevious := false
	if _, e = os.Stat(target); e == nil {
		if e = os.Rename(target, previous); e != nil {
			return errors.New("Could not prepare the current registration for replacement")
		}
		hadPrevious = true
	}
	if e = os.Rename(stage, target); e != nil {
		if hadPrevious {
			_ = os.Rename(previous, target)
		}
		return errors.New("Could not activate the new registration")
	}
	if hadPrevious {
		_ = os.RemoveAll(previous)
	}
	_ = os.RemoveAll(filepath.Join(base, "plus-pending"))
	return nil
}
func linkPlus(reader io.Reader) error {
	var request linkRequest
	data, e := io.ReadAll(io.LimitReader(reader, 1025))
	if e != nil || len(data) > 1024 {
		return errors.New("Invalid subscription request")
	}
	if e = json.Unmarshal(data, &request); e != nil {
		return errors.New("Invalid subscription request")
	}
	return linkPlusAt(dir, request, runWGCF)
}
func planProfile(tier string) string {
	if tier == "plus" {
		return dir + "/plus/wgcf-profile.conf"
	}
	return dir + "/wgcf-profile.conf"
}
func plusRegistered() bool {
	var entitlement Entitlement
	if readJSON(dir+"/plus/entitlement.json", &entitlement) != nil || (entitlement.Type != "Unlimited" && entitlement.Type != "WARP+") {
		return false
	}
	_, e := os.Stat(planProfile("plus"))
	return e == nil
}
func plusPending() bool { _, e := os.Stat(dir + "/plus-pending/wgcf-account.toml"); return e == nil }
