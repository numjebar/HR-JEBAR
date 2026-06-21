import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { addDays, computePay, dayRate, parseYmd, rulesFor, rangeForEmployee, THB, ymd } from '../../lib/payroll';

const URGENT_LEAVE_NOTE_PREFIX = 'ลาด่วนเช้าวันงานโดยไม่มีเหตุผล';

const EMPLOYEE_APP_URL = 'https://hr-jebar.pages.dev';
const PAY_TYPE_LABEL = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
};
const DAY_OFF_OPTIONS = [
  { value: 0, label: 'อาทิตย์' },
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัส' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
];
const WEEKDAY_OPTIONS = [
  { value: 0, label: 'อาทิตย์' },
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัส' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
];
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, idx) => idx + 1);

function payrollPeriodForEmployee(emp, requestedPeriod) {
  if (!emp) return requestedPeriod || 'month';
  if (emp.pay_type === 'weekly') return 'week';
  if (emp.pay_type === 'monthly') return 'month';
  return requestedPeriod || 'day';
}

function allowedPeriodsForEmployee(emp) {
  if (!emp) return [
    { k: 'day', l: 'วันนี้' },
    { k: 'week', l: 'สัปดาห์' },
    { k: 'month', l: 'เดือน' },
  ];
  if (emp.pay_type === 'weekly') return [{ k: 'week', l: 'สัปดาห์' }];
  if (emp.pay_type === 'monthly') return [{ k: 'month', l: 'เดือน' }];
  return [
    { k: 'day', l: 'วันนี้' },
    { k: 'week', l: 'สัปดาห์' },
    { k: 'month', l: 'เดือน' },
  ];
}

function dayOffLabel(days) {
  const active = new Set((days || []).map(Number));
  const labels = DAY_OFF_OPTIONS.filter((day) => active.has(day.value)).map((day) => day.label);
  return labels.length ? labels.join(', ') : 'ไม่มี';
}

