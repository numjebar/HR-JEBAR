import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import logo from '../assets/lucid-logo.svg';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const adminLogin = useAuthStore((s) => s.adminLogin);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await adminLogin(email, password);
      nav('/admin');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img src={logo} alt="LUCID" style={{ height: 40 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>แอดมิน</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>เข้าสู่ระบบจัดการ</div>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>อีเมล</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" required />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>รหัสผ่าน</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => nav('/')}>← กลับ</button>
        </form>
      </div>
    </div>
  );
}
