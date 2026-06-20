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
  const [opsTodayCounts, setOpsTodayCounts] = useState({});
  const [opsWarning, setOpsWarning] = useState('');
  const [lowStockItems, setLowStockItems] = useState([]);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  const today = ymd(new Date());

  async function load() {
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;
    const [{ data: att }, { data: leaves }, { data: todayLeaves }, { data: msgs }, { data: emps }, { data: branches }, { data: settings }, opsResult, opsTodayResult, lowStockResult, pendingTasksResult] = await Promise.all([
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
      supabase.from('employee_ops_entries').select('task_key').eq('org_id', orgId).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('employee_ops_entries').select('id,emp_id,created_at,payload').eq('org_id', orgId).eq('task_key', 'inventory').order('created_at', { ascending: false }).limit(40),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('from', 'admin').eq('kind', 'task').neq('status', 'done'),
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
    setPendingTasksCount(pendingTasksResult?.count || 0);
    if (opsResult?.error) {
      setOpsEntriesCount(0);
      setOpsTodayCounts({});
      setLowStockItems([]);
      if (String(opsResult.error.message || '').includes('employee_ops_entries')) {
        setOpsWarning('ยังไม่ได้รัน SQL งานร้านพนักงาน');
      } else {
        setOpsWarning('โหลดงานร้านพนักงานไม่สำเร็จ');
      }
    } else {
      setOpsEntriesCount(opsResult?.count || 0);
      setOpsWarning('');
      const todayCounts = {};
      (opsTodayResult?.data || []).forEach((row) => {
        todayCounts[row.task_key] = (todayCounts[row.task_key] || 0) + 1;
      });
      setOpsTodayCounts(todayCounts);

      // low-stock alert: keep only alert-status entries, dedupe by itemName (latest per item)
      const alertRows = (lowStockResult?.data || []).filter(e => {
        const s = e.payload?.status;
        return s && s !== 'ปกติ';
      });
      const seen = new Set();
      const unique = alertRows.filter(e => {
        const name = e.payload?.itemName;
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      }).slice(0, 6);
      setLowStockItems(unique);
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

      {/* alert: pending tasks */}
      {pendingTasksCount > 0 && (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 16, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ color: '#3730a3', fontWeight: 700 }}>📋 งานที่มอบหมายค้างอยู่ {pendingTasksCount} รายการ</div>
            <div style={{ fontSize: 13, color: '#6366f1', marginTop: 2 }}>พนักงานยังไม่ได้กด "ทำงานเสร็จ"</div>
          </div>
          <button className="btn" onClick={() => nav('/admin/messages')} style={{ background: 'none', color: '#3730a3', border: '1px solid #a5b4fc', borderRadius: 8, padding: '4px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
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

      {/* low-stock alert */}
      {lowStockItems.length > 0 && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 8, border: '1px solid #f4dfab', background: '#fff8e8' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#7a5b2b' }}>⚠️ สต๊อกวัตถุดิบต้องติดตาม ({lowStockItems.length} รายการ)</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {lowStockItems.map(item => {
              const p = item.payload || {};
              const emp = (employees || []).find(e => e.id === item.emp_id);
              const empName = emp?.nickname || emp?.name || 'พนักงาน';
              const isUrgent = p.status === 'ต้องสั่งเพิ่ม' || p.status === 'มีปัญหา';
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13, padding: '7px 0', borderBottom: '1px solid #f0e3c2' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{p.itemName}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                      เหลือ {p.stockLeft} {p.unit} · {empName}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '2px 8px', flexShrink: 0, background: isUrgent ? '#fff1f1' : '#fff8e8', color: isUrgent ? '#b42318' : '#7a5b2b' }}>
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
          <button className="btn" onClick={() => nav('/admin/ops-inbox?task=inventory')} style={{ marginTop: 12, fontSize: 13 }}>
            ดูรายการวัตถุดิบทั้งหมด →
          </button>
        </div>
      )}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>งานร้านที่พนักงานส่งเข้ามา</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              บิลซื้อของ ผลิตขนม สต๊อก ของใช้ ใบสั่งซื้อ — รวม {opsEntriesCount} รายการ
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/admin/ops-inbox')}>
            เปิดกล่องงานร้าน
          </button>
        </div>
        {opsWarning ? (
          <div style={{ fontSize: 13, color: '#7a5b2b', background: '#fff8e8', border: '1px solid #f4dfab', borderRadius: 10, padding: '10px 14px' }}>
            {opsWarning}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { key: 'bills',          icon: '📷', label: 'ถ่ายบิล' },
              { key: 'production',     icon: '🏭', label: 'ผลิตขนม' },
              { key: 'inventory',      icon: '📦', label: 'วัตถุดิบ' },
              { key: 'cake-stock',     icon: '🍰', label: 'สต๊อกเค้ก' },
              { key: 'supplies-count', icon: '🧴', label: 'ของใช้' },
              { key: 'purchase-list',  icon: '🛒', label: 'ใบซื้อ' },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => nav(`/admin/ops-inbox?task=${key}`)}
                style={{
                  padding: '12px 10px', borderRadius: 14, background: opsTodayCounts[key] ? 'var(--accent-soft)' : 'var(--bg)',
                  border: `1px solid ${opsTodayCounts[key] ? 'var(--accent)' : 'var(--line)'}`,
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 20 }}>{icon}</div>
                <div className="num" style={{ fontWeight: 800, fontSize: 22, color: opsTodayCounts[key] ? 'var(--accent)' : 'var(--muted)' }}>
                  {opsTodayCounts[key] || 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

