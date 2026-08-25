package biz

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Site is one measurement location used by the regional indicators.
type Site struct {
	Name  string  `json:"name"`
	City  string  `json:"city"`
	Lat   float64 `json:"lat"`
	Lon   float64 `json:"lon"`
	HeatC float64 `json:"heatC"`
}

var (
	arcticSites = []Site{
		{"Norilsk", "Norilsk", 69.35, 88.20, 22},
		{"Dikson", "Dikson", 73.51, 80.53, 18},
		{"Utqiagvik", "Utqiaġvik", 71.29, -156.79, 16},
	}
	amazonSites = []Site{
		{"Manaus", "Manaus", -3.12, -60.02, 34},
		{"Porto Velho", "Porto Velho", -8.76, -63.90, 35},
		{"Belem", "Belém", -1.46, -48.49, 33},
	}
	medSites = []Site{
		{"Seville", "Seville", 37.39, -5.98, 37},
		{"Athens", "Athens", 37.98, 23.73, 36},
		{"Tunis", "Tunis", 36.80, 10.18, 37},
	}
	southAsiaSites = []Site{
		{"Delhi", "Delhi", 28.61, 77.21, 38},
		{"Lahore", "Lahore", 31.55, 74.35, 38},
		{"Dhaka", "Dhaka", 23.81, 90.41, 35},
	}
)

// RegionRow mirrors the frontend RegionRow shape exactly so responses can
// be upserted into snapshot regions without translation.
type RegionRow struct {
	Name      string `json:"name"`
	Metric    string `json:"metric"`
	Sub       string `json:"sub"`
	Badge     string `json:"badge"` // critical | elevated | stable
	BadgeText string `json:"badgeText"`
}

// RegionRowEntry attaches a row to its dashboard region.
type RegionRowEntry struct {
	Region string    `json:"region"`
	Row    RegionRow `json:"row"`
}

type RegionsPayload struct {
	UpdatedAt string           `json:"updatedAt"`
	Source    string           `json:"source"`
	Rows      []RegionRowEntry `json:"rows"`
}

// ---- computations -------------------------------------------------------

// activeHeatwave reports whether the daily tmax series shows a heatwave —
// ≥3 consecutive days at or above threshold with the run ending within
// the last 10 days (including the short forecast tail).
func activeHeatwave(days []string, tmax []float64, threshold float64) bool {
	run := 0
	lastRunEnd := -1
	for i, v := range tmax {
		if v >= threshold {
			run++
			if run >= 3 {
				lastRunEnd = i
			}
		} else {
			run = 0
		}
	}
	if lastRunEnd < 0 || lastRunEnd >= len(days) {
		return false
	}
	endDay, err := time.Parse("2006-01-02", days[lastRunEnd])
	if err != nil {
		return false
	}
	return time.Since(endDay) <= 10*24*time.Hour && !endDay.After(time.Now().AddDate(0, 0, 4))
}

// jjaMean returns the mean of temperature values for June–August of the
// most recent year present in the series.
func jjaMean(days []string, vals []float64) (float64, bool) {
	year := 0
	for _, d := range days {
		if t, err := time.Parse("2006-01-02", d); err == nil && t.Year() > year {
			year = t.Year()
		}
	}
	sum, n := 0.0, 0
	for i, d := range days {
		t, err := time.Parse("2006-01-02", d)
		if err != nil || i >= len(vals) {
			continue
		}
		if t.Month() >= time.June && t.Month() <= time.August && t.Year() == year {
			sum += vals[i]
			n++
		}
	}
	if n == 0 {
		return 0, false
	}
	return sum / float64(n), true
}

func sumRange(days []string, vals []float64, from, to time.Time) float64 {
	sum := 0.0
	for i, d := range days {
		if i >= len(vals) {
			break
		}
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			continue
		}
		if !t.Before(from) && t.Before(to) {
			sum += vals[i]
		}
	}
	return sum
}

func meanRange(days []string, vals []float64, from, to time.Time, monthLo, monthHi time.Month) (float64, bool) {
	sum, n := 0.0, 0
	for i, d := range days {
		if i >= len(vals) {
			break
		}
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			continue
		}
		if !t.Before(from) && t.Before(to) && t.Month() >= monthLo && t.Month() <= monthHi {
			sum += vals[i]
			n++
		}
	}
	if n == 0 {
		return 0, false
	}
	return sum / float64(n), true
}

func pctDelta(actual, baseline float64) float64 {
	if baseline == 0 {
		return 0
	}
	return (actual - baseline) / baseline * 100
}

func signedPct(v float64) string { return fmt.Sprintf("%+.0f%%", v) }

// ---- row builders -------------------------------------------------------

