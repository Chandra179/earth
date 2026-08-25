const DEFAULT_TIMEOUT = 15000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function request(url: string, timeout: number, headers?: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA, ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getText(url: string, timeout = DEFAULT_TIMEOUT): Promise<string> {
  return (await request(url, timeout)).text();
}

export async function getJson<T>(url: string, timeout = DEFAULT_TIMEOUT, headers?: Record<string, string>): Promise<T> {
  return (await request(url, timeout, headers)).json() as Promise<T>;
}
