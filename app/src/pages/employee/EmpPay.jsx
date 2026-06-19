import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { computePay, rulesFor, rangeForEmployee, THB, fmtHM } from '../../lib/payroll';

const PERIODS = [
  { k: 'day', label: 'วันนี้' },
  { k: 'week', label: 'สัปดาห์' },
  { k: 'month', label: 'เดือน' },
];

const PAY_TYPE_LABEL = {
  daily: 'วัน',
  weekly: 'สัปดาห์',
  monthly: 'เดือน',
};

function payrollPeriodForEmployee(employee, requestedPeriod) {
  if (!employee) return requestedPeriod || 'month';
  if (employee.pay_type === 'weekly') return 'week';
  if (employee.pay_type === 'monthly') return 'month';
  return requestedPeriod || 'day';
}

function allowedPeriodsForEmployee(employee) {
  if (!employee) return PERIODS;
  if (employee.pay_type === 'weekly') return PERIODS.filter((item) => item.k === 'week');
  if (employee.pay_type === 'monthly') return PERIODS.filter((item) => item.k === 'month');
  return PERIODS;
}

export default function EmpPay() {
  const { employee, employeeSessionToken } = useAuthStore();
  const naturalPeriod = payrollPeriodForEmployee(employee, 'month');
  const [period, setPeriod] = useState(naturalPeriod);
  const [pay, setPay] = useState(null);
  const [branch, setBranch] = useState(null);
  const [settings, setSettings] = useState(null);
  const [payRange, setPayRange] = useState(null);
  const effectivePeriod = payrollPeriodForEmployee(employee, period);
  const periodOptions = allowedPeriodsForEmployee(employee);

  async function load() {
    const range = rangeForEmployee(effectivePeriod, employee);
    setPayRange(range);
    const { data } = await supabase.rpc('employee_pay_data_v2', {
      p_session_token: employeeSessionToken,
      p_from: range.from,
      p_to: range.to,
    });
    const br = data?.branch || null;
    const st = data?.settings || null;
    setBranch(br);
    setSettings(st);
    const rules = rulesFor(st?.rules, br, employee);
    setPay(computePay(employee, data?.attendance || [], data?.sales || [], data?.adjustments || [], rules, range));
  }

  useEffect(() => {
    setPeriod(naturalPeriod);
  }, [employee?.id, naturalPeriod]);

  useEffect(() => { load(); }, [effectivePeriod, employee?.id]);

  if (!pay) return <div style={{ padding: 24, color: 'var(--muted)' }}>กำลังโหลด...</div>;

  const items = [
    { label: 'ค่าแรงงวดนี้', value: pay.base, type: '+' },
    pay.otPay > 0 && { label: `OT (${fmtHM(pay.otMin)} ชม.)`, value: pay.otPay, type: '+' },
    pay.commission > 0 && { label: 'คอมมิชชั่น', value: pay.commission, type: '+' },
    pay.bonus > 0 && { label: 'โบนัส / รางวัล', value: pay.bonus, type: '+' },
    pay.lateDeduct > 0 && { label: 'หักมาสาย', value: pay.lateDeduct, type: '-' },
    pay.damage > 0 && { label: 'หักค่าเสียหาย', value: pay.damage, type: '-' },
    pay.advance > 0 && { label: 'เบิกล่วงหน้า', value: pay.advance, type: '-' },
    pay.otherDeduct > 0 && { label: 'หักอื่นๆ', value: pay.otherDeduct, type: '-' },
    pay.ss > 0 && { label: 'ประกันสังคม', value: pay.ss, type: '-' },
  ].filter(Boolean);

  return (
    <div style={{ padding: '20px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>รายได้</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {periodOptions.map((p) => (
          <button
            key={p.k}
            onClick={() => setPeriod(p.k)}
            className="btn"
            style={{
              background: period === p.k ? 'var(--accent)' : 'var(--surface)',
              color: period === p.k ? '#fff' : 'var(--muted)',
              border: '1px solid var(--line)',
              padding: '8px 16px',
              fontSize: 14,
              flex: 1,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {payRange && (
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
          รอบคำนวณ {employee?.pay_type === 'weekly' ? 'รายสัปดาห์' : employee?.pay_type === 'monthly' ? 'รายเดือน' : 'ปัจจุบัน'}:
          {' '}
          <span className="num">{payRange.from}</span> - <span className="num">{payRange.to}</span>
        </div>
      )}

      <div className="card" style={{ padding: '14px 16px', marginBottom: 16, background: 'var(--surface)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>ค่าจ้างต่อวัน</div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{THB(pay.configuredRate)}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          ต่อวัน · {pay.scheduledDaysLabel || `รอบนี้มีวันทำงาน ${pay.scheduledDaysInCycle || pay.daysWorked} วัน`}
        </div>
        {employee?.pay_type !== 'daily' && (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            รอบนี้มี {pay.cycleDaysTotal || 0} วัน · วันหยุดประจำ {pay.offDaysTotal || 0} วัน · วันทำงานตามตาราง {pay.scheduledDaysInCycle || 0} วัน
          </div>
        )}
        {employee?.pay_type !== 'daily' && (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            ถึงวันนี้ผ่านมา {pay.cycleDaysElapsed || 0} วัน · ผ่านวันทำงานตามตารางแล้ว {pay.scheduledDaysElapsed || 0} วัน
          </div>
        )}
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          คิดจ่าย {pay.paidUnits} วัน ที่ {THB(pay.effectiveDayRate)}/วัน
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
          {employee?.pay_type === 'weekly' && 'พนักงานรายสัปดาห์จะนับเฉพาะงวดสัปดาห์ปัจจุบันของพนักงานคนนี้'}
          {employee?.pay_type === 'monthly' && 'พนักงานรายเดือนจะนับเฉพาะงวดเดือนปัจจุบันของพนักงานคนนี้'}
        </div>
      </div>

      <div style={{ background: 'var(--accent)', borderRadius: 22, padding: '24px 20px', color: '#fff', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>เงินสุทธิ</div>
        <div className="num" style={{ fontSize: 42, fontWeight: 700 }}>{THB(pay.net)}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, fontSize: 13, opacity: 0.85, flexWrap: 'wrap' }}>
          <div>{pay.daysWorked} วันทำงาน</div>
          {pay.leaveDays > 0 && <div>{pay.leaveDays} วันลา</div>}
          {pay.absentDays > 0 && <div>{pay.absentDays} วันขาด</div>}
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>รายละเอียด</div>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div style={{ fontSize: 14 }}>{item.label}</div>
            <div className="num" style={{ fontWeight: 600, color: item.type === '+' ? 'var(--accent)' : 'var(--danger-fg)' }}>
              {item.type}{THB(item.value)}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '2px solid var(--line)' }}>
          <div style={{ fontWeight: 700 }}>รวมสุทธิ</div>
          <div className="num" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{THB(pay.net)}</div>
        </div>
      </div>
    </div>
  );
}
