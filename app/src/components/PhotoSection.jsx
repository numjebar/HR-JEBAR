import { useState, useRef } from 'react';

export default function PhotoSection({ photos = [], onChange, label = 'รูปแนบ' }) {
  const [lightbox, setLightbox] = useState(null);
  const cameraRef = useRef();
  const albumRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let loaded = 0;
    const incoming = [];
    files.forEach(file => {
      const previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        incoming.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          previewUrl,
          base64: ev.target.result.split(',')[1],
          mimeType: file.type,
          name: file.name,
        });
        loaded++;
        if (loaded === files.length) onChange([...photos, ...incoming]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  function remove(id) {
    const next = photos.filter(p => p.id !== id);
    onChange(next);
    if (lightbox?.id === id) setLightbox(null);
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>{label}</label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => cameraRef.current.click()} style={iconBtnSt}>
            📷 ถ่ายรูป
          </button>
          <button type="button" onClick={() => albumRef.current.click()} style={iconBtnSt}>
            🖼️ อัลบัม
          </button>
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
          style={{ display: 'none' }} onChange={handleFiles} />
        <input ref={albumRef} type="file" accept="image/*" multiple
          style={{ display: 'none' }} onChange={handleFiles} />

        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ position: 'relative' }}>
                <img
                  src={photo.previewUrl}
                  alt={photo.name}
                  onClick={() => setLightbox(photo)}
                  style={{
                    width: 76, height: 76, objectFit: 'cover',
                    borderRadius: 14, border: '1.5px solid #eadcc6',
                    cursor: 'zoom-in', display: 'block',
                  }}
                />
                <button
                  type="button"
                  onClick={() => remove(photo.id)}
                  style={{
                    position: 'absolute', top: -7, right: -7,
                    width: 22, height: 22, borderRadius: 999,
                    background: '#ef4444', border: '2px solid #fff',
                    color: '#fff', fontSize: 13, fontWeight: 900,
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 0, lineHeight: 1,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)',
            zIndex: 9999, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16,
          }}
        >
          <img
            src={lightbox.previewUrl}
            alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '86vh', borderRadius: 18, objectFit: 'contain' }}
          />
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={e => { e.stopPropagation(); remove(lightbox.id); }}
              style={actionBtnSt('#ef4444')}
            >🗑 ลบ</button>
            <button
              onClick={() => setLightbox(null)}
              style={actionBtnSt('rgba(255,255,255,.22)')}
            >✕ ปิด</button>
          </div>
          {lightbox.name && (
            <div style={{
              position: 'absolute', bottom: 14, left: 0, right: 0,
              textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 12,
              pointerEvents: 'none',
            }}>
              {lightbox.name}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const iconBtnSt = {
  padding: '9px 14px', borderRadius: 12,
  border: '1.5px solid #e0d4c0', background: '#faf7f2',
  color: '#5a3e2b', cursor: 'pointer', fontSize: 14, fontWeight: 700,
};

const actionBtnSt = (bg) => ({
  background: bg, border: 'none', color: '#fff',
  borderRadius: 12, padding: '8px 16px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
});
