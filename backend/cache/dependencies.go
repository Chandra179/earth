package cache

import (
	"errors"
	"os"

	"go.uber.org/zap"
)

var errInFlight = errors.New("refresh already in flight")

// DependenciesConfig carries everything the cache service needs.
type DependenciesConfig struct {
	// Dir enables disk persistence of cached values when non-empty.
	Dir string
	// Log receives refresh-failure notices; defaults to a no-op logger.
	Log *zap.Logger
}

// NewDependencies builds the cache service from its configuration.
func NewDependencies(cfg DependenciesConfig) (*Service, error) {
	logger := cfg.Log
	if logger == nil {
		logger = zap.NewNop()
	}
	if cfg.Dir != "" {
		if err := os.MkdirAll(cfg.Dir, 0o755); err != nil {
			return nil, err
		}
	}
	return newService(cfg.Dir, logger), nil
}
