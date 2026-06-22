import { supabase } from './supabase';
import { getDeviceSession, saveDeviceSession } from './posLocalStore';

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

export async function registerPosDevice({
  tenantId,
  storeId = null,
  deviceName,
  platform = 'web',
  licenseDays = 7,
  printerProfile = {},
}) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!deviceName) throw new Error('deviceName is required');

  const { data, error } = await supabase.rpc('lucid_register_device', {
    p_tenant_id: tenantId,
    p_store_id: storeId || null,
    p_device_name: deviceName,
    p_platform: platform,
    p_license_days: licenseDays,
    p_printer_profile: printerProfile,
  });

  if (error) throw error;

  const row = firstRow(data);
  if (!row?.device_id || !row?.device_token) {
    throw new Error('Device registration did not return a device token');
  }

  const session = {
    tenantId,
    storeId: storeId || null,
    deviceId: row.device_id,
    deviceToken: row.device_token,
    licenseExpiresAt: row.license_expires_at || row.licenseExpiresAt || null,
    platform,
    deviceName,
    printerProfileId: printerProfile?.id || null,
    printerProfile: printerProfile || {},
  };

  await saveDeviceSession(session);
  return session;
}


export async function renewPosDeviceLicense({ tenantId, licenseDays = 7 } = {}) {
  if (!tenantId) throw new Error('tenantId is required');

  const currentSession = await getDeviceSession(tenantId);
  if (!currentSession?.deviceId || !currentSession?.deviceToken) {
    throw new Error('Device session with token is required');
  }

  const { data, error } = await supabase.rpc('lucid_renew_device_license', {
    p_tenant_id: tenantId,
    p_device_id: currentSession.deviceId,
    p_device_token: currentSession.deviceToken,
    p_license_days: licenseDays,
  });

  if (error) throw error;

  const row = firstRow(data);
  const nextSession = {
    ...currentSession,
    licenseExpiresAt: row?.license_expires_at || row?.licenseExpiresAt || currentSession.licenseExpiresAt || null,
    deviceStatus: row?.status || row?.deviceStatus || 'active',
  };

  await saveDeviceSession(nextSession);
  return nextSession;
}
