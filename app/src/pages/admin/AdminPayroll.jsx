import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { computePay, rulesFor, rangeFor, rangeForEmployee, THB, ymd, addDays, parseYmd, fmtDateFull, lateMinutesOf, overtimeMinutesOf } from '../../lib/payroll';
import slipLogo from '../../assets/lucid-logo.svg';

const PERIOD_LABEL = {
  day: 'รายวัน',
  week: 'รายสัปดาห์',
  month: 'รายเดือน',
};
const MANUAL_PAYROLL_NOTE_PREFIX = '[manual-payroll-net]';

function payrollPeriodForEmployee(emp, requestedPeriod) {
  if (!emp) return requestedPeriod || 'month';
  if (emp.pay_type === 'weekly') return 'week';
  if (emp.pay_type === 'monthly') return 'month';
  return requestedPeriod || 'day';
}

export default function AdminPayroll() {
  const { orgId } = useAuthStore();
  const [period, setPeriod] = useState('month');
  const [branchFilter, setBranchFilter] = useState('all');
  const [payTypeFilter, setPayTypeFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [dayView, setDayView] = useState({});
  const [ssModal, setSsModal] = useState(null);
  const [advanceModal, setAdvanceModal] = useState(null);
  const [netModal, setNetModal] = useState(null);
  const [dayEditModal, setDayEditModal] = useState(null);
  const [payRange, setPayRange] = useState(rangeFor('month'));

  async function load() {
    const calendarRange = rangeFor(period);
    const [{ data: emps }, { data: brs }, { data: settings }] = await Promise.all([
      supabase.from('employees').select('*').eq('org_id', orgId),
      supabase.from('branches').select('*').eq('org_id', orgId),
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
    ]);
    setBranches(brs || []);
    const branchFiltered = branchFilter === 'all' ? (emps || []) : (emps || []).filter((e) => e.branch_id === branchFilter);
    const filtered = payTypeFilter === 'all' ? branchFiltered : branchFiltered.filter((e) => e.pay_type === payTypeFilter);
    const empRanges = filtered.map((emp) => {
      const effectivePeriod = payrollPeriodForEmployee(emp, period);
      return { empId: emp.id, effectivePeriod, range: rangeForEmployee(effectivePeriod, emp) };
    });
    const minFrom = empRanges.map((item) => item.range.from).sort()[0] || calendarRange.from;
    const maxTo = empRanges.map((item) => item.range.to).sort().slice(-1)[0] || calendarRange.to;
    setPayRange({ from: minFrom, to: maxTo });
    const [{ data: att }, { data: sales }, { data: adj }, paymentsRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
      supabase.from('sales').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
      supabase.from('adjustments').select('*').eq('org_id', orgId).gte('date', minFrom).lte('date', maxTo),
      supabase.from('payroll_payments').select('*').eq('org_id', orgId).gte('cycle_to', minFrom).lte('cycle_from', maxTo),
    ]);
    const payments = paymentsRes?.data || [];
    let totalNet = 0;
    const result = filtered.map((emp) => {
      const br = (brs || []).find((b) => b.id === emp.branch_id);
      const rules = rulesFor(settings?.rules, br, emp);
      const effectivePeriod = payrollPeriodForEmployee(emp, period);
      const range = rangeForEmployee(effectivePeriod, emp);
      const empAtt = (att || []).filter((a) => a.emp_id === emp.id && a.date >= range.from && a.date <= range.to);
      const empSales = (sales || []).filter((s) => s.emp_id === emp.id && s.date >= range.from && s.date <= range.to);
      const empAdj = (adj || []).filter((a) => a.emp_id === emp.id && a.date >= range.from && a.date <= range.to);
      const pay = computePay(emp, empAtt, empSales, empAdj, rules, range);
      const payment = payments.find((p) => p.emp_id === emp.id && p.cycle_from === range.from && p.cycle_to === range.to) || null;
      totalNet += pay.net;
      return { emp, br, pay, rules, range, effectivePeriod, empAtt, empAdj, payment };
    });
    setRows(result);
    setTotal(totalNet);
  }

  async function togglePaid(row) {
    const { emp, range, effectivePeriod, pay, payment } = row;
    if (payment) {
      const { error } = await supabase.rpc('payroll_unmark_paid', {
        p_emp_id: emp.id,
        p_cycle_from: range.from,
        p_cycle_to: range.to,
      });
      if (error) { alert('ยกเลิกสถานะจ่ายไม่สำเร็จ: ' + error.message); return; }
    } else {
      const { error } = await supabase.rpc('payroll_mark_paid', {
        p_emp_id: emp.id,
        p_period: effectivePeriod || period,
        p_cycle_from: range.from,
        p_cycle_to: range.to,
        p_net_amount: Math.round(pay.net),
        p_note: null,
      });
      if (error) { alert('บันทึกสถานะจ่ายไม่สำเร็จ: ' + error.message); return; }
    }
    load();
  }

  useEffect(() => { load(); }, [period, branchFilter, payTypeFilter]);

  function exportCsv() {
    const headers = ['พนักงาน', 'สาขา', 'วันทำงาน', 'ค่าแรง', 'OT', 'คอมมิชชั่น', 'โบนัส', 'ประกันสังคม', 'เบิก', 'หักรวม', 'สุทธิ'];
    const csvRows = rows.map(({ emp, br, pay }) => [
      emp.name,
      br?.label || '',
      pay.daysWorked,
      pay.base,
      pay.otPay,
      pay.commission,
      pay.bonus,
      pay.ss,
      pay.advance,
      pay.deductTotal,
      pay.net,
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lucid-payroll-${period}-${branchFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toggleDetails(empId) {
    setExpanded((prev) => ({ ...prev, [empId]: !prev[empId] }));
  }

  function toggleDayView(empId) {
    setDayView((prev) => ({ ...prev, [empId]: !prev[empId] }));
    setExpanded((prev) => ({ ...prev, [empId]: true }));
  }

  async function saveManualNet(row, targetNet, note) {
    const emp = row?.emp;
    if (!row) return { error: new Error('Payroll row not found') };

    const currentNet = Number(row.pay.net || 0);
    const nextNet = Number(targetNet || 0);
    const delta = Math.round((nextNet - currentNet) * 100) / 100;
    const manualPrefix = `${MANUAL_PAYROLL_NOTE_PREFIX}[${row.effectivePeriod || period}]`;

    const cleanup = await supabase
      .from('adjustments')
      .delete()
      .eq('emp_id', emp.id)
      .gte('date', row.range.from)
      .lte('date', row.range.to)
      .like('note', `${manualPrefix}%`);

    if (cleanup.error) return cleanup;
    if (delta === 0) return { error: null };

    return supabase.from('adjustments').insert({
      emp_id: emp.id,
      org_id: orgId,
      date: row.range.to,
      type: delta > 0 ? 'bonus' : 'other',
      amount: Math.abs(delta),
      note: `${manualPrefix} ${note || 'ปรับยอดจ่ายจริง'} | target=${nextNet}`,
      auto: false,
    });
  }

  function payrollSummaryText(row) {
    const { emp, br, pay, range } = row;
    return [
      `สรุปการจ่ายเงิน ${PERIOD_LABEL[row.effectivePeriod || period]}`,
      `${range.from} ถึง ${range.to}`,
      `พนักงาน: ${emp.nickname || emp.name}`,
      br?.label ? `สาขา: ${br.label}` : null,
      `วันทำงาน: ${pay.daysWorked} วัน`,
      `ค่าแรง: ${THB(pay.base)}`,
      pay.otPay > 0 ? `OT: ${THB(pay.otPay)}` : null,
      pay.commission > 0 ? `คอมมิชชั่น: ${THB(pay.commission)}` : null,
      pay.bonus > 0 ? `โบนัส: ${THB(pay.bonus)}` : null,
      pay.lateDeduct > 0 ? `หักสาย: -${THB(pay.lateDeduct)}` : null,
      pay.damage > 0 ? `หักเสียหาย: -${THB(pay.damage)}` : null,
      pay.advance > 0 ? `เบิกล่วงหน้า: -${THB(pay.advance)}` : null,
      pay.otherDeduct > 0 ? `หักอื่นๆ: -${THB(pay.otherDeduct)}` : null,
      pay.ss > 0 ? `ประกันสังคม: -${THB(pay.ss)}` : null,
      `หักรวม: -${THB(pay.deductTotal)}`,
      `สุทธิที่จ่าย: ${THB(pay.net)}`,
    ].filter(Boolean).join('\n');
  }

  async function sendPayrollSummary(row) {
    const ok = confirm(`ส่งสรุปการจ่ายเงินให้ ${row.emp.nickname || row.emp.name}?`);
    if (!ok) return;
    // ensure payrollSummaryText uses the employee's own effective period
    const { error } = await supabase.from('messages').insert({
      emp_id: row.emp.id,
      org_id: orgId,
      from: 'admin',
      kind: 'message',
      text: payrollSummaryText(row),
      status: 'unread',
      created_at: new Date().toISOString(),
    });
    alert(error ? (error.message || 'ส่งสรุปไม่สำเร็จ') : 'ส่งสรุปให้พนักงานแล้ว');
  }

  async function downloadPayrollSlip(row) {
    const { emp, br, pay, range, effectivePeriod: ep } = row;
    const logo = await loadImage(slipLogo).catch(() => null);
    const exportScale = 3;
    const slipWidth = 900;
    const slipHeight = 1180;
    const canvas = document.createElement('canvas');
    canvas.width = slipWidth * exportScale;
    canvas.height = slipHeight * exportScale;
    const ctx = canvas.getContext('2d');
    ctx.scale(exportScale, exportScale);
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, slipWidth, slipHeight);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 60, 60, 780, 1060, 28);
    ctx.fill();

    ctx.fillStyle = '#0E7C66';
    roundRect(ctx, 60, 60, 780, 190, 28);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 100, 92, 300, 86, 18);
    ctx.fill();
    if (logo) {
      drawContainImage(ctx, logo, 124, 108, 252, 54);
    } else {
      ctx.fillStyle = '#2f302e';
      ctx.font = '700 38px sans-serif';
      ctx.fillText('JE BAR', 132, 148);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px sans-serif';
    ctx.fillText('สลิปการจ่ายเงิน', 440, 128);
    ctx.font = '500 22px sans-serif';
    ctx.fillText(PERIOD_LABEL[ep || period], 440, 166);
    ctx.font = '400 18px sans-serif';
    ctx.fillText(`${range.from} ถึง ${range.to}`, 440, 202);

    ctx.fillStyle = '#111827';
    ctx.font = '700 34px sans-serif';
    ctx.fillText(emp.name, 100, 310);
    ctx.font = '500 22px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${emp.nickname ? `"${emp.nickname}" · ` : ''}${br?.label || ''}`, 100, 348);
    ctx.fillText(`วันทำงาน ${pay.daysWorked} วัน`, 100, 384);

    const income = [
      ['ค่าแรงตามรอบ', pay.base],
      ['OT', pay.otPay],
      ['คอมมิชชั่น', pay.commission],
      ['โบนัส', pay.bonus],
    ];
    const deduct = [
      ['หักสาย', pay.lateDeduct],
      ['เสียหาย', pay.damage],
      ['เบิกล่วงหน้า', pay.advance],
      ['หักอื่นๆ', pay.otherDeduct],
      ['ประกันสังคม', pay.ss],
    ];

    let y = 460;
    y = drawSlipSection(ctx, 'รายรับ', income, y, '#0E7C66', '+');
    y = drawSlipSection(ctx, 'รายการหัก', deduct, y + 24, '#dc2626', '-');

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, y + 26);
    ctx.lineTo(800, y + 26);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = '700 30px sans-serif';
    ctx.fillText('ยอดสุทธิที่จ่าย', 100, y + 88);
    ctx.fillStyle = '#0E7C66';
    ctx.textAlign = 'right';
    ctx.font = '800 44px sans-serif';
    ctx.fillText(THB(pay.net), 800, y + 92);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#6b7280';
    ctx.font = '400 18px sans-serif';
    ctx.fillText(`สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`, 100, 1060);
    ctx.textAlign = 'right';
    ctx.fillText('JE BAR', 800, 1060);
    ctx.textAlign = 'left';

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `pay-slip-${emp.nickname || emp.name}-${range.from}-${range.to}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>คำนวณเงิน</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportCsv} disabled={rows.length === 0} style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '8px 16px', fontSize: 14 }}>Export CSV</button>
          {[{ k: 'day', l: 'วันนี้' }, { k: 'week', l: 'สัปดาห์' }, { k: 'month', l: 'เดือน' }].map((p) => (
            <button key={p.k} onClick={() => setPeriod(p.k)} className="btn" style={{ background: period === p.k ? 'var(--accent)' : 'var(--surface)', color: period === p.k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '8px 16px', fontSize: 14 }}>{p.l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setBranchFilter('all')} className="btn" style={{ background: branchFilter === 'all' ? 'var(--ink)' : 'var(--surface)', color: branchFilter === 'all' ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 16px', fontSize: 13 }}>ทุกสาขา</button>
        {branches.map((b) => (
          <button key={b.id} onClick={() => setBranchFilter(b.id)} className="btn" style={{ background: branchFilter === b.id ? 'var(--ink)' : 'var(--surface)', color: branchFilter === b.id ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 16px', fontSize: 13 }}>{b.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'ทุกประเภทค่าจ้าง' },
          { key: 'daily', label: 'รายวัน' },
          { key: 'weekly', label: 'รายสัปดาห์' },
          { key: 'monthly', label: 'รายเดือน' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setPayTypeFilter(item.key)}
            className="btn"
            style={{
              background: payTypeFilter === item.key ? 'var(--accent)' : 'var(--surface)',
              color: payTypeFilter === item.key ? '#fff' : 'var(--muted)',
              border: '1px solid var(--line)',
              padding: '7px 16px',
              fontSize: 13,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '20px 24px', color: '#fff', marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: .8 }}>ยอดจ่ายรวม ({rows.length} คน)</div>
        <div className="num" style={{ fontSize: 36, fontWeight: 700 }}>{THB(total)}</div>
        <div style={{ fontSize: 12, opacity: .8, marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>ช่วงข้อมูลรวมในหน้านี้ {payRange.from} - {payRange.to}</span>
          {rows.length > 0 && (
            <span>· จ่ายแล้ว {rows.filter((r) => r.payment).length}/{rows.length} คน</span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {rows.map((row) => {
          const { emp, br, pay, rules, range, effectivePeriod, empAtt, empAdj, payment } = row;
          return (
          <div key={emp.id} className="card" style={{ padding: 18, ...(payment ? { borderColor: '#0E7C66' } : {}) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{emp.name}</span>
                  {payment && (
                    <span style={{ background: '#0E7C66', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      ✓ จ่ายแล้ว
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                  {br?.label || '—'} · {emp.pay_type === 'daily' ? 'รายวัน' : emp.pay_type === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                  รอบพนักงาน: <span className="num">{range.from}</span> - <span className="num">{range.to}</span>
                </div>
                {payment && (
                  <div style={{ color: '#0E7C66', fontSize: 12, marginTop: 4 }}>
                    จ่ายเมื่อ {new Date(payment.paid_at).toLocaleDateString('th-TH')} · ยอด {THB(payment.net_amount)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>สุทธิที่ต้องจ่าย</div>
                <div className="num" style={{ fontWeight: 800, fontSize: 26, color: 'var(--accent)' }}>{THB(pay.net)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
              <SummaryItem label="ค่าจ้างต่อวัน" value={`${THB(pay.configuredRate)} / วัน`} hint={pay.scheduledDaysLabel} />
              <SummaryItem label="ค่าแรงงวดนี้" value={THB(pay.base)} hint={`คิดจ่าย ${pay.paidUnits} วัน · ${THB(pay.effectiveDayRate)}/วัน`} />
              <SummaryItem
                label="วันทำงานจริง"
                value={`${pay.daysWorked} วัน`}
                hint={
                  emp.pay_type === 'daily'
                    ? (pay.paidLeaveDays > 0 ? `ลาจ่าย ${pay.paidLeaveDays} วัน` : 'คิดตามวันทำงานจริง')
                    : `รอบนี้ ${pay.cycleDaysTotal || 0} วัน · หยุด ${pay.offDaysTotal || 0} วัน · ตารางงาน ${pay.scheduledDaysInCycle || 0} วัน`
                }
              />
              <SummaryItem label="OT / คอม / โบนัส" value={`${THB(pay.otPay + pay.commission + pay.bonus)}`} hint={`OT ${THB(pay.otPay)} · คอม ${THB(pay.commission)} · โบนัส ${THB(pay.bonus)}`} />
              <SummaryItem label="หักรวม" value={pay.deductTotal > 0 ? `-${THB(pay.deductTotal)}` : THB(0)} hint={`ประกันสังคม ${THB(pay.ss)} · เบิก ${THB(pay.advance)}`} danger={pay.deductTotal > 0} />
              <SummaryItem label="รอบจ่ายของคนนี้" value={emp.pay_type === 'weekly' ? `เริ่ม ${weekdayLabel(emp.weekly_cycle_start_day)}` : emp.pay_type === 'monthly' ? `เริ่มวันที่ ${emp.monthly_cycle_start_day || '—'}` : 'คิดตามวันทำงาน'} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button
                className="btn"
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: payment ? 'var(--bg)' : '#0E7C66', color: payment ? '#0E7C66' : '#fff', border: payment ? '1px solid #0E7C66' : 'none' }}
                onClick={() => togglePaid(row)}
              >
                {payment ? '↩ ยกเลิกจ่าย' : '✓ ทำเครื่องหมายจ่ายแล้ว'}
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => toggleDetails(emp.id)}>
                {expanded[emp.id] && !dayView[emp.id] ? 'ซ่อนรายละเอียด' : 'รายละเอียด'}
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: dayView[emp.id] ? 'var(--ink)' : 'var(--bg)', color: dayView[emp.id] ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }} onClick={() => toggleDayView(emp.id)}>
                {dayView[emp.id] ? 'ซ่อนรายวัน' : 'ดูรายวัน'}
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} onClick={() => setSsModal({ emp, rules })}>
                แก้ประกันสังคม
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} onClick={() => setAdvanceModal({ emp, effectivePeriod })}>
                เบิก / หักล่วงหน้า
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} onClick={() => setNetModal({ emp, currentNet: pay.net, range, effectivePeriod, row })}>
                ปรับยอดจริง
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} onClick={() => downloadPayrollSlip({ emp, br, pay, rules, range, effectivePeriod })}>
                สลิป
              </button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} onClick={() => sendPayrollSummary({ emp, br, pay, rules, range, effectivePeriod })}>
                ส่งให้พนักงาน
              </button>
            </div>

            {expanded[emp.id] && !dayView[emp.id] && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <PayDetails pay={pay} rules={rules} />
              </div>
            )}
            {dayView[emp.id] && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <DayBreakdown
                  emp={emp}
                  range={range}
                  att={empAtt}
                  adj={empAdj}
                  rules={rules}
                  onEditDay={(dateStr, rec) => setDayEditModal({ emp, orgId, date: dateStr, rec, rules })}
                />
              </div>
            )}
          </div>
        )})}

        {rows.length === 0 && (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>
            ยังไม่มีข้อมูลเงินเดือนในช่วงนี้
          </div>
        )}
      </div>

      {ssModal && <SsModal data={ssModal} onClose={() => setSsModal(null)} onSaved={() => { setSsModal(null); load(); }} />}
      {advanceModal && <AdvanceModal emp={advanceModal.emp} orgId={orgId} period={advanceModal.effectivePeriod || period} onClose={() => setAdvanceModal(null)} onSaved={() => { setAdvanceModal(null); load(); }} />}
      {netModal && <ManualNetModal data={netModal} period={period} onClose={() => setNetModal(null)} onSave={async (targetNet, note) => {
        const result = await saveManualNet(netModal.row, targetNet, note);
        if (result.error) throw result.error;
        setNetModal(null);
        load();
      }} />}
      {dayEditModal && <DayEditModal data={dayEditModal} onClose={() => setDayEditModal(null)} onSaved={() => { setDayEditModal(null); load(); }} />}
    </div>
  );
}

function DayBreakdown({ emp, range, att, adj, rules, onEditDay }) {
  const start = parseYmd(range.from);
  const end = parseYmd(range.to);
  if (!start || !end) return null;

  const days = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(ymd(cursor));
  }

  const dayOff = new Set((emp.day_off || []).map(Number));
  const attByDate = {};
  (att || []).forEach((r) => { attByDate[r.date] = r; });
  const adjByDate = {};
  (adj || []).forEach((a) => {
    if (!adjByDate[a.date]) adjByDate[a.date] = [];
    adjByDate[a.date].push(a);
  });

  const STATUS = {
    work: { label: 'ทำงาน', color: '#0E7C66' },
    leave: { label: 'ลา', color: '#d97a16' },
    absent: { label: 'ขาด', color: '#dc2626' },
    off: { label: 'หยุด', color: 'var(--muted)' },
    none: { label: '—', color: 'var(--muted)' },
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
        รายวัน · {range.from} – {range.to} · {days.length} วัน
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 12 }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>วันที่</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>สถานะ</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>เข้างาน</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>ออกงาน</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>สาย</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>OT</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>ปรับ / หัก</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {days.map((dateStr) => {
              const rec = attByDate[dateStr];
              const dayAdjs = adjByDate[dateStr] || [];
              const d = new Date(dateStr + 'T00:00');
              const isOff = dayOff.has(d.getDay());
              const lateMins = rec && rec.clock_in ? lateMinutesOf(rec, rules) : 0;
              const otMins = rec && rec.clock_out ? overtimeMinutesOf(rec, rules) : 0;

              let s = STATUS.none;
              if (isOff && !rec) s = STATUS.off;
              else if (rec?.status === 'leave') s = STATUS.leave;
              else if (rec?.status === 'absent') s = STATUS.absent;
              else if (rec) s = STATUS.work;

              return (
                <tr
                  key={dateStr}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    background: isOff && !rec ? 'var(--surface)' : 'transparent',
                    opacity: isOff && !rec ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 500 }}>{fmtDateFull(dateStr)}</span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                    <span style={{ color: s.color, fontWeight: 700, fontSize: 12 }}>{s.label}</span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                    {rec?.clock_in || '—'}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                    {rec?.clock_out || '—'}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                    {lateMins > 0
                      ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{lateMins} น.</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                    {otMins > 0
                      ? <span style={{ color: '#0E7C66', fontWeight: 600 }}>{otMins} น.</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    {dayAdjs.length > 0 ? (
                      <div style={{ display: 'grid', gap: 2 }}>
                        {dayAdjs.map((a, i) => (
                          <span key={i} style={{ fontSize: 11, color: a.type === 'bonus' ? '#0E7C66' : '#dc2626', whiteSpace: 'nowrap' }}>
                            {a.type === 'bonus' ? '+' : '−'}{THB(a.amount)} {a.note ? `(${a.note.replace(/\[.*?\]/g, '').trim()})` : a.type}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                    <button
                      className="btn"
                      style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', whiteSpace: 'nowrap' }}
                      onClick={() => onEditDay && onEditDay(dateStr, rec || null)}
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayEditModal({ data, onClose, onSaved }) {
  const { emp, orgId, date, rec, rules } = data;
  const initialStatus = rec?.status === 'leave' ? 'leave' : rec?.status === 'absent' ? 'absent' : rec ? 'present' : 'present';
  const [status, setStatus] = useState(initialStatus);
  const [clockIn, setClockIn] = useState(rec?.clock_in || '');
  const [clockOut, setClockOut] = useState(rec?.clock_out || '');
  const [paid, setPaid] = useState(rec?.paid ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    const row = {
      org_id: orgId,
      emp_id: emp.id,
      date,
      status,
      clock_in: status === 'present' ? (clockIn || null) : null,
      clock_out: status === 'present' ? (clockOut || null) : null,
      paid: status === 'leave' ? paid : true,
      leave_type: status === 'leave' ? (rec?.leave_type || 'ลา') : null,
    };
    if (status === 'present' && clockOut) {
      row.ot_min = overtimeMinutesOf({ clock_out: clockOut }, rules);
    } else {
      row.ot_min = 0;
    }
    const { error } = await supabase.from('attendance').upsert(row, { onConflict: 'emp_id,date' });
    setBusy(false);
    if (error) { setErr(error.message || 'บันทึกไม่สำเร็จ'); return; }
    onSaved();
  }

  async function removeDay() {
    if (!confirm('ลบรายการลงเวลาของวันนี้?')) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('attendance').delete().eq('emp_id', emp.id).eq('date', date);
    setBusy(false);
    if (error) { setErr(error.message || 'ลบไม่สำเร็จ'); return; }
    onSaved();
  }

  const STATUS_OPTS = [
    ['present', 'ทำงาน'],
    ['leave', 'ลา'],
    ['absent', 'ขาด'],
  ];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>แก้ไขการลงเวลา</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          {emp.name} · {fmtDateFull(date)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {STATUS_OPTS.map(([value, label]) => (
            <button
              key={value}
              className="btn"
              onClick={() => setStatus(value)}
              style={{ background: status === value ? 'var(--accent)' : 'var(--bg)', color: status === value ? '#fff' : 'var(--ink)', border: '1px solid var(--line)', padding: '8px 0' }}
            >
              {label}
            </button>
          ))}
        </div>

        {status === 'present' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เวลาเข้า</label>
              <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เวลาออก</label>
              <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>
        )}

        {status === 'leave' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            ลาแบบได้รับค่าจ้าง (นับเป็นวันจ่าย)
          </label>
        )}

        {status === 'absent' && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>วันขาดงานจะไม่ถูกนับเป็นวันจ่าย</div>
        )}

        {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
        </div>
        {rec && (
          <button className="btn" style={{ width: '100%', marginTop: 10, background: 'var(--bg)', border: '1px solid var(--line)', color: '#dc2626' }} onClick={removeDay} disabled={busy}>
            ลบรายการวันนี้
          </button>
        )}
      </div>
    </div>
  );
}

function weekdayLabel(value) {
  const labels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  return labels[Number(value)] || '—';
}

function SummaryItem({ label, value, hint, danger = false }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: 18, color: danger ? 'var(--danger-fg)' : 'var(--ink)', marginTop: 4 }}>{value}</div>
      {hint ? <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawContainImage(ctx, img, x, y, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  const left = x + (maxWidth - width) / 2;
  const top = y + (maxHeight - height) / 2;
  ctx.drawImage(img, left, top, width, height);
}

function drawSlipSection(ctx, title, rows, startY, color, sign) {
  let y = startY;
  ctx.fillStyle = '#111827';
  ctx.font = '700 26px sans-serif';
  ctx.fillText(title, 100, y);
  y += 34;

  rows.filter(([, value]) => value > 0).forEach(([label, value]) => {
    ctx.fillStyle = '#374151';
    ctx.font = '500 22px sans-serif';
    ctx.fillText(label, 110, y);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.font = '700 22px sans-serif';
    ctx.fillText(`${sign}${THB(value)}`, 800, y);
    ctx.textAlign = 'left';
    y += 38;
  });

  if (y === startY + 34) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 20px sans-serif';
    ctx.fillText('ไม่มีรายการ', 110, y);
    y += 38;
  }

  return y;
}

function PayDetails({ pay, rules }) {
  const income = [
    ['ค่าแรงงวดนี้', pay.base],
    ['OT', pay.otPay],
    ['คอมมิชชั่น', pay.commission],
    ['โบนัส', pay.bonus],
  ];
  const deduct = [
    ['หักสาย', pay.lateDeduct],
    ['เสียหาย', pay.damage],
    ['เบิกล่วงหน้า', pay.advance],
    ['หักอื่นๆ', pay.otherDeduct],
    ['ประกันสังคม', pay.ss],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      <DetailBox
        title="รายรับ"
        rows={income}
        sign="+"
        meta={[
          `อัตราค่าจ้าง ${THB(pay.configuredRate)} / วัน`,
          pay.configuredPayType === 'daily'
            ? `มาทำงาน ${pay.daysWorked} วัน`
            : `รอบนี้ ${pay.cycleDaysTotal || 0} วัน · หยุด ${pay.offDaysTotal || 0} วัน · ตารางงาน ${pay.scheduledDaysInCycle || 0} วัน`,
          pay.configuredPayType === 'daily'
            ? null
            : `ถึงวันนี้ผ่านมา ${pay.cycleDaysElapsed || 0} วัน · ผ่านวันทำงานตามตารางแล้ว ${pay.scheduledDaysElapsed || 0} วัน · มาทำงานจริง ${pay.daysWorked} วัน`,
          `คิดจ่าย ${pay.paidUnits} วัน${pay.paidLeaveDays > 0 ? ` (รวมลาจ่าย ${pay.paidLeaveDays} วัน)` : ''}`,
        ].filter(Boolean)}
      />
      <DetailBox title="รายการหัก" rows={deduct} sign="-" />
      <div className="card" style={{ padding: 14, background: 'var(--surface)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>สรุป</div>
        <Line label="ยอดก่อนหัก" value={pay.gross} />
        <Line label="หักรวม" value={pay.deductTotal} danger />
        <Line label="สุทธิ" value={pay.net} strong />
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          ประกันสังคม: {rules.ssMode === 'fixed' ? `คงที่ ${THB(rules.ssAmount || 0)}` : `${rules.ssPercent || 0}% เพดาน ${THB(rules.ssMax || 0)}`}
        </div>
      </div>
    </div>
  );
}

function DetailBox({ title, rows, sign, meta = [] }) {
  return (
    <div className="card" style={{ padding: 14, background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {meta.length > 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10, display: 'grid', gap: 3 }}>
          {meta.map((item) => <div key={item}>{item}</div>)}
        </div>
      )}
      {rows.map(([label, value]) => <Line key={label} label={label} value={value} sign={sign} danger={sign === '-'} />)}
    </div>
  );
}

function Line({ label, value, sign = '', danger = false, strong = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="num" style={{ fontWeight: strong ? 800 : 600, color: strong ? 'var(--accent)' : danger && value > 0 ? 'var(--danger-fg)' : 'var(--ink)' }}>
        {value > 0 && sign}{THB(value || 0)}
      </span>
    </div>
  );
}

function SsModal({ data, onClose, onSaved }) {
  const { emp, rules } = data;
  const override = emp.rule_overrides || {};
  const [mode, setMode] = useState(override.ssMode || 'inherit');
  const [amount, setAmount] = useState(override.ssAmount ?? rules.ssAmount ?? 750);
  const [percent, setPercent] = useState(override.ssPercent ?? rules.ssPercent ?? 5);
  const [max, setMax] = useState(override.ssMax ?? rules.ssMax ?? 750);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    const next = { ...(emp.rule_overrides || {}) };
    delete next.ssMode;
    delete next.ssAmount;
    delete next.ssPercent;
    delete next.ssMax;

    if (mode === 'none') {
      next.ssMode = 'fixed';
      next.ssAmount = 0;
    } else if (mode === 'fixed') {
      next.ssMode = 'fixed';
      next.ssAmount = Number(amount || 0);
    } else if (mode === 'percent') {
      next.ssMode = 'percent';
      next.ssPercent = Number(percent || 0);
      next.ssMax = Number(max || 0);
    }

    const { error } = await supabase.from('employees').update({ rule_overrides: next }).eq('id', emp.id);
    setBusy(false);
    if (error) {
      setErr(error.message || 'บันทึกประกันสังคมไม่สำเร็จ');
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>ตั้งค่าประกันสังคมรายบุคคล</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{emp.name}</div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          {[
            ['inherit', 'ใช้ตามกฎสาขา/ร้าน'],
            ['none', 'ไม่หักประกันสังคมคนนี้'],
            ['fixed', 'กำหนดยอดคงที่'],
            ['percent', 'คิดเป็นเปอร์เซ็นต์'],
          ].map(([value, label]) => (
            <button key={value} className="btn" onClick={() => setMode(value)} style={{ justifyContent: 'flex-start', background: mode === value ? 'var(--accent)' : 'var(--bg)', color: mode === value ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>
              {label}
            </button>
          ))}
        </div>
        {mode === 'fixed' && <NumberInput label="ยอดประกันสังคมคงที่ (บาท)" value={amount} onChange={setAmount} />}
        {mode === 'percent' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <NumberInput label="% ที่หัก" value={percent} onChange={setPercent} />
            <NumberInput label="เพดานสูงสุด (บาท)" value={max} onChange={setMax} />
          </div>
        )}
        {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

function AdvanceModal({ emp, orgId, period, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState(period);
  const [date, setDate] = useState(ymd(new Date()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const value = Number(amount || 0);
    if (value <= 0) {
      setErr('กรุณาใส่ยอดเบิก');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('adjustments').insert({
      emp_id: emp.id,
      org_id: orgId,
      date,
      type: 'advance',
      amount: value,
      note: `[เบิก${PERIOD_LABEL[cycle]}] ${note || 'เบิกเงิน'}`,
    });
    setBusy(false);
    if (error) {
      setErr(error.message || 'บันทึกเบิกไม่สำเร็จ');
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>บันทึกเบิกเงิน</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{emp.name}</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <NumberInput label="ยอดเบิก (บาท)" value={amount} onChange={setAmount} />
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>รอบที่จะนำไปหัก</label>
            <select value={cycle} onChange={(e) => setCycle(e.target.value)}>
              <option value="day">รายวัน</option>
              <option value="week">รายสัปดาห์</option>
              <option value="month">รายเดือน</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>วันที่เบิก</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เบิกล่วงหน้า" />
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกเบิก'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

function ManualNetModal({ data, period, onClose, onSave }) {
  const [targetNet, setTargetNet] = useState(Math.round(Number(data.currentNet || 0)));
  const [note, setNote] = useState('ปรับยอดจ่ายจริง');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await onSave(Number(targetNet || 0), note);
    } catch (ex) {
      setErr(ex.message || 'ปรับยอดจ่ายจริงไม่สำเร็จ');
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>ปรับยอดจ่ายจริง</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          {data.emp.name} · {PERIOD_LABEL[period]} · {data.range?.from} - {data.range?.to}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 12, background: 'var(--bg)' }}>
            ยอดปัจจุบัน: <span className="num" style={{ fontWeight: 700 }}>{THB(data.currentNet || 0)}</span>
          </div>
          <NumberInput label="ยอดสุทธิที่ต้องการจ่าย (บาท)" value={targetNet} onChange={setTargetNet} />
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เหตุผล</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ปรับยอดจริงตามตกลง" />
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกยอดจริง'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}





