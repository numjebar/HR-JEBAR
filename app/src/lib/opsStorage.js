import { supabase } from './supabase';

const BUCKET = 'ops-photos';

export async function uploadOpsPhotos(photos = [], orgId, taskKey) {
  if (!photos.length) return [];
  const results = [];
  for (const photo of photos) {
    if (!photo.base64 || !photo.mimeType) continue;
    const ext = (photo.mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    const path = `${orgId}/${taskKey}/${ts}_${rand}.${ext}`;
    try {
      const bytes = base64ToUint8Array(photo.base64);
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: photo.mimeType,
        upsert: false,
      });
      if (!error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        results.push({ name: photo.name, url: data?.publicUrl || '', path });
      }
    } catch { /* skip failed uploads silently */ }
  }
  return results;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
