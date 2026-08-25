type RequestInit = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT = 15000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function request(url: string, { timeoutMs = DEFAULT_TIMEOUT, headers, signal }: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA, ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function getText(url: string, options: RequestInit = {}): Promise<string> {
  return request(url, options).then((r) => r.text());
}

export function getJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  return request(url, options).then((r) => r.json() as Promise<T>);
}
