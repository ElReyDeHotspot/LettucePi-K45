package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestScanPausesAllSIMATPathsAndPreservesSnapshot(t *testing.T) {
	oldScan, oldCommand, oldState := scanRunning, command, state
	t.Cleanup(func() { scanRunning, command, state = oldScan, oldCommand, oldState })
	scanRunning = func() bool { return true }
	command = func(context.Context, int, string, ...string) ([]byte, error) {
		t.Fatal("SIM polling reached modem during scan")
		return nil, nil
	}
	state = State{Active: "1", Cards: map[string]*Card{"1": {Slot: "1", Presence: "present", Ready: true, Seen: 123}}}
	before, _ := json.Marshal(state)
	if readAT("core") != "" {
		t.Fatal("read during scan")
	}
	snapshot()
	capabilities()
	autoTick()
	after, _ := json.Marshal(state)
	if string(before) != string(after) {
		t.Fatal("scan changed the last confirmed SIM snapshot")
	}
}

func TestLivePresenceClearsStaleConnectionAndHandlesATFallback(t *testing.T) {
	oldCmd, oldState, oldCfg := command, state, cfg
	oldPath, oldResults := statePath, resultsPath
	oldPort, oldModem := statusATPort, statusATModem
	t.Cleanup(func() {
		command, state, cfg = oldCmd, oldState, oldCfg
		statePath, resultsPath = oldPath, oldResults
		statusATPort, statusATModem = oldPort, oldModem
	})
	dir := t.TempDir()
	statePath = filepath.Join(dir, "state")
	resultsPath = filepath.Join(dir, "results")
	cfg = Config{Modem: "test", Interface: "pcie0"}
	state = State{Cards: map[string]*Card{}}
	statusATPort = ""
	statusATModem = ""
	present, known := true, true
	primaryAttempts := 0
	command = func(ctx context.Context, secs int, name string, args ...string) ([]byte, error) {
		if name == "uci" {
			if strings.HasSuffix(args[2], ".at_port") {
				return []byte("/dev/mhi_DUN"), nil
			}
			if strings.HasSuffix(args[2], ".valid_at_ports") {
				return []byte("/dev/mhi_DUN /dev/ttyUSB2"), nil
			}
			return nil, nil
		}
		if name == "/usr/libexec/chester-sim-status-at" {
			if args[0] == "/dev/mhi_DUN" {
				primaryAttempts++
				return nil, nil
			}
			if !known {
				return nil, nil
			}
			switch args[1] {
			case "core":
				if present {
					return []byte("+QUIMSLOT: 1\r\nOK\r\n+QSIMSTAT: 1,1\r\nOK\r\n+CPIN: READY\r\nOK"), nil
				}
				return []byte("+QUIMSLOT: 1\r\nOK\r\n+QSIMSTAT: 1,0\r\nOK\r\n+CME ERROR: 10"), nil
			case "AT+QUIMSLOT?":
				return []byte("+QUIMSLOT: 1\r\nOK"), nil
			case "AT+QSIMSTAT?":
				if present {
					return []byte("+QSIMSTAT: 1,1\r\nOK"), nil
				}
				return []byte("+QSIMSTAT: 1,0\r\nOK"), nil
			case "AT+CPIN?":
				if present {
					return []byte("+CPIN: READY\r\nOK"), nil
				}
				return []byte("+CME ERROR: 10"), nil
			case "AT+COPS?":
				return []byte("+COPS: 0,0,\"T-Mobile\",11\r\nOK"), nil
			case "AT+QCCID":
				return []byte("+QCCID: 1234567890123456\r\nOK"), nil
			case `AT+QENG="servingcell"`:
				return []byte("+QENG: \"NR5G-NSA\",310,260,120,-100,6,-11,507870,41,7,1\r\nOK"), nil
			}
		}
		if name == "ubus" {
			if strings.Contains(strings.Join(args, " "), "sim_info") || strings.Contains(strings.Join(args, " "), "cell_info") {
				t.Fatal("cached modem metadata must not determine live SIM status")
			}
			if strings.Contains(strings.Join(args, " "), "network.interface.") {
				return []byte(`{"up":true,"ipv4-address":[{"address":"192.0.2.3"}]}`), nil
			}
			return []byte(`{}`), nil
		}
		return nil, nil
	}
	snapshot()
	item := card("1")
	if !item.Ready || !item.Connected || item.IPv4 != "192.0.2.3" || item.RSRP == nil || *item.RSRP != -100 {
		t.Fatalf("live card not ready: %+v", item)
	}
	if statusATPort != "/dev/ttyUSB2" || primaryAttempts != 1 {
		t.Fatal("working AT fallback not reused")
	}
	item.Tested = 123
	present = false
	snapshot()
	if item.Ready || item.Connected || item.IPv4 != "" || item.Presence != "absent" || item.Tested != 123 {
		t.Fatal("removed card retained live connectivity or lost last test")
	}
	present = true
	snapshot()
	if !item.Ready || !item.Connected {
		t.Fatal("reinsertion did not recover")
	}
	known = false
	snapshot()
	if !item.Ready || state.Active != "1" {
		t.Fatal("transient AT contention flipped confirmed status")
	}
	item.Seen = time.Now().Unix() - 15
	snapshot()
	if state.Active != "" || item.Ready || item.Connected || item.IPv4 != "" {
		t.Fatal("unknown selected slot retained green connected card")
	}
}
func TestHotplugBootInitializationIsIdempotentAndCannotRebootLoop(t *testing.T) {
	oldCmd, oldState, oldCfg := command, state, cfg
	oldPath, oldPending := statePath, hotplugPendingPath
	oldPort, oldModem := statusATPort, statusATModem
	t.Cleanup(func() {
		command, state, cfg = oldCmd, oldState, oldCfg
		statePath, hotplugPendingPath = oldPath, oldPending
		statusATPort, statusATModem = oldPort, oldModem
	})
	dir := t.TempDir()
	statePath = filepath.Join(dir, "state")
	hotplugPendingPath = filepath.Join(dir, "pending")
	cfg = Config{Hotplug: true, Modem: "test"}
	state = State{Cards: map[string]*Card{}}
	statusATPort = "/dev/ttyUSB2"
	statusATModem = "test"
	enabled := true
	writes, reboots := 0, 0
	command = func(ctx context.Context, secs int, name string, args ...string) ([]byte, error) {
		if name == "uci" {
			if strings.HasSuffix(args[2], ".manufacturer") {
				return []byte("quectel"), nil
			}
			return []byte("/dev/ttyUSB2"), nil
		}
		if name == "/usr/libexec/chester-sim-status-at" {
			if args[1] == "AT+QSIMDET?" {
				if enabled {
					return []byte("+QSIMDET: 1,1\r\nOK"), nil
				}
				return []byte("+QSIMDET: 0,1\r\nOK"), nil
			}
			return []byte("+QSIMSTAT: 1,1\r\nOK"), nil
		}
		if name == "/usr/libexec/chester-sim-hotplug" {
			writes++
			if args[1] == "detect" {
				enabled = true
			}
			return []byte("OK\r\n"), nil
		}
		if name == "/sbin/reboot" {
			reboots++
		}
		return nil, nil
	}
	ensureHotplug()
	if writes != 0 || reboots != 0 || state.Hotplug != "enabled" {
		t.Fatal("configured modem was rewritten/restarted")
	}
	enabled = false
	ensureHotplug()
	if writes != 2 || reboots != 1 || state.Hotplug != "pending_restart" {
		t.Fatalf("new modem not initialized safely: writes=%d reboots=%d", writes, reboots)
	}
	ensureHotplug()
	if writes != 2 || reboots != 1 {
		t.Fatal("same boot issued repeated settings or restart")
	}
	pending, _ := json.Marshal(map[string]string{"boot": "previous-boot", "modem": "test"})
	os.WriteFile(hotplugPendingPath, pending, 0600)
	enabled = false
	ensureHotplug()
	if reboots != 1 || state.Hotplug != "needs_attention" {
		t.Fatal("non-persistent setting would cause reboot loop")
	}
	enabled = true
	ensureHotplug()
	if _, e := os.Stat(hotplugPendingPath); !os.IsNotExist(e) {
		t.Fatal("successful post-reboot verification did not clear marker")
	}
}
