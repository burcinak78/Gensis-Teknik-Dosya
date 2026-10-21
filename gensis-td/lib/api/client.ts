// Browser-side access to the C# API. Same origin (/api via the proxy), so the session cookie goes along.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      // ValidationProblem: show the first field message (Turkish, from the API) rather than the generic title.
      const first = body?.errors && (Object.values(body.errors) as string[][]).flat()[0];
      message = first ?? body?.error ?? body?.title ?? message;
    } catch {
      /* no JSON body */
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
