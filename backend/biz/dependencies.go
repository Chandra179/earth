// Package biz holds the dashboard's domain logic: deriving indicators
// from upstream responses. All I/O arrives through injected dependencies
// — never through direct package-function calls.
package biz

import (
	"context"
	"errors"
	"time"

	"earth-backend/external"
	"go.uber.org/zap"
)

// Upstream is the external-API data seam. It is satisfied by
// external.NewDependencies(...); biz never imports transport details.
type Upstream interface {
	GetForecast(ctx context.Context, lat, lon float64) (*external.DailyResponse, error)
	GetArchive(ctx context.Context, lat, lon float64, start, end string) (*external.DailyResponse, error)
	GetIceMassCSV(ctx context.Context) ([]byte, error)
}

// DiskCache persists raw series so restarts and quota windows degrade to
// last-good data instead of empty rows. Satisfied by *cache.Service.
type DiskCache interface {
	ReadJSON(key string, dst any) bool
	WriteJSON(key string, v any)
}

// DependenciesConfig carries everything the biz layer needs.
type DependenciesConfig struct {
	// Upstream provides external API data; required.
	Upstream Upstream
	// Cache persists upstream series across restarts; optional.
	Cache DiskCache
	// Log receives per-site fetch failures; defaults to a no-op logger.
	Log *zap.Logger
}

type dependencies struct {
	up   Upstream
	log  *zap.Logger
	disk DiskCache

	fc   *memStore // forecast series per site
	clim *memStore // 1991–2020 climatology per site
	rec  *memStore // trailing ~13-month window per site
	ice  *memStore // parsed GRACE/GRACE-FO ice-sheet payload
}

// NewDependencies builds the domain service from its configuration.
func NewDependencies(cfg DependenciesConfig) (dependencies, error) {
	if cfg.Upstream == nil {
		return dependencies{}, errors.New("biz: Upstream dependency is required")
	}
	logger := cfg.Log
	if logger == nil {
		logger = zap.NewNop()
	}
	mk := func() *memStore { return newMemStore(cfg.Cache, logger) }
	return dependencies{
		up:   cfg.Upstream,
		log:  logger,
		disk: cfg.Cache,
		fc:   mk(),
		clim: mk(),
		rec:  mk(),
		ice:  mk(),
	}, nil
}

const (
	climatologyStart = "1991-01-01"
	climatologyEnd   = "2020-12-31"
	jjasDays         = 122 // Jun 1 – Sep 30

	climTTLOrRefreshWindow = 30 * 24 * time.Hour
	recentTTL              = 6 * time.Hour
	forecastTTL            = 3 * time.Hour
	// iceMassTTL covers GRACE/GRACE-FO's monthly release cadence with
	// margin; the disk copy survives restarts.
	iceMassTTL = 7 * 24 * time.Hour
)

func (d dependencies) fetchClimatology(ctx context.Context, st Site) (*external.DailyResponse, error) {
	return getOrLoad(d.clim, "clim:"+st.Name, climTTLOrRefreshWindow, func() (*external.DailyResponse, error) {
		return d.up.GetArchive(ctx, st.Lat, st.Lon, climatologyStart, climatologyEnd)
	})
}

func (d dependencies) fetchRecent(ctx context.Context, st Site) (*external.DailyResponse, error) {
	return getOrLoad(d.rec, "rec:"+st.Name, recentTTL, func() (*external.DailyResponse, error) {
		start := time.Now().AddDate(-1, 0, -10).Format("2006-01-02")
		return d.up.GetArchive(ctx, st.Lat, st.Lon, start, time.Now().Format("2006-01-02"))
	})
}

func (d dependencies) fetchForecast(ctx context.Context, st Site) (*external.DailyResponse, error) {
	return getOrLoad(d.fc, "fc:"+st.Name, forecastTTL, func() (*external.DailyResponse, error) {
		return d.up.GetForecast(ctx, st.Lat, st.Lon)
	})
}

func (d dependencies) siteSeries(ctx context.Context, st Site) (clim, rec *external.DailyResponse, ok bool) {
	clim, err1 := d.fetchClimatology(ctx, st)
	rec, err2 := d.fetchRecent(ctx, st)
	if err1 != nil || err2 != nil || clim == nil || rec == nil {
		d.log.Warn("regions: site series unavailable",
			zap.String("site", st.Name), zap.NamedError("climErr", err1), zap.NamedError("recErr", err2))
		return nil, nil, false
	}
	return clim, rec, true
}
