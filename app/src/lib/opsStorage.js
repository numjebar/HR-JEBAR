import { supabase } from './supabase';

const BUCKET = 'ops-photos';

export async function uploadOpsPhotos(photos = [], orgId, taskKey) {
  if (!photos.length) return [];
  const results = [];
  for (const photo of photos) {
    const result = await uploadOneBase64(photo.base64, photo.mimeType, photo.name, orgId, taskKey);
    if (result) results.push(result);
  }
  return results;
}

export async function uploadSingleBase64(base64, mimeType, name, orgId, taskKey) {
  return uploadOneBase64(base64, mimeType, name, orgId, taskKey);
}

async function uploadOneBase64(base64, mimeType, name, orgId, taskKey) {
  if (!base64 || !mimeType) return null;
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `${orgId}/${taskKey}/${ts}_${rand}.${ext}`;
  try {
    const bytes = base64ToUint8Array(base64);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { name: name || path, url: data?.publicUrl || '', path };
  } catch { return null; }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
