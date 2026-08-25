package biz

import (
	"strings"
	"testing"
	"time"
)

func sampleCSV() string {
	var b strings.Builder
	b.WriteString("entity,code,day,land_ice_mass_nasa\n")
	// Greenland: linear -120 Gt/yr from a 500 Gt offset
	for y := 2002; y <= 2024; y++ {
		for _, md := range []string{"01-15", "07-15"} {
			v := float64(y-2002)*-120 + 500
			b.WriteString("Greenland,GRL," + itoa(y) + "-" + md + "," + ftoa(v) + "\n")
		}
	}
	// Antarctica: flat
	for y := 2002; y <= 2024; y++ {
		b.WriteString("Antarctica,ATA," + itoa(y) + "-06-15,-100\n")
	}
	return b.String()
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	digits := ""
	for i > 0 {
		digits = string(rune('0'+i%10)) + digits
		i /= 10
	}
	if neg {
		return "-" + digits
	}
	return digits
}

func ftoa(f float64) string { return itoa(int(f)) }

func TestParseIceMassCSVTrends(t *testing.T) {
	p, err := ParseIceMassCSV(strings.NewReader(sampleCSV()))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got := p.Greenland.TrendGtPerYear; got < -121 || got > -119 {
		t.Errorf("greenland trend = %v, want ≈ -120", got)
	}
	if p.Antarctica.TrendGtPerYear != 0 {
		t.Errorf("antarctica trend = %v, want 0", p.Antarctica.TrendGtPerYear)
	}
	if !strings.HasPrefix(p.Greenland.LastDate, "2024") {
		t.Errorf("last date = %v", p.Greenland.LastDate)
	}
}

func TestParseIceMassCSVMissingEntity(t *testing.T) {
	r := strings.NewReader("entity,code,day,land_ice_mass_nasa\nGreenland,GRL,2010-01-01,100\n")
	if _, err := ParseIceMassCSV(r); err == nil {
		t.Fatal("expected error for insufficient samples")
	}
}

func TestOLSSlopePerYearWindow(t *testing.T) {
	// slope changes mid-series: early +100/yr, last years flat
	base := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	ss := []sample{}
	for i := 0; i <= 20; i++ {
		v := float64(i) * 100
		if i > 15 {
			v = 1500
		}
		ss = append(ss, sample{t: base.AddDate(i, 0, 0), v: v})
	}
	got := olsSlopePerYear(ss, base.AddDate(16, 0, 0))
	if got != 0 {
		t.Errorf("slope in window = %v, want 0", got)
	}
	full := olsSlopePerYear(ss, base.AddDate(-1, 0, 0))
	if full < 60 || full > 90 {
		t.Errorf("full slope = %v, want ~75 (ramp then plateau)", full)
	}
}
