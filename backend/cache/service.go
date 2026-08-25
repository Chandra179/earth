// Package cache provides the shared TTL cache with stale-on-error and
// optional disk persistence. Consumers receive it through their own
// DependenciesConfig; the generic entry point is GetOrLoad.
package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

type svcEntry struct {
	val       any
	fetchedAt time.Time
	loading   bool
	err       error // last refresh error, kept for diagnostics
}

// Service is safe for concurrent use.
type Service struct {
	mu      sync.Mutex
	entries map[string]*svcEntry
	dir     string
	log     *zap.Logger
}

func newService(dir string, log *zap.Logger) *Service {
	return &Service{
		entries: map[string]*svcEntry{},
		dir:     dir,
		log:     log,
	}
}

// GetOrLoad returns a fresh value by calling load after ttl has elapsed,
// a stale cached value while a refresh is running or when load fails,
// and last-good data from disk when nothing is in memory yet.
func GetOrLoad[T any](s *Service, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	s.mu.Lock()
	e, ok := s.entries[key]
	if !ok {
		e = &svcEntry{}
		s.entries[key] = e
	}
	if e.val != nil && time.Since(e.fetchedAt) < ttl && !e.loading {
		s.mu.Unlock()
		return e.val.(T), nil
	}
	if e.loading {
		stale := e.val
		s.mu.Unlock()
		if stale != nil {
			return stale.(T), nil
		}
		var zero T
		return zero, errInFlight
	}

	// Nothing usable in memory: fall back to last-good disk copy.
	var probe T
	if e.val == nil && s.readDisk(key, &probe) {
		e.val = any(probe)
		e.fetchedAt = time.Time{} // stale: next call refreshes upstream
		s.mu.Unlock()
		return probe, nil
	}

	e.loading = true
	s.mu.Unlock()

	val, err := load()

	s.mu.Lock()
	e.loading = false
	if err != nil {
		e.err = err
		s.mu.Unlock()
		if e.val != nil {
			s.log.Warn("cache: refresh failed, serving stale", zap.String("key", key), zap.Error(err))
			return e.val.(T), nil
		}
		var zero T
		return zero, err
	}
	e.val = val
	e.fetchedAt = time.Now()
	e.err = nil
	s.mu.Unlock()

	if s.dir != "" {
		go s.writeDisk(key, val)
	}
	return val, nil
}

// ---- DiskCache seam (implemented by Service, consumed by other packages) -

// ReadJSON loads a persisted value into dst; reports whether found.
func (s *Service) ReadJSON(key string, dst any) bool { return s.readDisk(key, dst) }

// WriteJSON persists a value under key.
func (s *Service) WriteJSON(key string, v any) { s.writeDisk(key, v) }

func (s *Service) readDisk(key string, dst any) bool {
	if s.dir == "" {
		return false
	}
	b, err := os.ReadFile(s.path(key))
	if err != nil {
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

func (s *Service) writeDisk(key string, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	name := s.path(key)
	tmp := name + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err == nil {
		_ = os.Rename(tmp, name)
	}
}

func (s *Service) path(key string) string {
	return filepath.Join(s.dir, strings.ReplaceAll(key, string(filepath.Separator), "_")+".json")
}
