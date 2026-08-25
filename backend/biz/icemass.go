// Package biz holds the dashboard's domain logic: deriving indicators
// from upstream responses fetched by the external package.
package biz

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"
)

// IceSheet summarises one ice sheet's mass balance.
type IceSheet struct {
	TrendGtPerYear float64 `json:"trendGtPerYear"`
	CumulativeGt   float64 `json:"cumulativeGt"`
	LastDate       string  `json:"lastDate"`
}

type IceMassPayload struct {
	UpdatedAt  string   `json:"updatedAt"`
	Source     string   `json:"source"`
	Greenland  IceSheet `json:"greenland"`
	Antarctica IceSheet `json:"antarctica"`
}

// ParseIceMassCSV reads the OWID grapher export (entity,code,day,
// land_ice_mass_nasa — cumulative Gt relative to a 2002 baseline) and
// derives per-sheet stats.
func ParseIceMassCSV(r io.Reader) (IceMassPayload, error) {
	out := IceMassPayload{Source: "NASA JPL GRACE/GRACE-FO mascons (via OWID)"}
	rows := map[string][]sample{"Greenland": {}, "Antarctica": {}}

	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	header := true
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return out, fmt.Errorf("read csv: %w", err)
		}
		if header {
			col := -1
			for i, h := range rec {
				if strings.Contains(h, "land_ice_mass") {
					col = i
				}
			}
			if col < 0 || len(rec) < 4 {
				return out, fmt.Errorf("unexpected header %v", rec)
			}
			header = false
			continue
		}
		if len(rec) < 4 {
			continue
		}
		entity := rec[0]
		ss, ok := rows[entity]
		if !ok {
			continue
		}
		day, err := time.Parse("2006-01-02", rec[2])
		if err != nil {
			continue
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(rec[3]), 64)
		if err != nil {
			continue
		}
		rows[entity] = append(ss, sample{t: day, v: v})
	}

	for _, sheetName := range []struct {
		key string
		dst *IceSheet
	}{
		{"Greenland", &out.Greenland},
		{"Antarctica", &out.Antarctica},
	} {
		ss := rows[sheetName.key]
		if len(ss) < 12 {
			return out, fmt.Errorf("%s: insufficient samples (%d)", sheetName.key, len(ss))
		}
		sortSamples(ss)
		last := ss[len(ss)-1]
		sheetName.dst.LastDate = last.t.Format("2006-01-02")
		sheetName.dst.CumulativeGt = round1(last.v)
		sheetName.dst.TrendGtPerYear = round1(olsSlopePerYear(ss, last.t.AddDate(-10, 0, 0)))
	}
	return out, nil
}

type sample struct {
	t time.Time
	v float64
}

func sortSamples(ss []sample) {
	for i := 1; i < len(ss); i++ {
		for j := i; j > 0 && ss[j].t.Before(ss[j-1].t); j-- {
			ss[j], ss[j-1] = ss[j-1], ss[j]
		}
	}
}

// olsSlopePerYear fits y = a + b·x over samples from `since` onward and
// returns b expressed in units per year.
func olsSlopePerYear(ss []sample, since time.Time) float64 {
	var n int
	var sx, sy, sxx, sxy float64
	for _, s := range ss {
		if s.t.Before(since) {
			continue
		}
		x := s.t.Sub(since).Hours() / 24 / 365.25
		n++
		sx += x
		sy += s.v
		sxx += x * x
		sxy += x * s.v
	}
	if n < 2 {
		return 0
	}
	den := float64(n)*sxx - sx*sx
	if den == 0 {
		return 0
	}
	return (float64(n)*sxy - sx*sy) / den
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }

// IceMass derives Greenland/Antarctica mass-balance stats from the OWID
// mirror of the NASA JPL GRACE/GRACE-FO mascon series.
func (d dependencies) IceMass(ctx context.Context) (IceMassPayload, error) {
	body, err := d.up.GetIceMassCSV(ctx)
	if err != nil {
		return IceMassPayload{}, err
	}
	p, err := ParseIceMassCSV(strings.NewReader(string(body)))
	if err == nil {
		p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return p, err
}
