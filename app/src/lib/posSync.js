import { supabase } from './supabase';
import {
  listPendingSyncEvents,
  markSyncEventFailed,
  markSyncEventSynced,
} from './posLocalStore';

const DEFAULT_BATCH_SIZE = 25;

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function normalizeRpcRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

function resultKey(row) {
  return row.local_event_id || row.localEventId || row.local_event_id_text || '';
}

function resultCloudRef(row) {
  return row.cloud_ref || row.cloudRef || null;
}

function resultError(row) {
  return row.error || row.message || 'POS sync failed';
}

export async function syncPendingPosEvents({ tenantId, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  if (!tenantId) throw new Error('tenantId is required');

  if (!isOnline()) {
    return {
      ok: false,
      skipped: true,
      reason: 'offline',
      synced: 0,
      failed: 0,
      pending: 0,
      results: [],
    };
  }

  const pendingEvents = await listPendingSyncEvents(tenantId, batchSize);
  if (!pendingEvents.length) {
    return {
      ok: true,
      skipped: false,
      reason: 'empty',
      synced: 0,
      failed: 0,
      pending: 0,
      results: [],
    };
  }

  const { data, error } = await supabase.rpc('lucid_sync_pos_events', {
    p_tenant_id: tenantId,
    p_events: pendingEvents,
  });

  if (error) {
    await Promise.all(
      pendingEvents.map((event) => markSyncEventFailed(event.localEventId, error.message || 'RPC sync failed')),
    );
    return {
      ok: false,
      skipped: false,
      reason: 'rpc_error',
      synced: 0,
      failed: pendingEvents.length,
      pending: pendingEvents.length,
      results: pendingEvents.map((event) => ({
        localEventId: event.localEventId,
        status: 'failed',
        error: error.message || 'RPC sync failed',
      })),
    };
  }

  const rows = normalizeRpcRows(data);
  const rowByEventId = new Map(rows.map((row) => [resultKey(row), row]));
  let synced = 0;
  let failed = 0;

  await Promise.all(pendingEvents.map(async (event) => {
    const row = rowByEventId.get(event.localEventId);
    if (row?.status === 'synced') {
      synced += 1;
      await markSyncEventSynced(event.localEventId, resultCloudRef(row));
      return;
    }

    failed += 1;
    await markSyncEventFailed(event.localEventId, row ? resultError(row) : 'Missing RPC result for event');
  }));

  return {
    ok: failed === 0,
    skipped: false,
    reason: failed === 0 ? 'synced' : 'partial_failure',
    synced,
    failed,
    pending: Math.max(0, pendingEvents.length - synced),
    results: rows,
  };
}

export function createOnlineSyncHandler(options) {
  return () => syncPendingPosEvents(options);
}