function fullThaiDate(iso) {
  const d = parseYmd(iso);
  if (!d) return iso || '—';
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function attendanceStatusMeta(status) {
  if (status === 'present') return { label: 'มา', color: 'var(--accent)', bg: 'var(--accent-soft)' };
  if (status === 'late') return { label: 'สาย', color: 'var(--late-fg)', bg: 'var(--late-bg)' };
  if (status === 'leave') return { label: 'ลา', color: 'var(--danger-fg)', bg: '#fee2e2' };
  if (status === 'paid_leave') return { label: 'ลาจ่าย', color: '#0f766e', bg: '#ccfbf1' };
  if (status === 'absent') return { label: 'ขาด', color: 'var(--danger-fg)', bg: '#fee2e2' };
  if (status === 'off') return { label: 'หยุด', color: 'var(--muted)', bg: 'var(--bg)' };
  return { label: status || '—', color: 'var(--muted)', bg: 'var(--bg)' };
}

function buildAttendanceTimeline(range, attendanceRows, dayOff) {
  if (!range?.from || !range?.to) return [];
  const byDate = new Map((attendanceRows || []).map((row) => [row.date, row]));
  const blockedDays = new Set((dayOff || []).map(Number));
  const items = [];
  for (let cursor = parseYmd(range.from); cursor && cursor <= parseYmd(range.to); cursor = addDays(cursor, 1)) {
    const date = ymd(cursor);
    const row = byDate.get(date);
    if (row) {
      items.push({
        date,
        kind: row.status === 'leave' && row.paid ? 'paid_leave' : row.status,
        row,
      });
      continue;
    }
    items.push({
      date,
      kind: blockedDays.has(cursor.getDay()) ? 'off' : 'absent',
      row: null,
    });
  }
  return items.reverse();
}

function groupAdjustmentsByDate(adjustments) {
  const map = new Map();
  (adjustments || []).forEach((item) => {
    if (!item?.date) return;
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  });
  return map;
}

function summarizeTimeline(items) {
  const summary = {
    workedDays: 0,
    leaveDays: 0,
    paidLeaveDays: 0,
    absentDays: 0,
    offDays: 0,
    payableDays: 0,
  };
  (items || []).forEach((item) => {
    if (item.kind === 'present' || item.kind === 'late') {
      summary.workedDays += 1;
      summary.payableDays += 1;
      return;
    }
    if (item.kind === 'paid_leave') {
      summary.leaveDays += 1;
      summary.paidLeaveDays += 1;
      summary.payableDays += 1;
      return;
    }
    if (item.kind === 'leave') {
      summary.leaveDays += 1;
      return;
    }
    if (item.kind === 'off') {
      summary.offDays += 1;
      return;
    }
    summary.absentDays += 1;
  });
  return summary;
}

function toSyntheticAttendance(items) {
  return (items || [])
    .filter((item) => item.kind !== 'off')
    .map((item) => {
      if (item.row) {
        return {
          ...item.row,
          status: item.kind === 'paid_leave' ? 'leave' : item.row.status,
          paid: item.kind === 'paid_leave' ? true : item.row.paid,
        };
      }
      return {
        date: item.date,
        status: item.kind === 'paid_leave' ? 'leave' : item.kind,
        paid: item.kind === 'paid_leave',
        clock_in: null,
        clock_out: null,
        ot_min: 0,
      };
    });
}

function adjustmentTypeLabel(type) {
  if (type === 'bonus') return 'โบนัส';
  if (type === 'damage') return 'หักเสียหาย';
  if (type === 'advance') return 'เบิกล่วงหน้า';
  return 'รายการอื่น';
}

function Avatar({ emp, size = 48 }) {
  const displayName = emp.nickname || emp.name || 'พนักงาน';
  const hasPhoto = !!emp.photo_url;
  return (
    <div style={{ width: hasPhoto ? size : 'auto', minWidth: size, maxWidth: Math.max(size * 2.2, 96), height: size, padding: hasPhoto ? 0 : '0 12px', borderRadius: hasPhoto ? '50%' : 999, background: emp.color || '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: hasPhoto ? size * 0.35 : Math.max(12, size * 0.24), flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {emp.photo_url ? <img src={emp.photo_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayName}
    </div>
  );
}

export default function AdminEmployees() {
  const { orgId } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const [{ data: emps }, { data: brs }] = await Promise.all([
      supabase.from('employees').select('*').eq('org_id', orgId).order('name'),
      supabase.from('branches').select('*').eq('org_id', orgId),
    ]);
    setEmployees(emps || []);
    setBranches(brs || []);
  }

  useEffect(() => { load(); }, []);

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return <EmpDetail emp={selected} branches={branches} orgId={orgId} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>พนักงาน</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ เพิ่มพนักงาน</button>
      </div>
      <input placeholder="ค้นหาชื่อ ชื่อเล่น แผนก..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {filtered.map((emp) => {
          const br = branches.find((b) => b.id === emp.branch_id);
          return (
            <button key={emp.id} onClick={() => setSelected(emp)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, cursor: 'pointer', textAlign: 'left' }}>
              <Avatar emp={emp} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{emp.nickname && `"${emp.nickname}" · `}{emp.position}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{br?.label || '—'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {showAdd && <EmpFormModal branches={branches} orgId={orgId} onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function EmpDetail({ emp, branches, orgId, onBack }) {
  const naturalPeriod = payrollPeriodForEmployee(emp, 'month');
  const [period, setPeriod] = useState(naturalPeriod);
  const [att, setAtt] = useState([]);
  const [adj, setAdj] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [pay, setPay] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const [showPinRecovery, setShowPinRecovery] = useState(false);
  const [settings, setSettings] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [payRange, setPayRange] = useState(null);
  const effectivePeriod = payrollPeriodForEmployee(emp, period);
  const periodOptions = allowedPeriodsForEmployee(emp);

  const br = branches.find((b) => b.id === emp.branch_id);
  const attendanceTimeline = buildAttendanceTimeline(payRange, att, emp.day_off);
  const timelineSummary = summarizeTimeline(attendanceTimeline);
  const adjustmentsByDate = groupAdjustmentsByDate(adj);
  const offDaysInTimeline = attendanceTimeline.filter((entry) => entry.kind === 'off');

  async function load() {
    const range = rangeForEmployee(effectivePeriod, emp);
    setPayRange(range);
    const [{ data: st }, { data: a }, { data: s }, { data: d }, { data: lv }] = await Promise.all([
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
      supabase.from('attendance').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to).order('date', { ascending: false }),
      supabase.from('sales').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to),
      supabase.from('adjustments').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to).order('created_at', { ascending: false }),
      supabase.from('leaves').select('*').eq('emp_id', emp.id).gte('date_from', range.from).lte('date_from', range.to).order('created_at', { ascending: false }),
    ]);
    setSettings(st || null);
    setAtt(a || []);
    setAdj(d || []);
    setLeaves(lv || []);
    const rules = rulesFor(st?.rules, br, emp);
    const syntheticAttendance = toSyntheticAttendance(buildAttendanceTimeline(range, a || [], emp.day_off));
    setPay(computePay(emp, syntheticAttendance, s || [], d || [], rules, range));
  }

  useEffect(() => {
    setPeriod(naturalPeriod);
  }, [emp?.id, naturalPeriod]);

  useEffect(() => { load(); }, [effectivePeriod, emp?.id]);

  async function deleteEmp() {
    if (!confirm(`ลบพนักงาน "${emp.name}" ออกจากระบบ?`)) return;
    await supabase.from('attendance').delete().eq('emp_id', emp.id);
    await supabase.from('adjustments').delete().eq('emp_id', emp.id);
    await supabase.from('sales').delete().eq('emp_id', emp.id);
    await supabase.from('messages').delete().eq('emp_id', emp.id);
    await supabase.from('employees').delete().eq('id', emp.id);
    onBack();
  }

  async function deleteAdj(id) {
    if (!confirm('ลบรายการนี้?')) return;
    await supabase.from('adjustments').delete().eq('id', id).eq('emp_id', emp.id);
    load();
  }

  async function approveLeave(leaveId) {
    const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
    await supabase.from('leaves').update({ status: 'approved' }).eq('id', leaveId);
    if (leave) {
      const days = [];
      let cursor = new Date(`${leave.date_from}T00:00:00`);
      const end = new Date(`${leave.date_to}T00:00:00`);
      while (cursor <= end) {
        days.push({
          org_id: leave.org_id, emp_id: leave.emp_id, date: ymd(cursor),
          clock_in: null, clock_out: null, status: 'leave', ot_min: 0,
          leave_type: leave.type, paid: true,
        });
        cursor = addDays(cursor, 1);
      }
      await supabase.from('attendance').upsert(days, { onConflict: 'emp_id,date' });
      const rules = rulesFor(settings?.rules, br, emp);
      const deductDays = Number(rules?.urgentLeaveDeductDays || 0);
      if (Boolean(leave.urgent) && deductDays > 0) {
        const note = `${URGENT_LEAVE_NOTE_PREFIX} (หัก ${deductDays} แรง)`;
        const deductAmount = Math.round(dayRate(emp) * deductDays);
        const { data: existingAdjust } = await supabase.from('adjustments').select('id')
          .eq('emp_id', leave.emp_id).eq('date', leave.date_from).eq('auto', true)
          .like('note', `${URGENT_LEAVE_NOTE_PREFIX}%`).maybeSingle();
        if (!existingAdjust && deductAmount > 0) {
          await supabase.from('adjustments').insert({
            emp_id: leave.emp_id, org_id: leave.org_id, date: leave.date_from,
            type: 'other', amount: deductAmount, note, auto: true,
          });
        }
      }
    }
    load();
  }

  async function rejectLeave(leaveId) {
    if (!confirm('ปฏิเสธคำขอลา?')) return;
    const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
    await supabase.from('leaves').update({ status: 'rejected' }).eq('id', leaveId);
    if (leave) {
      await supabase.from('attendance').delete()
        .eq('emp_id', leave.emp_id).gte('date', leave.date_from).lte('date', leave.date_to)
        .eq('status', 'leave').eq('leave_type', leave.type);
      await supabase.from('adjustments').delete()
        .eq('emp_id', leave.emp_id).eq('date', leave.date_from).eq('auto', true)
        .like('note', `${URGENT_LEAVE_NOTE_PREFIX}%`);
    }
    load();
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← กลับ</button>

      {/* profile card */}
      <div className="card" style={{ padding: '20px', display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <Avatar emp={emp} size={72} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{emp.name}</div>
          {emp.nickname && <div style={{ color: 'var(--muted)' }}>"{emp.nickname}"</div>}
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{emp.position} · {emp.department} · {br?.label || '—'}</div>
          <div style={{ marginTop: 4, fontSize: 14 }}>
            {`${PAY_TYPE_LABEL[emp.pay_type] || PAY_TYPE_LABEL.monthly} · ค่าจ้าง ${THB(emp.rate)}/วัน`}
          </div>
          {emp.pay_type === 'weekly' && emp.weekly_cycle_start_day != null && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
              เริ่มรอบสัปดาห์: {WEEKDAY_OPTIONS.find((d) => d.value === Number(emp.weekly_cycle_start_day))?.label || '—'}
            </div>
          )}
          {emp.pay_type === 'monthly' && emp.monthly_cycle_start_day != null && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
              เริ่มรอบเดือน: วันที่ {emp.monthly_cycle_start_day}
            </div>
          )}
          <div style={{ marginTop: 4, fontSize: 14, color: 'var(--muted)' }}>วันหยุดประจำ: {dayOffLabel(emp.day_off)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 13 }} onClick={() => setShowEdit(true)}>แก้ไข</button>
          <button className="btn" style={{ background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 13 }} onClick={() => setShowPinRecovery(true)}>PIN</button>
          <button className="btn" style={{ background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 13 }} onClick={() => setShowMsg(true)}>ส่งข้อความ</button>
          <button className="btn" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #dc2626', fontSize: 13 }} onClick={deleteEmp}>ลบพนักงาน</button>

        </div>
      </div>

      {(emp.closing_tasks || []).length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>เช็กลิสต์ก่อนลงเวลาออก</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emp.closing_tasks.map((task) => (
              <div key={task} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{ color: 'var(--accent)' }}>✓</span>
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>ข้อมูลเอกสาร / ติดต่อ</div>
        {[
          ['เบอร์โทร', emp.phone],
          ['เลขบัตรประชาชน', emp.id_number],
          ['รูปบัตรประชาชน', emp.id_card_url ? <a href={emp.id_card_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>เปิดดูรูป</a> : null],
          ['ธนาคาร', emp.bank_name],
          ['เลขบัญชี', emp.bank_account],
          ['วันหยุดประจำ', dayOffLabel(emp.day_off)],
          ['ผู้ติดต่อฉุกเฉิน', emp.em_name && `${emp.em_name} (${emp.em_rel || '-'}) ${emp.em_phone || ''}`],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
          </div>
        ))}
      </div>

      {/* period toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {periodOptions.map((p) => (
          <button key={p.k} onClick={() => setPeriod(p.k)} className="btn" style={{ background: period === p.k ? 'var(--accent)' : 'var(--surface)', color: period === p.k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 18px', fontSize: 14 }}>{p.l}</button>
        ))}
      </div>

      {payRange && (
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          รอบคำนวณของพนักงานนี้ ({emp.pay_type === 'weekly' ? 'รายสัปดาห์' : emp.pay_type === 'monthly' ? 'รายเดือน' : 'ปัจจุบัน'}):
          {' '}
          <span className="num">{payRange.from}</span> - <span className="num">{payRange.to}</span>
        </div>
      )}

      {/* pay breakdown */}
      {pay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: .8 }}>เงินสุทธิ</div>
            <div className="num" style={{ fontSize: 34, fontWeight: 700, marginTop: 4 }}>{THB(pay.net)}</div>
            <div style={{ fontSize: 13, opacity: .8, marginTop: 8 }}>
              {timelineSummary.workedDays} วันทำงาน · {timelineSummary.leaveDays} วันลา · {timelineSummary.absentDays} วันขาด
            </div>
            {emp.pay_type !== 'daily' && (
              <div style={{ fontSize: 12, opacity: .8, marginTop: 6 }}>
                รอบนี้ {pay.cycleDaysTotal || 0} วัน · หยุด {timelineSummary.offDays} วัน · ตารางงาน {pay.scheduledDaysInCycle || 0} วัน
              </div>
            )}
            {emp.pay_type !== 'daily' && (
              <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
                ถึงวันนี้ผ่านไป {pay.cycleDaysElapsed || 0} วัน · วันมีสิทธิ์รับค่าจ้าง {timelineSummary.payableDays} วัน
              </div>
            )}
          </div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 14 }}>
            {[
              ['ค่าแรงงวดนี้', pay.base, '+'],
              ['OT', pay.otPay, '+'],
              ['คอมมิชชั่น', pay.commission, '+'],
              ['โบนัส', pay.bonus, '+'],
              ['หักสาย', pay.lateDeduct, '-'],
              ['ประกันสังคม', pay.ss, '-'],
            ].filter(([, v]) => v > 0).map(([l, v, t]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>{l}</span>
                <span className="num" style={{ color: t === '+' ? 'var(--accent)' : 'var(--danger-fg)', fontWeight: 600 }}>{t}{THB(v)}</span>
              </div>
            ))}
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
              {emp.pay_type === 'weekly' && 'พนักงานรายสัปดาห์จะแสดงเฉพาะงวดสัปดาห์ปัจจุบันของพนักงานคนนี้'}
              {emp.pay_type === 'monthly' && 'พนักงานรายเดือนจะแสดงเฉพาะงวดเดือนปัจจุบันของพนักงานคนนี้'}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>ตารางสรุปรายวัน</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
          ใช้วันที่จริงเป็นตัวอ้างอิงว่าแต่ละวันเป็นวันทำงาน วันหยุด วันลา วันขาด และมีรายการเบิก/โบนัสวันไหนบ้าง
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>วันทำงานจริง</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{timelineSummary.workedDays}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>วันลา</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{timelineSummary.leaveDays}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>วันหยุด</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{timelineSummary.offDays}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>วันมีสิทธิ์รับค่าจ้าง</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{timelineSummary.payableDays}</div>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>รายการวันหยุดในรอบนี้</div>
        {offDaysInTimeline.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>ไม่มีวันหยุดที่ระบบคำนวณได้จากรอบนี้</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {offDaysInTimeline.map((entry) => (
              <span key={entry.date} className="badge" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                {fullThaiDate(entry.date)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* adjustments */}
      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>โบนัส / รายการหัก</div>
          <button className="btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '6px 14px', fontSize: 13 }} onClick={() => setShowAddAdj(true)}>+ เพิ่ม</button>
        </div>
        {adj.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 14 }}>ยังไม่มีรายการ</div>}
        {adj.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{a.note}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.date} · {a.type === 'bonus' ? 'โบนัส' : a.type === 'damage' ? 'หักเสียหาย' : a.type === 'advance' ? 'เบิกล่วงหน้า' : 'หักอื่นๆ'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="num" style={{ fontWeight: 700, color: a.type === 'bonus' ? 'var(--accent)' : 'var(--danger-fg)' }}>
                {a.type === 'bonus' ? '+' : '-'}{THB(a.amount)}
              </span>
              {!a.auto && <button onClick={() => deleteAdj(a.id)} style={{ color: 'var(--danger-fg)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>}
            </div>
          </div>
        ))}
      </div>

      {/* leaves */}
      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>คำขอลา / ประวัติการลา</div>
        {leaves.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>ไม่มีคำขอลาในรอบนี้</div>
        ) : (
          leaves.map((lv) => {
            const isPending = lv.status === 'pending';
            const statusMeta = lv.status === 'approved'
              ? { label: 'อนุมัติแล้ว', color: '#0f766e', bg: '#ccfbf1' }
              : lv.status === 'rejected'
              ? { label: 'ปฏิเสธแล้ว', color: '#b91c1c', bg: '#fee2e2' }
              : { label: 'รออนุมัติ', color: '#92400e', bg: '#fef3c7' };
            const days = Math.round((new Date(lv.date_to) - new Date(lv.date_from)) / 86400000) + 1;
            return (
              <div key={lv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {lv.type}
                    {lv.urgent && <span style={{ marginLeft: 6, fontSize: 11, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '1px 6px' }}>ด่วน</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {lv.date_from === lv.date_to ? lv.date_from : `${lv.date_from} – ${lv.date_to}`}
                    {' · '}{days} วัน
                    {lv.reason && ` · ${lv.reason}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isPending ? (
                    <>
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent)', color: '#fff' }} onClick={() => approveLeave(lv.id)}>อนุมัติ</button>
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: '#fee2e2', color: '#b91c1c' }} onClick={() => rejectLeave(lv.id)}>ปฏิเสธ</button>
                    </>
                  ) : (
                    <span className="badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* attendance */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>ประวัติรายวัน / ลงเวลา</div>
        {attendanceTimeline.map((entry) => {
          const meta = attendanceStatusMeta(entry.kind);
          const a = entry.row;
          const dateAdjustments = adjustmentsByDate.get(entry.date) || [];
          return (
          <div key={entry.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <div>
              <span style={{ fontWeight: 500 }}>{fullThaiDate(entry.date)}</span>
              {a?.clock_in && <span className="num" style={{ color: 'var(--muted)', marginLeft: 10 }}>{a.clock_in} – {a.clock_out || '—'}</span>}
              {!a?.clock_in && <span style={{ color: 'var(--muted)', marginLeft: 10 }}>{entry.kind === 'off' ? 'วันหยุดประจำ' : entry.kind === 'absent' ? 'ไม่มีการลงเวลา' : entry.kind === 'leave' || entry.kind === 'paid_leave' ? 'ลางาน' : '—'}</span>}
              {dateAdjustments.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {dateAdjustments.map((item) => (
                    <span
                      key={item.id}
                      className="badge"
                      style={{
                        background: item.type === 'bonus' ? 'var(--accent-soft)' : '#fff4e5',
                        color: item.type === 'bonus' ? 'var(--accent)' : '#9a3412',
                      }}
                    >
                      {adjustmentTypeLabel(item.type)} {item.type === 'bonus' ? '+' : '-'}{THB(item.amount)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {a?.checkin_dist != null && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.checkin_dist}ม.</span>}
              {a?.checkin_selfie_url ? (
                <a href={a.checkin_selfie_url} target="_blank" rel="noreferrer"><img src={a.checkin_selfie_url} alt="selfie" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /></a>
              ) : (
                <div title="ยังไม่มีรูปเซลฟี่ของรายการนี้" style={{ width: 28, height: 28, borderRadius: '50%', background: emp.color || 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {(emp.nickname || emp.name || 'ไม่มีรูป').slice(0, 2)}
                </div>
              )}
              <span className="badge" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEditingDay(entry)}>
                แก้วัน
              </button>
            </div>
          </div>
        )})}
      </div>

      {showEdit && <EmpFormModal emp={emp} branches={branches} orgId={orgId} onClose={() => { setShowEdit(false); onBack(); }} />}
      {showPinRecovery && <PinRecoveryModal emp={emp} onClose={() => setShowPinRecovery(false)} />}
      {showAddAdj && <AddAdjModal emp={emp} orgId={orgId} onClose={() => { setShowAddAdj(false); load(); }} />}
      {showMsg && <SendMsgModal emp={emp} orgId={orgId} onClose={() => setShowMsg(false)} />}
      {editingDay && <AttendanceDayModal emp={emp} orgId={orgId} entry={editingDay} onClose={() => setEditingDay(null)} onSaved={() => { setEditingDay(null); load(); }} />}
    </div>
  );
}

function EmpFormModal({ emp, branches, orgId, onClose }) {
  const isEdit = !!emp;
  const needsLoginPin = !isEdit || !emp.pin_hash;
  const currentPin = emp?.pin_code || '';
  const showPinField = true;
  const COLORS = ['#0E7C66', '#B45309', '#1D4ED8', '#9333EA', '#DC2626', '#9A6B2F'];
  const DEFAULT_CLOSING_TASKS = ['ปิดเครื่องคิดเงิน', 'เช็กเงินสดในลิ้นชัก', 'ปิดไฟหน้าร้าน'];
  const [form, setForm] = useState({
    name: emp?.name || '',
    nickname: emp?.nickname || '',
    position: emp?.position || '',
    department: emp?.department || '',
    phone: emp?.phone || '',
    id_number: emp?.id_number || '',
    id_card_url: emp?.id_card_url || '',
    bank_name: emp?.bank_name || '',
    bank_account: emp?.bank_account || '',
    em_name: emp?.em_name || '',
    em_rel: emp?.em_rel || '',
    em_phone: emp?.em_phone || '',
    branch_id: emp?.branch_id || (branches[0]?.id || ''),
    pay_type: emp?.pay_type || 'daily',
    rate: emp?.rate || 480,
    start_date: emp?.start_date || ymd(new Date()),
    weekly_cycle_start_day: emp?.weekly_cycle_start_day ?? new Date((emp?.start_date || ymd(new Date())) + 'T00:00').getDay(),
    monthly_cycle_start_day: emp?.monthly_cycle_start_day ?? new Date((emp?.start_date || ymd(new Date())) + 'T00:00').getDate(),
    commission: emp?.commission || { type: 'none', value: 0 },
    color: emp?.color || COLORS[0],
    notes: emp?.notes || '',
    closing_tasks_text: isEdit ? (emp?.closing_tasks || []).join('\n') : DEFAULT_CLOSING_TASKS.join('\n'),
    day_off: Array.isArray(emp?.day_off) ? emp.day_off : [],
    annual_leave_days: emp?.annual_leave_days ?? 6,
    sick_leave_days: emp?.sick_leave_days ?? 30,
    pin: '',
    currentPin,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const pinReady = needsLoginPin ? /^\d{4}$/.test(form.pin) : !form.pin || /^\d{4}$/.test(form.pin);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function copyEmployeeLink() {
    await navigator.clipboard?.writeText(EMPLOYEE_APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function toggleDayOff(day) {
    setForm((prev) => {
      const current = new Set((prev.day_off || []).map(Number));
      if (current.has(day)) current.delete(day);
      else current.add(day);
      return { ...prev, day_off: Array.from(current).sort((a, b) => a - b) };
    });
  }

  async function save() {
    if (!pinReady) {
      setErr('กรุณาตั้ง PIN เป็นตัวเลข 4 หลัก');
      return;
    }

    setBusy(true);
    setErr('');
      const payload = {
        ...form,
        org_id: orgId,
        weekly_cycle_start_day: form.pay_type === 'weekly' ? Number(form.weekly_cycle_start_day) : null,
        monthly_cycle_start_day: form.pay_type === 'monthly' ? Number(form.monthly_cycle_start_day) : null,
      };
    payload.closing_tasks = form.closing_tasks_text
      .split('\n')
      .map((task) => task.trim())
      .filter(Boolean);
    delete payload.pin;
    delete payload.closing_tasks_text;
    delete payload.currentPin;

    try {
      if (isEdit) {
        const { error: updateError } = await supabase.from('employees').update(payload).eq('id', emp.id);
        if (updateError) throw updateError;

        if (form.pin && form.pin !== currentPin) {
          const { error: pinError } = await supabase.rpc('admin_set_employee_pin', {
            p_emp_id: emp.id,
            p_pin: form.pin,
          });
          if (pinError) throw pinError;
        }
      } else {
        const empId = crypto.randomUUID();

        const { error: empError } = await supabase.from('employees').insert({
          ...payload,
          id: empId,
        });

        if (empError) throw empError;

        const { error: pinError } = await supabase.rpc('admin_set_employee_pin', {
          p_emp_id: empId,
          p_pin: form.pin,
        });
        if (pinError) throw pinError;
      }

      onClose();
    } catch (ex) {
      setErr(ex.message || 'บันทึกพนักงานไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>{isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ชื่อ-นามสกุล" value={form.name} onChange={(v) => set('name', v)} required />
            <Field label="ชื่อเล่น" value={form.nickname} onChange={(v) => set('nickname', v)} />
            <Field label="ตำแหน่ง" value={form.position} onChange={(v) => set('position', v)} />
            <Field label="แผนก" value={form.department} onChange={(v) => set('department', v)} />
            <Field label="เบอร์โทร" value={form.phone} onChange={(v) => set('phone', v)} type="tel" />
            <Field label="เลขบัตรประชาชน" value={form.id_number} onChange={(v) => set('id_number', v)} />
            <Field label="ลิงก์รูปบัตรประชาชน" value={form.id_card_url} onChange={(v) => set('id_card_url', v)} placeholder="พนักงานอัปโหลดได้จากหน้าโปรไฟล์" />
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>สาขา</label>
              <select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>รอบจ่ายเงิน</label>
              <select value={form.pay_type} onChange={(e) => set('pay_type', e.target.value)}>
                <option value="daily">รายวัน</option>
                <option value="weekly">รายสัปดาห์</option>
                <option value="monthly">รายเดือน</option>
              </select>
            </div>
            <Field
              label="อัตราค่าจ้าง (บาท/วัน)"
              value={form.rate}
              onChange={(v) => set('rate', +v)}
              type="number"
            />
            <Field label="วันเริ่มงาน" value={form.start_date} onChange={(v) => set('start_date', v)} type="date" />
            {form.pay_type === 'weekly' && (
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>วันเริ่มรอบสัปดาห์</label>
                <select value={form.weekly_cycle_start_day} onChange={(e) => set('weekly_cycle_start_day', Number(e.target.value))}>
                  {WEEKDAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                </select>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>เช่น บางคนเริ่มนับรอบทุกวันอังคาร บางคนทุกวันพุธ</div>
              </div>
            )}
            {form.pay_type === 'monthly' && (
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>วันที่เริ่มรอบเดือน</label>
                <select value={form.monthly_cycle_start_day} onChange={(e) => set('monthly_cycle_start_day', Number(e.target.value))}>
                  {MONTH_DAY_OPTIONS.map((day) => <option key={day} value={day}>วันที่ {day}</option>)}
                </select>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>เช่น บางคนเริ่มรอบวันที่ 10 บางคนวันที่ 15</div>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>วันหยุดประจำของพนักงาน</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DAY_OFF_OPTIONS.map((day) => {
                  const active = (form.day_off || []).map(Number).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className="btn"
                      onClick={() => toggleDayOff(day.value)}
                      style={{
                        padding: '7px 12px',
                        fontSize: 13,
                        background: active ? 'var(--accent)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--muted)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>เลือกได้มากกว่า 1 วัน ถ้าไม่เลือกถือว่าไม่มีวันหยุดประจำ</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>โควต้าวันลาต่อปี</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ลาพักร้อน (วัน/ปี)</label>
                  <input
                    type="number" min="0" max="365"
                    value={form.annual_leave_days}
                    onChange={(e) => set('annual_leave_days', Math.max(0, +e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ลาป่วย (วัน/ปี)</label>
                  <input
                    type="number" min="0" max="365"
                    value={form.sick_leave_days}
                    onChange={(e) => set('sick_leave_days', Math.max(0, +e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </div>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>พนักงานจะเห็นสิทธิ์คงเหลือในแอปของตัวเอง</div>
            </div>
            {showPinField && (
              <Field
                label={isEdit ? (currentPin ? 'PIN พนักงาน (4 หลัก)' : (needsLoginPin ? 'ตั้ง PIN เพื่อเปิดใช้งานล็อกอิน (4 หลัก)' : 'PIN พนักงาน (ตั้งใหม่เพื่อให้แสดง)')) : 'PIN (4 หลัก)'}
                value={form.pin}
                onChange={(v) => set('pin', v.replace(/\D/g, '').slice(0, 4))}
                type="text"
                placeholder={isEdit && !currentPin && !needsLoginPin ? 'ใส่ PIN ใหม่เพื่อบันทึกและแสดง' : 'เช่น 1234'}
                inputMode="numeric"
                maxLength={4}
              />
            )}
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เช็กลิสต์ก่อนลงเวลาออก</label>
            <textarea
              value={form.closing_tasks_text}
              onChange={(e) => set('closing_tasks_text', e.target.value)}
              placeholder={'เช่น\nปิดเครื่องคิดเงิน\nเช็กเงินสดในลิ้นชัก\nปิดไฟหน้าร้าน'}
              rows={4}
            />
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>ใส่ 1 บรรทัดต่อ 1 ข้อ พนักงานต้องติ๊กครบก่อนลงเวลาออกงาน</div>
          </div>

          {/* commission */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>คอมมิชชั่น</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={form.commission.type} onChange={(e) => set('commission', { ...form.commission, type: e.target.value })} style={{ flex: 1 }}>
                <option value="none">ไม่มี</option>
                <option value="percent">เปอร์เซ็นต์ยอดขาย</option>
                <option value="unit">บาท/ชิ้น</option>
              </select>
              {form.commission.type !== 'none' && (
                <input type="number" value={form.commission.value} onChange={(e) => set('commission', { ...form.commission, value: +e.target.value })} style={{ width: 100 }} placeholder={form.commission.type === 'percent' ? '%' : 'บาท/ชิ้น'} />
              )}
            </div>
          </div>

          {/* color */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>สีประจำตัว</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: form.color === c ? '3px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          <Field label="หมายเหตุ (แอดมิน)" value={form.notes} onChange={(v) => set('notes', v)} />

          <div className="card" style={{ padding: 14, background: 'var(--bg)' }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>ข้อมูลธนาคาร / ผู้ติดต่อฉุกเฉิน</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="ธนาคาร" value={form.bank_name} onChange={(v) => set('bank_name', v)} />
              <Field label="เลขบัญชี" value={form.bank_account} onChange={(v) => set('bank_account', v)} />
              <Field label="ผู้ติดต่อฉุกเฉิน" value={form.em_name} onChange={(v) => set('em_name', v)} />
              <Field label="ความสัมพันธ์" value={form.em_rel} onChange={(v) => set('em_rel', v)} />
              <Field label="เบอร์ผู้ติดต่อฉุกเฉิน" value={form.em_phone} onChange={(v) => set('em_phone', v)} type="tel" />
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'var(--bg)' }}>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>ลิงก์แอปพนักงาน</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={EMPLOYEE_APP_URL} readOnly style={{ flex: 1, minWidth: 220, background: 'var(--surface)' }} />
              <button className="btn" onClick={copyEmployeeLink} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </div>

          {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy || !form.name || !pinReady}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinRecoveryModal({ emp, onClose }) {
  const [pin, setPin] = useState(emp.pin_code || '');
  const [shownPin, setShownPin] = useState(emp.pin_code || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const pinReady = /^\d{4}$/.test(pin);

  async function unlock() {
    setBusy('unlock');
    setErr('');
    setMessage('');
    try {
      const { error } = await supabase.rpc('admin_unlock_employee_pin', {
        p_emp_id: emp.id,
      });
      if (error) throw error;
      setMessage('ปลดล็อก PIN แล้ว พนักงานลองเข้าใหม่ได้ทันที');
    } catch (ex) {
      setErr(ex.message || 'ปลดล็อก PIN ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function resetPin() {
    if (!pinReady) {
      setErr('กรุณาใส่ PIN เป็นตัวเลข 4 หลัก');
      return;
    }

    setBusy('reset');
    setErr('');
    setMessage('');
    try {
      const { error } = await supabase.rpc('admin_set_employee_pin', {
        p_emp_id: emp.id,
        p_pin: pin,
      });
      if (error) throw error;
      setShownPin(pin);
      setMessage('ตั้ง PIN ใหม่แล้ว และล้างสถานะล็อกเรียบร้อย');
    } catch (ex) {
      setErr(ex.message || 'รีเซ็ต PIN ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>ช่วยเหลือ PIN</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>{emp.nickname || emp.name}</div>

        <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--surface)' }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>PIN ปัจจุบัน</div>
          <div className="num" style={{ fontWeight: 800, fontSize: 28, letterSpacing: 2 }}>
            {shownPin || 'ยังไม่มีข้อมูล'}
          </div>
          {!shownPin && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>PIN เก่าที่เคย hash ไว้ไม่สามารถถอดกลับมาแสดงได้ ให้ตั้ง PIN ใหม่ 1 ครั้ง</div>}
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--bg)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>พนักงานกด PIN ผิดจนล็อก</div>
          <button className="btn" style={{ width: '100%', background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={unlock} disabled={!!busy}>
            {busy === 'unlock' ? 'กำลังปลดล็อก...' : 'ปลดล็อก PIN ทันที'}
          </button>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--bg)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>พนักงานลืม PIN</div>
          <Field
            label="PIN ใหม่ (4 หลัก)"
            value={pin}
            onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            type="password"
            placeholder="เช่น 1234"
            inputMode="numeric"
            maxLength={4}
          />
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={resetPin} disabled={!!busy || !pinReady}>
            {busy === 'reset' ? 'กำลังรีเซ็ต...' : 'ตั้ง PIN ใหม่'}
          </button>
        </div>

        {message && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12 }}>{message}</div>}
        {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose} disabled={!!busy}>ปิด</button>
      </div>
    </div>
  );
}

function AttendanceDayModal({ emp, orgId, entry, onClose, onSaved }) {
  const initialStatus = entry.kind === 'paid_leave' ? 'leave' : entry.kind === 'off' ? 'absent' : entry.kind;
  const [form, setForm] = useState({
    status: initialStatus,
    paid: entry.kind === 'paid_leave' ? true : !!entry.row?.paid,
    clock_in: entry.row?.clock_in || '',
    clock_out: entry.row?.clock_out || '',
    ot_min: entry.row?.ot_min || 0,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        emp_id: emp.id,
        org_id: orgId,
        date: entry.date,
        status: form.status,
        paid: form.status === 'leave' ? !!form.paid : form.status === 'absent' ? false : true,
        clock_in: form.status === 'present' || form.status === 'late' ? (form.clock_in || null) : null,
        clock_out: form.status === 'present' || form.status === 'late' ? (form.clock_out || null) : null,
        ot_min: Number(form.ot_min || 0),
      };
      const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'emp_id,date' });
      if (error) throw error;
      onSaved();
    } catch (ex) {
      setErr(ex.message || 'บันทึกสถานะรายวันไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function resetToDefault() {
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.from('attendance').delete().eq('emp_id', emp.id).eq('date', entry.date);
      if (error) throw error;
      onSaved();
    } catch (ex) {
      setErr(ex.message || 'คืนค่าวันนี้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28, maxWidth: 560 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>แก้สถานะรายวัน</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>{fullThaiDate(entry.date)}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>สถานะวันนี้</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="present">มาทำงาน</option>
              <option value="late">มาสาย</option>
              <option value="leave">ลา</option>
              <option value="absent">ขาด</option>
            </select>
          </div>

          {(form.status === 'present' || form.status === 'late') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="เวลาเข้า" value={form.clock_in} onChange={(v) => set('clock_in', v)} placeholder="09:00" />
              <Field label="เวลาออก" value={form.clock_out} onChange={(v) => set('clock_out', v)} placeholder="18:00" />
              <Field label="OT (นาที)" value={form.ot_min} onChange={(v) => set('ot_min', +v)} type="number" />
            </div>
          )}

          {form.status === 'leave' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={!!form.paid} onChange={(e) => set('paid', e.target.checked)} />
              ลานี้ยังได้รับค่าจ้าง
            </label>
          )}

          <div className="card" style={{ padding: 14, background: 'var(--bg)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>วิธีใช้</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              ใช้หน้าต่างนี้แก้รายวันเป็นวันที่จริงเลย เช่น วันหยุด วันลา วันขาด หรือวันที่มาทำงาน แล้วระบบจะนำไปสรุปจำนวนวันและค่าแรงของงวดนั้นใหม่
            </div>
          </div>

          {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก...' : 'บันทึกวันนี้'}
            </button>
            <button className="btn" style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--line)' }} onClick={resetToDefault} disabled={busy}>
              คืนค่าอัตโนมัติ
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={busy}>
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddAdjModal({ emp, orgId, onClose }) {
  const [form, setForm] = useState({ type: 'bonus', amount: 0, note: '', date: ymd(new Date()) });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.note.trim()) { alert('กรุณาระบุเหตุผล'); return; }
    setBusy(true);
    await supabase.from('adjustments').insert({ emp_id: emp.id, org_id: orgId, ...form });
    setBusy(false);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>เพิ่มโบนัส / รายการหัก</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>ประเภท</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
              <option value="bonus">โบนัส/รางวัล</option>
              <option value="damage">หักค่าเสียหาย</option>
              <option value="advance">เบิกล่วงหน้า</option>
              <option value="other">หักอื่นๆ</option>
            </select>
          </div>
          <Field label="จำนวน (บาท)" value={form.amount} onChange={(v) => setForm((p) => ({ ...p, amount: +v }))} type="number" />
          <Field label="วันที่รายการนี้มีผล" value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} type="date" />
          <Field label="เหตุผล (บังคับ)" value={form.note} onChange={(v) => setForm((p) => ({ ...p, note: v }))} required />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendMsgModal({ emp, orgId, onClose }) {
  const [kind, setKind] = useState('message');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await supabase.from('messages').insert({
      emp_id: emp.id, org_id: orgId,
      from: 'admin', kind, text: text.trim(),
      due: due || null, status: 'unread',
    });
    setBusy(false);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>ส่งข้อความถึง {emp.nickname || emp.name}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['message', 'task'].map((k) => (
            <button key={k} onClick={() => setKind(k)} className="btn" style={{ background: kind === k ? 'var(--accent)' : 'var(--surface)', color: kind === k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', flex: 1 }}>
              {k === 'message' ? '💬 ข้อความ' : '📋 มอบงาน'}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์ข้อความ..." rows={4} style={{ marginBottom: 12 }} />
        {kind === 'task' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>กำหนดส่ง</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} min={ymd(new Date())} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={send} disabled={busy || !text.trim()}>{busy ? 'กำลังส่ง...' : 'ส่ง'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder, ...inputProps }) {
  return (
    <div>
      <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} {...inputProps} />
    </div>
  );
}

