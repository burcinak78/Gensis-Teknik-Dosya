// Limits on teknik dosya assembly. Merging holds every attached PDF in memory, outside the render queue, and the
// server is shared (KRR-035). No imports, so it can be tested on its own (npm run test:unit).

/** Too many PDFs in progress, or one waited / ran too long. The routes answer 503. */
export class PdfBusyError extends Error {}

/**
 * At most `max` tasks at a time; `maxWaiting` more wait up to `waitMs` for a turn. A turn always ends: when the task
 * settles, or after `holdMs` for a task that hangs. The task gets a signal that fires when the client leaves or the
 * hold runs out, so it can stop working early; a client that leaves while waiting just leaves the queue.
 */
export class TaskLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly max: number;
  private readonly maxWaiting: number;
  private readonly waitMs: number;
  private readonly holdMs: number;

  constructor(options: { max: number; maxWaiting: number; waitMs: number; holdMs: number }) {
    this.max = options.max;
    this.maxWaiting = options.maxWaiting;
    this.waitMs = options.waitMs;
    this.holdMs = options.holdMs;
  }

  get running() { return this.active; }
  get queued() { return this.waiting.length; }

  private acquire(client?: AbortSignal): Promise<void> {
    if (client?.aborted) return Promise.reject(new PdfBusyError("client left"));
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.maxWaiting) return Promise.reject(new PdfBusyError("queue full"));
    return new Promise((resolve, reject) => {
      const leave = (reason: string) => {
        const i = this.waiting.indexOf(turn);
        if (i >= 0) this.waiting.splice(i, 1);
        clearTimeout(timer);
        client?.removeEventListener("abort", onAbort);
        reject(new PdfBusyError(reason));
      };
      const onAbort = () => leave("client left");
      const turn = () => {
        clearTimeout(timer);
        client?.removeEventListener("abort", onAbort);
        resolve();
      };
      const timer = setTimeout(() => leave("wait timed out"), this.waitMs);
      client?.addEventListener("abort", onAbort, { once: true });
      this.waiting.push(turn);
    });
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next(); // the turn passes straight on; active stays the same
    else this.active--;
  }

  async run<T>(task: (signal: AbortSignal) => Promise<T>, client?: AbortSignal): Promise<T> {
    await this.acquire(client);
    const stop = new AbortController();
    const onAbort = () => stop.abort();
    client?.addEventListener("abort", onAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = task(stop.signal);
      const hold = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          stop.abort();
          reject(new PdfBusyError("hold timed out"));
        }, this.holdMs);
      });
      work.catch(() => {}); // after a hold timeout nobody is listening any more
      return await Promise.race([work, hold]);
    } finally {
      clearTimeout(timer);
      client?.removeEventListener("abort", onAbort);
      this.release();
    }
  }
}

/** Bytes one request may download. Once over, it stays over: the route must answer with an error, not skip files. */
export class ByteBudget {
  private used = 0;
  private readonly limit: number;

  constructor(limit: number) { this.limit = limit; }

  get exceeded() { return this.used > this.limit; }

  /** Counts bytes; false when the request is now over its limit. */
  take(bytes: number): boolean {
    this.used += bytes;
    return !this.exceeded;
  }
}
