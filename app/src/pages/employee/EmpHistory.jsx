import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { fmtDateFull, fmtDate, ymd, dayRate, rulesFor } from '../../lib/payroll';

const STATUS_LABEL = { present: 'มาทำงาน', late: 'มาสาย', leave: 'ลา', absent: 'ขาด' };
const STATUS_COLOR = { present: 'var(--accent)', late: 'var(--late-fg)', leave: 'var(--leave-fg)', absent: 'var(--danger-fg)' };
const STATUS_BG = { present: 'var(--accent-soft)', late: 'var(--late-bg)', leave: 'var(--leave-bg)', absent: 'var(--danger-bg)' };

const OPS_LABELS = {
  bills: 'ถ่ายบิลซื้อของ',
  production: 'บันทึกการผลิตขนม',
  inventory: 'วัตถุดิบและสต๊อก',
  'cake-stock': 'สต๊อกขนม',
  'supplies-count': 'นับสต๊อกของใช้',
  'purchase-list': 'ใบสั่งซื้อ',
};

function OpsIcon({ taskKey }) {
  const paths = {
    bills: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    'purchase-list': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></>,
    production: <><rect x="3" y="5" width="18" height="16" rx="2"/><rect x="6" y="9" width="12" height="8" rx="1"/><line x1="3" y1="8" x2="21" y2="8"/><circle cx="8.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="15.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></>,
    inventory: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    'supplies-count': <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></>,
    'cake-stock': <><rect x="2" y="15" width="20" height="6" rx="2"/><rect x="5" y="11" width="14" height="4"/><line x1="5" y1="11" x2="19" y2="11"/><line x1="12" y1="6" x2="12" y2="11"/><path d="M12 6 Q10 3.5 12 2 Q14 3.5 12 6z" fill="currentColor" stroke="none"/></>,
  };
  return (
    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[taskKey] || <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>}
      </svg>
    </div>
  );
}

