// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { ByteBudget, PdfBusyError, TaskLimiter } from "./limits.ts";

const options = { max: 2, maxWaiting: 2, waitMs: 1000, holdMs: 1000 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((r) => { open = r; });
  return { open, opened };
}
const idle = (l: TaskLimiter) => { assert.equal(l.running, 0); assert.equal(l.queued, 0); };

test("runs at most max at a time; the rest wait their turn", async () => {
  const l = new TaskLimiter(options);
  const g = gate();
  let peak = 0, now = 0;
  const task = async () => { peak = Math.max(peak, ++now); await g.opened; now--; return "ok"; };
  const all = [l.run(task), l.run(task), l.run(task), l.run(task)];
  await sleep(10);
  assert.equal(l.running, 2);
  assert.equal(l.queued, 2);
  g.open();
  assert.deepEqual(await Promise.all(all), ["ok", "ok", "ok", "ok"]);
  assert.equal(peak, 2);
  idle(l);
});

test("a full queue is refused at once", async () => {
  const l = new TaskLimiter(options);
  const g = gate();
  const task = async () => { await g.opened; };
  const held = [l.run(task), l.run(task), l.run(task), l.run(task)];
  await sleep(5);
  await assert.rejects(l.run(task), PdfBusyError);
  g.open();
  await Promise.all(held);
  idle(l);
});

test("waiting too long is refused and leaves no trace", async () => {
  const l = new TaskLimiter({ ...options, waitMs: 20 });
  const g = gate();
  const task = async () => { await g.opened; };
  const held = [l.run(task), l.run(task)];
  await assert.rejects(l.run(task), PdfBusyError);
  assert.equal(l.queued, 0);
  g.open();
  await Promise.all(held);
  idle(l);
});

test("a task that fails or throws gives its turn back", async () => {
  const l = new TaskLimiter({ ...options, max: 1 });
  await assert.rejects(l.run(async () => { throw new Error("broken pdf"); }), /broken pdf/);
  idle(l);
  await assert.rejects(l.run(() => { throw new Error("sync"); }), /sync/);
  idle(l);
  assert.equal(await l.run(async () => "next"), "next");
  idle(l);
});

test("a client that leaves while waiting frees its place and takes no turn", async () => {
  const l = new TaskLimiter({ ...options, max: 1 });
  const g = gate();
  const held = l.run(async () => { await g.opened; });
  const client = new AbortController();
  let ran = false;
  const left = l.run(async () => { ran = true; }, client.signal);
  await sleep(5);
  assert.equal(l.queued, 1);
  client.abort();
  await assert.rejects(left, PdfBusyError);
  assert.equal(l.queued, 0);
  g.open();
  await held;
  assert.equal(ran, false);
  idle(l);
});

test("a client that already left never starts", async () => {
  const l = new TaskLimiter(options);
  await assert.rejects(l.run(async () => {}, AbortSignal.abort()), PdfBusyError);
  idle(l);
});

test("a client that leaves while running tells the task and the turn ends with it", async () => {
  const l = new TaskLimiter({ ...options, max: 1 });
  const client = new AbortController();
  const running = l.run((signal) => new Promise<string>((resolve) => {
    signal.addEventListener("abort", () => resolve("stopped"));
  }), client.signal);
  await sleep(5);
  assert.equal(l.running, 1);
  client.abort();
  assert.equal(await running, "stopped");
  idle(l);
});

test("a task that hangs loses its turn, and the next one runs", async () => {
  const l = new TaskLimiter({ ...options, max: 1, holdMs: 20 });
  let told = false;
  const hung = l.run((signal) => new Promise(() => { signal.addEventListener("abort", () => { told = true; }); }));
  const next = l.run(async () => "next");
  await assert.rejects(hung, PdfBusyError);
  assert.equal(told, true);
  assert.equal(await next, "next");
  idle(l);
});

test("a late failure after the hold ran out is not an unhandled rejection", async () => {
  const l = new TaskLimiter({ ...options, holdMs: 5 });
  await assert.rejects(l.run(async () => { await sleep(20); throw new Error("late"); }), PdfBusyError);
  await sleep(30);
  idle(l);
});

test("byte budget: up to the limit is fine, over it stays over", () => {
  const b = new ByteBudget(100);
  assert.equal(b.take(100), true);
  assert.equal(b.exceeded, false);
  assert.equal(b.take(1), false);
  assert.equal(b.exceeded, true);
  assert.equal(b.take(0), false);
});