func heatwaveRow(defaultSub string, sites []Site, active map[string]string) *RegionRow {
	var names []string
	for _, s := range sites {
		if _, ok := active[s.Name]; ok {
			names = append(names, s.City)
		}
	}
	n := len(names)
	row := RegionRow{Name: "Heatwave alerts"}
	switch {
	case n >= 2:
		row.Badge, row.BadgeText = "critical", "heatwave threshold exceeded"
	case n == 1:
		row.Badge, row.BadgeText = "elevated", "watch"
	default:
		row.Badge, row.BadgeText = "stable", "none detected"
	}
	row.Metric = fmt.Sprintf("%d active", n)
	row.Sub = defaultSub
	if len(names) > 0 {
		row.Sub = strings.Join(names, " · ")
	}
	return &row
}

func permafrostRow(anomalyC float64) *RegionRow {
	row := RegionRow{Name: "Permafrost thaw", Sub: "JJA air-temp anomaly vs. 1991–2020"}
	row.Metric = fmt.Sprintf("%+.1f°C", anomalyC)
	switch {
	case anomalyC > 1.5:
		row.Badge, row.BadgeText = "critical", "accelerating active-layer deepening"
	case anomalyC > 0.8:
		row.Badge, row.BadgeText = "elevated", "above baseline"
	default:
		row.Badge, row.BadgeText = "stable", "near baseline"
	}
	return &row
}

func droughtStressRow(deficitPct float64) RegionRow {
	row := RegionRow{Name: "Drought stress", Sub: "90-day rain vs. climate norm"}
	row.Metric = signedPct(deficitPct)
	switch {
	case deficitPct <= -40:
		row.Badge, row.BadgeText = "critical", "severe deficit"
	case deficitPct <= -15:
		row.Badge, row.BadgeText = "elevated", "moderate deficit"
	default:
		row.Badge, row.BadgeText = "stable", "adequate moisture"
	}
	return row
}

func medDroughtRow(deficitPct float64) RegionRow {
	row := RegionRow{Name: "Drought", Sub: "12-month rainfall deficit"}
	row.Metric = signedPct(deficitPct)
	switch {
	case deficitPct <= -25:
		row.Badge, row.BadgeText = "critical", "persistent precipitation deficit"
	case deficitPct <= -10:
		row.Badge, row.BadgeText = "elevated", "below normal"
	default:
		row.Badge, row.BadgeText = "stable", "near normal"
	}
	return row
}

func monsoonRow(anomalyPct float64) RegionRow {
	row := RegionRow{Name: "Monsoon anomaly", Sub: "Jun–Sep rainfall vs. normal pace"}
	row.Metric = signedPct(anomalyPct)
	switch {
	case anomalyPct <= -20:
		row.Badge, row.BadgeText = "critical", "weak monsoon season"
	case anomalyPct <= -8:
		row.Badge, row.BadgeText = "elevated", "below seasonal pace"
	case anomalyPct >= 15:
		row.Badge, row.BadgeText = "elevated", "above seasonal pace"
	default:
		row.Badge, row.BadgeText = "stable", "near normal"
	}
	return row
}

// ---- service ------------------------------------------------------------

// RegionRows computes the Open-Meteo-derived regional indicator rows.
func (d dependencies) RegionRows(ctx context.Context) ([]RegionRowEntry, error) {
	now := time.Now()
	var mu sync.Mutex
	var rows []RegionRowEntry
	var wg sync.WaitGroup
	add := func(region string, r *RegionRow) {
		if r == nil {
			return
		}
		mu.Lock()
		rows = append(rows, RegionRowEntry{Region: region, Row: *r})
		mu.Unlock()
	}

	// Permafrost thaw (Arctic): JJA mean temp this year vs 1991–2020.
	wg.Add(1)
	go func() {
		defer wg.Done()
		anom, ok := d.arcticJJAAnomaly(ctx)
		if ok {
			add("Arctic", permafrostRow(anom))
		}
	}()

	// Heatwave alerts ×3 regions via forecast streaks.
	for _, cfg := range []struct {
		region string
		sites  []Site
		sub    string
	}{
		{"Arctic", arcticSites, "Siberian tundra + coastal"},
		{"Mediterranean", medSites, "Iberia · Aegean · Maghreb"},
		{"South Asia", southAsiaSites, "Indo-Gangetic plain"},
	} {
		cfg := cfg
		wg.Add(1)
		go func() {
			defer wg.Done()
			active := map[string]string{}
			var inner sync.WaitGroup
			for _, st := range cfg.sites {
				st := st
				inner.Add(1)
				go func() {
					defer inner.Done()
					d, err := d.fetchForecast(ctx, st)
					if err != nil || d == nil {
						return
					}
					if activeHeatwave(d.Daily.Time, d.Daily.Temperature2mMax, st.HeatC) {
						mu.Lock()
						active[st.Name] = st.City
						mu.Unlock()
					}
				}()
			}
			inner.Wait()
			add(cfg.region, heatwaveRow(cfg.sub, cfg.sites, active))
		}()
	}

	// Amazon drought stress: last-90d precip vs climatological norm.
	wg.Add(1)
	go func() {
		defer wg.Done()
		def, ok := d.precipDeficit(ctx, amazonSites, 90*24*time.Hour)
		if ok {
			r := droughtStressRow(def)
			add("Amazon", &r)
		}
	}()

	// Mediterranean drought: rolling 12-month deficit.
	wg.Add(1)
	go func() {
		defer wg.Done()
		def, ok := d.precipDeficit(ctx, medSites, 365*24*time.Hour)
		if ok {
			r := medDroughtRow(def)
			add("Mediterranean", &r)
		}
	}()

	// South Asia monsoon: JJAS-to-date vs climatological pace.
	wg.Add(1)
	go func() {
		defer wg.Done()
		anom, ok := d.monsoonAnomaly(ctx, now)
		if ok {
			r := monsoonRow(anom)
			add("South Asia", &r)
		}
	}()

	wg.Wait()
	if len(rows) == 0 {
		return nil, fmt.Errorf("no regional rows computed")
	}
	sortRows(rows)
	return rows, nil
}

