import { syncPendingPosEvents } from './posSync';

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;

function canUseWindow() {
  return typeof window !== 'undefined';
}

function normalizeInterval(intervalMs) {
  const n = Number(intervalMs || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, n);
}

export function startPosBackgroundSync({
  tenantId,
  batchSize,
  intervalMs = DEFAULT_INTERVAL_MS,
  runImmediately = true,
  onResult,
  onError,
} = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!canUseWindow()) {
    return {
      started: false,
      stop: () => {},
      syncNow: () => syncPendingPosEvents({ tenantId, batchSize }),
    };
  }

  let stopped = false;
  let syncing = false;
  let timerId = null;
  const safeIntervalMs = normalizeInterval(intervalMs);

  const emitResult = (result) => {
    if (typeof onResult === 'function') onResult(result);
  };

  const emitError = (error) => {
    if (typeof onError === 'function') onError(error);
  };

  const syncNow = async (trigger = 'manual') => {
    if (stopped || syncing) {
      return {
        ok: false,
        skipped: true,
        reason: stopped ? 'stopped' : 'already_syncing',
        trigger,
      };
    }

    syncing = true;
    try {
      const result = await syncPendingPosEvents({ tenantId, batchSize });
      const withTrigger = { ...result, trigger };
      emitResult(withTrigger);
      return withTrigger;
    } catch (error) {
      emitError(error);
      return {
        ok: false,
        skipped: false,
        reason: 'exception',
        trigger,
        error: error?.message || String(error),
      };
    } finally {
      syncing = false;
    }
  };

  const onOnline = () => {
    syncNow('online');
  };

  window.addEventListener('online', onOnline);
  timerId = window.setInterval(() => {
    syncNow('interval');
  }, safeIntervalMs);

  if (runImmediately) {
    window.setTimeout(() => syncNow('start'), 0);
  }

  return {
    started: true,
    syncNow,
    stop: () => {
      stopped = true;
      if (timerId) window.clearInterval(timerId);
      window.removeEventListener('online', onOnline);
    },
  };
}
