// ─────────────────────────────────────────────────────────────
// HR JEBAR — Admin: employee detail, attendance, payroll, messages, settings
// ─────────────────────────────────────────────────────────────

// ---- EMPLOYEE DETAIL ---------------------------------------------
function AdminEmployeeDetail({ empId, onBack }) {
  const { state, addAdjustment, addSale, sendMessage } = useStore();
  const emp = state.emps.find((e) => e.id === empId);
  const [period, setPeriod] = React.useState('month');
  const [modal, setModal] = React.useState(null);
  if (!emp) return null;
  const r = rangeFor(period);
  const recs = state.att.filter((a) => a.empId === emp.id && inRange(a.date, r)).sort((a, b) => b.date.localeCompare(a.date));
  const sales = state.sales.filter((s) => s.empId === emp.id && inRange(s.date, r));
  const adj = state.adjusts.filter((a) => a.empId === emp.id && inRange(a.date, r));
  const p = computePay(emp, recs, sales, adj, rulesFor(state, emp));

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, fontSize: 15 }}>
        <Icon name="back" size={18} /> กลับรายชื่อ
      </button>
      <div className="emp-detail-grid">
        {/* LEFT: profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar emp={emp} size={64} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{emp.name}</div>
                <div style={{ color: 'var(--muted)' }}>{emp.position}</div>
              </div>
            </div>
            <InfoRow label="แผนก" value={emp.department} />
            <InfoRow label="สาขา" value={(state.branches || []).find((b) => b.id === emp.branchId)?.label || '—'} />
            <InfoRow label="เบอร์โทร" value={emp.phone} />
            <InfoRow label="บัตรประชาชน" value={emp.idNumber} />
            <InfoRow label="ค่าแรง" value={emp.payType === 'daily' ? THB(emp.rate) + '/วัน' : THB(emp.rate) + '/เดือน'} />
            <InfoRow label="คอมมิชชั่น" value={emp.commission?.type === 'percent' ? emp.commission.value + '% ยอดขาย' : emp.commission?.type === 'unit' ? THB(emp.commission.value) + '/ชิ้น' : 'ไม่มี'} />
            <InfoRow label="ธนาคาร" value={`${emp.bankName} ${emp.bankAccount}`} />
            <InfoRow label="ติดต่อฉุกเฉิน" value={emp.emName ? `${emp.emName} (${emp.emRel})` : '—'} />
            <InfoRow label="เบอร์ฉุกเฉิน" value={emp.emPhone || '—'} />
            <InfoRow label="หมายเหตุ" value={emp.notes || '—'} last />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button size="sm" variant="ghost" icon="edit" onClick={() => setModal('edit')}>แก้ไขข้อมูล</Button>
              <Button size="sm" variant="soft" icon="chat" full onClick={() => setModal('msg')}>ส่งข้อความ</Button>
            </div>
            <Button size="sm" variant="ghost" icon="settings" full onClick={() => setModal('rules')} style={{ marginTop: 8 }}>
              ตั้งกฎ/เงินเฉพาะคนนี้{emp.ruleOverrides && Object.keys(emp.ruleOverrides).length > 0 ? ` (${Object.keys(emp.ruleOverrides).length} รายการ)` : ''}
            </Button>
          </Card>
          <Card>
            <SecHead title="เอกสาร & รูป" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <DocThumb emp={emp} field="photo" label="รูปโปรไฟล์" icon="user" />
              <DocThumb emp={emp} field="bankQR" label="QR บัญชี" icon="qr" />
              <DocThumb emp={emp} field="idCardImg" label="บัตรประชาชน" icon="card" />
            </div>
          </Card>
        </div>

        {/* RIGHT: pay + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Segmented options={[{ value: 'day', label: 'วันนี้' }, { value: 'week', label: 'สัปดาห์' }, { value: 'month', label: 'เดือนนี้' }]} value={period} onChange={setPeriod} style={{ flex: '1 1 240px', maxWidth: 320 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setModal('sale')}>ยอดขาย/คอม</Button>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setModal('adj')}>หัก/โบนัส</Button>
            </div>
          </div>

          <PayBreakdown emp={emp} p={p} />

          <MoneyItems emp={emp} sales={sales} adj={adj} />

          <Card>
            <SecHead title="การลงเวลา" />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {recs.map((a) => {
                const late = lateMinutesOf(a, rulesFor(state, emp));
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    {a.checkin?.selfie ? <img src={a.checkin.selfie} style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', transform: 'scaleX(-1)' }} /> : <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user" size={16} color="var(--muted)" /></div>}
                    <div style={{ width: 90, fontSize: 14, fontWeight: 600 }}>{fmtDate(a.date)}</div>
                    <div style={{ flex: 1, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                      {a.status === 'leave' ? a.leaveType : `${a.clockIn || '—'} – ${a.clockOut || '—'}`}
                      {a.checkin?.dist != null && <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>📍{a.checkin.dist}ม.</span>}
                      {a.closingDone && a.closingDone.length > 0 && <span style={{ color: 'var(--accent)', fontSize: 12, marginLeft: 8 }}>✓ปิดร้าน {a.closingDone.length} ข้อ</span>}
                    </div>
                    {late > 0 && <span style={{ fontSize: 12, color: '#B45309' }}>สาย {late}น.</span>}
                    {a.otMin > 0 && <span style={{ fontSize: 12, color: 'var(--accent)' }}>OT {a.otMin}น.</span>}
                    <Badge status={a.status} small />
                  </div>
                );
              })}
              {recs.length === 0 && <Empty text="ไม่มีข้อมูลในช่วงนี้" />}
            </div>
          </Card>
        </div>
      </div>

      {modal === 'msg' && <AdminConversationModal emp={emp} onClose={() => setModal(null)} />}
      {modal === 'edit' && <AddEmployeeModal emp={emp} onClose={() => setModal(null)} />}
      {modal === 'rules' && <EmpRulesModal emp={emp} onClose={() => setModal(null)} />}
      {modal === 'sale' && <AddSaleModal emp={emp} onClose={() => setModal(null)} onSave={(s) => { addSale({ empId: emp.id, ...s }); setModal(null); }} />}
      {modal === 'adj' && <AddAdjModal emp={emp} onClose={() => setModal(null)} onSave={(a) => { addAdjustment({ empId: emp.id, ...a }); setModal(null); }} />}
    </div>
  );
}
function DocThumb({ emp, field, label, icon }) {
  const { updateEmployee } = useStore();
  const upload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader(); rd.onload = () => updateEmployee(emp.id, { [field]: rd.result }); rd.readAsDataURL(file);
  };
  return (
    <label style={{ cursor: 'pointer' }}>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
      <div style={{ aspectRatio: '1.4', borderRadius: 12, border: '1.5px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: emp[field] ? `center/cover url(${emp[field]})` : 'var(--bg)', overflow: 'hidden' }}>
        {!emp[field] && <><Icon name={icon} size={22} color="var(--muted)" /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span></>}
      </div>
    </label>
  );
}
function PayBreakdown({ emp, p }) {
  const rows = [
    { label: emp.payType === 'daily' ? `ค่าแรง ${p.daysWorked} วัน` : 'เงินเดือน', value: p.base, plus: true },
    p.otPay > 0 && { label: `OT ${(p.otMin / 60).toFixed(1)} ชม.`, value: p.otPay, plus: true },
    p.commission > 0 && { label: 'คอมมิชชั่น', value: p.commission, plus: true },
    p.bonus > 0 && { label: 'โบนัส', value: p.bonus, plus: true },
    p.lateDeduct > 0 && { label: p.lateBigDays + p.lateMidUnits > 0 ? `หักมาสาย ${p.lateBigDays + p.lateMidUnits} ชม.` : `หักมาสาย ${p.lateMinTotal} นาที`, value: -p.lateDeduct },
    p.damage > 0 && { label: 'หักของเสียหาย', value: -p.damage },
    p.advance > 0 && { label: 'หักเบิกล่วงหน้า', value: -p.advance },
    { label: 'ประกันสังคม', value: -p.ss },
  ].filter(Boolean);
  return (
    <Card style={{ background: 'linear-gradient(135deg,#0E7C66,#0B5D4D)', color: '#fff', border: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>ยอดจ่ายสุทธิ</div>
          <div style={{ fontSize: 38, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{THB(p.net)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div>รับรวม {THB(p.gross)}</div>
          <div>หักรวม {THB(p.deductTotal)}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '4px 14px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none', fontSize: 14 }}>
            <span style={{ opacity: 0.92 }}>{row.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.value < 0 ? '#FCA5A5' : '#fff' }}>{row.value < 0 ? '−' : '+'}{THB(Math.abs(row.value))}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---- money line items (add/deduct with reason) -------------------
const ADJ_META = {
  bonus: { label: 'โบนัส / เพิ่มพิเศษ', sign: 1, color: 'var(--accent)' },
  damage: { label: 'หักของเสียหาย', sign: -1, color: '#DC2626' },
  advance: { label: 'หักเบิกล่วงหน้า', sign: -1, color: '#DC2626' },
  other: { label: 'หักอื่นๆ', sign: -1, color: '#DC2626' },
};
function MoneyItems({ emp, sales, adj }) {
  const { deleteAdjustment, deleteSale } = useStore();
  const hasAny = sales.length || adj.length;
  return (
    <Card>
      <SecHead title="รายการเงินเพิ่ม / หัก (รอบนี้)" />
      {!hasAny && <Empty text="ยังไม่มีรายการในช่วงนี้ — กดปุ่ม “ยอดขาย/คอม” หรือ “หัก/โบนัส” ด้านบนเพื่อเพิ่ม" />}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {adj.map((a) => {
          const m = ADJ_META[a.type] || ADJ_META.other;
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: m.sign > 0 ? 'var(--accent-soft)' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={m.sign > 0 ? 'plus' : 'money'} size={17} color={m.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}{a.auto && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>(อัตโนมัติ)</span>}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', wordBreak: 'break-word' }}>{fmtDate(a.date)} · {a.note || '—'}</div>
              </div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: m.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{m.sign > 0 ? '+' : '−'}{THB(a.amount)}</div>
              <button onClick={() => deleteAdjustment(a.id)} title="ลบรายการ" style={{ border: 'none', background: 'var(--bg)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="x" size={15} color="var(--muted)" />
              </button>
            </div>
          );
        })}
        {sales.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="trend" size={17} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>ยอดขาย / คอมมิชชั่น</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', wordBreak: 'break-word' }}>{fmtDate(s.date)} · {s.note || '—'}{s.units ? ` · ${s.units} ชิ้น` : s.amount ? ` · ยอด ${THB(s.amount)}` : ''}</div>
            </div>
            <button onClick={() => deleteSale(s.id)} title="ลบรายการ" style={{ border: 'none', background: 'var(--bg)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="x" size={15} color="var(--muted)" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---- per-employee rule overrides ---------------------------------
const RULE_SECTIONS = [
  { id: 'work', title: 'เวลาทำงาน', keys: ['workStart', 'workEnd', 'graceMin'] },
  { id: 'late', title: 'หักมาสาย', keys: ['lateMode', 'lateBigMin', 'lateMinorMin', 'lateMinorCount', 'lateDeductHours', 'lateDeductPerMin'] },
  { id: 'ot', title: 'ล่วงเวลา (OT)', keys: ['otMode', 'otMultiplier', 'otRatePerHour'] },
  { id: 'ss', title: 'ประกันสังคม', keys: ['ssMode', 'ssPercent', 'ssMax', 'ssAmount'] },
  { id: 'leave', title: 'ลาด่วน', keys: ['urgentLeaveDeductDays'] },
];
function EmpRulesModal({ emp, onClose }) {
  const { state, setEmployeeRules } = useStore();
  const branch = branchOf(state, emp);
  const base = { ...DEFAULT_RULES, ...(state.rules || {}), ...(branch?.rules || {}) };
  const [draft, setDraft] = React.useState({ ...(emp.ruleOverrides || {}) });
  const isOn = (sec) => sec.keys.some((k) => k in draft);
  const toggle = (sec, on) => {
    const d = { ...draft };
    if (on) sec.keys.forEach((k) => { d[k] = base[k]; });
    else sec.keys.forEach((k) => { delete d[k]; });
    setDraft(d);
  };
  const setK = (k, v) => setDraft({ ...draft, [k]: v });
  const eff = { ...base, ...draft };

  return (
    <Modal open onClose={onClose} title={`กฎเฉพาะบุคคล — ${emp.name}`} maxWidth={560}>
      <div style={{ background: 'var(--accent-soft)', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        เปิดสวิตช์หัวข้อใดเพื่อ <b>กำหนดเฉพาะคนนี้</b> — ถ้าปิดไว้จะ <b>ใช้ค่าของสาขา {branch?.label || ''}</b> อัตโนมัติ
      </div>

      {RULE_SECTIONS.map((sec) => {
        const on = isOn(sec);
        return (
          <div key={sec.id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div onClick={() => toggle(sec, !on)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 44, height: 26, borderRadius: 26, background: on ? 'var(--accent)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{sec.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{on ? 'กำหนดเฉพาะคนนี้' : `ใช้ค่าสาขา (${sec.id === 'ss' ? (eff.ssMode === 'fixed' ? THB(eff.ssAmount) : eff.ssPercent + '%') : sec.id === 'ot' ? (eff.otMode === 'fixed' ? THB(eff.otRatePerHour) + '/ชม.' : eff.otMultiplier + 'x') : sec.id === 'work' ? eff.workStart + '–' + eff.workEnd : sec.id === 'leave' ? 'หัก ' + eff.urgentLeaveDeductDays + ' แรง' : (eff.lateMode === 'tiered' ? 'ขั้นบันได' : 'ตามนาที')})`}</div>
              </div>
            </div>

            {on && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                {sec.id === 'work' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
                    <Field label="เข้างาน"><TextInput type="time" value={eff.workStart} onChange={(e) => setK('workStart', e.target.value)} /></Field>
                    <Field label="ออกงาน"><TextInput type="time" value={eff.workEnd} onChange={(e) => setK('workEnd', e.target.value)} /></Field>
                    <Field label="ผ่อนผัน (น.)"><TextInput type="number" value={eff.graceMin} onChange={(e) => setK('graceMin', Number(e.target.value))} /></Field>
                  </div>
                )}
                {sec.id === 'late' && (
                  <>
                    <Field label="วิธีคิด"><Segmented options={[{ value: 'tiered', label: 'ขั้นบันได' }, { value: 'permin', label: 'ตามนาที' }]} value={eff.lateMode} onChange={(v) => setK('lateMode', v)} /></Field>
                    {eff.lateMode === 'tiered' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                        <Field label="สายเกิน...น. (หักทันที)"><TextInput type="number" value={eff.lateBigMin} onChange={(e) => setK('lateBigMin', Number(e.target.value))} /></Field>
                        <Field label="หัก (ชม.)"><TextInput type="number" step="0.5" value={eff.lateDeductHours} onChange={(e) => setK('lateDeductHours', Number(e.target.value))} /></Field>
                        <Field label="สายเกิน...น. (สะสม)"><TextInput type="number" value={eff.lateMinorMin} onChange={(e) => setK('lateMinorMin', Number(e.target.value))} /></Field>
                        <Field label="ครบ...ครั้ง"><TextInput type="number" value={eff.lateMinorCount} onChange={(e) => setK('lateMinorCount', Number(e.target.value))} /></Field>
                      </div>
                    ) : (
                      <Field label="หักมาสาย (บาท/นาที)"><TextInput type="number" value={eff.lateDeductPerMin} onChange={(e) => setK('lateDeductPerMin', Number(e.target.value))} /></Field>
                    )}
                  </>
                )}
                {sec.id === 'ot' && (
                  <>
                    <Field label="วิธีคิด OT"><Segmented options={[{ value: 'multiplier', label: 'เท่าของค่าแรง' }, { value: 'fixed', label: 'ยอดเงิน/ชม.' }]} value={eff.otMode} onChange={(v) => setK('otMode', v)} /></Field>
                    {eff.otMode === 'fixed'
                      ? <Field label="ค่า OT (บาท/ชั่วโมง)"><TextInput type="number" value={eff.otRatePerHour} onChange={(e) => setK('otRatePerHour', Number(e.target.value))} /></Field>
                      : <Field label="อัตรา OT (เท่า)"><TextInput type="number" step="0.05" value={eff.otMultiplier} onChange={(e) => setK('otMultiplier', Number(e.target.value))} /></Field>}
                  </>
                )}
                {sec.id === 'ss' && (
                  <>
                    <Field label="วิธีคิด"><Segmented options={[{ value: 'percent', label: '% มีเพดาน' }, { value: 'fixed', label: 'ยอดเงินคงที่' }]} value={eff.ssMode} onChange={(v) => setK('ssMode', v)} /></Field>
                    {eff.ssMode === 'fixed'
                      ? <Field label="ยอดประกันสังคม (บาท/รอบ)"><TextInput type="number" value={eff.ssAmount} onChange={(e) => setK('ssAmount', Number(e.target.value))} /></Field>
                      : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                          <Field label="ประกันสังคม (%)"><TextInput type="number" value={eff.ssPercent} onChange={(e) => setK('ssPercent', Number(e.target.value))} /></Field>
                          <Field label="เพดาน (บาท)"><TextInput type="number" value={eff.ssMax} onChange={(e) => setK('ssMax', Number(e.target.value))} /></Field>
                        </div>
                      )}
                  </>
                )}
                {sec.id === 'leave' && (
                  <Field label="ลาด่วนเช้าไม่มีเหตุผล → หัก (แรง)"><TextInput type="number" value={eff.urgentLeaveDeductDays} onChange={(e) => setK('urgentLeaveDeductDays', Number(e.target.value))} /></Field>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Button variant="ghost" full onClick={() => { setEmployeeRules(emp.id, {}); onClose(); }}>ล้างทั้งหมด (ใช้กฎสาขา)</Button>
        <Button full onClick={() => { setEmployeeRules(emp.id, draft); onClose(); }}>บันทึกกฎเฉพาะคนนี้</Button>
      </div>
    </Modal>
  );
}

// ---- send message modal ------------------------------------------
function SendMessageModal({ emp, onClose, onSend }) {
  const [kind, setKind] = React.useState('message');
  const [text, setText] = React.useState('');
  const [due, setDue] = React.useState('');
  return (
    <Modal open onClose={onClose} title={`ส่งถึง ${emp.name}`}>
      <Field label="ประเภท">
        <Segmented options={[{ value: 'message', label: 'ข้อความ' }, { value: 'task', label: 'มอบหมายงาน' }]} value={kind} onChange={setKind} />
      </Field>
      <Field label={kind === 'task' ? 'รายละเอียดงาน' : 'ข้อความ'}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={kind === 'task' ? 'เช่น เช็คสต็อกคลัง A ให้เสร็จวันนี้' : 'พิมพ์ข้อความ...'} />
      </Field>
      {kind === 'task' && <Field label="กำหนดเสร็จ (ถ้ามี)"><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>}
      <Button full size="lg" icon="arrow" onClick={() => text && onSend(kind, text, due)}>ส่ง</Button>
    </Modal>
  );
}
function AddSaleModal({ emp, onClose, onSave }) {
  const isUnit = emp.commission?.type === 'unit';
  const [amount, setAmount] = React.useState('');
  const [units, setUnits] = React.useState('');
  const [note, setNote] = React.useState('');
  return (
    <Modal open onClose={onClose} title="บันทึกยอดขาย / คอมมิชชั่น">
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, background: 'var(--bg)', padding: 10, borderRadius: 10 }}>
        {emp.commission?.type === 'percent' ? `คอม ${emp.commission.value}% ของยอดขาย` : isUnit ? `คอม ${THB(emp.commission.value)} ต่อชิ้น/ออเดอร์` : 'พนักงานคนนี้ไม่มีคอมมิชชั่น'}
      </div>
      {isUnit
        ? <Field label="จำนวนชิ้น/ออเดอร์"><TextInput type="number" value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
        : <Field label="ยอดขาย (บาท)"><TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
      <Field label="หมายเหตุ"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button full size="lg" onClick={() => onSave({ amount: Number(amount) || 0, units: Number(units) || 0, note: note || 'ยอดขาย' })}>บันทึก</Button>
    </Modal>
  );
}
function AddAdjModal({ emp, onClose, onSave }) {
  const [type, setType] = React.useState('damage');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  return (
    <Modal open onClose={onClose} title="เพิ่มรายการหัก / โบนัส">
      <Field label="ประเภท">
        <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
          <option value="damage">หัก: ของเสียหาย</option>
          <option value="advance">หัก: เบิกเงินล่วงหน้า</option>
          <option value="other">หัก: อื่นๆ</option>
          <option value="bonus">เพิ่ม: โบนัส</option>
        </select>
      </Field>
      <Field label="จำนวนเงิน (บาท)"><TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="สาเหตุ / เหตุผล" hint="ระบุให้ชัดเจน — จะแสดงในรายการเงินและสลิปของพนักงาน">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'bonus' ? 'เช่น โบนัสยอดขายดีเด่น' : 'เช่น ทำแก้วแตก 1 ลัง'} />
      </Field>
      <Button full size="lg" disabled={!Number(amount)} onClick={() => Number(amount) && onSave({ type, amount: Number(amount), note: note || '-' })}>บันทึกรายการ</Button>
    </Modal>
  );
}

// ---- ATTENDANCE --------------------------------------------------
function AdminAttendance() {
  const { state } = useStore();
  const [day, setDay] = React.useState(ymd(new Date()));
  const recs = state.emps.map((e) => ({ emp: e, rec: state.att.find((a) => a.empId === e.id && a.date === day) }));
  return (
    <div>
      <PageHead title="การลงเวลา" sub="ดูสถานะการเข้า-ออกงานรายวัน" action={<TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 180 }} />} />
      <Card pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: 13 }}>
              <th style={th}>พนักงาน</th><th style={th}>เข้างาน</th><th style={th}>ออกงาน</th><th style={th}>สาย</th><th style={th}>OT</th><th style={th}>ตำแหน่ง</th><th style={th}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {recs.map(({ emp, rec }) => {
              const late = rec ? lateMinutesOf(rec, rulesFor(state, emp)) : 0;
              return (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar emp={emp} size={34} /><div><div style={{ fontWeight: 600 }}>{emp.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{emp.position}</div></div></div></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{rec?.clockIn || '—'}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{rec?.clockOut || '—'}</td>
                  <td style={td}>{late > 0 ? <span style={{ color: '#B45309', fontWeight: 600 }}>{late} น.</span> : '—'}</td>
                  <td style={td}>{rec?.otMin ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{rec.otMin} น.</span> : '—'}</td>
                  <td style={td}>{rec?.checkin?.dist != null ? <span style={{ fontSize: 13 }}>📍 ในพื้นที่ {rec.checkin.dist}ม.</span> : '—'}</td>
                  <td style={td}><Badge status={rec ? rec.status : 'absent'} small /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
const th = { padding: '14px 18px', fontWeight: 600 };
const td = { padding: '12px 18px', fontSize: 14 };

// ---- PAYROLL -----------------------------------------------------
function AdminPayroll() {
  const { state } = useStore();
  const [period, setPeriod] = React.useState('month');
  const [bf, setBf] = React.useState('all');
  const branches = state.branches || [];
  const r = rangeFor(period);
  const emps = bf === 'all' ? state.emps : state.emps.filter((e) => e.branchId === bf);
  const rows = emps.map((e) => {
    const recs = state.att.filter((a) => a.empId === e.id && inRange(a.date, r));
    const sales = state.sales.filter((s) => s.empId === e.id && inRange(s.date, r));
    const adj = state.adjusts.filter((a) => a.empId === e.id && inRange(a.date, r));
    return { emp: e, p: computePay(e, recs, sales, adj, rulesFor(state, e)) };
  });
  const total = rows.reduce((s, x) => s + x.p.net, 0);
  const grossTotal = rows.reduce((s, x) => s + x.p.gross, 0);
  const dedTotal = rows.reduce((s, x) => s + x.p.deductTotal, 0);
  const periodLabel = period === 'day' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : `${THAI_MONTHS[new Date().getMonth()]} ${new Date().getFullYear() + 543}`;
  const branchName = (id) => branches.find((b) => b.id === id)?.label || '—';
  return (
    <div>
      <PageHead title="คำนวณเงิน" sub={`รอบจ่าย: ${periodLabel}`} action={<Segmented options={[{ value: 'day', label: 'รายวัน' }, { value: 'week', label: 'รายสัปดาห์' }, { value: 'month', label: 'รายเดือน' }]} value={period} onChange={setPeriod} style={{ width: 340 }} />} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Chip label="ทุกสาขา" active={bf === 'all'} onClick={() => setBf('all')} />
        {branches.map((b) => <Chip key={b.id} label={b.label} active={bf === b.id} onClick={() => setBf(b.id)} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
        <Stat label="รายรับรวม" value={THB(grossTotal)} icon="trend" />
        <Stat label="หักรวม" value={THB(dedTotal)} icon="alert" accent="#DC2626" />
        <Stat label="ยอดจ่ายสุทธิรวม" value={THB(total)} icon="money" accent="var(--accent)" />
      </div>
      <Card pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: 13 }}>
              <th style={th}>พนักงาน</th><th style={th}>สาขา</th><th style={thR}>วันทำงาน</th><th style={thR}>ค่าแรง</th><th style={thR}>OT</th><th style={thR}>คอม+โบนัส</th><th style={thR}>หัก</th><th style={thR}>ปกส.</th><th style={thR}>สุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ emp, p }) => (
              <tr key={emp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar emp={emp} size={32} /><span style={{ fontWeight: 600 }}>{emp.name}</span></div></td>
                <td style={{ ...td, color: 'var(--muted)', fontSize: 13 }}>{branchName(emp.branchId)}</td>
                <td style={tdR}>{p.daysWorked}</td>
                <td style={tdR}>{THB(p.base)}</td>
                <td style={tdR}>{p.otPay ? THB(p.otPay) : '—'}</td>
                <td style={tdR}>{(p.commission + p.bonus) ? THB(p.commission + p.bonus) : '—'}</td>
                <td style={{ ...tdR, color: '#DC2626' }}>{(p.lateDeduct + p.damage + p.advance + p.otherDeduct) ? THB(p.lateDeduct + p.damage + p.advance + p.otherDeduct) : '—'}</td>
                <td style={tdR}>{THB(p.ss)}</td>
                <td style={{ ...tdR, fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{THB(p.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg)' }}>
              <td style={{ ...td, fontWeight: 700 }} colSpan={8}>ยอดจ่ายสุทธิรวม{bf !== 'all' ? ` (${branchName(bf)})` : 'ทั้งหมด'}</td>
              <td style={{ ...tdR, fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{THB(total)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>* แต่ละสาขาใช้กฎ/เงื่อนไขจ่ายเงินของตัวเอง — ตั้งค่าได้ที่ “ตั้งค่ากฎ → กฎ & เงื่อนไขจ่ายเงินรายสาขา”</div>
    </div>
  );
}
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
      border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'),
      background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)',
    }}>{label}</button>
  );
}
const thR = { ...th, textAlign: 'right' };
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

// ---- MESSAGES (admin) --------------------------------------------
function AdminConversationModal({ emp, onClose }) {
  const { state, sendMessage, markEmpRead } = useStore();
  const { setMessageStatus } = useStore();
  const thread = state.messages.filter((m) => m.empId === emp.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [kind, setKind] = React.useState('message');
  const [text, setText] = React.useState('');
  const [due, setDue] = React.useState('');
  const listRef = React.useRef(null);
  React.useEffect(() => { markEmpRead(emp.id); }, []);
  React.useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [thread.length]);
  const send = () => { const v = text.trim(); if (!v) return; sendMessage(emp.id, kind, v, kind === 'task' ? due : null, 'admin'); setText(''); setDue(''); setKind('message'); };
  return (
    <Modal open onClose={onClose} title={`แชทกับ ${emp.name}`} maxWidth={520}>
      <div ref={listRef} style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 2px 8px' }}>
        {thread.length === 0 && <Empty text="ยังไม่มีข้อความ" />}
        {thread.map((m) => {
          const mine = m.from === 'admin';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: 16, background: mine ? 'var(--accent)' : 'var(--bg)', color: mine ? '#fff' : 'var(--ink)', fontSize: 14.5, lineHeight: 1.45 }}>
                {m.kind === 'task' && <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: 4 }}>📋 งานที่มอบหมาย{m.due ? ` · ภายใน ${fmtDate(m.due)}` : ''}</div>}
                {m.text}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 4px 0', display: 'flex', gap: 6 }}>
                <span>{mine ? 'คุณ' : emp.nickname} · {m.createdAt.split(' ')[1]}</span>
                {mine && <ReadReceipt m={m} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <Segmented options={[{ value: 'message', label: 'ข้อความ' }, { value: 'task', label: 'มอบหมายงาน' }]} value={kind} onChange={setKind} style={{ flex: 1 }} />
          {kind === 'task' && <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 150 }} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={kind === 'task' ? 'รายละเอียดงาน…' : 'พิมพ์ข้อความ…'} style={{ ...inputStyle, borderRadius: 999 }} />
          <Button icon="arrow" onClick={send}>ส่ง</Button>
        </div>
      </div>
    </Modal>
  );
}
function ReadReceipt({ m }) {
  let glyph, label, color;
  if (m.status === 'done') { glyph = '✓✓'; label = 'ทำงานเสร็จแล้ว'; color = 'var(--accent)'; }
  else if (m.status === 'read') { glyph = '✓✓'; label = 'อ่านแล้ว · ' + (m.readAt ? m.readAt.split(' ')[1] : ''); color = 'var(--accent)'; }
  else { glyph = '✓'; label = 'ส่งแล้ว'; color = 'var(--muted)'; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color }}>
      <span style={{ fontSize: 14, letterSpacing: '-2px' }}>{glyph}</span>{label}
    </span>
  );
}
function AdminMessages() {
  const { state, sendMessage } = useStore();
  const [target, setTarget] = React.useState(null);
  const sorted = [...state.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <PageHead title="ข้อความ & สั่งงาน" sub="ส่งถึงพนักงานรายบุคคล" action={<Button icon="plus" onClick={() => setTarget('pick')}>ส่งใหม่</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 22 }}>
        {state.emps.map((e) => {
          const nUnread = state.messages.filter((m) => m.empId === e.id && m.from === 'emp' && m.status === 'unread').length;
          return (
            <button key={e.id} onClick={() => setTarget(e.id)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, borderRadius: 14, border: '1px solid ' + (nUnread ? 'var(--accent)' : 'var(--line)'), background: nUnread ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {nUnread > 0 && <span style={{ position: 'absolute', top: 10, right: 10, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 20, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{nUnread}</span>}
              <Avatar emp={e} size={48} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{e.nickname}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{nUnread > 0 ? '↩ ตอบกลับใหม่' : '+ ส่งข้อความ'}</span>
            </button>
          );
        })}
      </div>
      <SecHead title="ประวัติการส่ง" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {sorted.map((m) => {
          const e = state.emps.find((x) => x.id === m.empId);
          if (!e) return null;
          return (
            <Card key={m.id} pad={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar emp={e} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{e.name}</span>
                  {m.from === 'emp'
                    ? <Badge status="read" text="↩ พนักงานตอบ" small />
                    : <Badge status={m.kind === 'task' ? 'unread' : 'read'} text={m.kind === 'task' ? 'งาน' : 'ข้อความ'} small />}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{m.text}</div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.createdAt}</div>
                {m.from === 'admin' && <ReadReceipt m={m} />}
              </div>
            </Card>
          );
        })}
      </div>
      {target === 'pick' && (
        <Modal open onClose={() => setTarget(null)} title="เลือกผู้รับ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.emps.map((e) => (
              <button key={e.id} onClick={() => setTarget(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <Avatar emp={e} size={40} /><div><div style={{ fontWeight: 600 }}>{e.name}</div><div style={{ fontSize: 13, color: 'var(--muted)' }}>{e.position}</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {target && target !== 'pick' && (
        <AdminConversationModal emp={state.emps.find((e) => e.id === target)} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}

// ---- SETTINGS ----------------------------------------------------
function AdminSettings() {
  const { state, updateRules, updateBranchRules, reset, startFresh } = useStore();
  const branches = state.branches || [];
  const [bid, setBid] = React.useState(branches[0]?.id || '');
  const branch = branches.find((b) => b.id === bid) || branches[0];
  const r = { ...DEFAULT_RULES, ...(branch?.rules || {}) };
  const num = (k) => (e) => updateBranchRules(bid, { [k]: Number(e.target.value) });
  const txt = (k) => (e) => updateBranchRules(bid, { [k]: e.target.value });
  const setR = (patch) => updateBranchRules(bid, patch);
  return (
    <div>
      <PageHead title="ตั้งค่ากฎ" sub="แต่ละสาขาตั้งกฎ & เงื่อนไขจ่ายเงินของตัวเองได้" />

      {/* branch selector */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>กำลังตั้งกฎของ:</span>
        {branches.map((b) => <Chip key={b.id} label={b.label} active={b.id === bid} onClick={() => setBid(b.id)} />)}
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>{state.emps.filter((e) => e.branchId === bid).length} พนักงานในสาขานี้</span>
      </div>

      <div style={{ background: 'var(--accent-soft)', borderRadius: 14, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <Icon name="pin" size={18} color="var(--accent)" />
        <span>กฎด้านล่างนี้ใช้กับ <b>{branch?.label}</b> เท่านั้น — เปลี่ยนสาขาด้านบนเพื่อตั้งค่าสาขาอื่น</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SecHead title="เวลาทำงาน" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <Field label="เข้างาน"><TextInput type="time" value={r.workStart} onChange={txt('workStart')} /></Field>
            <Field label="ออกงาน"><TextInput type="time" value={r.workEnd} onChange={txt('workEnd')} /></Field>
            <Field label="ผ่อนผันสาย (นาที)" hint="มาสายไม่เกินนี้ถือว่าไม่สาย"><TextInput type="number" value={r.graceMin} onChange={num('graceMin')} /></Field>
          </div>
        </Card>
        <Card>
          <SecHead title="กฎหักเงินมาสาย" />
          <Field label="วิธีคิด">
            <Segmented options={[{ value: 'tiered', label: 'ขั้นบันได' }, { value: 'permin', label: 'ตามนาที' }]} value={r.lateMode} onChange={(v) => setR({ lateMode: v })} />
          </Field>
          {r.lateMode === 'tiered' ? (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                • สายเกิน <b style={{ color: 'var(--ink)' }}>{r.lateBigMin}</b> นาที → หัก <b style={{ color: 'var(--ink)' }}>{r.lateDeductHours}</b> ชม. ทันที<br />
                • สายเกิน <b style={{ color: 'var(--ink)' }}>{r.lateMinorMin}</b> นาที ครบ <b style={{ color: 'var(--ink)' }}>{r.lateMinorCount}</b> ครั้ง → หัก <b style={{ color: 'var(--ink)' }}>{r.lateDeductHours}</b> ชม.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="สายเกิน...นาที (หักทันที)"><TextInput type="number" value={r.lateBigMin} onChange={num('lateBigMin')} /></Field>
                <Field label="หัก (ชั่วโมง)"><TextInput type="number" step="0.5" value={r.lateDeductHours} onChange={num('lateDeductHours')} /></Field>
                <Field label="สายเกิน...นาที (นับสะสม)"><TextInput type="number" value={r.lateMinorMin} onChange={num('lateMinorMin')} /></Field>
                <Field label="สะสมครบ...ครั้ง"><TextInput type="number" value={r.lateMinorCount} onChange={num('lateMinorCount')} /></Field>
              </div>
            </>
          ) : (
            <Field label="หักมาสาย (บาท/นาที)" hint="คิดตามจำนวนนาทีที่สายหลังผ่อนผัน"><TextInput type="number" value={r.lateDeductPerMin} onChange={num('lateDeductPerMin')} /></Field>
          )}
        </Card>
        <Card>
          <SecHead title="ล่วงเวลา (OT)" />
          <Field label="วิธีคิด OT">
            <Segmented options={[{ value: 'multiplier', label: 'เท่าของค่าแรง' }, { value: 'fixed', label: 'ยอดเงิน (บาท/ชม.)' }]} value={r.otMode} onChange={(v) => setR({ otMode: v })} />
          </Field>
          {r.otMode === 'fixed'
            ? <Field label="ค่า OT (บาท/ชั่วโมง)" hint="จ่ายตามจำนวนชั่วโมง OT จริง"><TextInput type="number" value={r.otRatePerHour} onChange={num('otRatePerHour')} /></Field>
            : <Field label="อัตรา OT (เท่า)" hint="ของค่าแรงรายชั่วโมง"><TextInput type="number" step="0.05" value={r.otMultiplier} onChange={num('otMultiplier')} /></Field>}
        </Card>
        <Card>
          <SecHead title="ประกันสังคม" />
          <Field label="วิธีคิด">
            <Segmented options={[{ value: 'percent', label: '% มีเพดาน' }, { value: 'fixed', label: 'ยอดเงินคงที่' }]} value={r.ssMode} onChange={(v) => setR({ ssMode: v })} />
          </Field>
          {r.ssMode === 'fixed'
            ? <Field label="ยอดประกันสังคม (บาท/รอบจ่าย)" hint="หักเท่ากันทุกครั้ง"><TextInput type="number" value={r.ssAmount} onChange={num('ssAmount')} /></Field>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="ประกันสังคม (%)"><TextInput type="number" value={r.ssPercent} onChange={num('ssPercent')} /></Field>
                <Field label="เพดาน (บาท)"><TextInput type="number" value={r.ssMax} onChange={num('ssMax')} /></Field>
              </div>
            )}
        </Card>
        <Card>
          <SecHead title="เงื่อนไขการลา" />
          <Field label="ลาด่วนตอนเช้าโดยไม่มีเหตุผล → หัก (แรง/วันค่าจ้าง)" hint="พนักงานแจ้งลาในวันนั้นหลังเวลางาน โดยไม่ระบุเหตุผล">
            <TextInput type="number" value={r.urgentLeaveDeductDays} onChange={num('urgentLeaveDeductDays')} />
          </Field>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            ตั้ง = <b style={{ color: 'var(--ink)' }}>{r.urgentLeaveDeductDays}</b> แรง: ลาด่วนเช้าวันงานแบบไม่มีเหตุผล จะถูกหักเท่ากับค่าแรง {r.urgentLeaveDeductDays} วัน
          </div>
        </Card>
        <Card style={{ gridColumn: '1 / -1' }}>
          <BranchShopRulesEditor bid={bid} branchName={branch?.label} />
        </Card>

        <Card style={{ gridColumn: '1 / -1' }}>
          <SecHead title="การลงเวลา & กันโกง (ทุกสาขา)" />
          <ToggleRow label="จำกัดพิกัด (ต้องอยู่ในพื้นที่สาขาจึงเช็คอินได้)" value={state.rules.geoEnabled} onChange={(v) => updateRules({ geoEnabled: v })} />
          <ToggleRow label="บังคับถ่ายเซลฟี่ตอนเช็คอิน" value={state.rules.requireSelfie} onChange={(v) => updateRules({ requireSelfie: v })} />
        </Card>
        <Card style={{ gridColumn: '1 / -1' }}>
          <BranchManager />
        </Card>
        <Card style={{ gridColumn: '1 / -1' }}>
          <SecHead title="เริ่มใช้งานจริง" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: 'var(--muted)', flex: '1 1 320px' }}>ล้างข้อมูลตัวอย่างทั้งหมด แล้วเริ่มกรอกข้อมูลจริง (เหลือสาขาหลัก 1 สาขาให้แก้ไข) — ข้อมูลจริงจะถูกเก็บถาวร ไม่รีเซ็ตรายวัน</div>
            <Button onClick={() => { if (confirm('ล้างข้อมูลตัวอย่างทั้งหมดและเริ่มใช้งานจริง?\n(ลบพนักงาน/การลงเวลา/ข้อความตัวอย่างทั้งหมด)')) { startFresh(); alert('พร้อมใช้งานจริงแล้ว — เริ่มที่ “ตั้งค่ากฎ → สาขา” และ “พนักงาน → เพิ่มพนักงาน”'); } }}>เริ่มใช้งานจริง (ล้างตัวอย่าง)</Button>
          </div>
        </Card>
        <Card style={{ gridColumn: '1 / -1' }}>
          <SecHead title="ข้อมูลระบบ (เดโม)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>รีเซ็ตข้อมูลตัวอย่างทั้งหมดกลับค่าเริ่มต้น</div>
            <Button variant="danger" onClick={() => { if (confirm('รีเซ็ตข้อมูลทั้งหมด?')) reset(); }}>รีเซ็ตข้อมูล</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
