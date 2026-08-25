type Entry<T> = { value: T; at: number };

const fresh = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string, ttlMs: number): T | undefined {
  const hit = fresh.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit) fresh.delete(key);
  return undefined;
}

/**
 * Deduplicates concurrent calls and serves results from a TTL cache.
 * Failed runs are neither cached nor deduplicated — the next call retries.
 */
export function cached<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key, ttlMs);
  if (hit !== undefined) return Promise.resolve(hit);
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = run().then(
    (value) => {
      fresh.set(key, { value, at: Date.now() });
      inflight.delete(key);
      return value;
    },
    (err) => {
      inflight.delete(key);
      throw err;
    },
  );
  inflight.set(key, p);
  return p;
}
