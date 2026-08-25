// Command earth-backend serves derived climate indicators to the
// dashboard frontend:
//
//	GET /api/v1/health     liveness
//	GET /api/v1/ice-mass   Greenland/Antarctica mass balance (NASA JPL GRACE/GRACE-FO mascons)
//	GET /api/v1/regions    regional rows computed from Open-Meteo (heatwaves,
//	                       permafrost driver, drought stress, monsoon anomaly)
//
// main is only a composition root: it builds the dependency chain
// logger → cache → external → biz → api and starts the server. Every
// layer receives what it needs through NewDependencies.
package main

import (
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"

	"earth-backend/api"
	"earth-backend/biz"
	"earth-backend/cache"
	"earth-backend/external"
)

func main() {
	logger := zap.Must(zap.NewProduction())
	defer func() { _ = logger.Sync() }()

	port := envOr("PORT", "8090")
	cacheDir := envOr("CACHE_DIR", ".cache")

	httpClient := &http.Client{Timeout: 45 * time.Second}

	cacheSvc, err := cache.NewDependencies(cache.DependenciesConfig{
		Dir: cacheDir,
		Log: logger,
	})
	if err != nil {
		logger.Fatal("cache dependencies failed", zap.Error(err))
	}

	extDeps, err := external.NewDependencies(external.DependenciesConfig{
		HTTP:          httpClient,
		Log:           logger,
		IceMassCSVURL: os.Getenv("ICE_MASS_URL"),
	})
	if err != nil {
		logger.Fatal("external dependencies failed", zap.Error(err))
	}

	bizDeps, err := biz.NewDependencies(biz.DependenciesConfig{
		Upstream: extDeps,
		Cache:    cacheSvc,
		Log:      logger,
	})
	if err != nil {
		logger.Fatal("biz dependencies failed", zap.Error(err))
	}

	apiDeps, err := api.NewDependencies(api.DependenciesConfig{
		Data:  bizDeps,
		Cache: cacheSvc,
		Log:   logger,
	})
	if err != nil {
		logger.Fatal("api dependencies failed", zap.Error(err))
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           apiDeps.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	logger.Info("earth-backend listening", zap.String("addr", srv.Addr))
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatal("server exited", zap.Error(err))
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
