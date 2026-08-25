package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"go.uber.org/zap"

	"earth-backend/biz"
	"earth-backend/cache"
)

const (
	iceMassTTL     = 24 * time.Hour
	regionsTTL     = 3 * time.Hour
	iceMassTimeout = 60 * time.Second
	regionsTimeout = 150 * time.Second
)

// Router registers the endpoints and returns the handler to serve.
func (d dependencies) Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", d.handleHealth)
	mux.HandleFunc("/api/v1/ice-mass", d.handleIceMass)
	mux.HandleFunc("/api/v1/regions", d.handleRegions)
	return d.logRequests(d.withCORS(mux))
}

func (d dependencies) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (d dependencies) handleIceMass(w http.ResponseWriter, _ *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), iceMassTimeout)
	defer cancel()

	payload, err := cached(d, "ice-mass", iceMassTTL, func() (biz.IceMassPayload, error) {
		return d.data.IceMass(ctx)
	})
	if err != nil {
		d.log.Warn("ice-mass unavailable", zap.Error(err))
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "ice-mass upstream unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (d dependencies) handleRegions(w http.ResponseWriter, _ *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), regionsTimeout)
	defer cancel()

	rows, err := cached(d, "regions", regionsTTL, func() ([]biz.RegionRowEntry, error) {
		return d.data.RegionRows(ctx)
	})
	if err != nil {
		d.log.Warn("regions unavailable", zap.Error(err))
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "regional upstream unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, biz.RegionsPayload{
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		Source:    "Open-Meteo",
		Rows:      rows,
	})
}

// cached wraps cache.GetOrLoad so handlers stay dependency-driven even
// when no Cache was injected (nil cache means load-through).
func cached[T any](d dependencies, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	if d.cache == nil {
		return load()
	}
	return cache.GetOrLoad(d.cache, key, ttl, load)
}

// ---- middleware ---------------------------------------------------------

func (d dependencies) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (d dependencies) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		d.log.Info("request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.Duration("elapsed", time.Since(start).Round(time.Millisecond)))
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}
