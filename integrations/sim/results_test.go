package main

import (
	"crypto/sha256"
	"path/filepath"
	"testing"
)

func TestResultCacheRetainsMeasurementsWithoutRestoringLiveConnection(t *testing.T) {
	oldState, oldPath := state, resultsPath
	t.Cleanup(func() { state = oldState; resultsPath = oldPath })
	resultsPath = filepath.Join(t.TempDir(), "results.json")
	state = State{Cards: map[string]*Card{}}
	item := card("1")
	d, u, l := 120.2, 15.4, 22.0
	item.identity = sha256.Sum256([]byte("original-sim"))
	item.Download = &d
	item.Upload = &u
	item.Latency = &l
	item.Tested = 1234
	item.Server = "test.example"
	item.Connected = true
	item.IPv4 = "192.0.2.1"
	saveResults()
	state = State{Cards: map[string]*Card{}}
	restoreResults()
	got := card("1")
	if got.Tested != 1234 || got.Download == nil || *got.Download != d || got.Upload == nil || *got.Upload != u || got.Latency == nil || *got.Latency != l {
		t.Fatalf("last result lost: %+v", got)
	}
	if got.Connected || got.IPv4 != "" {
		t.Fatal("must not restore live connection state")
	}
	observeIdentity(got, sha256.Sum256([]byte("original-sim")))
	if got.Tested != 1234 {
		t.Fatal("same SIM lost results")
	}
	observeIdentity(got, sha256.Sum256([]byte("replacement-sim")))
	if got.Tested != 0 || got.Download != nil || got.Latency != nil || got.Server != "" {
		t.Fatal("replacement SIM inherited previous results")
	}
	state = State{Cards: map[string]*Card{}}
	restoreResults()
	if card("1").Tested != 0 {
		t.Fatal("invalidated results restored from cache")
	}
}