export default function EmpHistory() {
  const { employee, orgId, employeeSessionToken } = useAuthStore();
  const [att, setAtt] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [opsEntries, setOpsEntries] = useState([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsFilter, setOpsFilter] = useState('all');
  const [tab, setTab] = useState('att');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [branch, setBranch] = useState(null);
  const [settings, setSettings] = useState(null);

  const opsCounts = useMemo(() => {
    const c = { all: opsEntries.length };
    opsEntries.forEach(e => { c[e.task_key] = (c[e.task_key] || 0) + 1; });
    return c;
  }, [opsEntries]);

  const filteredOps = useMemo(() =>
    opsFilter === 'all' ? opsEntries : opsEntries.filter(e => e.task_key === opsFilter),
  [opsEntries, opsFilter]);

  async function load() {
    const { data } = await supabase.rpc('employee_history_data_v2', { p_session_token: employeeSessionToken });
    setAtt(data?.attendance || []);
    setLeaves(data?.leaves || []);
    setBranch(data?.branch || null);
    setSettings(data?.settings || null);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== 'ops' || !employee?.id || !orgId) return;
    setOpsLoading(true);
    supabase
      .from('employee_ops_entries')
      .select('id,task_key,payload,created_at')
      .eq('org_id', orgId)
      .eq('emp_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { setOpsEntries(data || []); setOpsLoading(false); });
  }, [tab, employee?.id, orgId]);

  return (
    <div style={{ padding: '20px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>ประวัติ</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['att', 'การลงเวลา'], ['leave', 'การลา'], ['ops', 'งานร้าน']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className="btn" style={{
            background: tab === t ? 'var(--accent)' : 'var(--surface)',
            color: tab === t ? '#fff' : 'var(--muted)',
            border: '1px solid var(--line)', padding: '8px 20px', fontSize: 14,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'att' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {att.map((a) => (
            <div key={a.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtDateFull(a.date)}</div>
                {a.clock_in && <div className="num" style={{ color: 'var(--muted)', fontSize: 13 }}>{a.clock_in} – {a.clock_out || '–'}</div>}
                {a.status === 'leave' && <div style={{ fontSize: 13, color: 'var(--leave-fg)' }}>{a.leave_type}</div>}
              </div>
              <span className="badge" style={{ background: STATUS_BG[a.status], color: STATUS_COLOR[a.status] }}>
                {STATUS_LABEL[a.status]}
              </span>
            </div>
          ))}
          {att.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>ยังไม่มีประวัติการลงเวลา</div>}
        </div>
      )}

      {tab === 'leave' && (
        <>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => setShowLeaveForm(true)}>
            + ขอลาใหม่
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leaves.map((l) => (
              <div key={l.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{l.type}</span>
                  <span className="badge" style={{
                    background: l.status === 'approved' ? 'var(--accent-soft)' : l.status === 'rejected' ? 'var(--danger-bg)' : 'var(--late-bg)',
                    color: l.status === 'approved' ? 'var(--accent)' : l.status === 'rejected' ? 'var(--danger-fg)' : 'var(--late-fg)',
                  }}>
                    {l.status === 'approved' ? 'อนุมัติ' : l.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{fmtDate(l.date_from)} – {fmtDate(l.date_to)}</div>
                {l.reason && <div style={{ fontSize: 13, marginTop: 4 }}>{l.reason}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'ops' && (
        <div>
          {!opsLoading && opsEntries.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[['all', 'ทั้งหมด'], ...Object.entries(OPS_LABELS)].map(([key, label]) => {
                const count = opsCounts[key] || 0;
                if (key !== 'all' && count === 0) return null;
                return (
                  <button key={key} onClick={() => setOpsFilter(key)} className="btn" style={{
                    background: opsFilter === key ? 'var(--accent)' : 'var(--surface)',
                    color: opsFilter === key ? '#fff' : 'var(--muted)',
                    border: '1px solid var(--line)', padding: '5px 12px', fontSize: 12,
                  }}>
                    {label}{count > 0 && key !== 'all' ? ` (${count})` : key === 'all' ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opsLoading ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>กำลังโหลด...</div>
            ) : filteredOps.length === 0 ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>ยังไม่มีบันทึกงานร้าน</div>
            ) : (
              filteredOps.map((entry) => {
                const p = entry.payload || {};
                const summary = opsPayloadSummary(entry.task_key, p);
                const timeStr = entry.created_at?.slice(11, 16) || '';
                return (
                  <div key={entry.id} className="card" style={{ padding: '12px 16px', display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <OpsIcon taskKey={entry.task_key} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{OPS_LABELS[entry.task_key] || entry.task_key}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                        <div>{fmtDateFull(entry.created_at?.slice(0, 10))}</div>
                        {timeStr && <div style={{ fontWeight: 700 }}>{timeStr}</div>}
                      </div>
                    </div>
                    {summary && <div style={{ fontSize: 13, color: 'var(--muted)', paddingLeft: 28 }}>{summary}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showLeaveForm && (
        <LeaveForm
          employee={employee}
          orgId={orgId}
          branch={branch}
          settings={settings}
          employeeSessionToken={employeeSessionToken}
          onClose={() => { setShowLeaveForm(false); load(); }}
        />
      )}
    </div>
  );
}

function opsPayloadSummary(taskKey, p) {
  switch (taskKey) {
    case 'bills':          return [p.vendor, p.amount ? `฿${p.amount}` : null, p.category].filter(Boolean).join(' · ');
    case 'production':     return [p.product, p.quantity ? `${p.quantity} ${p.unit || ''}`.trim() : null, p.batch].filter(Boolean).join(' · ');
    case 'inventory':      return [p.itemName, p.stockLeft ? `${p.stockLeft} ${p.unit || ''}`.trim() : null, p.status].filter(Boolean).join(' · ');
    case 'cake-stock':     return [p.cakeName, p.available != null ? `พร้อมขาย ${p.available}` : null].filter(Boolean).join(' · ');
    case 'supplies-count': return [p.area, p.itemName, p.count != null ? `${p.count} ${p.unit || ''}`.trim() : null].filter(Boolean).join(' · ');
    case 'purchase-list':  return (p.items || []).slice(0, 3).map(i => i.itemName).join(', ') + ((p.items || []).length > 3 ? ` +${(p.items || []).length - 3}` : '');
    default:               return null;
  }
}

function LeaveForm({ employee, orgId, branch, settings, employeeSessionToken, onClose }) {
  const rules = rulesFor(settings?.rules, branch, employee);
  const [type, setType] = useState('ลาป่วย');
  const [dateFrom, setDateFrom] = useState(ymd(new Date()));
  const [dateTo, setDateTo] = useState(ymd(new Date()));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const today = ymd(new Date());
  const isUrgent = dateFrom === today && !reason.trim();
  const dr = dayRate(employee);
  const deductAmt = Math.round(dr * rules.urgentLeaveDeductDays);

  async function submit() {
    setBusy(true);
    const urgent = isUrgent;
    await supabase.rpc('employee_request_leave_v2', {
      p_session_token: employeeSessionToken,
      p_type: type,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_reason: reason,
      p_urgent: urgent,
      p_deduct_amount: 0,
      p_deduct_note: null,
    });
    if (branch?.line_notify_token) {
      const name = employee.nickname || employee.name;
      const dateStr = dateFrom === dateTo ? dateFrom : `${dateFrom} ถึง ${dateTo}`;
      try {
        await fetch('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${branch.line_notify_token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ message: `\n📋 ใบลาใหม่ (รอการอนุมัติ)\nพนักงาน: ${name}\nประเภท: ${type}\nวันที่: ${dateStr}${reason ? `\nเหตุผล: ${reason}` : ''}` }),
        });
      } catch (e) { /* silent */ }
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet">
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>ขอลา</div>
        {isUrgent && (
          <div style={{ background: 'var(--late-bg)', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: 'var(--late-fg)' }}>
            ⚠️ การลาวันนี้โดยไม่มีเหตุผล จะถูกหักเงิน ฿{deductAmt.toLocaleString()} ({rules.urgentLeaveDeductDays} วัน)
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>ประเภทการลา</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {['ลาป่วย', 'ลากิจ', 'ลาพักร้อน'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>วันที่เริ่ม</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} min={today} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>วันที่สิ้นสุด</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>เหตุผล</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล..." rows={3} />
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'กำลังส่ง...' : 'ส่งคำขอ'}</button>
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