func sortRows(rows []RegionRowEntry) {
	order := map[string]int{"Arctic": 0, "Amazon": 1, "Mediterranean": 2, "South Asia": 3}
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && order[rows[j].Region] < order[rows[j-1].Region]; j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}
}

func (d dependencies) arcticJJAAnomaly(ctx context.Context) (float64, bool) {
	var wg sync.WaitGroup
	ch := make(chan float64, len(arcticSites))
	for _, st := range arcticSites {
		st := st
		wg.Add(1)
		go func() {
			defer wg.Done()
			clim, rec, ok := d.siteSeries(ctx, st)
			if !ok {
				return
			}
			base, ok1 := meanRange(clim.Daily.Time, clim.Daily.Temperature2mMean,
				time.Date(1991, 6, 1, 0, 0, 0, 0, time.UTC), time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC), time.June, time.August)
			cur, ok2 := jjaMean(rec.Daily.Time, rec.Daily.Temperature2mMean)
			if !ok1 || !ok2 {
				return
			}
			ch <- cur - base
		}()
	}
	wg.Wait()
	close(ch)
	sum, n := 0.0, 0
	for v := range ch {
		sum += v
		n++
	}
	if n == 0 {
		return 0, false
	}
	return sum / float64(n), true
}

func (d dependencies) precipDeficit(ctx context.Context, sites []Site, window time.Duration) (float64, bool) {
	var wg sync.WaitGroup
	ch := make(chan float64, len(sites))
	now := time.Now()
	from := now.Add(-window)
	for _, st := range sites {
		st := st
		wg.Add(1)
		go func() {
			defer wg.Done()
			clim, rec, ok := d.siteSeries(ctx, st)
			if !ok {
				return
			}
			baseDaily, ok1 := meanRange(clim.Daily.Time, clim.Daily.PrecipitationSum,
				time.Date(1991, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC), time.January, time.December)
			actual := sumRange(rec.Daily.Time, rec.Daily.PrecipitationSum, from, now.AddDate(0, 0, 1))
			if !ok1 || actual == 0 {
				return
			}
			ch <- pctDelta(actual, baseDaily*window.Hours()/24)
		}()
	}
	wg.Wait()
	close(ch)
	sum, n := 0.0, 0
	for v := range ch {
		sum += v
		n++
	}
	if n == 0 {
		return 0, false
	}
	return sum / float64(n), true
}

func (d dependencies) monsoonAnomaly(ctx context.Context, now time.Time) (float64, bool) {
	var wg sync.WaitGroup
	ch := make(chan float64, len(southAsiaSites))
	for _, st := range southAsiaSites {
		st := st
		wg.Add(1)
		go func() {
			defer wg.Done()
			clim, rec, ok := d.siteSeries(ctx, st)
			if !ok {
				return
			}
			jStart := time.Date(now.Year(), time.June, 1, 0, 0, 0, 0, time.UTC)
			if now.Before(jStart) {
				jStart = jStart.AddDate(-1, 0, 0)
			}
			end := now.AddDate(0, 0, 1)
			elapsed := end.Sub(jStart).Hours() / 24
			if elapsed > jjasDays {
				elapsed = jjasDays
			}
			if elapsed < 15 {
				return // too early in the season to be meaningful
			}
			total := 0.0
			for y := 1991; y <= 2020; y++ {
				total += sumRange(clim.Daily.Time, clim.Daily.PrecipitationSum,
					time.Date(y, time.June, 1, 0, 0, 0, 0, time.UTC), time.Date(y, time.October, 1, 0, 0, 0, 0, time.UTC))
			}
			expected := total / 30 * (elapsed / jjasDays)
			actual := sumRange(rec.Daily.Time, rec.Daily.PrecipitationSum, jStart, end)
			if expected <= 0 || actual <= 0 {
				return
			}
			ch <- pctDelta(actual, expected)
		}()
	}
	wg.Wait()
	close(ch)
	sum, n := 0.0, 0
	for v := range ch {
		sum += v
		n++
	}
	if n == 0 {
		return 0, false
	}
	return sum / float64(n), true
}
