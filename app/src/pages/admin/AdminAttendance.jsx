import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ymd, addDays, rulesFor, parseHM } from '../../lib/payroll';

export default function AdminAttendance() {
  const { orgId } = useAuthStore();
  const [date, setDate] = useState(ymd(new Date()));
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [clockOutModal, setClockOutModal] = useState(null);
  const [clockInModal, setClockInModal] = useState(null);

  async function load() {
    const [{ data: attendanceRows }, { data: leaveRows }, { data: brs }, { data: st }] = await Promise.all([
      supabase.from('attendance')
        .select('*, employees(name,nickname,color,branch_id)')
        .eq('org_id', orgId).eq('date', date).order('employees(name)'),
      supabase.from('leaves')
        .select('*, employees(name,nickname,color,branch_id)')
        .eq('org_id', orgId)
        .lte('date_from', date)
        .gte('date_to', date)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('*').eq('org_id', orgId),
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
    ]);
    setBranches(brs || []);
    setSettings(st || null);

    const existingEmpIds = new Set((attendanceRows || []).map((r) => r.emp_id));
    const visibleLeaves = (leaveRows || [])
      .filter((l) => !existingEmpIds.has(l.emp_id))
      .map((l) => ({
        id: `leave-${l.id}`,
        leave_id: l.id,
        emp_id: l.emp_id,
        employees: l.employees,
        date,
        clock_in: null,
        clock_out: null,
        status: 'leave',
        leave_type: l.type,
        leave_status: l.status,
        ot_min: 0,
        checkin_dist: null,
        checkin_selfie_url: null,
        is_leave_request: true,
      }));

    setRows([...(attendanceRows || []), ...visibleLeaves].sort((a, b) => {
      const an = a.employees?.nickname || a.employees?.name || '';
      const bn = b.employees?.nickname || b.employees?.name || '';
      return an.localeCompare(bn, 'th');
    }));
  }

  useEffect(() => { load(); }, [date]);

  async function clearClockOut(row) {
    if (!confirm(`ล้างเวลาออกของ ${row.employees?.nickname || row.employees?.name || 'พนักงาน'}?`)) return;
    const { error } = await supabase.rpc('admin_clear_clock_out', { p_attendance_id: row.id });
    if (error) {
      const fallback = await supabase.from('attendance').update({
        clock_out: null,
        ot_min: 0,
        closing_done: null,
      }).eq('id', row.id);
      if (fallback.error) alert(fallback.error.message || error.message || 'ล้างเวลาออกไม่สำเร็จ');
    }
    load();
  }

  async function deleteAttendance(row) {
    if (!confirm(`ลบรายการลงเวลาวันนี้ของ ${row.employees?.nickname || row.employees?.name || 'พนักงาน'}?`)) return;
    const { error } = await supabase.rpc('admin_delete_attendance', { p_attendance_id: row.id });
    if (error) {
      const fallback = await supabase.from('attendance').delete().eq('id', row.id);
      if (fallback.error) alert(fallback.error.message || error.message || 'ลบรายการไม่สำเร็จ');
    }
    load();
  }

  async function approveLeave(leaveId) {
    await supabase.from('leaves').update({ status: 'approved' }).eq('id', leaveId);
    load();
  }

  async function rejectLeave(leaveId) {
    if (!confirm('ปฏิเสธคำขอลา?')) return;
    await supabase.from('leaves').update({ status: 'rejected' }).eq('id', leaveId);
    load();
  }

  function rulesForRow(row) {
    const br = branches.find((b) => b.id === row.employees?.branch_id);
    return rulesFor(settings?.rules, br, row.employees);
  }

  function defaultClockOutFor(row) {
    return row.clock_out || rulesForRow(row).workEnd || '18:00';
  }

  function calcOtMin(row, clockOut) {
    const rules = rulesForRow(row);
    const outMin = parseHM(clockOut);
    const endMin = parseHM(rules.workEnd);
    if (outMin == null || endMin == null) return 0;
    return Math.max(0, outMin - endMin - Number(rules.otGraceMin || 0));
  }

  function statusForClockIn(row, clockIn) {
    const rules = rulesForRow(row);
    const inMin = parseHM(clockIn);
    const startMin = parseHM(rules.workStart);
    if (inMin == null || startMin == null) return row.status || 'present';
    return inMin > startMin + Number(rules.graceMin || 0) ? 'late' : 'present';
  }

  async function saveManualClockOut(row, clockOut, reason) {
    const otMin = calcOtMin(row, clockOut);
    const { error } = await supabase.rpc('admin_set_clock_out', {
      p_attendance_id: row.id,
      p_clock_out: clockOut,
      p_ot_min: otMin,
      p_reason: reason || 'พนักงานลืมเช็คเอาท์',
    });
    if (error) {
      const fallback = await supabase.from('attendance').update({
        clock_out: clockOut,
        ot_min: otMin,
      }).eq('id', row.id);
      if (fallback.error) {
        alert(fallback.error.message || error.message || 'ใส่เวลาออกไม่สำเร็จ');
        return;
      }
    }
    setClockOutModal(null);
    load();
  }

  async function saveManualClockIn(row, clockIn, reason) {
    const status = statusForClockIn(row, clockIn);
    const { error } = await supabase.rpc('admin_set_clock_in', {
      p_attendance_id: row.id,
      p_clock_in: clockIn,
      p_status: status,
      p_reason: reason || 'แอดมินแก้เวลาเข้างานย้อนหลัง',
    });
    if (error) {
      const fallback = await supabase.from('attendance').update({
        clock_in: clockIn,
        status,
      }).eq('id', row.id);
      if (fallback.error) {
        alert(fallback.error.message || error.message || 'แก้เวลาเข้าไม่สำเร็จ');
        return;
      }
    }
    setClockInModal(null);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>การลงเวลา</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), -1)))}>←</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-ghost" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), 1)))}>→</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
              {['พนักงาน', 'เข้า', 'ออก', 'OT', 'ระยะห่าง', 'เซลฟี่', 'สถานะ', 'จัดการ'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const nickname = r.employees?.nickname || r.employees?.name || 'พนักงาน';
              return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 44, maxWidth: 92, padding: '6px 10px', borderRadius: 999, background: r.employees?.color || '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nickname}
                  </div>
                  <span style={{ fontWeight: 500 }}>{r.employees?.name}</span>
                </td>
                <td style={{ padding: '12px 16px' }} className="num">{r.clock_in || '—'}</td>
                <td style={{ padding: '12px 16px' }} className="num">{r.clock_out || '—'}</td>
                <td style={{ padding: '12px 16px' }} className="num">{r.ot_min > 0 ? `${r.ot_min}น.` : '—'}</td>
                <td style={{ padding: '12px 16px' }} className="num">{r.checkin_dist != null ? `${r.checkin_dist}ม.` : '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <SelfieCell row={r} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{
                    background: r.status === 'present' ? 'var(--accent-soft)' : r.status === 'late' ? 'var(--late-bg)' : r.status === 'leave' ? 'var(--leave-bg)' : 'var(--danger-bg)',
                    color: r.status === 'present' ? 'var(--accent)' : r.status === 'late' ? 'var(--late-fg)' : r.status === 'leave' ? 'var(--leave-fg)' : 'var(--danger-fg)',
                  }}>
                    {r.status === 'present' ? 'มา' : r.status === 'late' ? 'สาย' : r.status === 'leave' ? (r.leave_status === 'pending' ? 'รอลา' : 'ลา') : 'ขาด'}
                  </span>
                  {r.leave_type && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.leave_type}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.is_leave_request && r.leave_status === 'pending' && (
                      <>
                        <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent)', color: '#fff' }} onClick={() => approveLeave(r.leave_id)}>อนุมัติ</button>
                        <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: '#fee2e2', color: '#b91c1c' }} onClick={() => rejectLeave(r.leave_id)}>ปฏิเสธ</button>
                      </>
                    )}
                    {r.is_leave_request && r.leave_status !== 'pending' && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.leave_status === 'approved' ? '✓ อนุมัติแล้ว' : 'จากคำขอลา'}</span>}
                    {!r.is_leave_request && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)' }} onClick={() => setClockInModal({ row: r, clockIn: r.clock_in || rulesForRow(r).workStart || '09:00', reason: 'แอดมินแก้เวลาเข้างานย้อนหลัง' })}>
                        แก้เวลาเข้า
                      </button>
                    )}
                    {!r.is_leave_request && r.clock_out && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => clearClockOut(r)}>
                        ล้างเวลาออก
                      </button>
                    )}
                    {!r.is_leave_request && r.clock_in && !r.clock_out && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => setClockOutModal({ row: r, clockOut: defaultClockOutFor(r), reason: 'พนักงานลืมเช็คเอาท์' })}>
                        ใส่เวลาออก
                      </button>
                    )}
                    {!r.is_leave_request && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--danger-bg)', color: 'var(--danger-fg)' }} onClick={() => deleteAttendance(r)}>
                        ลบรายการ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {clockOutModal && (
        <ManualClockOutModal
          data={clockOutModal}
          onChange={setClockOutModal}
          getOtMin={calcOtMin}
          onSave={saveManualClockOut}
          onClose={() => setClockOutModal(null)}
        />
      )}
      {clockInModal && (
        <ManualClockInModal
          data={clockInModal}
          onChange={setClockInModal}
          getStatus={statusForClockIn}
          onSave={saveManualClockIn}
          onClose={() => setClockInModal(null)}
        />
      )}
    </div>
  );
}

