import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { fmtDateFull, fmtHM, rulesFor, shopRulesFor } from '../../lib/payroll';
import CheckInFlow from './CheckInFlow';

const OPERATE_EMPLOYEE_URL = 'https://je-bar-operate.pages.dev/';

function nowClock() {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function openOperateForEmployee(employee, branch) {
  const url = new URL(OPERATE_EMPLOYEE_URL);
  const employeeId = employee?.id || employee?.employee_id || employee?.emp_id || employee?.code || 'unknown';
  const employeeName = employee?.name || employee?.nickname || employeeId;
  const branchName = branch?.label || branch?.name || employee?.branch || employee?.branch_id || '';

  url.searchParams.set('mode', 'employee');
  url.searchParams.set('emp_id', String(employeeId));
  url.searchParams.set('emp_name', String(employeeName));
  if (branchName) url.searchParams.set('branch', String(branchName));
  url.searchParams.set('from_hr', '1');

  window.location.href = url.toString();
}

export default function EmpHome() {
  const { employee, employeeSessionToken } = useAuthStore();
  const [currentEmployee, setCurrentEmployee] = useState(employee);
  const [branch, setBranch] = useState(null);
  const [settings, setSettings] = useState(null);
  const [todayAtt, setTodayAtt] = useState(null);
  const [weekAtt, setWeekAtt] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [clockText, setClockText] = useState(nowClock());

  async function load() {
    const { data } = await supabase.rpc('employee_home_data_v2', {
      p_session_token: employeeSessionToken,
    });
    if (data?.employee?.id) {
      setCurrentEmployee(data.employee);
      useAuthStore.setState({ employee: data.employee });
    }
    setBranch(data?.branch || null);
    setSettings(data?.settings || null);
    setTodayAtt(data?.today_att || null);
    setWeekAtt(data?.week_att || []);
    setMessages(data?.messages || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockText(nowClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const rules = rulesFor(settings?.rules, branch, currentEmployee);
  const shopRules = shopRulesFor(settings?.shop_rules, branch);
  const unreadCount = useMemo(
    () => (messages || []).filter((m) => m.from === 'admin' && !m.read_at).length,
    [messages]
  );
  const pendingTasks = useMemo(
    () => (messages || []).filter((m) => m.kind === 'task' && m.from === 'admin' && m.status !== 'done').length,
    [messages]
  );
  const weekSummary = useMemo(() => {
    const presentDays = weekAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const otMinutes = weekAtt.reduce((sum, a) => sum + Number(a.ot_min || 0), 0);
    return { presentDays, otMinutes };
  }, [weekAtt]);

  const lastCheckIn = todayAtt?.clock_in ? fmtHM(parseClock(todayAtt.clock_in)) : '--';
  const lastCheckOut = todayAtt?.clock_out ? fmtHM(parseClock(todayAtt.clock_out)) : '--';
  const canClockOut = !!todayAtt?.clock_in && !todayAtt?.clock_out;
  const actionMode = canClockOut ? 'out' : 'in';
  const actionLabel = canClockOut ? 'ลงเวลาออกงาน' : 'ลงเวลาเข้างาน';

  const quickStats = [
    { value: weekSummary.presentDays, label: 'มาวันนี้' },
    { value: pendingTasks, label: 'ค้างที่ต้องทำ' },
    { value: unreadCount, label: 'ของแจ้ง' },
  ];

  return (
    <div style={{ padding: '16px 16px 96px', background: 'linear-gradient(180deg, #f8f3ea 0%, #f6f7fb 18%, #f6f7fb 100%)' }}>
      <div className="card" style={{
        padding: 18,
        borderRadius: 32,
        background: 'linear-gradient(180deg, rgba(255,249,241,.96) 0%, rgba(255,255,255,.96) 100%)',
        border: '1px solid rgba(197,162,117,.24)',
        boxShadow: '0 24px 60px rgba(30,41,59,.08)',
      }}>
        <div style={{ width: 92, height: 18, borderRadius: 999, background: '#0d0d0d', margin: '0 auto 18px' }} />

        <div style={{ color: '#c77a45', fontWeight: 800, fontSize: 18 }}>สวัสดี, {currentEmployee?.nickname || currentEmployee?.name || 'ทีมงาน'}</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          กะเช้า · {fmtDateFull(new Date().toISOString().slice(0, 10))}
        </div>

        <div style={{ textAlign: 'center', margin: '18px 0 12px', fontSize: 64, letterSpacing: 6, fontWeight: 500, color: '#3f332e' }}>
          JEBAR
        </div>

        <div style={{
          background: '#f6efe3',
          border: '1px solid #eadcc6',
          borderRadius: 18,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 14, color: '#8a613e', fontWeight: 700 }}>
            🏷️ {branch?.label || 'ยังไม่ตั้งสาขา'} · {todayAtt?.status ? todayStatusLabel(todayAtt.status) : 'ยังไม่ระบุ'}
          </div>
          <button className="btn" style={{ padding: 0, background: 'transparent', border: 'none', color: '#8a613e' }} onClick={() => setShowRules(true)}>
            ⚙️
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {quickStats.map((item) => (
            <div key={item.label} style={{
              background: '#fff',
              border: '1px solid #eadcc6',
              borderRadius: 22,
              padding: '16px 10px',
              textAlign: 'center',
            }}>
              <div className="num" style={{ fontSize: 34, fontWeight: 800, color: '#bf6c2a', marginBottom: 2 }}>{item.value}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <button
          className="btn"
          onClick={() => openOperateForEmployee(currentEmployee, branch)}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 22px',
            alignItems: 'center',
            gap: 14,
            padding: 18,
            width: '100%',
            borderRadius: 24,
            border: '1px solid #eadcc6',
            background: '#fff',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            background: '#f4e2cf',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}>
            📋
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#2f241f' }}>งานร้าน / เมนูปฏิบัติงาน</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              รวมเมนูถ่ายบิล ผลิตขนม วัตถุดิบ ของใช้ และใบสั่งซื้อไว้หน้าเดียว
            </div>
          </div>
          <div style={{ fontSize: 26, color: '#9b7a5a' }}>›</div>
        </button>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <div style={{ background: '#14191f', color: '#fff', borderRadius: 24, padding: 20 }}>
          <div style={{ fontSize: 14, opacity: 0.84, marginBottom: 10 }}>
            {branch?.label || 'ยังไม่ได้ตั้งสาขา'} · {fmtDateFull(new Date().toISOString().slice(0, 10))}
          </div>
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 800, marginBottom: 16 }}>{clockText}</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, opacity: 0.88, marginBottom: 18 }}>
            <span>เข้า {lastCheckIn}</span>
            <span>ออก {lastCheckOut}</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: 22, fontWeight: 800, padding: '14px 18px', borderRadius: 18 }}
            onClick={() => setShowCheckin(true)}
          >
            {actionLabel}
          </button>
        </div>
      </div>

      {showCheckin && (
        <CheckInFlow
          employee={currentEmployee}
          branch={branch}
          rules={rules}
          mode={actionMode}
          employeeSessionToken={employeeSessionToken}
          onClose={() => {
            setShowCheckin(false);
            load();
          }}
        />
      )}

      {showRules && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>ระเบียบร้าน</div>
            {shopRules.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>ยังไม่มีระเบียบร้านที่ตั้งไว้</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {shopRules.map((rule, index) => (
                  <div key={`${index}-${rule}`} style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px 14px', fontSize: 14 }}>
                    {index + 1}. {rule}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setShowRules(false)}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseClock(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function todayStatusLabel(status) {
  if (status === 'present') return 'มาทำงาน';
  if (status === 'late') return 'มาสาย';
  if (status === 'leave') return 'ลา';
  if (status === 'absent') return 'ขาดงาน';
  return 'ยังไม่ระบุ';
}
