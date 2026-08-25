package biz

import (
	"errors"
	"sync"
	"time"

	"go.uber.org/zap"
)

var errInFlight = errors.New("refresh already in flight")

// memStore is an in-memory TTL store with stale-on-error semantics and a
// disk-backed last-good fallback provided through the DiskCache seam.
type memStore struct {
	mu      sync.Mutex
	entries map[string]*entry
	disk    DiskCache
	log     *zap.Logger
}

type entry struct {
	val       any
	fetchedAt time.Time
	loading   bool
	err       error // last refresh error, kept for diagnostics
}

func newMemStore(disk DiskCache, log *zap.Logger) *memStore {
	return &memStore{entries: map[string]*entry{}, disk: disk, log: log}
}

// getOrLoad returns a fresh value by calling load after ttl has elapsed,
// a stale cached value while a refresh is running or when load fails,
// and the persisted last-good value when memory is cold.
func getOrLoad[T any](s *memStore, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	s.mu.Lock()
	e, ok := s.entries[key]
	if !ok {
		e = &entry{}
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

	var probe T
	if e.val == nil && s.disk != nil && s.disk.ReadJSON(key, &probe) {
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

	if s.disk != nil {
		go s.disk.WriteJSON(key, val)
	}
	return val, nil
}