function ManualClockInModal({ data, onChange, getStatus, onSave, onClose }) {
  const { row, clockIn, reason } = data;
  const name = row.employees?.nickname || row.employees?.name || 'พนักงาน';
  const status = getStatus(row, clockIn);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>แก้เวลาเข้างานย้อนหลัง</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>{name} · วันที่ {row.date}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เวลาเข้า</label>
            <input type="time" value={clockIn} onChange={(e) => onChange({ ...data, clockIn: e.target.value })} />
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg)', fontSize: 14 }}>
            สถานะใหม่: <span style={{ fontWeight: 700, color: status === 'late' ? 'var(--late-fg)' : 'var(--accent)' }}>{status === 'late' ? 'สาย' : 'มาทำงาน'}</span>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เหตุผล</label>
            <input value={reason} onChange={(e) => onChange({ ...data, reason: e.target.value })} placeholder="เช่น ปรับเวลาเข้าให้ตรงตามจริง" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave(row, clockIn, reason)} disabled={!clockIn}>บันทึกเวลาเข้า</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualClockOutModal({ data, onChange, getOtMin, onSave, onClose }) {
  const { row, clockOut, reason } = data;
  const name = row.employees?.nickname || row.employees?.name || 'พนักงาน';
  const otMin = getOtMin(row, clockOut);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>ใส่เวลาออกย้อนหลัง</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>{name} · วันที่ {row.date}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เวลาออก</label>
            <input type="time" value={clockOut} onChange={(e) => onChange({ ...data, clockOut: e.target.value })} />
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg)', fontSize: 14 }}>
            OT ที่คำนวณได้: <span className="num" style={{ fontWeight: 700 }}>{otMin}</span> นาที
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>เหตุผล</label>
            <input value={reason} onChange={(e) => onChange({ ...data, reason: e.target.value })} placeholder="เช่น พนักงานลืมเช็คเอาท์" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave(row, clockOut, reason)} disabled={!clockOut}>บันทึกเวลาออก</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelfieCell({ row }) {
  const emp = row.employees || {};
  const label = emp.nickname || emp.name || 'ไม่มีรูป';
  if (row.checkin_selfie_url) {
    return (
      <a href={row.checkin_selfie_url} target="_blank" rel="noreferrer" title="เปิดรูปเซลฟี่">
        <img src={row.checkin_selfie_url} alt="selfie" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
      </a>
    );
  }

  return (
    <div title="ยังไม่มีรูปเซลฟี่ของรายการนี้" style={{ width: 36, height: 36, borderRadius: '50%', background: emp.color || '#0E7C66', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, overflow: 'hidden' }}>
      {label.slice(0, 2)}
    </div>
  );
}
