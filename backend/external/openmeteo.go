package external

import (
	"context"
	"net/url"
)

const (
	ForecastBase = "https://api.open-meteo.com/v1/forecast"
	ArchiveBase  = "https://archive-api.open-meteo.com/v1/archive"

	defaultPastDays     = "75" // forecast lookback for heatwave detection
	defaultForecastDays = "3"
)

// DailySeries is the Open-Meteo daily block we rely on.
type DailySeries struct {
	Time              []string  `json:"time"`
	Temperature2mMax  []float64 `json:"temperature_2m_max"`
	Temperature2mMean []float64 `json:"temperature_2m_mean"`
	PrecipitationSum  []float64 `json:"precipitation_sum"`
}

// DailyResponse is the decoded Open-Meteo daily payload.
type DailyResponse struct {
	Daily DailySeries `json:"daily"`
}

// GetForecast returns daily tmax around a site: defaultPastDays back plus
// a short forward tail, used for heatwave streak detection.
func (d dependencies) GetForecast(ctx context.Context, lat, lon float64) (*DailyResponse, error) {
	q := url.Values{}
	q.Set("latitude", fnum(lat))
	q.Set("longitude", fnum(lon))
	q.Set("daily", "temperature_2m_max")
	q.Set("past_days", defaultPastDays)
	q.Set("forecast_days", defaultForecastDays)
	q.Set("timezone", "GMT")
	return d.get(ctx, ForecastBase, q)
}

// GetArchive returns daily mean temperature and precipitation totals
// between two ISO dates from the ERA5 archive endpoint.
func (d dependencies) GetArchive(ctx context.Context, lat, lon float64, start, end string) (*DailyResponse, error) {
	q := url.Values{}
	q.Set("latitude", fnum(lat))
	q.Set("longitude", fnum(lon))
	q.Set("start_date", start)
	q.Set("end_date", end)
	q.Set("daily", "temperature_2m_mean,precipitation_sum")
	q.Set("timezone", "GMT")
	return d.get(ctx, ArchiveBase, q)
}
