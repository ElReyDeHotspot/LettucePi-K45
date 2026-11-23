package main

import (
	"strings"
	"testing"
)

func TestServingNeighborsAndRepeatedNRCarriers(t *testing.T) {
	raw := map[string]string{"serving": "+QENG: \"LTE\",\"FDD\",310,260,123400,285,66711,66,4,4,5852,-114,-14,-81,11,10,140,-\n+QENG: \"NR5G-NSA\",310,260,120,-110,6,-11,507870,41,7,1\n", "carriers": "+QCAINFO: \"PCC\",66711,75,\"LTE BAND 66\",1,285,-114,-14,-81,0\n+QCAINFO: \"SCC\",507870,7,\"NR5G BAND 41\",120\n+QCAINFO: \"SCC\",530190,7,\"NR5G BAND 41\",1,120,0,-,-\n", "neighbors": "+QENG: \"neighbourcell intra\",\"LTE\",66711,285,-14,-114,-81,-,-\n+QENG: \"neighbourcell intra\",\"LTE\",66711,19,-17,-117,-90,-,-\n"}
	cells := parse(raw)
	if len(cells) != 4 {
		t.Fatalf("expected 4 cells, got %+v", cells)
	}
	var n41 int
	for _, c := range cells {
		if c.Band == "n41" {
			n41++
		}
		if c.PCI == "19" && c.Provider != "Not reported" {
			t.Fatal("neighbor provider guessed")
		}
		if c.ARFCN == "66711" && c.PCI == "285" && (c.Provider != "T-Mobile" || c.ENB != "4660") {
			t.Fatalf("serving identity lost: %+v", c)
		}
	}
	if n41 != 2 {
		t.Fatal("same-band different channels merged")
	}
}
func TestFullScanProvidersAndUnknowns(t *testing.T) {
	raw := map[string]string{"scan": "+QSCAN: \"LTE\",311,480,5230,101,-90,-9,20,30,123456,ABCD,50,13\n+QSCAN: \"NR5G\",310,410,633984,200,-95,-11,20,1,123456789,ABCD,100,77\n+QSCAN: \"LTE\",999,01,10,0,-32768,-,-,-\n"}
	cells := parse(raw)
	if len(cells) != 3 {
		t.Fatal(cells)
	}
	if cells[0].Provider != "Verizon" || cells[0].Band != "B13" {
		t.Fatal(cells[0])
	}
	if cells[1].Provider != "AT&T" || cells[1].Band != "n77" {
		t.Fatal(cells[1])
	}
	if cells[2].Provider != "Network 999-01" || cells[2].RSRP != nil || cells[2].Band != "B1" {
		t.Fatal(cells[2])
	}
}
func TestSameRadioCellDifferentNetworksRemainSeparate(t *testing.T) {
	cells := parse(map[string]string{"scan": "+QSCAN: \"LTE\",310,260,100,10,-90,-10,1,1\n+QSCAN: \"LTE\",310,410,100,10,-90,-10,1,1"})
	if len(cells) != 2 {
		t.Fatal("different network identities merged")
	}
}
func TestMalformedAndMissingMeasurements(t *testing.T) {
	for _, raw := range []string{"", "ERROR", "+QSCAN: (1-4)", "+QSCAN: \"LTE\",310,260,-,9999,-90,-10", strings.Repeat("x", 5000)} {
		if cells := parse(map[string]string{"scan": raw}); len(cells) != 0 {
			t.Fatal(cells)
		}
	}
	if provider("310", "26") != "Network 310-26" {
		t.Fatal("MNC padding must not guess a provider")
	}
}
func TestCapabilityAndInputAllowlist(t *testing.T) {
	if len(supported("+QSCAN: (1-4)\r\nOK")) != 3 || len(supported("ERROR")) != 0 {
		t.Fatal("unsupported scan enabled")
	}
	for _, s := range []string{"all;reboot", "", "4"} {
		if validMode(s) {
			t.Fatal("invalid mode accepted")
		}
	}
	if nameRE.MatchString("x;reboot") || portRE.MatchString("/dev/../../etc/passwd") {
		t.Fatal("unsafe input accepted")
	}
}
func TestBoundedModemOutput(t *testing.T) {
	var b cappedBuffer
	p := []byte(strings.Repeat("x", 100000))
	n, e := b.Write(p)
	if n != len(p) || e != nil || b.Len() != 65536 {
		t.Fatal("output limit failed")
	}
}
func TestLTEChannelDerivationAndNRNotGuessed(t *testing.T) {
	for _, tc := range []struct{ channel, band string }{{"5780", "B17"}, {"5330", "B14"}, {"650", "B2"}, {"9820", "B30"}, {"4950", ""}, {"-1", ""}} {
		if lteBand(tc.channel) != tc.band {
			t.Fatal(tc)
		}
	}
	cells := parse(map[string]string{"scan": "+QSCAN: \"NR5G\",310,260,530190,10,-90,-10,1,1"})
	if len(cells) != 1 || cells[0].Band != "" {
		t.Fatal("ambiguous NR band guessed")
	}
}
func TestFullScanDoesNotReuseOldNeighborSignalOrProvider(t *testing.T) {
	cells := parse(map[string]string{"neighbors": "+QENG: \"neighbourcell intra\",\"LTE\",650,10,-10,-90", "scan": "+QSCAN: \"LTE\",310,260,650,10,-110,-15,1,1"})
	if len(cells) != 1 || cells[0].RSRP == nil || *cells[0].RSRP != -110 || cells[0].Source != "Detected" {
		t.Fatal(cells)
	}
}
func TestNonFiniteAndFractionalMeasurementsRejected(t *testing.T) {
	if number("NaN", -160, -20) != nil || number("+Inf", -160, -20) != nil {
		t.Fatal("nonfinite measurement accepted")
	}
	cells := parse(map[string]string{"scan": "+QSCAN: \"LTE\",310,260,1.5,1,-90,-10,1,1\n+QSCAN: \"LTE\",310,260,650,1.5,-90,-10,1,1"})
	if len(cells) > 0 {
		t.Fatal("fractional channel or PCI accepted")
	}
}
