/** Bounds both response headers and body reading. Aborting is not a server rollback. */
export const JSON_REQUEST_TIMEOUT_MS = 20_000;

export class JsonRequestInterrupted extends Error {
  constructor(readonly reason: "timeout" | "aborted") {
    super(reason);
    this.name = "JsonRequestInterrupted";
  }
}

/** Also bounds the lazy validation download before any auth mutation is issued. */
export async function withRequestDeadline<T>(request: (signal: AbortSignal) => Promise<T>, source?: AbortSignal | null) {
  const controller = new AbortController();
  let interrupt!: (error: JsonRequestInterrupted) => void;
  const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
  const stop = (reason: "timeout" | "aborted") => {
    // Settle our deadline independently of fetch implementations/body readers.
    interrupt(new JsonRequestInterrupted(reason));
    controller.abort();
  };
  const onAbort = () => stop("aborted");
  if (source?.aborted) throw new JsonRequestInterrupted("aborted");
  source?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => stop("timeout"), JSON_REQUEST_TIMEOUT_MS);
  try {
    return await Promise.race([
      request(controller.signal),
      interrupted,
    ]);
  } finally {
    clearTimeout(timer);
    source?.removeEventListener("abort", onAbort);
  }
}

export function boundedJsonRequest<T>(path: string, init: RequestInit) {
  return withRequestDeadline(async signal => {
    const response = await fetch(path, { ...init, signal });
    const body = await response.json().catch(() => null) as T | null;
    return { response, body };
  }, init.signal);
}
