import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import diamond from '../../assets/lucid-diamond.svg';
import { APP_VERSION } from '../../lib/version';
import AdminDashboard from './AdminDashboard';
import AdminEmployees from './AdminEmployees';
import AdminAttendance from './AdminAttendance';
import AdminPayroll from './AdminPayroll';
import AdminMessages from './AdminMessages';
import AdminSettings from './AdminSettings';
import AdminOpsInbox from './AdminOpsInbox';

const OPS_APP_URL = 'https://je-bar-operate.pages.dev/';

const NAV = [
  { path: '/admin', label: 'ภาพรวม', icon: '📊', end: true },
  { path: '/admin/employees', label: 'พนักงาน', icon: '👥' },
  { path: '/admin/attendance', label: 'การลงเวลา', icon: '🕐' },
  { path: '/admin/payroll', label: 'คำนวณเงิน', icon: '💰' },
  { path: '/admin/messages', label: 'ข้อความ', icon: '💬' },
  { path: '/admin/ops-inbox', label: 'งานร้านพนักงาน', icon: '🧾' },
  { path: '/admin/settings', label: 'ตั้งค่ากฎ', icon: '⚙️' },
];

export default function AdminShell() {
  const { adminLogout, orgId } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [opsTodayCount, setOpsTodayCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const location = useLocation();
  const closeSidebar = () => setSidebarOpen(false);

  function refreshBadgeCounts() {
    const today = new Date().toISOString().slice(0, 10);
    const seenKey = `hr_ops_today_seen_${today}`;
    const seen = parseInt(localStorage.getItem(seenKey) || '0', 10);
    supabase
      .from('employee_ops_entries')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .then(({ count }) => {
        const unseen = Math.max(0, (count || 0) - seen);
        setOpsTodayCount(unseen);
      });

    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('from', 'emp')
      .eq('status', 'unread')
      .then(({ count }) => setUnreadMsgCount(count || 0));
  }

  useEffect(() => {
    if (!orgId) return;
    refreshBadgeCounts();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel('shell-badge-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_ops_entries', filter: `org_id=eq.${orgId}` }, refreshBadgeCounts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `org_id=eq.${orgId}` }, refreshBadgeCounts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `org_id=eq.${orgId}` }, refreshBadgeCounts)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [orgId]);

  useEffect(() => {
    if (!location.pathname.startsWith('/admin/ops-inbox')) return;
    const today = new Date().toISOString().slice(0, 10);
    const seenKey = `hr_ops_today_seen_${today}`;
    supabase
      .from('employee_ops_entries')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .then(({ count }) => {
        if (count) localStorage.setItem(seenKey, String(count));
        setOpsTodayCount(0);
      });
  }, [location.pathname, orgId]);

  useEffect(() => {
    if (location.pathname.startsWith('/admin/messages')) setUnreadMsgCount(0);
  }, [location.pathname]);
  const openOps = () => {
    window.location.href = OPS_APP_URL;
  };

  const returnTo = new URLSearchParams(location.search).get('returnTo');

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="เปิดเมนู">☰</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={diamond} alt="LUCID HR" style={{ height: 26 }} />
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.3px', color: 'var(--ink)' }}>LUCID HR</span>
        </div>
      </div>
      {sidebarOpen && <button className="admin-sidebar-overlay" onClick={closeSidebar} aria-label="ปิดเมนู" />}
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={diamond} alt="LUCID HR" style={{ height: 36 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.3px', color: 'var(--ink)', lineHeight: 1 }}>LUCID HR</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '1.5px', marginTop: 3 }}>HUMAN RESOURCE</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>แอดมิน</div>
          </div>
          <button className="admin-sidebar-close" onClick={closeSidebar} aria-label="ปิดเมนู">×</button>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.end} onClick={closeSidebar} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--ink)',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              marginBottom: 2,
            })}>
              <span>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.path === '/admin/ops-inbox' && opsTodayCount > 0 && (
                <span style={{
                  background: '#e53e3e', color: '#fff', borderRadius: 999,
                  fontSize: 11, fontWeight: 800, padding: '2px 7px', lineHeight: 1.4,
                  minWidth: 20, textAlign: 'center',
                }}>
                  {opsTodayCount > 99 ? '99+' : opsTodayCount}
                </span>
              )}
              {n.path === '/admin/messages' && unreadMsgCount > 0 && (
                <span style={{
                  background: '#e53e3e', color: '#fff', borderRadius: 999,
                  fontSize: 11, fontWeight: 800, padding: '2px 7px', lineHeight: 1.4,
                  minWidth: 20, textAlign: 'center',
                }}>
                  {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: 8 }}>
          <button onClick={openOps} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
            เปิดระบบร้าน / OPS
          </button>
          <button onClick={adminLogout} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="employees/*" element={<AdminEmployees />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="payroll" element={<AdminPayroll />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="ops-inbox" element={<AdminOpsInbox />} />
          <Route path="settings" element={<AdminSettings />} />
        </Routes>
        {returnTo && (
          <a href={returnTo}
            style={{ position: 'fixed', left: 14, bottom: 12, zIndex: 30, display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '7px 14px',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,113,227,.35)',
              border: 'none', cursor: 'pointer' }}>
            ← กลับ LUCID Operate
          </a>
        )}
        <div style={{ position: 'fixed', right: 14, bottom: 12, fontSize: 11, color: 'var(--muted)', background: 'rgba(255,255,255,.92)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', zIndex: 20 }}>
          {APP_VERSION}
        </div>
      </main>
    </div>
  );
}

