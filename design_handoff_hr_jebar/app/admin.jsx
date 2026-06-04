// ─────────────────────────────────────────────────────────────
// HR JEBAR — Admin console: shell, dashboard, employees, detail
// ─────────────────────────────────────────────────────────────

function AdminShell({ children }) {
  return children;
}

// ---- DASHBOARD ---------------------------------------------------
function AdminDashboard({ go }) {
  const { state } = useStore();
  const { emps, att, leaves, rules } = state;
  const td = ymd(new Date());
  const todayRecs = att.filter((a) => a.date === td);
  const inNow = todayRecs.filter((a) => a.clockIn && !a.clockOut);
  const lateToday = todayRecs.filter((a) => a.status === 'late');
  const onLeave = todayRecs.filter((a) => a.status === 'leave');
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');

  // month payroll total
  const r = rangeFor('month');
  let total = 0;
  emps.forEach((e) => {
    const recs = att.filter((a) => a.empId === e.id && inRange(a.date, r));
    const sales = state.sales.filter((s) => s.empId === e.id && inRange(s.date, r));
    const adj = state.adjusts.filter((a) => a.empId === e.id && inRange(a.date, r));
    total += computePay(e, recs, sales, adj, rulesFor(state, e)).net;
  });

  return (
    <div>
      <PageHead title="ภาพรวม" sub={fmtDateFull(td)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <Stat label="กำลังทำงาน" value={inNow.length + '/' + emps.length} sub="เช็คอินแล้ว" icon="users" accent="var(--accent)" />
        <Stat label="มาสายวันนี้" value={lateToday.length} sub="คน" icon="alert" accent={lateToday.length ? '#B45309' : undefined} />
        <Stat label="ลาวันนี้" value={onLeave.length} sub="คน" icon="calendar" />
        <Stat label="ยอดจ่ายเดือนนี้" value={THB(total)} sub="ยอดสุทธิรวม" icon="wallet" accent="var(--accent)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card>
          <SecHead title="สถานะวันนี้" action="ดูทั้งหมด" onAction={() => go('att')} />
          <div>
            {emps.map((e) => {
              const rec = todayRecs.find((a) => a.empId === e.id);
              const st = rec ? rec.status : 'absent';
              const late = rec ? lateMinutesOf(rec, rulesFor(state, e)) : 0;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <Avatar emp={e} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{e.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{e.position}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {rec && rec.status !== 'leave' ? (
                      <div style={{ fontSize: 14 }}>{rec.clockIn || '—'} – {rec.clockOut || '...'}</div>
                    ) : <div style={{ fontSize: 14, color: 'var(--muted)' }}>—</div>}
                    {late > 0 && <div style={{ fontSize: 12, color: '#B45309' }}>สาย {late} นาที</div>}
                  </div>
                  <Badge status={st} small />
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(() => {
            const replies = state.messages.filter((m) => m.from === 'emp' && m.status === 'unread');
            if (!replies.length) return null;
            const byEmp = [...new Set(replies.map((m) => m.empId))];
            return (
              <Card onClick={() => go('msg')} style={{ border: '1px solid #DC2626', background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: '#fff', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="chat" size={22} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>พนักงานตอบกลับ {replies.length} ข้อความ</div>
                    <div style={{ fontSize: 13, opacity: 0.92 }}>จาก {byEmp.length} คน · แตะเพื่อดูและตอบ</div>
                  </div>
                  <Icon name="arrow" size={20} color="#fff" />
                </div>
              </Card>
            );
          })()}
          <Card>
            <SecHead title="คำขอลารออนุมัติ" action={pendingLeaves.length ? null : ''} />
            {pendingLeaves.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 0' }}>ไม่มีคำขอค้าง</div>}
            {pendingLeaves.map((l) => {
              const e = emps.find((x) => x.id === l.empId);
              return <PendingLeaveRow key={l.id} leave={l} emp={e} />;
            })}
          </Card>
          <Card>
            <SecHead title="ทางลัด" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <QuickAction icon="plus" label="เพิ่มพนักงาน" onClick={() => go('emps', 'add')} />
              <QuickAction icon="chat" label="ส่งข้อความ" onClick={() => go('msg')} />
              <QuickAction icon="wallet" label="คำนวณเงิน" onClick={() => go('pay')} />
              <QuickAction icon="settings" label="ตั้งค่ากฎ" onClick={() => go('set')} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function PendingLeaveRow({ leave, emp }) {
  const { setLeaveStatus } = useStore();
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar emp={emp} size={32} />
        <div style={{ flex: 1, fontSize: 14 }}><b>{emp.nickname}</b> · {leave.type}</div>
        {leave.urgent && <Badge status="rejected" text="ลาด่วน · หักแรง" small />}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{fmtDate(leave.dateFrom)}{leave.dateTo !== leave.dateFrom ? `–${fmtDate(leave.dateTo)}` : ''} · {leave.reason}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={() => setLeaveStatus(leave.id, 'approved')}>อนุมัติ</Button>
        <Button size="sm" variant="danger" onClick={() => setLeaveStatus(leave.id, 'rejected')}>ปฏิเสธ</Button>
      </div>
    </div>
  );
}
function QuickAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 14, cursor: 'pointer',
      border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: 'inherit', textAlign: 'left',
    }}>
      <Icon name={icon} size={22} color="var(--accent)" />
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
    </button>
  );
}

// ---- EMPLOYEES LIST ----------------------------------------------
function AdminEmployees({ openDetail, autoAdd, clearAuto }) {
  const { state } = useStore();
  const [add, setAdd] = React.useState(false);
  const [q, setQ] = React.useState('');
  React.useEffect(() => { if (autoAdd) { setAdd(true); clearAuto(); } }, [autoAdd]);
  const list = state.emps.filter((e) => (e.name + e.nickname + e.position + e.department).includes(q));
  return (
    <div>
      <PageHead title="พนักงาน" sub={`ทั้งหมด ${state.emps.length} คน`} action={<Button icon="plus" onClick={() => setAdd(true)}>เพิ่มพนักงาน</Button>} />
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <div style={{ position: 'absolute', left: 14, top: 13 }}><Icon name="search" size={18} color="var(--muted)" /></div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ตำแหน่ง" style={{ ...inputStyle, paddingLeft: 42 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {list.map((e) => {
          const r = rangeFor('month');
          const recs = state.att.filter((a) => a.empId === e.id && inRange(a.date, r));
          const sales = state.sales.filter((s) => s.empId === e.id && inRange(s.date, r));
          const adj = state.adjusts.filter((a) => a.empId === e.id && inRange(a.date, r));
          const p = computePay(e, recs, sales, adj, rulesFor(state, e));
          return (
            <Card key={e.id} onClick={() => openDetail(e.id)} style={{ transition: 'box-shadow .15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar emp={e} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{e.position} · {e.department}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                <span>มาทำงาน {p.daysWorked} วัน</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{THB(p.net)}</span>
              </div>
            </Card>
          );
        })}
      </div>
      {add && <AddEmployeeModal onClose={() => setAdd(false)} />}
    </div>
  );
}

// ---- ADD / EDIT EMPLOYEE -----------------------------------------
function AddEmployeeModal({ onClose, emp }) {
  const { addEmployee, updateEmployee, state } = useStore();
  const branches = state.branches || [];
  const editing = !!emp;
  const init = emp ? {
    name: emp.name, nickname: emp.nickname, position: emp.position, department: emp.department,
    phone: emp.phone, payType: emp.payType, rate: String(emp.rate), idNumber: emp.idNumber,
    bankName: emp.bankName, bankAccount: emp.bankAccount, commType: emp.commission?.type || 'none',
    commValue: String(emp.commission?.value || ''), pin: emp.pin, branchId: emp.branchId || (branches[0]?.id || ''),
    emName: emp.emName || '', emRel: emp.emRel || '', emPhone: emp.emPhone || '', notes: emp.notes || '',
    closingTasks: (emp.closingTasks || []).join('\n'),
  } : { name: '', nickname: '', position: '', department: 'หน้าร้าน', phone: '', payType: 'daily', rate: '', idNumber: '', bankName: 'กสิกรไทย', bankAccount: '', commType: 'none', commValue: '', pin: '0000', branchId: branches[0]?.id || '', emName: '', emRel: '', emPhone: '', notes: '', closingTasks: '' };
  const [f, setF] = React.useState(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const colors = ['#0E7C66', '#B45309', '#1D4ED8', '#9333EA', '#DC2626', '#0891B2'];
  const save = () => {
    if (!f.name) return;
    const data = {
      name: f.name, nickname: f.nickname || f.name.split(' ')[0], position: f.position || 'พนักงาน',
      department: f.department, phone: f.phone, payType: f.payType, rate: Number(f.rate) || 0,
      idNumber: f.idNumber, bankName: f.bankName, bankAccount: f.bankAccount,
      commission: { type: f.commType, value: Number(f.commValue) || 0 }, pin: f.pin || '0000',
      branchId: f.branchId,
      emName: f.emName, emRel: f.emRel, emPhone: f.emPhone, notes: f.notes,
      closingTasks: f.closingTasks.split('\n').map((l) => l.trim()).filter(Boolean),
    };
    if (editing) updateEmployee(emp.id, data);
    else addEmployee({ ...data, startDate: ymd(new Date()), photo: null, color: colors[Math.floor(Math.random() * colors.length)] });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={editing ? `แก้ไขข้อมูล: ${emp.name}` : 'เพิ่มพนักงานใหม่'} maxWidth={560}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="ชื่อ–สกุล"><TextInput value={f.name} onChange={set('name')} placeholder="เช่น สมหญิง รักงาน" /></Field>
        <Field label="ชื่อเล่น"><TextInput value={f.nickname} onChange={set('nickname')} /></Field>
        <Field label="ตำแหน่ง"><TextInput value={f.position} onChange={set('position')} placeholder="พนักงานขาย" /></Field>
        <Field label="แผนก">
          <select value={f.department} onChange={set('department')} style={inputStyle}>
            <option>หน้าร้าน</option><option>คลังสินค้า</option><option>จัดส่ง</option><option>สำนักงาน</option>
          </select>
        </Field>
        <Field label="สาขาที่สังกัด (ล็อกพิกัดเช็คอิน)">
          <select value={f.branchId} onChange={set('branchId')} style={inputStyle}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="เบอร์โทร"><TextInput value={f.phone} onChange={set('phone')} placeholder="08x-xxx-xxxx" /></Field>
        <Field label="เลขบัตรประชาชน"><TextInput value={f.idNumber} onChange={set('idNumber')} /></Field>
        <Field label="ประเภทค่าแรง">
          <Segmented options={[{ value: 'daily', label: 'รายวัน' }, { value: 'monthly', label: 'รายเดือน' }]} value={f.payType} onChange={(v) => setF({ ...f, payType: v })} />
        </Field>
        <Field label={f.payType === 'daily' ? 'ค่าแรง/วัน (บาท)' : 'เงินเดือน (บาท)'}><TextInput type="number" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="ธนาคาร"><TextInput value={f.bankName} onChange={set('bankName')} /></Field>
        <Field label="เลขบัญชี"><TextInput value={f.bankAccount} onChange={set('bankAccount')} /></Field>
        <Field label="คอมมิชชั่น">
          <select value={f.commType} onChange={set('commType')} style={inputStyle}>
            <option value="none">ไม่มี</option><option value="percent">% ของยอดขาย</option><option value="unit">ต่อชิ้น/ออเดอร์ (บาท)</option>
          </select>
        </Field>
        <Field label={f.commType === 'percent' ? 'อัตรา %' : f.commType === 'unit' ? 'บาท/ชิ้น' : 'ค่า'}>
          <TextInput type="number" value={f.commValue} onChange={set('commValue')} disabled={f.commType === 'none'} />
        </Field>
        <Field label="ผู้ติดต่อฉุกเฉิน"><TextInput value={f.emName} onChange={set('emName')} placeholder="ชื่อ" /></Field>
        <Field label="ความสัมพันธ์"><TextInput value={f.emRel} onChange={set('emRel')} placeholder="เช่น บิดา/ภรรยา" /></Field>
        <Field label="เบอร์ฉุกเฉิน"><TextInput value={f.emPhone} onChange={set('emPhone')} placeholder="08x-xxx-xxxx" /></Field>
        <Field label="PIN เข้าแอป (4 หลัก)"><TextInput value={f.pin} onChange={set('pin')} maxLength={4} /></Field>
      </div>
      <Field label="หมายเหตุ / อื่นๆ">
        <textarea value={f.notes} onChange={set('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="ข้อมูลเพิ่มเติม เช่น ทักษะพิเศษ ข้อจำกัด ฯลฯ" />
      </Field>
      <Field label="เช็กลิสต์ก่อนเลิกงาน (1 งานต่อบรรทัด)" hint="พนักงานต้องติ๊กครบทุกข้อก่อนจึงลงเวลาออกได้ — เว้นว่างได้ถ้าไม่มี">
        <textarea value={f.closingTasks} onChange={set('closingTasks')} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={'เช่น\nล้างของให้เรียบร้อย\nกวาด-ถูพื้นร้าน\nปิดไฟ-แอร์ก่อนออก'} />
      </Field>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Button variant="ghost" full onClick={onClose}>ยกเลิก</Button>
        <Button full onClick={save}>{editing ? 'บันทึกการแก้ไข' : 'บันทึกพนักงาน'}</Button>
      </div>
    </Modal>
  );
}

// ---- shared headings ---------------------------------------------
function PageHead({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</div>
        {sub && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
function SecHead({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>{action}</button>}
    </div>
  );
}

Object.assign(window, { AdminShell, AdminDashboard, AdminEmployees, AddEmployeeModal, PageHead, SecHead });
