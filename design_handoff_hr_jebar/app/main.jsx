// ─────────────────────────────────────────────────────────────
// HR JEBAR — Admin console layout + root app + role switcher
// ─────────────────────────────────────────────────────────────

const ADMIN_NAV = [
  { id: 'dash', label: 'ภาพรวม', icon: 'home' },
  { id: 'emps', label: 'พนักงาน', icon: 'users' },
  { id: 'att', label: 'การลงเวลา', icon: 'calendar' },
  { id: 'pay', label: 'คำนวณเงิน', icon: 'wallet' },
  { id: 'msg', label: 'ข้อความ & สั่งงาน', icon: 'chat' },
  { id: 'set', label: 'ตั้งค่ากฎ', icon: 'settings' },
];

function AdminConsole({ onExit }) {
  const { state } = useStore();
  const [nav, setNav] = React.useState('dash');
  const [detail, setDetail] = React.useState(null);
  const [autoAdd, setAutoAdd] = React.useState(false);
  const td = ymd(new Date());
  const inNow = state.att.filter((a) => a.date === td && a.clockIn && !a.clockOut).length;

  const go = (n, extra) => { setDetail(null); setNav(n); if (extra === 'add') setAutoAdd(true); };

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
      {/* sidebar */}
      <div style={{ width: 248, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '22px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px 22px' }}>
          <img src="assets/jebar-logo.png" alt="JEBAR" style={{ height: 26, alignSelf: 'flex-start' }} />
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em' }}>HR · คอนโซลแอดมิน</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {ADMIN_NAV.map((n) => {
            const active = nav === n.id && !detail;
            const badge = n.id === 'msg' ? state.messages.filter((m) => m.from === 'emp' && m.status === 'unread').length : 0;
            return (
              <button key={n.id} onClick={() => go(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, textAlign: 'left',
                background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--ink)',
              }}>
                <Icon name={n.icon} size={20} stroke={active ? 2.4 : 2} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {badge > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 5px', borderRadius: 20, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>กำลังทำงานตอนนี้</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{inNow}/{state.emps.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>คน</span></div>
        </div>
        <button onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginTop: 8, borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
          <Icon name="logout" size={18} /> สลับมุมมอง
        </button>
      </div>

      {/* main */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 40px 60px' }}>
          {detail
            ? <AdminEmployeeDetail empId={detail} onBack={() => setDetail(null)} />
            : <>
              {nav === 'dash' && <AdminDashboard go={go} />}
              {nav === 'emps' && <AdminEmployees openDetail={setDetail} autoAdd={autoAdd} clearAuto={() => setAutoAdd(false)} />}
              {nav === 'att' && <AdminAttendance />}
              {nav === 'pay' && <AdminPayroll />}
              {nav === 'msg' && <AdminMessages />}
              {nav === 'set' && <AdminSettings />}
            </>}
        </div>
      </div>
    </div>
  );
}

// ---- ROLE PICKER (landing) ---------------------------------------
function RolePicker({ onPick }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ maxWidth: 760, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="assets/jebar-logo.png" alt="JEBAR" style={{ height: 72, marginBottom: 18 }} />
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>HR System</div>
          <div style={{ color: 'var(--muted)', fontSize: 17, marginTop: 6 }}>ระบบลงเวลา & คำนวณเงินพนักงาน</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <RoleCard icon="user" title="แอปพนักงาน" desc="ลงเวลาเข้า-ออก · ขอลา · ดูรายได้ · รับงานจากหัวหน้า" tag="มือถือ — เห็นเฉพาะข้อมูลตัวเอง" onClick={() => onPick('employee')} />
          <RoleCard icon="users" title="คอนโซลแอดมิน" desc="จัดการพนักงาน · คำนวณเงิน · ตั้งกฎ · สั่งงานรายคน" tag="คอมพิวเตอร์ — เห็นทุกคน" onClick={() => onPick('admin')} dark />
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 28 }}>ต้นแบบสาธิต · ข้อมูลตัวอย่าง · สลับมุมมองได้ตลอดเวลา</div>
      </div>
    </div>
  );
}
function RoleCard({ icon, title, desc, tag, onClick, dark }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', padding: 28, borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
      border: '1px solid ' + (dark ? 'transparent' : 'var(--line)'),
      background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--ink)',
      transition: 'transform .15s, box-shadow .15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: dark ? 'rgba(255,255,255,0.12)' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon name={icon} size={26} color={dark ? '#fff' : 'var(--accent)'} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 14, color: dark ? 'rgba(255,255,255,0.7)' : 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 16, color: dark ? '#7DD3C0' : 'var(--accent)' }}>{tag} →</div>
    </button>
  );
}

// ---- ROOT --------------------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": ["#0E7C66", "#E6F4EF"],
  "radius": 18
}/*EDITMODE-END*/;

function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = React.useState(null); // null | 'employee' | 'admin'
  const [emp, setEmp] = React.useState(null);

  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.theme[0]);
    r.style.setProperty('--accent-soft', t.theme[1]);
  }, [t.theme]);

  const panel = (
    <TweaksPanel>
      <TweakSection label="ธีมสีหลัก" />
      <TweakColor label="ชุดสี" value={t.theme} options={[
        ['#0E7C66', '#E6F4EF'],
        ['#9A6B2F', '#F3ECDF'],
        ['#1D4ED8', '#E6EDFB'],
        ['#9333EA', '#F2E8FB'],
        ['#B45309', '#FBF0E2'],
        ['#0F172A', '#E9ECF2'],
      ]} onChange={(v) => setTweak('theme', v)} />
    </TweaksPanel>
  );

  let view;
  if (!role) view = <RolePicker onPick={(r) => { setRole(r); setEmp(null); }} />;
  else if (role === 'admin') view = (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <AdminConsole onExit={() => setRole(null)} />
    </div>
  );
  else view = (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px 0', position: 'relative' }}>
      <button onClick={() => { setRole(null); setEmp(null); }} style={{
        position: 'fixed', top: 20, left: 20, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)',
        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, color: 'var(--muted)', whiteSpace: 'nowrap',
      }}>
        <Icon name="back" size={16} /> สลับมุมมอง
      </button>
      <IOSDevice>
        {emp ? <EmployeeApp emp={emp} onLogout={() => setEmp(null)} /> : <EmployeeLogin onLogin={setEmp} />}
      </IOSDevice>
    </div>
  );

  return <>{view}{panel}</>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <StoreProvider><Root /></StoreProvider>
);
