type Job<T> = { key: string; background: boolean; run: (signal: AbortSignal) => Promise<T>; controller: AbortController; promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

/** One provider pack at a time. Prioritise selections without discarding paid work. */
export class ChartWorkQueue<T> {
  private jobs: Job<T>[] = [];
  private active: Job<T> | null = null;
  private completed = new Map<string, T>();

  request(key: string, run: (signal: AbortSignal) => Promise<T>, background = false): Promise<T> {
    if (this.completed.has(key)) return Promise.resolve(this.completed.get(key)!);
    const existing = [this.active, ...this.jobs].find((job) => job?.key === key && !job.controller.signal.aborted);
    if (existing) {
      if (!background) {
        existing.background = false;
        this.jobs.sort((a, b) => Number(a.background) - Number(b.background));
      }
      return existing.promise;
    }
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    const job: Job<T> = { key, run, background, controller: new AbortController(), promise, resolve, reject };
    this.jobs.push(job);
    this.jobs.sort((a, b) => Number(a.background) - Number(b.background));
    this.pump();
    return promise;
  }

  clear() {
    this.completed.clear();
    this.active?.controller.abort();
    for (const job of this.jobs.splice(0)) { job.controller.abort(); job.reject(new DOMException("Chart session changed", "AbortError")); }
  }

  private pump() {
    if (this.active) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.active = job;
    Promise.resolve().then(() => { job.controller.signal.throwIfAborted(); return job.run(job.controller.signal); }).then((value) => {
      job.controller.signal.throwIfAborted();
      if (this.completed.size >= 5) this.completed.delete(this.completed.keys().next().value!);
      this.completed.set(job.key, value);
      return value;
    }).then(job.resolve, job.reject).finally(() => { this.active = null; this.pump(); });
  }
}
