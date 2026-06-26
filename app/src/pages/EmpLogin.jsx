import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

function Avatar({ emp }) {
  const displayName = emp.nickname || emp.name || 'พนักงาน';
  const hasPhoto = !!emp.photo_url;
  return (
    <div style={{
      width: hasPhoto ? 56 : 'auto',
      minWidth: 56,
      maxWidth: hasPhoto ? 56 : 128,
      height: 56,
      padding: hasPhoto ? 0 : '0 14px',
      borderRadius: hasPhoto ? '50%' : 999,
      background: emp.color || 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: hasPhoto ? 20 : 13, flexShrink: 0,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {emp.photo_url
        ? <img src={emp.photo_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : displayName
      }
    </div>
  );
}

export default function EmpLogin() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const submittedPinRef = useRef('');
  const nav = useNavigate();
  const empLoginByPin = useAuthStore((s) => s.empLoginByPin);

  useEffect(() => {
    let alive = true;

    async function loadEmployees() {
      setLoadingEmployees(true);
      setLoadErr('');

      try {
        const { data, error } = await supabase.rpc('employee_login_options');

        if (error) {
        const fallback = await supabase
            .from('employees')
            .select('id,name,nickname,color,photo_url')
            .order('name');

          if (fallback.error) throw error;
          if (alive) setEmployees(fallback.data || []);
          return;
        }

        if (alive) setEmployees(data || []);
      } catch {
        if (alive) {
          setEmployees([]);
          setLoadErr('โหลดรายชื่อพนักงานไม่ได้ กรุณาตรวจสอบสิทธิ์ฐานข้อมูลสำหรับหน้า PIN');
        }
      } finally {
        if (alive) setLoadingEmployees(false);
      }
    }

    loadEmployees();
    return () => { alive = false; };
  }, []);

  function pressPin(digit) {
    if (loading || pin.length >= 4) return;
    setErr('');
    setPin((p) => p + digit);
  }

  const login = useCallback(async (pinToSubmit) => {
    if (!selected || loading) return;

    setErr('');
    setLoading(true);
    try {
      await empLoginByPin(selected, pinToSubmit);
      nav('/emp', { replace: true });
    } catch (ex) {
      setErr(ex?.message || 'PIN ไม่ถูกต้อง');
      submittedPinRef.current = '';
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [empLoginByPin, loading, nav, selected]);

  useEffect(() => {
    if (pin.length !== 4 || !selected || loading) return;

    const submitKey = `${selected.id}:${pin}`;
    if (submittedPinRef.current === submitKey) return;

    submittedPinRef.current = submitKey;
    login(pin);
  }, [pin, selected, loading, login]);

  function chooseEmployee(emp) {
    submittedPinRef.current = '';
    setSelected(emp);
    setPin('');
    setErr('');
  }

  if (!selected) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 28 }}>
          <img src="/jebar-logo.png" alt="JE BAR" style={{ height: 28, width: 'auto' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>เลือกบัญชีของคุณ</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingEmployees && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>กำลังโหลดรายชื่อพนักงาน...</div>
          )}
          {loadErr && (
            <div style={{ color: 'var(--danger-fg)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>{loadErr}</div>
          )}
          {employees.map((emp) => (
            <button key={emp.id} onClick={() => chooseEmployee(emp)} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-card)', cursor: 'pointer', textAlign: 'left',
            }}>
              <Avatar emp={emp} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{emp.name}</div>
                {emp.nickname && <div style={{ color: 'var(--muted)', fontSize: 13 }}>"{emp.nickname}"</div>}
              </div>
            </button>
          ))}
          {!loadingEmployees && !loadErr && employees.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>ยังไม่มีข้อมูลพนักงาน</div>
          )}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 24, width: '100%' }} onClick={() => nav('/')}>← กลับ</button>
      </div>
    );
  }

  // PIN pad
  const dots = [0, 1, 2, 3].map((i) => (
    <div key={i} style={{
      width: 16, height: 16, borderRadius: '50%',
      background: i < pin.length ? 'var(--accent)' : 'var(--line)',
      transition: 'background .15s',
    }} />
  ));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Avatar emp={selected} />
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 12 }}>{selected.name}</div>
        {selected.nickname && <div style={{ color: 'var(--muted)' }}>"{selected.nickname}"</div>}
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--muted)', marginTop: 16 }}>กรอก PIN 4 หลัก</div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>{dots}</div>
      {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {loading && <div style={{ color: 'var(--muted)', marginBottom: 12 }}>กำลังตรวจสอบ...</div>}

      {/* PIN pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 280, width: '100%' }}>
        {[1,2,3,4,5,6,7,8,9].map((d) => (
          <button key={d} onClick={() => pressPin(String(d))} style={{
            padding: '20px 0', fontSize: 24, fontWeight: 600,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-card)', cursor: loading ? 'wait' : 'pointer',
          }}>{d}</button>
        ))}
        <div />
        <button onClick={() => pressPin('0')} style={{
          padding: '20px 0', fontSize: 24, fontWeight: 600,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)', cursor: loading ? 'wait' : 'pointer',
        }}>0</button>
        <button onClick={() => !loading && setPin((p) => p.slice(0, -1))} style={{
          padding: '20px 0', fontSize: 20,
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)', cursor: loading ? 'wait' : 'pointer', color: 'var(--muted)',
        }}>⌫</button>
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { submittedPinRef.current = ''; setSelected(null); setPin(''); setErr(''); }} disabled={loading}>เปลี่ยนบัญชี</button>
    </div>
  );
}
