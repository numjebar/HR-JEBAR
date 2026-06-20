import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { fmtDateFull, fmtHM, rulesFor, shopRulesFor } from '../../lib/payroll';
import CheckInFlow from './CheckInFlow';

function nowClock() {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

export default function EmpHome() {
  const navigate = useNavigate();
  const { employee, employeeSessionToken, orgId } = useAuthStore();
  const [currentEmployee, setCurrentEmployee] = useState(employee);
  const [branch, setBranch] = useState(null);
  const [settings, setSettings] = useState(null);
  const [todayAtt, setTodayAtt] = useState(null);
  const [weekAtt, setWeekAtt] = useState([]);
  const [messages, setMessages] = useState([]);
  const [todayOpsCounts, setTodayOpsCounts] = useState({});
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
    if (!employee?.id || !orgId) return;
    const ch = supabase.channel(`emp-home-${employee.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `emp_id=eq.${employee.id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `emp_id=eq.${employee.id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `org_id=eq.${orgId}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [employee?.id, orgId]);

  function loadOpsCounts() {
    if (!employee?.id || !orgId) return;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('employee_ops_entries')
      .select('task_key')
      .eq('emp_id', employee.id)
      .eq('org_id', orgId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .then(({ data }) => {
        const counts = {};
        (data || []).forEach(e => { counts[e.task_key] = (counts[e.task_key] || 0) + 1; });
        setTodayOpsCounts(counts);
      }).catch(() => {});
  }

  useEffect(() => {
    loadOpsCounts();
  }, [employee?.id, orgId]);

  useEffect(() => {
    if (!employee?.id || !orgId) return;
    const ch = supabase.channel(`emp-ops-counts-${employee.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_ops_entries', filter: `emp_id=eq.${employee.id}` }, loadOpsCounts)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [employee?.id, orgId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockText(nowClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingTasks = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (messages || [])
      .filter(m => m.kind === 'task' && m.from === 'admin' && m.status !== 'done' && m.due && m.due >= todayStr)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 3);
  }, [messages]);

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
    { value: weekSummary.presentDays, label: 'มาสัปดาห์นี้' },
    { value: pendingTasks, label: 'งานค้าง' },
    { value: unreadCount, label: 'ข้อความใหม่' },
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

        {/* Unread message preview */}
        {unreadCount > 0 && (() => {
          const firstUnread = (messages || []).find(m => m.from === 'admin' && !m.read_at);
          if (!firstUnread) return null;
          return (
            <div
              onClick={() => navigate('/emp/messages')}
              style={{
                marginBottom: 12, padding: '12px 14px', borderRadius: 18,
                background: '#fff8e8', border: '1.5px solid #f4dfab',
                cursor: 'pointer', display: 'grid', gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#7a5b2b' }}>
                  💬 ข้อความจากแอดมิน{unreadCount > 1 ? ` (${unreadCount})` : ''}
                </span>
                <span style={{ fontSize: 11, color: '#9b7a5a' }}>ดูทั้งหมด ›</span>
              </div>
              <div style={{ fontSize: 13, color: '#5a4024', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firstUnread.text || '…'}
              </div>
            </div>
          );
        })()}

        {/* OPS quick shortcuts */}
        <div style={{ marginTop: 4 }}>
          {(() => {
            const todayOpsTotal = Object.values(todayOpsCounts).reduce((s, v) => s + v, 0);
            return (
              <div style={{ fontSize: 12, color: '#9b7a5a', fontWeight: 700, marginBottom: 8, paddingLeft: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>งานร้านวันนี้</span>
                {todayOpsTotal > 0 && (
                  <span style={{ background: '#ecfdf3', color: '#0d7a46', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✓ {todayOpsTotal} รายการ</span>
                )}
              </div>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { path: '/emp/ops/bills',          icon: '📷', label: 'ถ่ายบิล',    taskKey: 'bills' },
              { path: '/emp/ops/purchase-list',  icon: '🛒', label: 'ใบสั่งซื้อ', taskKey: 'purchase-list' },
              { path: '/emp/ops/production',     icon: '🏭', label: 'ผลิตขนม',    taskKey: 'production' },
              { path: '/emp/ops/inventory',      icon: '📦', label: 'เช็กของ',    taskKey: 'inventory' },
              { path: '/emp/ops/supplies-count', icon: '🧴', label: 'ของใช้',     taskKey: 'supplies-count' },
              { path: '/emp/ops/cake-stock',     icon: '🍰', label: 'สต๊อกเค้ก', taskKey: 'cake-stock' },
            ].map(item => {
              const count = todayOpsCounts[item.taskKey] || 0;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '14px 8px', borderRadius: 18,
                    border: `1px solid ${count > 0 ? '#bbe7cf' : '#eadcc6'}`,
                    background: count > 0 ? '#f0fdf4' : '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#2f241f',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{item.icon}</span>
                  {item.label}
                  {count > 0 && (
                    <span style={{ background: '#ecfdf3', color: '#0d7a46', borderRadius: 999, padding: '1px 6px', fontSize: 11, fontWeight: 800, lineHeight: 1.4 }}>
                      ✓{count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => navigate('/emp/ops')}
            style={{
              marginTop: 8, width: '100%', padding: '11px 14px', borderRadius: 16,
              border: '1px solid #eadcc6', background: 'none',
              fontSize: 13, color: '#9b7a5a', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            ดูทุกเมนูงาน ›
          </button>

          {upcomingTasks.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#9b7a5a', fontWeight: 700, marginBottom: 8, paddingLeft: 2 }}>📋 งานที่ต้องทำ</div>
              {upcomingTasks.map(task => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const diffDays = Math.round((new Date(task.due + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
                const isUrgent = diffDays <= 0;
                const isSoon = diffDays === 1;
                return (
                  <div key={task.id} onClick={() => navigate('/emp/messages')} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 14, marginBottom: 6, cursor: 'pointer',
                    background: isUrgent ? '#fff1f1' : '#fff',
                    border: `1px solid ${isUrgent ? '#fca5a5' : isSoon ? '#fde68a' : '#eadcc6'}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {task.text}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: isUrgent ? '#b42318' : isSoon ? '#b45309' : '#0d7a46' }}>
                      {diffDays === 0 ? 'วันนี้!' : `${diffDays}วัน`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
