import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { computePay, rulesFor, rangeForEmployee, THB, fmtHM } from '../../lib/payroll';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSlipSection(ctx, title, rows, y, color, sign) {
  ctx.fillStyle = color;
  ctx.font = '600 22px sans-serif';
  ctx.fillText(title, 100, y);
  let cy = y + 34;
  rows.filter(([, v]) => v > 0).forEach(([label, val]) => {
    ctx.fillStyle = '#374151';
    ctx.font = '400 20px sans-serif';
    ctx.fillText(label, 120, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.fillText(`${sign}${THB(val)}`, 800, cy);
    ctx.textAlign = 'left';
    cy += 34;
  });
  return cy;
}

async function generatePaySlip({ employee, branch, pay, payRange }) {
  const scale = 3;
  const W = 900, H = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 60, 60, 780, 1060, 28);
  ctx.fill();

  ctx.fillStyle = '#0E7C66';
  roundRect(ctx, 60, 60, 780, 190, 28);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 100, 92, 300, 86, 18);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 38px sans-serif';
  ctx.fillText('LUCID HR', 130, 148);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('สลิปการจ่ายเงิน', 440, 128);
  ctx.font = '400 18px sans-serif';
  if (payRange) {
    ctx.fillText(`${payRange.from} ถึง ${payRange.to}`, 440, 166);
  }

  ctx.fillStyle = '#111827';
  ctx.font = '700 34px sans-serif';
  ctx.fillText(employee.name || '', 100, 310);
  ctx.font = '500 22px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`${employee.nickname ? `"${employee.nickname}" · ` : ''}${branch?.label || ''}`, 100, 348);
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
  ctx.fillText('LUCID HR', 800, 1060);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

const PERIODS = [
  { k: 'day', label: 'วันนี้' },
  { k: 'week', label: 'สัปดาห์' },
  { k: 'month', label: 'เดือน' },
];

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
  const employeeId = employee?.id || '';
  const naturalPeriod = payrollPeriodForEmployee(employee, 'month');
  const [periodChoice, setPeriodChoice] = useState({ employeeId, period: naturalPeriod });
  const [pay, setPay] = useState(null);
  const [branch, setBranch] = useState(null);
  const [payRange, setPayRange] = useState(null);
  const [payment, setPayment] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const period = periodChoice.employeeId === employeeId ? periodChoice.period : naturalPeriod;
  const effectivePeriod = payrollPeriodForEmployee(employee, period);
  const periodOptions = allowedPeriodsForEmployee(employee);

  useEffect(() => {
    let cancelled = false;

    async function loadPay() {
      const range = rangeForEmployee(effectivePeriod, employee);
      const { data } = await supabase.rpc('employee_pay_data_v2', {
        p_session_token: employeeSessionToken,
        p_from: range.from,
        p_to: range.to,
      });
      if (cancelled) return;
      const br = data?.branch || null;
      const st = data?.settings || null;
      const rules = rulesFor(st?.rules, br, employee);
      setPayRange(range);
      setBranch(br);
      setPayment(data?.payment || null);
      setPay(computePay(employee, data?.attendance || [], data?.sales || [], data?.adjustments || [], rules, range));
    }

    loadPay();
    return () => { cancelled = true; };
  }, [effectivePeriod, employee, employeeSessionToken]);

  async function downloadSlip() {
    if (!pay || !payRange) return;
    setDownloading(true);
    try {
      const dataUrl = await generatePaySlip({ employee, branch, pay, payRange });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `slip-${employee.nickname || employee.name}-${payRange.from}-${payRange.to}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  }

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
            onClick={() => setPeriodChoice({ employeeId, period: p.k })}
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

      <div style={{ background: 'var(--accent)', borderRadius: 22, padding: '24px 20px', color: '#fff', marginBottom: payment ? 12 : 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>เงินสุทธิ</div>
        <div className="num" style={{ fontSize: 42, fontWeight: 700 }}>{THB(pay.net)}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, fontSize: 13, opacity: 0.85, flexWrap: 'wrap' }}>
          <div>{pay.daysWorked} วันทำงาน</div>
          {pay.leaveDays > 0 && <div>{pay.leaveDays} วันลา</div>}
          {pay.absentDays > 0 && <div>{pay.absentDays} วันขาด</div>}
        </div>
      </div>

      {payment && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e7f4ef', border: '1px solid #0E7C66', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: '#0E7C66', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✓</div>
          <div>
            <div style={{ fontWeight: 700, color: '#0E7C66', fontSize: 15 }}>จ่ายเงินงวดนี้แล้ว</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
              จ่ายเมื่อ {new Date(payment.paid_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              {payment.net_amount > 0 ? ` · ยอด ${THB(payment.net_amount)}` : ''}
            </div>
          </div>
        </div>
      )}

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

      <button
        className="btn"
        onClick={downloadSlip}
        disabled={downloading}
        style={{ width: '100%', marginTop: 4, padding: '13px', fontSize: 15, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
      >
        {downloading ? 'กำลังสร้างสลิป...' : '⬇ ดาวน์โหลดสลิปเงินเดือน'}
      </button>
    </div>
  );
}
