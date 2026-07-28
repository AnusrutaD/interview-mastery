/**
 * Thin typed fetch wrapper with in-flight request deduplication.
 *
 * Six components previously called `fetch("/api/progress")` independently, so
 * mounting the dashboard fired several identical requests at once. Deduping by
 * URL collapses concurrent GETs of the same resource into one network call.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const inFlight = new Map<string, Promise<unknown>>();

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; details?: unknown }
      | null;
    throw new HttpError(
      response.status,
      body?.error ?? `Request failed with ${response.status}`,
      body?.details
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** GET with dedup — concurrent callers for the same URL share one request. */
export function get<T>(url: string): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const promise = request<T>(url, { cache: "no-store" }).finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, promise);
  return promise;
}

export function post<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Build a query string, omitting undefined values. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined
  );
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}
