export type RetryOptions = {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown, waitMs: number) => void;
  signal?: AbortSignal;
};

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error("Aborted"));
    });
  });

/** Exponential backoff with jitter. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const base = opts.baseMs ?? 1000;
  const max = opts.maxMs ?? 15_000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (opts.signal?.aborted) throw e;
      if (opts.shouldRetry && !opts.shouldRetry(e)) throw e;
      if (i === attempts - 1) break;
      const wait = Math.min(max, base * 2 ** i) * (0.75 + Math.random() * 0.5);
      opts.onRetry?.(i + 1, e, wait);
      await sleep(wait, opts.signal);
    }
  }
  throw lastErr;
}

/** Run a promise with a timeout that aborts the underlying request. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, outer?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new TimeoutError()), ms);
  const onAbort = () => ctrl.abort(outer?.reason);
  outer?.addEventListener("abort", onAbort);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted && ctrl.signal.reason instanceof TimeoutError) throw ctrl.signal.reason;
    throw e;
  } finally {
    clearTimeout(t);
    outer?.removeEventListener("abort", onAbort);
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("This took too long. Please try again.");
    this.name = "TimeoutError";
  }
}
