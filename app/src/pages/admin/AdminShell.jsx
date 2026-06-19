import { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/jebar-logo.png';
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
  const { adminLogout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const openOps = () => {
    window.location.href = OPS_APP_URL;
  };

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="เปิดเมนู">☰</button>
        <img src={logo} alt="JEBAR" style={{ height: 26 }} />
      </div>
      {sidebarOpen && <button className="admin-sidebar-overlay" onClick={closeSidebar} aria-label="ปิดเมนู" />}
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <img src={logo} alt="JEBAR" style={{ height: 32 }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>แอดมิน</div>
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
              <span>{n.icon}</span>{n.label}
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
        <div style={{ position: 'fixed', right: 14, bottom: 12, fontSize: 11, color: 'var(--muted)', background: 'rgba(255,255,255,.92)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', zIndex: 20 }}>
          {APP_VERSION}
        </div>
      </main>
    </div>
  );
}

