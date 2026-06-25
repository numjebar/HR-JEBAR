import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { fmtDateFull, fmtHM, rulesFor, shopRulesFor } from '../../lib/payroll';
import CheckInFlow from './CheckInFlow';
import { OPS_CONFIG_KEY } from '../../lib/operateCatalog';

function nowClock() {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function currentShiftLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'กะเช้า';
  if (h < 17) return 'กะบ่าย';
  return 'กะเย็น';
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
  const [monthAtt, setMonthAtt] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);

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
    const opsConfig = data?.settings?.rules?.ops_config;
    if (opsConfig?.url && opsConfig?.key) {
      try { sessionStorage.setItem(OPS_CONFIG_KEY, JSON.stringify({ url: opsConfig.url, key: opsConfig.key })); } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!employeeSessionToken) return;
    supabase.rpc('employee_history_data_v2', { p_session_token: employeeSessionToken })
      .then(({ data }) => {
        const all = data?.attendance || [];
        const thisMonth = new Date().toISOString().slice(0, 7);
        setMonthAtt(all.filter((a) => a.date?.startsWith(thisMonth)));
      }).catch(() => {});
    supabase.rpc('employee_leave_balance_v2', { p_session_token: employeeSessionToken })
      .then(({ data }) => { if (data && !data.error) setLeaveBalance(data); })
      .catch(() => {});
  }, [employeeSessionToken]);

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

  const monthSummary = useMemo(() => {
    const worked = monthAtt.filter((a) => a.status === 'present').length;
    const late = monthAtt.filter((a) => a.status === 'late').length;
    const leave = monthAtt.filter((a) => a.status === 'leave').length;
    const otMin = monthAtt.reduce((s, a) => s + Number(a.ot_min || 0), 0);
    return { worked: worked + late, late, leave, otMin };
  }, [monthAtt]);

  const quickStats = [
    { value: weekSummary.presentDays, label: 'มาสัปดาห์นี้' },
    { value: pendingTasks, label: 'งานค้าง' },
    { value: unreadCount, label: 'ข้อความใหม่' },
  ];

  return (
    <div style={{ padding: '16px 16px 96px', background: 'var(--bg)' }}>
      <div className="card" style={{ padding: 18, borderRadius: 'var(--r-card-lg)' }}>
        <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 18 }}>สวัสดี, {currentEmployee?.nickname || currentEmployee?.name || 'ทีมงาน'}</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          {currentShiftLabel()} · {fmtDateFull(new Date().toISOString().slice(0, 10))}
        </div>

        {/* Monthly summary card */}
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)', padding: '14px 16px', margin: '14px 0 12px',
        }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
            สรุปเดือนนี้
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { value: monthSummary.worked, label: 'มาแล้ว', unit: 'วัน' },
              { value: monthSummary.late, label: 'มาสาย', unit: 'ครั้ง' },
              { value: monthSummary.leave, label: 'ลา', unit: 'วัน' },
              { value: monthSummary.otMin > 0 ? (Math.round(monthSummary.otMin / 6) / 10) : 0, label: 'OT', unit: 'ชม.' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{item.value}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4, marginTop: 2 }}>{item.unit}<br />{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave balance card */}
        {leaveBalance && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-card)', padding: '14px 16px', margin: '0 0 12px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
              สิทธิ์ลาคงเหลือ ปี {(new Date().getFullYear() + 543).toString()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'ลาพักร้อน', used: leaveBalance.used_annual, total: leaveBalance.annual_leave_days },
                { label: 'ลาป่วย', used: leaveBalance.used_sick, total: leaveBalance.sick_leave_days },
                { label: 'ลากิจ', used: leaveBalance.used_personal, total: null },
              ].map((item) => {
                const remaining = item.total !== null ? item.total - item.used : null;
                const pct = item.total ? Math.min(1, item.used / item.total) : 0;
                const out = remaining === 0;
                return (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700, color: out ? 'var(--danger-fg)' : 'var(--ink)', lineHeight: 1 }}>
                      {remaining !== null ? remaining : item.used}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {remaining !== null ? `เหลือ / ${item.total} วัน` : `ใช้ไป ${item.used} วัน`}
                    </div>
                    {item.total && (
                      <div style={{ height: 3, background: 'var(--line)', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: pct >= 1 ? 'var(--danger-fg)' : 'var(--accent)', borderRadius: 99, transition: 'width .4s' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 14,
        }}>
          <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
            {branch?.label || 'ยังไม่ตั้งสาขา'} · <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{todayAtt?.status ? todayStatusLabel(todayAtt.status) : 'ยังไม่ระบุ'}</span>
          </div>
          <button className="btn" style={{ padding: 0, background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 18 }} onClick={() => setShowRules(true)}>
            ⚙
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {quickStats.map((item) => (
            <div key={item.label} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-card)', padding: '16px 10px', textAlign: 'center',
            }}>
              <div className="num" style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{item.value}</div>
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
                marginBottom: 12, padding: '12px 14px', borderRadius: 'var(--r-card)',
                background: 'var(--accent-soft)', border: '1px solid var(--line)',
                cursor: 'pointer', display: 'grid', gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  ข้อความจากแอดมิน{unreadCount > 1 ? ` (${unreadCount})` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>ดูทั้งหมด ›</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, paddingLeft: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>งานร้านวันนี้</span>
                {todayOpsTotal > 0 && (
                  <span className="badge badge-green">✓ {todayOpsTotal} รายการ</span>
                )}
              </div>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              {
                path: '/emp/ops/bills', taskKey: 'bills', label: 'ถ่ายบิล',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                ),
              },
              {
                path: '/emp/ops/purchase-list', taskKey: 'purchase-list', label: 'ใบสั่งซื้อ',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/>
                    <line x1="8" y1="17" x2="12" y2="17"/>
                  </svg>
                ),
              },
              {
                path: '/emp/ops/production', taskKey: 'production', label: 'ผลิตขนม',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="11" width="20" height="11" rx="2"/>
                    <path d="M7 11c0-5 2-7 5-7s5 2 5 7"/>
                    <line x1="2" y1="16" x2="22" y2="16"/>
                    <line x1="9" y1="19" x2="9" y2="22"/>
                    <line x1="15" y1="19" x2="15" y2="22"/>
                  </svg>
                ),
              },
              {
                path: '/emp/ops/inventory', taskKey: 'inventory', label: 'เช็กของ',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                ),
              },
              {
                path: '/emp/ops/supplies-count', taskKey: 'supplies-count', label: 'ของใช้',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <path d="M9 2v4M15 2v4"/>
                    <line x1="8" y1="11" x2="16" y2="11"/>
                    <line x1="8" y1="15" x2="13" y2="15"/>
                  </svg>
                ),
              },
              {
                path: '/emp/ops/cake-stock', taskKey: 'cake-stock', label: 'สต๊อกเค้ก',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="15" width="20" height="7" rx="2"/>
                    <rect x="5" y="9" width="14" height="6" rx="1.5"/>
                    <path d="M9 9c0-3 1.5-4.5 3-4.5S15 6 15 9"/>
                    <line x1="12" y1="4.5" x2="12" y2="2.5"/>
                    <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                ),
              },
            ].map(item => {
              const count = todayOpsCounts[item.taskKey] || 0;
              const done = count > 0;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '14px 6px 12px',
                    borderRadius: 'var(--r-card)',
                    border: `1px solid ${done ? 'var(--accent)' : 'var(--line)'}`,
                    background: done ? 'var(--accent-soft)' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: done ? 'var(--accent)' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: done ? '#fff' : 'var(--accent)',
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.3 }}>
                    {item.label}
                  </div>
                  {done && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      minWidth: 18, height: 18, borderRadius: 99,
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 800, padding: '0 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => navigate('/emp/ops')}
            style={{
              marginTop: 8, width: '100%', padding: '11px 14px', borderRadius: 'var(--r-input)',
              border: '1px solid var(--line)', background: 'none',
              fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            ดูทุกเมนูงาน ›
          </button>

          {upcomingTasks.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, paddingLeft: 2 }}>งานที่ต้องทำ</div>
              {upcomingTasks.map(task => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const diffDays = Math.round((new Date(task.due + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
                const isUrgent = diffDays <= 0;
                const isSoon = diffDays === 1;
                return (
                  <div key={task.id} onClick={() => navigate('/emp/messages')} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 'var(--r-input)', marginBottom: 6, cursor: 'pointer',
                    background: isUrgent ? 'var(--danger-bg)' : 'var(--surface)',
                    border: `1px solid ${isUrgent ? 'var(--danger-fg)' : 'var(--line)'}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {task.text}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: isUrgent ? 'var(--danger-fg)' : isSoon ? 'var(--late-fg)' : 'var(--accent)' }}>
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
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-card-lg)', padding: 20 }}>
          <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 10 }}>
            {branch?.label || 'ยังไม่ได้ตั้งสาขา'} · {fmtDateFull(new Date().toISOString().slice(0, 10))}
          </div>
          <div className="num" style={{ fontSize: 52, lineHeight: 1, fontWeight: 700, marginBottom: 16 }}>{clockText}</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, opacity: 0.8, marginBottom: 18 }}>
            <span>เข้า {lastCheckIn}</span>
            <span>ออก {lastCheckOut}</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: 20, fontWeight: 700, padding: '14px 18px', borderRadius: 'var(--r-card)' }}
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
