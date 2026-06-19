import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { computePay, rulesFor, rangeForEmployee, THB, ymd, addDays, dayRate } from '../../lib/payroll';

const URGENT_LEAVE_NOTE_PREFIX = 'ลาด่วนเช้าวันงานโดยไม่มีเหตุผล';

export default function AdminDashboard() {
  const { orgId } = useAuthStore();
  const nav = useNavigate();
  const [stats, setStats] = useState({ working: 0, late: 0, onLeave: 0, monthPayroll: 0 });
  const [todayList, setTodayList] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [empReplies, setEmpReplies] = useState([]);
  const [opsEntriesCount, setOpsEntriesCount] = useState(0);
  const [opsWarning, setOpsWarning] = useState('');
  const [employees, setEmployees] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  const today = ymd(new Date());

  async function load() {
    const [{ data: att }, { data: leaves }, { data: todayLeaves }, { data: msgs }, { data: emps }, { data: branches }, { data: settings }, opsResult] = await Promise.all([
      supabase.from('attendance').select('*, employees(name,nickname,color)').eq('org_id', orgId).eq('date', today),
      supabase.from('leaves').select('*, employees(name,nickname)').eq('org_id', orgId).eq('status', 'pending'),
      supabase.from('leaves')
        .select('*, employees(name,nickname,color)')
        .eq('org_id', orgId)
        .lte('date_from', today)
        .gte('date_to', today)
        .in('status', ['pending', 'approved']),
      supabase.from('messages').select('*').eq('org_id', orgId).eq('from', 'emp').eq('status', 'unread'),
      supabase.from('employees').select('*').eq('org_id', orgId),
      supabase.from('branches').select('*').eq('org_id', orgId),
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
      supabase.from('employee_ops_entries').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    const existingEmpIds = new Set((att || []).map((a) => a.emp_id));
    const leaveStatusRows = (todayLeaves || [])
      .filter((l) => !existingEmpIds.has(l.emp_id))
      .map((l) => ({
        id: `leave-${l.id}`,
        emp_id: l.emp_id,
        employees: l.employees,
        clock_in: null,
        clock_out: null,
        status: 'leave',
        leave_type: l.type,
        leave_status: l.status,
      }));
    const todayRows = [...(att || []), ...leaveStatusRows];

    setEmployees(emps || []);
    setAllBranches(branches || []);
    setOrgSettings(settings || null);
    setTodayList(todayRows);
    setPendingLeaves(leaves || []);
    setEmpReplies(msgs || []);
    if (opsResult?.error) {
      setOpsEntriesCount(0);
      if (String(opsResult.error.message || '').includes('employee_ops_entries')) {
        setOpsWarning('ยังไม่ได้รัน SQL งานร้านพนักงาน');
      } else {
        setOpsWarning('โหลดงานร้านพนักงานไม่สำเร็จ');
      }
    } else {
      setOpsEntriesCount(opsResult?.count || 0);
      setOpsWarning('');
    }

    const working = todayRows.filter((a) => a.clock_in && !a.clock_out).length;
    const late = todayRows.filter((a) => a.status === 'late').length;
    const onLeave = todayRows.filter((a) => a.status === 'leave').length;

    // month payroll total
    let monthPayroll = 0;
    if (emps && emps.length > 0) {
      const ranges = emps.map((emp) => rangeForEmployee('month', emp));
      const minFrom = ranges.map((r) => r.from).sort()[0];
      const maxTo = ranges.map((r) => r.to).sort().slice(-1)[0];
      const [{ data: allAtt }, { data: allSales }, { data: allAdj }] = await Promise.all([
        supabase.from('attendance').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
        supabase.from('sales').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
        supabase.from('adjustments').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
      ]);
      emps.forEach((emp) => {
        const br = (branches || []).find((b) => b.id === emp.branch_id);
        const rules = rulesFor(settings?.rules, br, emp);
        const empRange = rangeForEmployee('month', emp);
        const empAtt = (allAtt || []).filter((a) => a.emp_id === emp.id && a.date >= empRange.from && a.date <= empRange.to);
        const empSales = (allSales || []).filter((s) => s.emp_id === emp.id && s.date >= empRange.from && s.date <= empRange.to);
        const empAdj = (allAdj || []).filter((a) => a.emp_id === emp.id && a.date >= empRange.from && a.date <= empRange.to);
        const p = computePay(emp, empAtt, empSales, empAdj, rules, empRange);
        monthPayroll += p.net;
      });
    }

    setStats({ working, late, onLeave, monthPayroll });
  }

  useEffect(() => { load(); }, []);

  async function approveLeave(id, status) {
    const { data: leave } = await supabase.from('leaves').select('*').eq('id', id).single();
    await supabase.from('leaves').update({ status }).eq('id', id);
    if (leave && status === 'approved') {
      const days = [];
      let cursor = new Date(`${leave.date_from}T00:00:00`);
      const end = new Date(`${leave.date_to}T00:00:00`);
      while (cursor <= end) {
        days.push({
          org_id: leave.org_id,
          emp_id: leave.emp_id,
          date: ymd(cursor),
          clock_in: null,
          clock_out: null,
          status: 'leave',
          ot_min: 0,
          leave_type: leave.type,
          paid: true,
        });
        cursor = addDays(cursor, 1);
      }
      await supabase.from('attendance').upsert(days, { onConflict: 'emp_id,date' });

      const emp = employees.find((item) => item.id === leave.emp_id);
      const branch = allBranches.find((item) => item.id === emp?.branch_id);
      const rules = rulesFor(orgSettings?.rules, branch, emp);
      const deductDays = Number(rules?.urgentLeaveDeductDays || 0);
      const shouldCreateUrgentDeduct = Boolean(leave.urgent) && deductDays > 0;

      if (shouldCreateUrgentDeduct && emp) {
        const note = `${URGENT_LEAVE_NOTE_PREFIX} (หัก ${deductDays} แรง)`;
        const deductAmount = Math.round(dayRate(emp) * deductDays);
        const { data: existingAdjust } = await supabase
          .from('adjustments')
          .select('id')
          .eq('emp_id', leave.emp_id)
          .eq('date', leave.date_from)
          .eq('auto', true)
          .like('note', `${URGENT_LEAVE_NOTE_PREFIX}%`)
          .maybeSingle();

        if (!existingAdjust && deductAmount > 0) {
          await supabase.from('adjustments').insert({
            emp_id: leave.emp_id,
            org_id: leave.org_id,
            date: leave.date_from,
            type: 'other',
            amount: deductAmount,
            note,
            auto: true,
          });
        }
      }
    }
    if (leave && status === 'rejected') {
      await supabase.from('attendance')
        .delete()
        .eq('emp_id', leave.emp_id)
        .gte('date', leave.date_from)
        .lte('date', leave.date_to)
        .eq('status', 'leave')
        .eq('leave_type', leave.type);

      await supabase.from('adjustments')
        .delete()
        .eq('emp_id', leave.emp_id)
        .eq('date', leave.date_from)
        .eq('auto', true)
        .like('note', `${URGENT_LEAVE_NOTE_PREFIX}%`);
    }
    load();
  }

  const tiles = [
    { label: 'กำลังทำงาน', value: stats.working, color: 'var(--accent)', bg: 'var(--accent-soft)', suffix: 'คน', icon: '●' },
    { label: 'มาสายวันนี้', value: stats.late, color: 'var(--late-fg)', bg: 'var(--late-bg)', suffix: 'คน', icon: '⏱' },
    { label: 'ลาวันนี้', value: stats.onLeave, color: 'var(--leave-fg)', bg: 'var(--leave-bg)', suffix: 'คน', icon: '□' },
    { label: 'ยอดเงินเดือนนี้', value: THB(stats.monthPayroll), color: 'var(--ink)', bg: 'var(--surface)', suffix: '', icon: '฿' },
  ];

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>ภาพรวมวันนี้</h1>

      {/* alert: employee replies */}
      {empReplies.length > 0 && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid #fca5a5', borderRadius: 16, padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ color: 'var(--danger-fg)', fontWeight: 700 }}>มีพนักงานตอบกลับ {empReplies.length} รายการ</div>
          <button className="btn" style={{ marginTop: 8, background: 'none', color: 'var(--danger-fg)', padding: '4px 12px', fontSize: 13, border: '1px solid var(--danger-fg)', borderRadius: 8 }} onClick={() => nav('/admin/messages')}>
            ดูข้อความ →
          </button>
        </div>
      )}

      {/* stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {tiles.map((t) => (
          <div key={t.label} className="card" style={{ padding: '20px 16px', background: t.bg }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.value}{t.suffix}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* today status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>สถานะวันนี้</div>
          {todayList.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 14 }}>ยังไม่มีข้อมูล</div>}
          {todayList.map((a) => {
            const nickname = a.employees?.nickname || a.employees?.name || 'พนักงาน';
            return (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 44, maxWidth: 92, padding: '6px 10px', borderRadius: 999, background: a.employees?.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nickname}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.employees?.nickname || a.employees?.name}</div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {a.status === 'leave' ? a.leave_type || 'ลา' : `${a.clock_in || '-'} ${a.clock_out ? `- ${a.clock_out}` : ''}`}
                  </div>
                </div>
              </div>
              <span className="badge" style={{
                background: a.status === 'present' ? 'var(--accent-soft)' : a.status === 'late' ? 'var(--late-bg)' : 'var(--leave-bg)',
                color: a.status === 'present' ? 'var(--accent)' : a.status === 'late' ? 'var(--late-fg)' : 'var(--leave-fg)',
              }}>
                {a.status === 'present' ? 'ทำงาน' : a.status === 'late' ? 'สาย' : a.leave_status === 'pending' ? 'รอลา' : 'ลา'}
              </span>
            </div>
            );
          })}
        </div>

        {/* pending leaves */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>คำขอลา รอพิจารณา ({pendingLeaves.length})</div>
          {pendingLeaves.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 14 }}>ไม่มีคำขอ</div>}
          {pendingLeaves.map((l) => (
            <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{l.employees?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{l.type} · {l.date_from} - {l.date_to}</div>
              {l.reason && <div style={{ fontSize: 13, marginTop: 2 }}>{l.reason}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" style={{ background: 'var(--accent)', color: '#fff', padding: '6px 14px', fontSize: 13 }} onClick={() => approveLeave(l.id, 'approved')}>อนุมัติ</button>
                <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => approveLeave(l.id, 'rejected')}>ปฏิเสธ</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>งานร้านที่พนักงานส่งเข้ามา</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              ใช้ดูบิลซื้อของ การผลิตขนม สต๊อก ของใช้ และใบสั่งซื้อจากแอปพนักงาน
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/admin/ops-inbox')}>
            เปิดกล่องงานร้าน
          </button>
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>{opsEntriesCount}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>รายการทั้งหมดในระบบ</div>
          {opsWarning && (
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#7a5b2b', background: '#fff8e8', border: '1px solid #f4dfab', borderRadius: 999, padding: '6px 10px' }}>
              {opsWarning}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

