import { useNavigate } from 'react-router-dom';
import diamond from '../assets/lucid-diamond.svg';

export default function RolePicker() {
  const nav = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <img src={diamond} alt="LUCID HR" style={{ height: 72 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.5px', lineHeight: 1 }}>LUCID HR</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '2px', marginTop: 4 }}>HUMAN RESOURCE PLATFORM</div>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
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
