// ─────────────────────────────────────────────────────────────
// HR JEBAR — shared UI primitives
// ─────────────────────────────────────────────────────────────

// ---- icon set (stroke-based, 24 grid) ----------------------------
const ICON_PATHS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  in: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  out: '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 11h-5a2 2 0 0 0 0 4h5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 5M18 20a6.5 6.5 0 0 0-3-5.5"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M5 5l2 2M17 17l2 2M2 12h3M19 12h3M5 19l2-2M17 7l2-2"/>',
  trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  phone: '<path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  bank: '<path d="M3 21h18M4 10h16M5 21V10M19 21V10M9 21V10M15 21V10M12 3L3 8h18z"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7v-3"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><path d="M9 13l2 2 4-4"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.4-1.5 1.8-2.5 2s-2.5.6-2.5 2a2.5 2 0 0 0 5 0"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  belloff: '<path d="M8.7 3.5A6 6 0 0 1 18 8c0 3 1 5 1 5M6 8c0 7-3 9-3 9h13M13.7 21a2 2 0 0 1-3.4 0"/><path d="M2 2l20 20"/>',
};
function Icon({ name, size = 22, color = 'currentColor', stroke = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }} />
  );
}

// ---- avatar ------------------------------------------------------
function Avatar({ emp, size = 44, ring = false }) {
  const initials = emp.nickname ? emp.nickname.slice(0, 2) : emp.name.slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: emp.photo ? `center/cover url(${emp.photo})` : (emp.color || '#0E7C66'),
      color: '#fff', fontWeight: 600, fontSize: size * 0.38, overflow: 'hidden',
      boxShadow: ring ? '0 0 0 3px #fff, 0 0 0 5px ' + (emp.color || '#0E7C66') : 'none',
    }}>{!emp.photo && initials}</div>
  );
}

// ---- badge -------------------------------------------------------
const BADGE_STYLES = {
  present: { bg: '#E6F4EF', fg: '#0E7C66', label: 'มาทำงาน' },
  late: { bg: '#FEF3E2', fg: '#B45309', label: 'มาสาย' },
  leave: { bg: '#EEF2FF', fg: '#4338CA', label: 'ลา' },
  absent: { bg: '#FEE2E2', fg: '#B91C1C', label: 'ขาดงาน' },
  pending: { bg: '#FEF3E2', fg: '#B45309', label: 'รออนุมัติ' },
  approved: { bg: '#E6F4EF', fg: '#0E7C66', label: 'อนุมัติ' },
  rejected: { bg: '#FEE2E2', fg: '#B91C1C', label: 'ไม่อนุมัติ' },
  unread: { bg: '#EEF2FF', fg: '#4338CA', label: 'ใหม่' },
  read: { bg: '#F1F2F4', fg: '#6B7280', label: 'อ่านแล้ว' },
  done: { bg: '#E6F4EF', fg: '#0E7C66', label: 'เสร็จแล้ว' },
};
function Badge({ status, text, small }) {
  const s = BADGE_STYLES[status] || { bg: '#F1F2F4', fg: '#6B7280', label: text || status };
  return (
    <span style={{
      background: s.bg, color: s.fg, borderRadius: 999,
      padding: small ? '2px 9px' : '4px 12px', fontSize: small ? 12 : 13, fontWeight: 600,
      whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>{text || s.label}</span>
  );
}

// ---- button ------------------------------------------------------
function Button({ children, onClick, variant = 'primary', size = 'md', full, icon, disabled, style = {} }) {
  const sizes = { sm: { p: '8px 14px', fs: 14 }, md: { p: '12px 20px', fs: 15 }, lg: { p: '16px 24px', fs: 17 } };
  const sz = sizes[size];
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff', border: 'none' },
    dark: { background: 'var(--ink)', color: '#fff', border: 'none' },
    soft: { background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none' },
    ghost: { background: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--line)' },
    danger: { background: '#FEE2E2', color: '#B91C1C', border: 'none' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      ...variants[variant], padding: sz.p, fontSize: sz.fs, fontWeight: 600,
      borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
      width: full ? '100%' : undefined, display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'transform .1s, filter .15s',
      ...style,
    }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
      {icon && <Icon name={icon} size={sz.fs + 3} />}{children}
    </button>
  );
}

// ---- card --------------------------------------------------------
function Card({ children, style = {}, pad = 20, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 18, padding: pad,
      border: '1px solid var(--line)', cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

// ---- segmented control ------------------------------------------
function Segmented({ options, value, onChange, style = {} }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--bg)', borderRadius: 12, padding: 4, gap: 4,
      border: '1px solid var(--line)', ...style,
    }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: active ? 'var(--surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--muted)', fontWeight: 600, fontSize: 14,
            boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', fontFamily: 'inherit',
            whiteSpace: 'nowrap', transition: 'all .15s',
          }}>{lbl}</button>
        );
      })}
    </div>
  );
}

