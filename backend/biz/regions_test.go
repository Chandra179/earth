package biz

import (
	"testing"
	"time"
)

func TestActiveHeatwave(t *testing.T) {
	now := time.Now().UTC()
	day := func(offset int) string { return now.AddDate(0, 0, offset).Format("2006-01-02") }

	// 4-day run ending recently → active
	days := []string{day(-6), day(-5), day(-4), day(-3), day(-2)}
	vals := []float64{30, 38, 39, 38.5, 25}
	if !activeHeatwave(days, vals, 35) {
		t.Error("expected active heatwave")
	}

	// run ended long ago → stale
	old := []string{day(-43), day(-42), day(-41), day(-2), day(-1)}
	oldVals := []float64{38, 39, 38, 20, 20}
	if activeHeatwave(old, oldVals, 35) {
		t.Error("expected stale heatwave to be inactive")
	}

	// only 2 consecutive days → no heatwave
	short := []string{day(-2), day(-1), day(0), day(1), day(2)}
	shortVals := []float64{36, 36, 20, 20, 20}
	if activeHeatwave(short, shortVals, 35) {
		t.Error("2-day run must not count")
	}
}

func TestPctDeltaAndSignedPct(t *testing.T) {
	if got := pctDelta(80, 100); got != -20 {
		t.Errorf("pctDelta = %v, want -20", got)
	}
	if got := signedPct(-7.2); got != "-7%" {
		t.Errorf("signedPct = %q", got)
	}
}

func TestDroughtRowBadges(t *testing.T) {
	cases := []struct {
		pct   float64
		badge string
	}{
		{-50, "critical"},
		{-20, "elevated"},
		{+5, "stable"},
	}
	for _, c := range cases {
		row := droughtStressRow(c.pct)
		if row.Badge != c.badge {
			t.Errorf("pct %.0f badge = %s, want %s", c.pct, row.Badge, c.badge)
		}
	}
	med := medDroughtRow(-30)
	if med.Badge != "critical" {
		t.Errorf("med -30%% badge = %s", med.Badge)
	}
	mon := monsoonRow(+22)
	if mon.BadgeText != "above seasonal pace" {
		t.Errorf("monsoon surplus text = %q", mon.BadgeText)
	}
}

func TestHeatwaveRowSubFallback(t *testing.T) {
	sites := []Site{{Name: "a", City: "Alpha"}, {Name: "b", City: "Beta"}}
	row := heatwaveRow("fallback sub", sites, map[string]string{})
	if row.Sub != "fallback sub" || row.Metric != "0 active" {
		t.Errorf("empty-active row = %+v", row)
	}
	row = heatwaveRow("fallback sub", sites, map[string]string{"a": "Alpha"})
	if row.Sub != "Alpha" || row.Badge != "elevated" {
		t.Errorf("one-active row = %+v", row)
	}
	row = heatwaveRow("fallback sub", sites, map[string]string{"a": "Alpha", "b": "Beta"})
	if row.Badge != "critical" || row.Sub != "Alpha · Beta" {
		t.Errorf("two-active row = %+v", row)
	}
}
