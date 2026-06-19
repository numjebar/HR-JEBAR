import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import EmpHome from './EmpHome';
import EmpHistory from './EmpHistory';
import EmpPay from './EmpPay';
import EmpMessages from './EmpMessages';
import EmpProfile from './EmpProfile';
import EmpOps from './EmpOps';
import { APP_VERSION } from '../../lib/version';

const tabs = [
  { path: '/emp', label: 'หน้าหลัก', icon: HomeIcon, end: true },
  { path: '/emp/history', label: 'ประวัติ', icon: CalIcon },
  { path: '/emp/pay', label: 'รายได้', icon: MoneyIcon },
  { path: '/emp/messages', label: 'ข้อความ', icon: ChatIcon },
  { path: '/emp/profile', label: 'โปรไฟล์', icon: UserIcon },
];

export default function EmpShell() {
  const { employeeSessionToken, employee } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  async function fetchUnread() {
    if (!employeeSessionToken) return;
    try {
      const { data } = await supabase.rpc('employee_get_messages_v2', { p_session_token: employeeSessionToken });
      setUnreadCount((data || []).filter((m) => m.from === 'admin' && !m.read_at).length);
    } catch {}
  }

  useEffect(() => { fetchUnread(); }, [employeeSessionToken]);

  // Clear badge when user opens messages tab
  useEffect(() => {
    if (location.pathname === '/emp/messages') setUnreadCount(0);
  }, [location.pathname]);

  // Realtime: new messages from admin bump the badge
  useEffect(() => {
    if (!employee?.id) return;
    const ch = supabase.channel('shell-unread')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `emp_id=eq.${employee.id}`,
      }, (payload) => {
        if (payload.new?.from === 'admin') setUnreadCount((n) => n + 1);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [employee?.id]);

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        <Routes>
          <Route index element={<EmpHome />} />
          <Route path="history" element={<EmpHistory />} />
          <Route path="pay" element={<EmpPay />} />
          <Route path="ops" element={<EmpOps />} />
          <Route path="ops/bills" element={<EmpOps />} />
          <Route path="ops/production" element={<EmpOps />} />
          <Route path="ops/inventory" element={<EmpOps />} />
          <Route path="ops/cake-stock" element={<EmpOps />} />
          <Route path="ops/supplies-count" element={<EmpOps />} />
          <Route path="ops/purchase-list" element={<EmpOps />} />
          <Route path="messages" element={<EmpMessages />} />
          <Route path="profile" element={<EmpProfile />} />
        </Routes>
      </div>
      {/* bottom tab bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--surface)',
        borderTop: '1px solid var(--line)', display: 'flex', zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tabs.map((t) => {
          const isMessages = t.path === '/emp/messages';
          return (
            <NavLink key={t.path} to={t.path} end={t.end} style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px', textDecoration: 'none', fontSize: 11,
              color: isActive ? 'var(--accent)' : 'var(--muted)', fontWeight: isActive ? 600 : 400,
              gap: 3,
            })}>
              <div style={{ position: 'relative' }}>
                <t.icon size={22} />
                {isMessages && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -7,
                    background: '#ef4444', color: '#fff',
                    borderRadius: 999, fontSize: 9, fontWeight: 800,
                    padding: '1px 4px', lineHeight: 1.4, minWidth: 14, textAlign: 'center',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {t.label}
            </NavLink>
          );
        })}
      </nav>
      <div style={{ position: 'fixed', right: 12, bottom: 74, fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,.92)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 8px', zIndex: 55 }}>
        {APP_VERSION}
      </div>
    </div>
  );
}

function HomeIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
}
function CalIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function MoneyIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M12 10v5m-2-2h4"/><circle cx="12" cy="12" r="2"/></svg>;
}
function ChatIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}
function UserIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}

