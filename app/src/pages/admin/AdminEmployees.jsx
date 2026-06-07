import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { computePay, rulesFor, rangeFor, THB, ymd } from '../../lib/payroll';

const EMPLOYEE_APP_URL = 'https://hr-jebar.pages.dev';

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
  const [period, setPeriod] = useState('month');
  const [att, setAtt] = useState([]);
  const [adj, setAdj] = useState([]);
  const [pay, setPay] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const [showPinRecovery, setShowPinRecovery] = useState(false);

  const br = branches.find((b) => b.id === emp.branch_id);

  async function load() {
    const range = rangeFor(period);
    const [{ data: st }, { data: a }, { data: s }, { data: d }] = await Promise.all([
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
      supabase.from('attendance').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to).order('date', { ascending: false }),
      supabase.from('sales').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to),
      supabase.from('adjustments').select('*').eq('emp_id', emp.id).gte('date', range.from).lte('date', range.to).order('created_at', { ascending: false }),
    ]);
    setAtt(a || []);
    setAdj(d || []);
    const rules = rulesFor(st?.rules, br, emp);
    setPay(computePay(emp, a || [], s || [], d || [], rules));
  }

  useEffect(() => { load(); }, [period]);

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
            {emp.pay_type === 'daily' ? `รายวัน ${THB(emp.rate)}/วัน` : `รายเดือน ${THB(emp.rate)}/เดือน`}
          </div>
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
        {[{ k: 'day', l: 'วันนี้' }, { k: 'week', l: 'สัปดาห์' }, { k: 'month', l: 'เดือน' }].map((p) => (
          <button key={p.k} onClick={() => setPeriod(p.k)} className="btn" style={{ background: period === p.k ? 'var(--accent)' : 'var(--surface)', color: period === p.k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 18px', fontSize: 14 }}>{p.l}</button>
        ))}
      </div>

      {/* pay breakdown */}
      {pay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: .8 }}>เงินสุทธิ</div>
            <div className="num" style={{ fontSize: 34, fontWeight: 700, marginTop: 4 }}>{THB(pay.net)}</div>
            <div style={{ fontSize: 13, opacity: .8, marginTop: 8 }}>{pay.daysWorked} วันทำงาน · {pay.leaveDays} วันลา</div>
          </div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 14 }}>
            {[
              ['ค่าแรงฐาน', pay.base, '+'],
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
          </div>
        </div>
      )}

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

      {/* attendance */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>ประวัติการลงเวลา</div>
        {att.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <div>
              <span style={{ fontWeight: 500 }}>{a.date}</span>
              {a.clock_in && <span className="num" style={{ color: 'var(--muted)', marginLeft: 10 }}>{a.clock_in} – {a.clock_out || '—'}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {a.checkin_dist != null && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.checkin_dist}ม.</span>}
              {a.checkin_selfie_url ? (
                <a href={a.checkin_selfie_url} target="_blank" rel="noreferrer"><img src={a.checkin_selfie_url} alt="selfie" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /></a>
              ) : (
                <div title="ยังไม่มีรูปเซลฟี่ของรายการนี้" style={{ width: 28, height: 28, borderRadius: '50%', background: emp.color || 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {(emp.nickname || emp.name || 'ไม่มีรูป').slice(0, 2)}
                </div>
              )}
              <span className="badge" style={{
                background: a.status === 'present' ? 'var(--accent-soft)' : a.status === 'late' ? 'var(--late-bg)' : 'var(--danger-bg)',
                color: a.status === 'present' ? 'var(--accent)' : a.status === 'late' ? 'var(--late-fg)' : 'var(--danger-fg)',
              }}>
                {a.status === 'present' ? 'มา' : a.status === 'late' ? 'สาย' : a.status === 'leave' ? 'ลา' : 'ขาด'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showEdit && <EmpFormModal emp={emp} branches={branches} orgId={orgId} onClose={() => { setShowEdit(false); onBack(); }} />}
      {showPinRecovery && <PinRecoveryModal emp={emp} onClose={() => setShowPinRecovery(false)} />}
      {showAddAdj && <AddAdjModal emp={emp} orgId={orgId} onClose={() => { setShowAddAdj(false); load(); }} />}
      {showMsg && <SendMsgModal emp={emp} orgId={orgId} onClose={() => setShowMsg(false)} />}
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
    commission: emp?.commission || { type: 'none', value: 0 },
    color: emp?.color || COLORS[0],
    notes: emp?.notes || '',
    closing_tasks_text: isEdit ? (emp?.closing_tasks || []).join('\n') : DEFAULT_CLOSING_TASKS.join('\n'),
    day_off: emp?.day_off || [], currentPin,
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

  async function save() {
    if (!pinReady) {
      setErr('กรุณาตั้ง PIN เป็นตัวเลข 4 หลัก');
      return;
    }

    setBusy(true);
    setErr('');
    const payload = { ...form, org_id: orgId };
    payload.closing_tasks = form.closing_tasks_text
      .split('\n')
      .map((task) => task.trim())
      .filter(Boolean);
    delete payload.pin;
    delete payload.closing_tasks_text;

    try {
      if (isEdit) {
        const { error: updateError } = await supabase.from('employees').update(payload).eq('id', emp.id);
        if (updateError) throw updateError;

        if (form.pin && form.pin !== currentPin) {
          const { error: pinError } = await supabase.rpc('admin_set_employee_pin', {
            p_emp_id: emp.id,
            p_day_off: emp?.day_off || [], form.pin,
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
          p_day_off: emp?.day_off || [], form.pin,
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
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>ประเภทค่าจ้าง</label>
              <select value={form.pay_type} onChange={(e) => set('pay_type', e.target.value)}>
                <option value="daily">รายวัน</option>
                <option value="monthly">รายเดือน</option>
              </select>
            </div>
            <Field label={`อัตราค่าจ้าง (${form.pay_type === 'daily' ? 'บาท/วัน' : 'บาท/เดือน'})`} value={form.rate} onChange={(v) => set('rate', +v)} type="number" />
            <Field label="วันเริ่มงาน" value={form.start_date} onChange={(v) => set('start_date', v)} type="date" />
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
        p_day_off: emp?.day_off || [], pin,
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

function AddAdjModal({ emp, orgId, onClose }) {
  const [form, setForm] = useState({ type: 'bonus', amount: 0, note: '' });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.note.trim()) { alert('กรุณาระบุเหตุผล'); return; }
    setBusy(true);
    await supabase.from('adjustments').insert({ emp_id: emp.id, org_id: orgId, date: ymd(new Date()), ...form });
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
