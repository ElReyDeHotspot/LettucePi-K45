package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Exercise the real request dispatcher with an offline modem. Only the system
// boundary is faked; there is no data connection or successful ping to rely on.
func TestManualRequestRetainsOfflineSlot(t *testing.T) {
	oldCommand, oldState, oldConfig := command, state, cfg
	oldStatePath, oldJournal, oldLock := statePath, journalPath, simLockPath
	t.Cleanup(func() {
		command, state, cfg = oldCommand, oldState, oldConfig
		statePath, journalPath, simLockPath = oldStatePath, oldJournal, oldLock
	})
	dir := t.TempDir()
	statePath = filepath.Join(dir, "state.json")
	journalPath = filepath.Join(dir, "journal.json")
	simLockPath = filepath.Join(dir, "operation.lock")
	state = State{Running: true, Cards: map[string]*Card{}, Supported: true}
	cfg = Config{Mode: "manual", Modem: "test_modem", Interface: "pcie0", AttachSeconds: 15, APN2: "vzwinternet"}
	slot := "1"
	writes := []string{}
	preferred := ""
	command = func(ctx context.Context, seconds int, name string, args ...string) ([]byte, error) {
		if name == "ping" {
			t.Fatal("Manual selection must not wait for or require data")
		}
		if name == "uci" {
			if len(args) > 1 && args[0] == "set" && strings.HasPrefix(args[1], "chester_sim.main.preferred=") {
				preferred = strings.TrimPrefix(args[1], "chester_sim.main.preferred=")
			}
			if len(args) > 2 && args[0] == "-q" && args[1] == "get" {
				if strings.HasSuffix(args[2], ".apn") {
					return []byte("fast.t-mobile.com"), nil
				}
				return nil, nil
			}
			return nil, nil
		}
		if name == "ubus" {
			method := args[len(args)-2]
			switch method {
			case "get_sim_slot":
				return json.Marshal(map[string]string{"sim_slot": slot})
			case "set_sim_slot":
				var v map[string]string
				json.Unmarshal([]byte(args[len(args)-1]), &v)
				slot = v["slot"]
				writes = append(writes, slot)
				return []byte(`{}`), nil
			case "sim_info", "cell_info":
				return []byte(`{"modem_info":[]}`), nil
			}
		}
		return nil, nil
	}
	runJob(Request{Action: "switch", Slot: "2"})
	if slot != "2" || len(writes) != 1 || preferred != "2" {
		t.Fatalf("selection rolled back or was not saved: slot=%s writes=%v preferred=%s", slot, writes, preferred)
	}
	if state.Busy || state.Phase != "completed" || state.Cards["2"].Connected {
		t.Fatalf("offline Manual request not completed: %+v", state)
	}
	if _, e := os.Stat(journalPath); !os.IsNotExist(e) {
		t.Fatalf("completed Manual choice left rollback journal: %v", e)
	}
	if _, e := os.Stat(simLockPath); !os.IsNotExist(e) {
		t.Fatalf("operation lock was not released: %v", e)
	}
}