function BranchLocationInput({ branch }) {
  const { updateBranch } = useStore();
  const [val, setVal] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  const apply = () => {
    const r = parseLocation(val, branch.lat, branch.lng);
    if (r) {
      updateBranch(branch.id, { lat: Math.round(r.lat * 1e6) / 1e6, lng: Math.round(r.lng * 1e6) / 1e6 });
      setMsg({ ok: true, text: `✓ ตั้งพิกัดแล้ว: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` });
    } else {
      setMsg({ ok: false, text: 'อ่านไม่ออก — วาง Plus Code, ลิงก์ Google Maps หรือ "lat, lng"' });
    }
  };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={val} onChange={(e) => { setVal(e.target.value); setMsg(null); }} onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder="วาง Plus Code / ลิงก์ Google Maps / พิกัด" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
        <button onClick={apply} style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 9, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>แปลง</button>
      </div>
      {msg && <div style={{ fontSize: 12, marginTop: 5, color: msg.ok ? 'var(--accent)' : '#DC2626' }}>{msg.text}</div>}
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>เช่น <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>44VP+HW เมืองแพร่ แพร่</code> · หรือกดแชร์ใน Google Maps แล้ววางลิงก์</div>
    </div>
  );
}
function BranchManager() {
  const { state, addBranch, updateBranch, deleteBranch } = useStore();
  const branches = state.branches || [];
  const num = (id, k) => (e) => updateBranch(id, { [k]: Number(e.target.value) });
  const useGPS = (id) => {
    if (!navigator.geolocation) { alert('อุปกรณ์นี้ไม่รองรับ GPS'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => updateBranch(id, { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => alert('ดึงตำแหน่งไม่สำเร็จ — อนุญาตการเข้าถึงตำแหน่งก่อน')
    );
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>สาขา & พิกัดเช็คอิน</div>
        <Button size="sm" icon="plus" onClick={() => addBranch({})}>เพิ่มสาขา</Button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>พนักงานเช็คเวลาได้เฉพาะเมื่ออยู่ในรัศมีของสาขาที่ตนสังกัดเท่านั้น</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {branches.map((b) => {
          const count = state.emps.filter((e) => e.branchId === b.id).length;
          return (
            <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16, display: 'flex', gap: 14 }}>
              <div style={{ flexShrink: 0 }}>
                <GeoMap inZone radius={b.radius} distance={8} label={b.label} size={120} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input value={b.label} onChange={(e) => updateBranch(b.id, { label: e.target.value })} style={{ ...inputStyle, padding: '8px 10px', fontWeight: 700 }} />
                  <button onClick={() => { if (count) { alert('มีพนักงาน ' + count + ' คนสังกัดสาขานี้ ย้ายก่อนลบ'); return; } if (confirm('ลบสาขา ' + b.label + '?')) deleteBranch(b.id); }} style={{ border: 'none', background: '#FEE2E2', borderRadius: 9, width: 36, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={16} color="#B91C1C" />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>รัศมี (ม.)<input type="number" value={b.radius} onChange={num(b.id, 'radius')} style={{ ...inputStyle, padding: '7px 9px', marginTop: 3 }} /></label>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>พนักงาน<div style={{ ...inputStyle, padding: '7px 9px', marginTop: 3, background: 'var(--bg)' }}>{count} คน</div></label>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Lat<input type="number" step="0.000001" value={b.lat} onChange={num(b.id, 'lat')} style={{ ...inputStyle, padding: '7px 9px', marginTop: 3 }} /></label>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Lng<input type="number" step="0.000001" value={b.lng} onChange={num(b.id, 'lng')} style={{ ...inputStyle, padding: '7px 9px', marginTop: 3 }} /></label>
                </div>
                <button onClick={() => useGPS(b.id)} style={{ marginTop: 8, width: '100%', border: '1.5px solid var(--line)', background: 'var(--surface)', borderRadius: 10, padding: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="pin" size={15} color="var(--accent)" /> ใช้ตำแหน่งปัจจุบัน (GPS)
                </button>
                <BranchLocationInput branch={b} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function BranchShopRulesEditor({ bid, branchName }) {
  const { state, setBranchShopRules } = useStore();
  const branch = (state.branches || []).find((b) => b.id === bid);
  const [text, setText] = React.useState((branch?.shopRules || []).join('\n'));
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setText((branch?.shopRules || []).join('\n')); setSaved(false); }, [bid]);
  React.useEffect(() => { setSaved(false); }, [text]);
  const save = () => {
    setBranchShopRules(bid, text.split('\n').map((l) => l.trim()).filter(Boolean));
    setSaved(true);
  };
  return (
    <div>
      <SecHead title={`กฎระเบียบร้าน — ${branchName} (แสดงในแอปพนักงานสาขานี้)`} />
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>พิมพ์กฎ 1 ข้อต่อ 1 บรรทัด — กดบันทึกแล้วขึ้นในแอปพนักงานของสาขานี้ทันที</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <Button icon="check" onClick={save}>บันทึกกฎร้าน</Button>
        {saved && <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>✓ บันทึกแล้ว — อัปเดตในแอปพนักงานเรียบร้อย</span>}
      </div>
    </div>
  );
}
function ShopRulesEditor() {
  const { state, setShopRules } = useStore();
  const [text, setText] = React.useState((state.shopRules || []).join('\n'));
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setSaved(false); }, [text]);
  const save = () => {
    const arr = text.split('\n').map((l) => l.trim()).filter(Boolean);
    setShopRules(arr);
    setSaved(true);
  };
  return (
    <div>
      <SecHead title="กฎระเบียบร้าน (แสดงในแอปพนักงาน)" />
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>พิมพ์กฎ 1 ข้อต่อ 1 บรรทัด — กดบันทึกแล้วจะขึ้นในแอปพนักงานทุกคนทันที</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <Button icon="check" onClick={save}>บันทึกกฎร้าน</Button>
        {saved && <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>✓ บันทึกแล้ว — อัปเดตในแอปพนักงานเรียบร้อย</span>}
      </div>
    </div>
  );
}
function ToggleRow({ label, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 46, height: 28, borderRadius: 28, background: value ? 'var(--accent)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 22, height: 22, borderRadius: 22, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

Object.assign(window, { AdminEmployeeDetail, AdminAttendance, AdminPayroll, AdminMessages, AdminSettings });
