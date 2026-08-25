// Package external wraps third-party HTTP endpoints. It knows how to
// call an API and decode the raw response — nothing else. Dependencies
// are injected via NewDependencies; consumers use dependency methods,
// never package functions.
package external

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.uber.org/zap"
)

// DependenciesConfig carries everything the external layer needs.
type DependenciesConfig struct {
	// HTTP executes requests; required.
	HTTP HTTPDoer
	// Log receives throttling/retry notices; defaults to a no-op logger.
	Log *zap.Logger
	// IceMassCSVURL overrides the OWID ice-sheet CSV endpoint.
	IceMassCSVURL string
	// MaxConcurrent caps in-flight upstream requests (default 2).
	MaxConcurrent int
	// MinInterval spaces request starts (default 350ms); Open-Meteo's
	// free tier answers bursts with HTTP 429.
	MinInterval time.Duration
}

// HTTPDoer executes HTTP requests (*http.Client satisfies it).
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type dependencies struct {
	http   HTTPDoer
	log    *zap.Logger
	iceURL string

	slots chan struct{}
	pace  chan struct{}
}

// NewDependencies builds the external endpoint clients. The pacer starts
// immediately and lives for the process lifetime.
func NewDependencies(cfg DependenciesConfig) (dependencies, error) {
	if cfg.HTTP == nil {
		return dependencies{}, fmt.Errorf("external: HTTP dependency is required")
	}
	logger := cfg.Log
	if logger == nil {
		logger = zap.NewNop()
	}
	conc := cfg.MaxConcurrent
	if conc <= 0 {
		conc = 2
	}
	interval := cfg.MinInterval
	if interval <= 0 {
		interval = 350 * time.Millisecond
	}
	iceURL := cfg.IceMassCSVURL
	if iceURL == "" {
		iceURL = DefaultIceMassCSVURL
	}
	d := dependencies{
		http:   cfg.HTTP,
		log:    logger,
		iceURL: iceURL,
		slots:  make(chan struct{}, conc),
		pace:   make(chan struct{}),
	}
	go d.pacer(interval)
	return d, nil
}

func (d dependencies) pacer(interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for range t.C {
		select {
		case d.pace <- struct{}{}:
		default:
		}
	}
}

// get performs a paced, concurrency-capped GET with retry/backoff on 429.
func (d dependencies) get(ctx context.Context, base string, q url.Values) (*DailyResponse, error) {
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		select {
		case d.slots <- struct{}{}:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		select {
		case <-d.pace:
		case <-ctx.Done():
			<-d.slots
			return nil, ctx.Err()
		}
		out, err := d.getOnce(ctx, base, q)
		<-d.slots
		if err == nil {
			return out, nil
		}
		lastErr = err
		if !strings.Contains(err.Error(), "HTTP 429") && !strings.Contains(err.Error(), "HTTP 5") {
			return nil, err
		}
		d.log.Warn("external: upstream throttled, retrying",
			zap.String("endpoint", base), zap.Int("attempt", attempt+1), zap.Error(err))
		wait := time.Duration(attempt+1) * 3 * time.Second
		select {
		case <-time.After(wait):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return nil, lastErr
}

func (d dependencies) getOnce(ctx context.Context, base string, q url.Values) (*DailyResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "earth-dashboard-backend/1.0")
	resp, err := d.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("open-meteo %s: HTTP %d", base, resp.StatusCode)
	}
	var out DailyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode open-meteo response: %w", err)
	}
	return &out, nil
}

func fnum(f float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.4f", f), "0"), ".")
}
