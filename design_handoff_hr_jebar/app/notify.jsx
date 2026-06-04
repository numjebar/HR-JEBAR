// ─────────────────────────────────────────────────────────────
// HR JEBAR — notifications: sound, vibrate, in-app banner, lock screen
// ─────────────────────────────────────────────────────────────

// ---- sound (WebAudio, no asset) ----------------------------------
let _audioCtx = null;
const NOTIF_TONES = {
  ding: { label: 'ติ๊ง-ติ๊ง', notes: [[880, 0], [1320, 0.13]], type: 'sine' },
  chime: { label: 'ระฆังใส', notes: [[660, 0], [988, 0.1], [1319, 0.2]], type: 'sine' },
  ping: { label: 'ปิ๊ง', notes: [[1568, 0]], type: 'triangle' },
  bloop: { label: 'บลู๊บ', notes: [[440, 0], [330, 0.12]], type: 'sine' },
  alert: { label: 'เตือนหนัก', notes: [[784, 0], [784, 0.16]], type: 'square' },
};
function playDing(tone = 'ding') {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const t = NOTIF_TONES[tone] || NOTIF_TONES.ding;
    t.notes.forEach(([freq, dt]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = t.type; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t0 = now + dt;
      const vol = t.type === 'square' ? 0.12 : 0.22;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
      o.start(t0); o.stop(t0 + 0.34);
    });
  } catch (e) {}
}
function doVibrate() { try { navigator.vibrate && navigator.vibrate([40, 60, 120]); } catch (e) {} }

function fireNotification(prefs) {
  if (prefs?.sound !== false) playDing(prefs?.tone || 'ding');
  if (prefs?.vibrate !== false) doVibrate();
}

// ---- logo mark (gold triangle + droplet) for notif icon ----------
function LogoMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 5 L33 33 Q20 28 7 33 Z" fill="none" stroke="#B5894B" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 16 c-3 4-4 6-4 8 a4 4 0 0 0 8 0 c0-2-1-4-4-8 z" fill="#B5894B" />
    </svg>
  );
}

// ---- in-app push banner ------------------------------------------
function NotifBanner({ notif, onClose, onOpen }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [notif]);
  if (!notif) return null;
  return (
    <div onClick={onOpen} style={{
      position: 'absolute', top: 10, left: 10, right: 10, zIndex: 120, cursor: 'pointer',
      background: 'rgba(245,246,247,0.86)', backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: 22, padding: '12px 14px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.18)', border: '0.5px solid rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 12, animation: 'bannerDrop .35s cubic-bezier(.2,.9,.2,1)',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1A1D21', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <LogoMark size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>HR JEBAR</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>ตอนนี้</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{notif.kind === 'task' ? 'งานใหม่ที่มอบหมาย' : 'ข้อความใหม่'}</div>
        <div style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.text}</div>
      </div>
    </div>
  );
}

// ---- lock screen -------------------------------------------------
function LockScreen({ emp, notifs, onUnlock, onOpenMsg }) {
  const [t, setT] = React.useState(nowHM());
  React.useEffect(() => { const i = setInterval(() => setT(nowHM()), 10000); return () => clearInterval(i); }, []);
  const today = new Date();
  const dateStr = `${THAI_DAYS_FULL[today.getDay()]} ${today.getDate()} ${THAI_MONTHS[today.getMonth()]}`;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150,
      background: 'linear-gradient(165deg,#1b2a26 0%,#0c1512 55%,#06100d 100%)',
      display: 'flex', flexDirection: 'column', color: '#fff', animation: 'fadeIn .3s',
    }}>
      {/* time */}
      <div style={{ textAlign: 'center', paddingTop: 74 }}>
        <div style={{ fontSize: 17, fontWeight: 500, opacity: 0.85 }}>{dateStr}</div>
        <div style={{ fontSize: 86, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{t}</div>
      </div>
      {/* notifications */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifs.length === 0 && (
          <div style={{ textAlign: 'center', opacity: 0.6, fontSize: 14, marginTop: 30 }}>ไม่มีการแจ้งเตือนใหม่</div>
        )}
        {notifs.map((m) => (
          <div key={m.id} onClick={() => onOpenMsg()} style={{
            background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 20, padding: '12px 14px', display: 'flex', gap: 12, cursor: 'pointer',
            animation: 'bannerDrop .4s cubic-bezier(.2,.9,.2,1)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1A1D21', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogoMark size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>HR JEBAR</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{m.createdAt.split(' ')[1] || 'ตอนนี้'}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{m.kind === 'task' ? 'งานที่มอบหมาย' : 'ข้อความจากหัวหน้า'}</div>
              <div style={{ fontSize: 13.5, opacity: 0.95, lineHeight: 1.4 }}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      {/* unlock */}
      <div style={{ padding: '16px 0 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <button onClick={onUnlock} style={{
          background: 'rgba(255,255,255,0.16)', border: 'none', color: '#fff', borderRadius: 999,
          padding: '12px 26px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 8,
        }}>ปลดล็อกเข้าแอป →</button>
        <div style={{ width: 139, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.7)' }} />
      </div>
    </div>
  );
}
const THAI_DAYS_FULL = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

Object.assign(window, { playDing, doVibrate, fireNotification, NotifBanner, LockScreen, LogoMark, NOTIF_TONES });
