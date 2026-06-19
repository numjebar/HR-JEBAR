import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { THB, rulesFor } from '../../lib/payroll';

const LOCKED_FIELDS = ['pay_type', 'rate', 'commission', 'branch_id', 'closing_tasks', 'rule_overrides', 'day_off'];
const PAY_TYPE_LABEL = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
};
const PAY_TYPE_SUFFIX = {
  daily: '/วัน',
  weekly: '/สัปดาห์',
  monthly: '/เดือน',
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

function dayOffLabel(days) {
  const active = new Set((days || []).map(Number));
  const labels = DAY_OFF_OPTIONS.filter((day) => active.has(day.value)).map((day) => day.label);
  return labels.length ? labels.join(', ') : 'ไม่มี';
}

export default function EmpProfile() {
  const { employee, employeeSessionToken, empLogout } = useAuthStore();
  const [currentEmployee, setCurrentEmployee] = useState(employee);
  const [branch, setBranch] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  async function load() {
    const { data } = await supabase.rpc('employee_profile_data_v2', { p_session_token: employeeSessionToken });
    const { data: freshEmployee } = await supabase.rpc('employee_current_session', { p_session_token: employeeSessionToken });
    const employeeData = data?.employee?.id ? data.employee : freshEmployee;
    if (employeeData?.id) {
      setCurrentEmployee(employeeData);
      useAuthStore.setState({ employee: employeeData });
    }
    setBranch(data?.branch || null);
    setSettings(data?.settings || null);
  }

  useEffect(() => { load(); }, []);

  const rules = rulesFor(settings?.rules, branch, currentEmployee);
  const displayName = currentEmployee.nickname || currentEmployee.name || 'พนักงาน';
  const hasPhoto = !!currentEmployee.photo_url;

  return (
    <div style={{ padding: '20px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>โปรไฟล์</h2>

      {/* avatar + name */}
      <div className="card" style={{ padding: '20px 16px', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: hasPhoto ? 64 : 'auto', minWidth: 64, maxWidth: hasPhoto ? 64 : 140, height: 64, padding: hasPhoto ? 0 : '0 16px', borderRadius: hasPhoto ? '50%' : 999, background: currentEmployee.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: hasPhoto ? 22 : 14, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentEmployee.photo_url ? <img src={currentEmployee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayName}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{currentEmployee.name}</div>
          {currentEmployee.nickname && <div style={{ color: 'var(--muted)', fontSize: 14 }}>"{currentEmployee.nickname}"</div>}
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{currentEmployee.position} · {currentEmployee.department}</div>
        </div>
      </div>

      {/* general info */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>ข้อมูลทั่วไป</div>
          <button className="btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '6px 14px', fontSize: 13 }} onClick={() => setShowEdit(true)}>แก้ไข</button>
        </div>
        {[
          { label: 'เบอร์โทร', value: currentEmployee.phone },
          { label: 'เลขบัตรประชาชน', value: currentEmployee.id_number },
          { label: 'รูปบัตรประชาชน', value: currentEmployee.id_card_url ? <a href={currentEmployee.id_card_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>เปิดดูรูป</a> : null },
          { label: 'ธนาคาร', value: currentEmployee.bank_name },
          { label: 'เลขบัญชี', value: currentEmployee.bank_account },
          { label: 'ผู้ติดต่อฉุกเฉิน', value: currentEmployee.em_name && `${currentEmployee.em_name} (${currentEmployee.em_rel}) ${currentEmployee.em_phone}` },
        ].filter((f) => f.value).map((f) => (
          <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <span style={{ color: 'var(--muted)' }}>{f.label}</span>
            <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* financial (locked) */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 14, background: 'var(--bg)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔒 ข้อมูลการเงิน (แอดมินเท่านั้น)
        </div>
        {[
          { label: 'สาขา', value: branch?.label },
          { label: 'วันหยุดประจำ', value: dayOffLabel(currentEmployee.day_off) },
          { label: 'ประเภทค่าจ้าง', value: PAY_TYPE_LABEL[currentEmployee.pay_type] || PAY_TYPE_LABEL.monthly },
          { label: 'อัตราค่าจ้าง', value: THB(currentEmployee.rate) + (PAY_TYPE_SUFFIX[currentEmployee.pay_type] || PAY_TYPE_SUFFIX.monthly) },
          { label: 'เวลาทำงาน', value: `${rules.workStart} – ${rules.workEnd}` },
          { label: 'ผ่อนผันสาย', value: `${rules.graceMin} นาที` },
        ].map((f) => (
          <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <span style={{ color: 'var(--muted)' }}>{f.label}</span>
            <span style={{ fontWeight: 500 }}>{f.value || '—'}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, color: 'var(--danger-fg)' }} onClick={empLogout}>
        ออกจากระบบ
      </button>

      {showEdit && <EditSheet employee={currentEmployee} employeeSessionToken={employeeSessionToken} onSaved={load} onClose={() => setShowEdit(false)} />}
    </div>
  );
}

function EditSheet({ employee, employeeSessionToken, onSaved, onClose }) {
  const [form, setForm] = useState({
    phone: employee.phone || '',
    id_number: employee.id_number || '',
    bank_name: employee.bank_name || '',
    bank_account: employee.bank_account || '',
    id_card_url: employee.id_card_url || '',
    em_name: employee.em_name || '',
    em_rel: employee.em_rel || '',
    em_phone: employee.em_phone || '',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function uploadIdCard(file) {
    if (!file) return;
    setUploading(true);
    setErr('');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `id-cards/${employee.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) {
      setErr(error.message || 'อัปโหลดรูปบัตรไม่สำเร็จ');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    setForm((p) => ({ ...p, id_card_url: data.publicUrl }));
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setErr('');
    let { data, error } = await supabase.rpc('employee_update_profile_v2', {
      p_session_token: employeeSessionToken,
      p_phone: form.phone,
      p_id_number: form.id_number,
      p_id_card_url: form.id_card_url,
      p_bank_name: form.bank_name,
      p_bank_account: form.bank_account,
      p_em_name: form.em_name,
      p_em_rel: form.em_rel,
      p_em_phone: form.em_phone,
    });

    if (error && String(error.message || '').includes('employee_update_profile_v2')) {
      const fallback = await supabase.rpc('employee_update_profile_v2', {
        p_session_token: employeeSessionToken,
        p_phone: form.phone,
        p_id_number: form.id_number,
        p_bank_name: form.bank_name,
        p_bank_account: form.bank_account,
        p_em_name: form.em_name,
        p_em_rel: form.em_rel,
        p_em_phone: form.em_phone,
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      setErr(error.message || 'บันทึกข้อมูลไม่สำเร็จ');
      setBusy(false);
      return;
    }

    if (!data?.[0]) {
      setErr('บันทึกไม่สำเร็จ: ไม่พบข้อมูลพนักงานจากระบบ');
      setBusy(false);
      return;
    }

    if (data?.[0]) {
      const { data: freshEmployee } = await supabase.rpc('employee_current_session', { p_session_token: employeeSessionToken });
      const updatedEmployee = freshEmployee?.id ? freshEmployee : data[0];
      useAuthStore.setState({ employee: updatedEmployee });
      const changed = profileChangedLines(employee, updatedEmployee);
      if (changed.length > 0) {
        await supabase.rpc('employee_send_message_v2', {
          p_session_token: employeeSessionToken,
          p_text: `แจ้งอัปเดตข้อมูลโปรไฟล์\n${changed.join('\n')}`,
        });
      }
    }
    setBusy(false);
    await onSaved?.();
    onClose();
  }

  const fields = [
    { key: 'phone', label: 'เบอร์โทร', type: 'tel' },
    { key: 'id_number', label: 'เลขบัตรประชาชน' },
    { key: 'bank_name', label: 'ชื่อธนาคาร' },
    { key: 'bank_account', label: 'เลขบัญชี' },
    { key: 'em_name', label: 'ชื่อผู้ติดต่อฉุกเฉิน' },
    { key: 'em_rel', label: 'ความสัมพันธ์' },
    { key: 'em_phone', label: 'เบอร์ผู้ติดต่อฉุกเฉิน', type: 'tel' },
  ];

  return (
    <div className="sheet-overlay">
      <div className="sheet">
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>แก้ไขข้อมูลทั่วไป</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input type={f.type || 'text'} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>รูปบัตรประชาชน</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => uploadIdCard(e.target.files?.[0])} disabled={uploading} />
            {form.id_card_url && (
              <a href={form.id_card_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                เปิดดูรูปบัตรที่อัปโหลด
              </a>
            )}
            {uploading && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>กำลังอัปโหลด...</div>}
          </div>
          {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{err}</div>}
          <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>{busy ? 'กำลังบันทึก...' : uploading ? 'กำลังอัปโหลด...' : 'บันทึก'}</button>
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}

function profileChangedLines(before, after) {
  const fields = [
    ['เบอร์โทร', 'phone'],
    ['เลขบัตรประชาชน', 'id_number'],
    ['รูปบัตรประชาชน', 'id_card_url'],
    ['ธนาคาร', 'bank_name'],
    ['เลขบัญชี', 'bank_account'],
    ['ผู้ติดต่อฉุกเฉิน', 'em_name'],
    ['ความสัมพันธ์', 'em_rel'],
    ['เบอร์ผู้ติดต่อฉุกเฉิน', 'em_phone'],
  ];

  return fields
    .filter(([, key]) => (before?.[key] || '') !== (after?.[key] || ''))
    .map(([label, key]) => `- ${label}: ${after?.[key] || '-'}`);
}
