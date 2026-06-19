import { useNavigate } from 'react-router-dom';
import logo from '../assets/jebar-logo.png';

export default function RolePicker() {
  const nav = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
      <img src={logo} alt="JEBAR" style={{ height: 64 }} />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>JEBAR OPERATIONS SYSTEM</h1>
        <p style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 520 }}>
          ระบบกลางสำหรับพนักงาน เจ้าของร้าน และการจัดการหน้าร้านในแอปเดียว
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <button className="btn btn-primary" style={{ padding: '16px 20px', fontSize: 16 }} onClick={() => nav('/emp/login')}>
          เข้าสู่ระบบพนักงาน
        </button>
        <button className="btn" style={{ background: 'var(--ink)', color: '#fff', padding: '16px 20px', fontSize: 16 }} onClick={() => nav('/admin/login')}>
          เข้าสู่ระบบเจ้าของร้าน / แอดมิน
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', maxWidth: 420 }}>
        พนักงานเข้าสู่ระบบแล้วสามารถเข้าเมนูระบบร้าน / OPS ได้จากในแอปพนักงาน
      </div>
    </div>
  );
}
