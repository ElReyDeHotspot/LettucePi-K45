package main

import "testing"

func TestSpeedCriteria(t *testing.T) {
	old := cfg
	defer func() { cfg = old }()
	for _, tc := range []struct {
		criterion string
		down, up  float64
		eligible  bool
		value     float64
	}{
		{"DL", 20, 1, true, 20}, {"UL", 1, 20, true, 20}, {"DLUL", 20, 1, false, 21}, {"DLUL", 10, 10, true, 20},
	} {
		cfg = Config{Criteria: tc.criterion, MinDown: 10, MinUp: 10}
		c := &Card{Download: &tc.down, Upload: &tc.up}
		if meets(c) != tc.eligible || score(c) != tc.value {
			t.Fatalf("incorrect selection policy for %+v", tc)
		}
	}
	if meets(&Card{}) {
		t.Fatal("unmeasured SIM must not satisfy thresholds")
	}
}
func TestInsertionStateDoesNotTreatUnknownAsAbsent(t *testing.T) {
	for _, tc := range []struct{ response, want string }{
		{"AT+QSIMSTAT?\r\n+QSIMSTAT: 0,1\r\nOK", "present"},
		{"+QSIMSTAT: 1,0", "absent"}, {"+QSIMSTAT: 1,2", "unknown"}, {"ERROR", ""}, {"", ""},
	} {
		if got := insertionState(tc.response); got != tc.want {
			t.Fatalf("%q: got %q, want %q", tc.response, got, tc.want)
		}
	}
}
