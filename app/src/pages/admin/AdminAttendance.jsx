import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ymd, addDays, dayRate, rulesFor, parseHM } from '../../lib/payroll';

const URGENT_LEAVE_NOTE_PREFIX = 'ลาด่วนเช้าวันงานโดยไม่มีเหตุผล';

export default function AdminAttendance() {
  const { orgId } = useAuthStore();
  const [date, setDate] = useState(ymd(new Date()));
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [clockOutModal, setClockOutModal] = useState(null);
  const [clockInModal, setClockInModal] = useState(null);
  const [tab, setTab] = useState('day');

  async function load() {
    const [{ data: attendanceRows }, { data: leaveRows }, { data: brs }, { data: st }, { data: allEmps }] = await Promise.all([
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
      supabase.from('employees').select('id,name,nickname,color,branch_id,active').eq('org_id', orgId).eq('active', true),
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

    const leaveEmpIds = new Set(visibleLeaves.map(l => l.emp_id));
    const absentRows = (allEmps || [])
      .filter(emp => !existingEmpIds.has(emp.id) && !leaveEmpIds.has(emp.id))
      .map(emp => ({
        id: `absent-${emp.id}`,
        emp_id: emp.id,
        employees: emp,
        date,
        clock_in: null,
        clock_out: null,
        status: 'absent',
        ot_min: 0,
        checkin_dist: null,
        checkin_selfie_url: null,
        is_absent_inferred: true,
      }));

    setRows([...(attendanceRows || []), ...visibleLeaves, ...absentRows].sort((a, b) => {
      const an = a.employees?.nickname || a.employees?.name || '';
      const bn = b.employees?.nickname || b.employees?.name || '';
      return an.localeCompare(bn, 'th');
    }));
  }

  useEffect(() => { load(); }, [date]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel(`att-live-${date}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `org_id=eq.${orgId}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `org_id=eq.${orgId}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [orgId, date]);

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
      if (Boolean(leave.urgent)) {
        const { data: emp } = await supabase.from('employees').select('*').eq('id', leave.emp_id).single();
        if (emp) {
          const br = branches.find((b) => b.id === emp.branch_id);
          const rules = rulesFor(settings?.rules, br, emp);
          const deductDays = Number(rules?.urgentLeaveDeductDays || 0);
          if (deductDays > 0) {
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

  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, leave: 0, absent: 0 };
    rows.forEach(r => { if (counts[r.status] != null) counts[r.status]++; });
    const totalOtMin = rows.reduce((sum, r) => sum + Number(r.ot_min || 0), 0);
    return { ...counts, totalOtMin };
  }, [rows]);

  function exportAttendanceCSV() {
    const headers = ['ชื่อ', 'ชื่อเล่น', 'สาขา', 'วันที่', 'เวลาเข้า', 'เวลาออก', 'สถานะ', 'OT (นาที)', 'ระยะห่าง (ม.)'];
    const STATUS_TH = { present: 'มา', late: 'สาย', leave: 'ลา', absent: 'ขาด' };
    const csvRows = rows.map(r => [
      r.employees?.name || '',
      r.employees?.nickname || '',
      branches.find(b => b.id === r.employees?.branch_id)?.label || '',
      r.date,
      r.clock_in || '',
      r.clock_out || '',
      STATUS_TH[r.status] || r.status,
      r.ot_min || 0,
      r.checkin_dist != null ? r.checkin_dist : '',
    ]);
    const csv = [headers, ...csvRows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jebar-attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>การลงเวลา</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {['day', 'month'].map((t) => (
            <button key={t} className="btn" onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--accent)' : 'var(--surface)', color: tab === t ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 14px', fontSize: 13 }}>
              {t === 'day' ? 'รายวัน' : 'สรุปรายเดือน'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'day' && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={exportAttendanceCSV} disabled={rows.length === 0} title="ส่งออก CSV">📥 CSV</button>
          <button className="btn btn-ghost" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), -1)))}>←</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-ghost" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), 1)))}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'มาทำงาน', value: summary.present, color: 'var(--accent)', bg: 'var(--accent-soft)' },
          { label: 'มาสาย',   value: summary.late,    color: 'var(--late-fg)', bg: 'var(--late-bg)' },
          { label: 'ลา',      value: summary.leave,   color: 'var(--leave-fg)', bg: 'var(--leave-bg)' },
          { label: 'ขาด',     value: summary.absent,  color: 'var(--danger-fg)', bg: 'var(--danger-bg)' },
          { label: 'OT รวม',  value: `${summary.totalOtMin}น.`, color: '#6941c6', bg: '#f9f5ff' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '12px 10px', textAlign: 'center', background: item.bg, border: `1px solid ${item.color}22` }}>
            <div className="num" style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: item.color, marginTop: 2, fontWeight: 600 }}>{item.label}</div>
          </div>
        ))}
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
                    {r.is_absent_inferred && (
                      <span style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>ยังไม่มีข้อมูล</span>
                    )}
                    {!r.is_leave_request && !r.is_absent_inferred && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)' }} onClick={() => setClockInModal({ row: r, clockIn: r.clock_in || rulesForRow(r).workStart || '09:00', reason: 'แอดมินแก้เวลาเข้างานย้อนหลัง' })}>
                        แก้เวลาเข้า
                      </button>
                    )}
                    {!r.is_leave_request && !r.is_absent_inferred && r.clock_out && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => clearClockOut(r)}>
                        ล้างเวลาออก
                      </button>
                    )}
                    {!r.is_leave_request && !r.is_absent_inferred && r.clock_in && !r.clock_out && (
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => setClockOutModal({ row: r, clockOut: defaultClockOutFor(r), reason: 'พนักงานลืมเช็คเอาท์' })}>
                        ใส่เวลาออก
                      </button>
                    )}
                    {!r.is_leave_request && !r.is_absent_inferred && (
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
      </>)}
      {tab === 'month' && <MonthlyReportView orgId={orgId} />}
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

function MonthlyReportView({ orgId }) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [stats, setStats] = useState([]);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    const [y, m] = month.split('-').map(Number);
    const firstDay = `${month}-01`;
    const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);
    const [{ data: empData }, { data: attData }, { data: brData }] = await Promise.all([
      supabase.from('employees').select('id,name,nickname,color,branch_id').eq('org_id', orgId).eq('active', true).order('name'),
      supabase.from('attendance').select('emp_id,status,ot_min').eq('org_id', orgId).gte('date', firstDay).lte('date', lastDay),
      supabase.from('branches').select('*').eq('org_id', orgId),
    ]);
    const empList = empData || [];
    const attList = attData || [];
    const brList = brData || [];
    const result = empList.map((emp) => {
      const empAtt = attList.filter((a) => a.emp_id === emp.id);
      const present = empAtt.filter((a) => a.status === 'present').length;
      const late = empAtt.filter((a) => a.status === 'late').length;
      const leave = empAtt.filter((a) => a.status === 'leave').length;
      const absent = empAtt.filter((a) => a.status === 'absent').length;
      const otMin = empAtt.reduce((s, a) => s + Number(a.ot_min || 0), 0);
      const worked = present + late;
      const br = brList.find((b) => b.id === emp.branch_id);
      return { emp, br, present, late, leave, absent, otMin, worked };
    });
    setStats(result);
    setBusy(false);
  }

  useEffect(() => { load(); }, [orgId, month]);

  function exportCsv() {
    const headers = ['ชื่อ', 'ชื่อเล่น', 'สาขา', 'วันทำงาน', 'มาสาย (ครั้ง)', 'วันลา', 'วันขาด', 'OT รวม (น.)'];
    const csvRows = stats.map((s) => [
      s.emp.name, s.emp.nickname || '', s.br?.label || '',
      s.worked, s.late, s.leave, s.absent, s.otMin,
    ]);
    const csv = [headers, ...csvRows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr-attendance-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const totals = stats.reduce(
    (acc, s) => { acc.worked += s.worked; acc.late += s.late; acc.leave += s.leave; acc.absent += s.absent; acc.otMin += s.otMin; return acc; },
    { worked: 0, late: 0, leave: 0, absent: 0, otMin: 0 }
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={exportCsv} disabled={stats.length === 0} title="ส่งออก CSV">📥 CSV</button>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
      </div>

      {busy ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลด...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'วันทำงานรวม', value: totals.worked, color: 'var(--accent)', bg: 'var(--accent-soft)' },
              { label: 'ครั้งสาย', value: totals.late, color: 'var(--late-fg)', bg: 'var(--late-bg)' },
              { label: 'วันลา', value: totals.leave, color: 'var(--leave-fg)', bg: 'var(--leave-bg)' },
              { label: 'วันขาด', value: totals.absent, color: 'var(--danger-fg)', bg: 'var(--danger-bg)' },
              { label: 'OT รวม (น.)', value: totals.otMin, color: '#6941c6', bg: '#f9f5ff' },
            ].map((item) => (
              <div key={item.label} className="card" style={{ padding: '12px 10px', textAlign: 'center', background: item.bg, border: `1px solid ${item.color}22` }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: item.color, marginTop: 2, fontWeight: 600 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                  {['พนักงาน', 'สาขา', 'ทำงาน', 'สาย', 'ลา', 'ขาด', 'OT (น.)'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'พนักงาน' || h === 'สาขา' ? 'left' : 'center', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map(({ emp, br, worked, late, leave, absent, otMin }) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: emp.color || '#0E7C66', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {(emp.nickname || emp.name || '').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{emp.name}</div>
                          {emp.nickname && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{emp.nickname}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>{br?.label || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{worked}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: late > 0 ? 'var(--late-fg)' : 'var(--muted)', fontWeight: late > 0 ? 700 : 400 }}>{late || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: leave > 0 ? 'var(--leave-fg)' : 'var(--muted)', fontWeight: leave > 0 ? 700 : 400 }}>{leave || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: absent > 0 ? 'var(--danger-fg)' : 'var(--muted)', fontWeight: absent > 0 ? 700 : 400 }}>{absent || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="num" style={{ color: otMin > 0 ? '#6941c6' : 'var(--muted)', fontWeight: otMin > 0 ? 700 : 400 }}>{otMin > 0 ? otMin : '—'}</span>
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูลพนักงาน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