// ---- field (label + input) --------------------------------------
function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 7 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>{hint}</div>}
    </label>
  );
}
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 11, border: '1.5px solid var(--line)',
  fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--surface)',
  color: 'var(--ink)', outline: 'none',
};
function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

// ---- modal / sheet ----------------------------------------------
function Modal({ open, onClose, children, title, maxWidth = 460 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,25,30,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      backdropFilter: 'blur(3px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 22, width: '100%', maxWidth,
        maxHeight: '88%', overflow: 'auto', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
      }}>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0,
            background: 'var(--surface)', zIndex: 1,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
            <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={18} color="var(--muted)" />
            </button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ---- bottom sheet (mobile) --------------------------------------
function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,25,30,0.4)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--surface)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        width: '100%', maxHeight: '90%', overflow: 'auto', paddingBottom: 34,
        animation: 'sheetUp .25s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 5, borderRadius: 5, background: 'var(--line)' }} />
        </div>
        {title && <div style={{ fontSize: 20, fontWeight: 700, padding: '8px 24px 4px' }}>{title}</div>}
        <div style={{ padding: '12px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

// ---- stat tile ---------------------------------------------------
function Stat({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {icon && <Icon name={icon} size={16} color={accent || 'var(--muted)'} />}{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ---- mini geofence map visual -----------------------------------
function GeoMap({ inZone, distance, radius, label, size = 200 }) {
  const c = size / 2;
  return (
    <div style={{
      width: size, height: size, borderRadius: 18, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg,#EAF2EC,#DCE8E2)',
      border: '1px solid var(--line)',
    }}>
      {/* faux streets */}
      <div style={{ position: 'absolute', top: '38%', left: 0, right: 0, height: 8, background: '#fff', opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '55%', width: 8, background: '#fff', opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: '70%', left: 0, right: 0, height: 5, background: '#fff', opacity: 0.5 }} />
      {/* radius circle */}
      <div style={{
        position: 'absolute', left: c, top: c, transform: 'translate(-50%,-50%)',
        width: size * 0.62, height: size * 0.62, borderRadius: '50%',
        background: inZone ? 'rgba(14,124,102,0.14)' : 'rgba(220,38,38,0.12)',
        border: `2px dashed ${inZone ? 'var(--accent)' : '#DC2626'}`,
      }} />
      {/* shop pin (center) */}
      <div style={{ position: 'absolute', left: c, top: c, transform: 'translate(-50%,-100%)' }}>
        <Icon name="pin" size={26} color="var(--accent)" stroke={2.5} />
      </div>
      {/* employee dot */}
      <div style={{
        position: 'absolute', left: inZone ? '52%' : '82%', top: inZone ? '46%' : '20%',
        transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: 16,
        background: '#2563EB', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

Object.assign(window, {
  Icon, Avatar, Badge, Button, Card, Segmented, Field, TextInput, Modal, Sheet, Stat, GeoMap, BADGE_STYLES, inputStyle,
});
