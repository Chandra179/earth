package api

import (
	"context"
	"errors"

	"go.uber.org/zap"

	"earth-backend/biz"
	"earth-backend/cache"
)

// ClimateService is the domain seam this layer serves; satisfied by
// biz.NewDependencies(...). The api package depends only on these
// methods, never on biz internals.
type ClimateService interface {
	IceMass(ctx context.Context) (biz.IceMassPayload, error)
	RegionRows(ctx context.Context) ([]biz.RegionRowEntry, error)
}

// DependenciesConfig carries everything the api layer needs.
type DependenciesConfig struct {
	// Data provides domain indicators; required.
	Data ClimateService
	// Cache memoizes upstream responses with stale-on-error; optional.
	Cache *cache.Service
	// Log receives request and failure logs; defaults to a no-op logger.
	Log *zap.Logger
}

type dependencies struct {
	data  ClimateService
	cache *cache.Service
	log   *zap.Logger
}

// NewDependencies builds the api layer from its configuration.
func NewDependencies(cfg DependenciesConfig) (dependencies, error) {
	if cfg.Data == nil {
		return dependencies{}, errors.New("api: Data dependency is required")
	}
	logger := cfg.Log
	if logger == nil {
		logger = zap.NewNop()
	}
	return dependencies{data: cfg.Data, cache: cfg.Cache, log: logger}, nil
}
