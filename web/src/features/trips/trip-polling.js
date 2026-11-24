// Keep one request active at a time. Stopping the poller aborts its request and makes late results obsolete.
export function createTripPoller({ load, apply, onState, schedule = setTimeout, cancel = clearTimeout, interval = 5000 }) {
  let running = false;
  let generation = 0;
  let timer = null;
  let controller = null;
  async function tick() {
    if (!running) return;
    const current = ++generation;
    const request = new AbortController();
    controller = request;
    let nextInterval = interval;
    try {
      const result = await load(request.signal);
      if (result?.pollAfterMs === 0) nextInterval = 0;
      if (running && current === generation && !request.signal.aborted) { apply(result); onState('current'); }
    } catch (error) {
      if (running && current === generation && !request.signal.aborted) onState('error');
    } finally {
      if (running && current === generation && !request.signal.aborted) timer = schedule(tick, nextInterval);
    }
  }
  return {
    start() { if (!running) { running = true; tick(); } },
    stop() { running = false; generation++; controller?.abort(); if (timer != null) cancel(timer); timer = null; },
  };
}
// On an unchanged revision, keep the displayed trip and honor the server's next-poll hint.
export async function fetchChangedTrip(getRevision, getDetail, currentRevision) {
  const result = await getRevision();
  const unchanged = Number.isSafeInteger(result.data?.revision) && result.data.revision === currentRevision;
  const detail = unchanged ? null : await getDetail();
  return result.pollAfterMs === 0 ? { ...detail, data: detail?.data ?? null, pollAfterMs: 0 } : detail;
}
