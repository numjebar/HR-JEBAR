// ─────────────────────────────────────────────────────────────
// HR JEBAR — Employee screens + app shell
// ─────────────────────────────────────────────────────────────
const TAB_TOP = 56; // clear status bar

function EmpHeader({ title, sub }) {
  return (
    <div style={{ padding: `${TAB_TOP}px 22px 14px` }}>
      {sub && <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>{sub}</div>}
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
  );
}

// ---- HOME --------------------------------------------------------
function EmpHome({ emp, go, onLock }) {
  const { state, clockIn, clockOut } = useStore();
  const { rules, att, messages, branches } = state;
  const branch = (branches || []).find((b) => b.id === emp.branchId) || null;
  const erules = rulesFor(state, emp);
  const shopRules = shopRulesFor(state, emp);
  const [sheet, setSheet] = React.useState(null);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const td = ymd(new Date());
  const today = att.find((a) => a.empId === emp.id && a.date === td);
  const wk = rangeFor('week');
  const myWeek = att.filter((a) => a.empId === emp.id && inRange(a.date, wk));
  const lateCount = myWeek.filter((a) => a.status === 'late').length;
  const otMin = myWeek.reduce((s, a) => s + (a.otMin || 0), 0);
  const myTasks = messages.filter((m) => m.empId === emp.id && m.kind === 'task' && m.status !== 'done');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  const phase = !today || !today.clockIn ? 'in' : !today.clockOut ? 'out' : 'done';

  return (
    <div>
      <div style={{ padding: `${TAB_TOP}px 22px 8px`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar emp={emp} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{greet}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{emp.nickname || emp.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div onClick={onLock} style={{ cursor: 'pointer' }} title="ดูหน้าจอล็อก">
            <Icon name="lock" size={22} color="var(--muted)" />
          </div>
          <div onClick={() => go('msg')} style={{ position: 'relative', cursor: 'pointer' }}>
            <Icon name="bell" size={24} color="var(--muted)" />
            {(() => {
              const n = messages.filter((m) => m.empId === emp.id && m.from === 'admin' && m.status === 'unread').length;
              return n > 0 ? (
                <div style={{ position: 'absolute', top: -7, right: -8, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 18, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{n}</div>
              ) : null;
            })()}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 22px' }}>
        {/* unread message alert — prominent */}
        {(() => {
          const unreadAdmin = messages.filter((m) => m.empId === emp.id && m.from === 'admin' && m.status === 'unread');
          if (!unreadAdmin.length) return null;
          const latest = unreadAdmin.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
          return (
            <div onClick={() => go('msg')} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: '#fff', borderRadius: 16,
              boxShadow: '0 6px 18px rgba(220,38,38,0.32)', animation: 'pulseAlert 2s ease-in-out infinite',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                <Icon name="chat" size={22} color="#fff" />
                <div style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 18, background: '#fff', color: '#DC2626', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadAdmin.length}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>ข้อความใหม่จากหัวหน้า {unreadAdmin.length} รายการ</div>
                <div style={{ fontSize: 13, opacity: 0.92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latest.kind === 'task' ? '📋 ' : ''}{latest.text}</div>
              </div>
              <Icon name="arrow" size={20} color="#fff" />
            </div>
          );
        })()}

        {/* clock card */}
        <div style={{
          background: phase === 'done' ? 'linear-gradient(135deg,#0E7C66,#0B5D4D)' : 'var(--ink)',
          borderRadius: 22, padding: 22, color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{fmtDateFull(td)}</div>
              <LiveClock />
              {branch && <div style={{ fontSize: 12.5, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Icon name="pin" size={13} color="#fff" />{branch.label}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.85 }}>
              <div>เวลางาน</div>
              <div style={{ fontWeight: 600 }}>{erules.workStart}–{erules.workEnd}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <ClockStat label="เข้างาน" value={today?.clockIn || '—'} late={today?.status === 'late'} />
            <ClockStat label="ออกงาน" value={today?.clockOut || '—'} />
          </div>
          {phase === 'in' && <Button full size="lg" icon="in" onClick={() => setSheet('in')} style={{ background: '#fff', color: 'var(--ink)' }}>ลงเวลาเข้างาน</Button>}
          {phase === 'out' && <Button full size="lg" icon="out" onClick={() => setSheet('out')} style={{ background: '#fff', color: 'var(--ink)' }}>ลงเวลาออกงาน</Button>}
          {phase === 'done' && (
            <div style={{ textAlign: 'center', fontWeight: 600, padding: '6px 0' }}>
              ✓ ลงเวลาครบแล้ววันนี้{today.otMin ? ` · OT ${today.otMin} นาที` : ''}
            </div>
          )}
        </div>

        {/* week mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
          <MiniStat label="มาทำงาน" value={myWeek.filter((a) => a.status === 'present' || a.status === 'late').length} unit="วัน" />
          <MiniStat label="มาสาย" value={lateCount} unit="ครั้ง" accent={lateCount ? '#B45309' : undefined} />
          <MiniStat label="OT" value={(otMin / 60).toFixed(1)} unit="ชม." accent={otMin ? 'var(--accent)' : undefined} />
        </div>

        {/* tasks */}
        {myTasks.length > 0 && (
          <Card style={{ marginTop: 14 }} pad={16} onClick={() => go('msg')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Icon name="clipboard" size={18} color="var(--accent)" />
              <div style={{ fontWeight: 700, flex: 1 }}>งานที่ได้รับมอบหมาย</div>
              <Badge status="unread" text={myTasks.length + ' งาน'} small />
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{myTasks[0].text}</div>
          </Card>
        )}

        <Card style={{ marginTop: 14 }} pad={16} onClick={() => setRulesOpen(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="doc" size={22} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>กฎระเบียบร้าน</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{(shopRules || []).length} ข้อ · อ่านก่อนเริ่มงาน</div>
            </div>
            <Icon name="arrow" size={20} color="var(--muted)" />
          </div>
        </Card>
      </div>

      {rulesOpen && (
        <Sheet open onClose={() => setRulesOpen(false)} title="กฎระเบียบร้าน">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(shopRules || []).map((rule, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--bg)', borderRadius: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: 24, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.5, paddingTop: 1 }}>{rule}</div>
              </div>
            ))}
            {(!shopRules || shopRules.length === 0) && <Empty text="ยังไม่มีกฎระเบียบ" />}
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>กฎกำหนดโดยแอดมิน · อัปเดตอัตโนมัติ</div>
        </Sheet>
      )}

      {sheet && (
        <CheckInSheet emp={emp} rules={erules} branch={branch} closingTasks={emp.closingTasks || []} mode={sheet} onClose={() => setSheet(null)}
          onConfirm={(meta) => { sheet === 'in' ? clockIn(emp.id, meta) : clockOut(emp.id, meta); }} />
      )}
    </div>
  );
}
function LiveClock() {
  const [t, setT] = React.useState(nowHM());
  React.useEffect(() => { const i = setInterval(() => setT(nowHM()), 1000 * 20); return () => clearInterval(i); }, []);
  return <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{t}</div>;
}
function ClockStat({ label, value, late }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: late ? '#FCD34D' : '#fff' }}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value, unit, accent }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || 'var(--ink)' }}>{value}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span></div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ---- HISTORY -----------------------------------------------------
function EmpHistory({ emp }) {
  const { state, requestLeave } = useStore();
  const { att, leaves } = state;
  const rules = rulesFor(state, emp);
  const [tab, setTab] = React.useState('att');
  const [sheet, setSheet] = React.useState(false);
  const mine = att.filter((a) => a.empId === emp.id).sort((a, b) => b.date.localeCompare(a.date));
  const myLeaves = leaves.filter((l) => l.empId === emp.id);

  return (
    <div>
      <EmpHeader title="ประวัติ" sub="การลงเวลาและการลา" />
      <div style={{ padding: '0 22px 12px' }}>
        <Segmented options={[{ value: 'att', label: 'ลงเวลา' }, { value: 'leave', label: 'การลา' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'att' && (
        <div style={{ padding: '0 22px' }}>
          {mine.map((a) => {
            const late = lateMinutesOf(a, rules);
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 46, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{new Date(a.date + 'T00:00').getDate()}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{THAI_MONTHS[new Date(a.date + 'T00:00').getMonth()]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {a.status === 'leave'
                    ? <div style={{ fontWeight: 600 }}>{a.leaveType}</div>
                    : <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{a.clockIn || '—'} – {a.clockOut || '—'}</div>}
                  {late > 0 && <div style={{ fontSize: 12, color: '#B45309' }}>สาย {late} นาที</div>}
                  {a.otMin > 0 && <div style={{ fontSize: 12, color: 'var(--accent)' }}>OT {a.otMin} นาที</div>}
                </div>
                <Badge status={a.status} small />
              </div>
            );
          })}
        </div>
      )}
      {tab === 'leave' && (
        <div style={{ padding: '0 22px' }}>
          <Button full icon="plus" variant="soft" onClick={() => setSheet(true)} style={{ marginBottom: 14 }}>ขอลาใหม่</Button>
          {myLeaves.length === 0 && <Empty text="ยังไม่มีรายการลา" />}
          {myLeaves.map((l) => (
            <Card key={l.id} style={{ marginBottom: 10 }} pad={16}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{l.type}</div>
                <Badge status={l.status} small />
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>{fmtDate(l.dateFrom)}{l.dateTo !== l.dateFrom ? ` – ${fmtDate(l.dateTo)}` : ''} · {l.reason}</div>
            </Card>
          ))}
        </div>
      )}
      {sheet && <LeaveSheet emp={emp} onClose={() => setSheet(false)} onSubmit={(t, f, to, r) => { requestLeave(emp.id, t, f, to, r); setSheet(false); }} />}
    </div>
  );
}
function LeaveSheet({ emp, onClose, onSubmit }) {
  const { state } = useStore();
  const er = rulesFor(state, emp);
  const [type, setType] = React.useState('ลาป่วย');
  const [from, setFrom] = React.useState(ymd(new Date()));
  const [to, setTo] = React.useState(ymd(new Date()));
  const [reason, setReason] = React.useState('');
  const today = ymd(new Date());
  const willPenalize = from === today && parseHM(nowHM()) >= parseHM(er.workStart) && !reason.trim() && er.urgentLeaveDeductDays > 0;
  return (
    <Sheet open onClose={onClose} title="ขอลา">
      <Field label="ประเภทการลา">
        <Segmented options={['ลาป่วย', 'ลากิจ', 'ลาพักร้อน']} value={type} onChange={setType} />
      </Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="ตั้งแต่"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="ถึง"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Field label="เหตุผล"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล" /></Field>
      {willPenalize && (
        <div style={{ background: '#FEF3E2', color: '#B45309', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 14, display: 'flex', gap: 10 }}>
          <Icon name="alert" size={18} color="#B45309" />
          <span>นี่คือ <b>ลาด่วนตอนเช้าวันงาน</b> และยังไม่ได้ระบุเหตุผล — ตามกฎสาขาจะถูก <b>หัก {er.urgentLeaveDeductDays} แรง</b> กรุณาระบุเหตุผลถ้ามีเหตุจำเป็น</span>
        </div>
      )}
      <Button full size="lg" onClick={() => onSubmit(type, from, to, reason || '-')}>ส่งคำขอลา</Button>
    </Sheet>
  );
}

// ---- PAY ---------------------------------------------------------
function EmpPay({ emp }) {
  const { state } = useStore();
  const [period, setPeriod] = React.useState('month');
  const r = rangeFor(period);
  const recs = state.att.filter((a) => a.empId === emp.id && inRange(a.date, r));
  const sales = state.sales.filter((s) => s.empId === emp.id && inRange(s.date, r));
  const adj = state.adjusts.filter((a) => a.empId === emp.id && inRange(a.date, r));
  const erules = rulesFor(state, emp);
  const p = computePay(emp, recs, sales, adj, erules);

  const rows = [
    { label: emp.payType === 'daily' ? `ค่าแรง (${p.daysWorked} วัน)` : 'เงินเดือน (ตามสัดส่วน)', value: p.base, plus: true },
    p.otPay > 0 && { label: `ค่าล่วงเวลา (${(p.otMin / 60).toFixed(1)} ชม.)`, value: p.otPay, plus: true },
    p.commission > 0 && { label: 'คอมมิชชั่น', value: p.commission, plus: true },
    p.bonus > 0 && { label: 'โบนัส', value: p.bonus, plus: true },
    p.lateDeduct > 0 && { label: erules.lateMode === 'tiered' ? `หักมาสาย (${p.lateBigDays + p.lateMidUnits} ชม.)` : `หักมาสาย (${p.lateMinTotal} นาที)`, value: -p.lateDeduct },
    p.damage > 0 && { label: 'หักของเสียหาย', value: -p.damage },
    p.advance > 0 && { label: 'หักเบิกล่วงหน้า', value: -p.advance },
    { label: 'ประกันสังคม', value: -p.ss },
  ].filter(Boolean);

  return (
    <div>
      <EmpHeader title="รายได้" sub="สรุปเงินที่จะได้รับ" />
      <div style={{ padding: '0 22px 12px' }}>
        <Segmented options={[{ value: 'day', label: 'วันนี้' }, { value: 'week', label: 'สัปดาห์' }, { value: 'month', label: 'เดือนนี้' }]} value={period} onChange={setPeriod} />
      </div>
      <div style={{ padding: '0 22px' }}>
        <div style={{ background: 'linear-gradient(135deg,#0E7C66,#0B5D4D)', borderRadius: 22, padding: 24, color: '#fff', marginBottom: 16 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>ยอดสุทธิ ({period === 'day' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'})</div>
          <div style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{THB(p.net)}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 13 }}>
            <span style={{ opacity: 0.85 }}>รายรับรวม {THB(p.gross)}</span>
            <span style={{ opacity: 0.85 }}>หักรวม {THB(p.deductTotal)}</span>
          </div>
        </div>
        <Card pad={6}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ color: 'var(--ink)' }}>{row.label}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.value < 0 ? '#DC2626' : 'var(--accent)' }}>
                {row.value < 0 ? '−' : '+'}{THB(Math.abs(row.value))}
              </span>
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: '16px 0' }}>
          ค่าแรง {emp.payType === 'daily' ? THB(emp.rate) + '/วัน' : THB(emp.rate) + '/เดือน'}
          {erules.lateMode === 'tiered'
            ? ` · มาสายเกิน ${erules.lateBigMin} นาที หัก ${erules.lateDeductHours} ชม.`
            : ` · มาสายหัก ${THB(erules.lateDeductPerMin)}/นาที`}
        </div>
      </div>
    </div>
  );
}

// ---- MESSAGES (chat, two-way) ------------------------------------
function ChatBubble({ m, setMessageStatus }) {
  const mine = m.from === 'emp';
  const isTask = m.kind === 'task';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: 18,
        borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4,
        background: mine ? 'var(--accent)' : 'var(--surface)', color: mine ? '#fff' : 'var(--ink)',
        border: mine ? 'none' : '1px solid var(--line)', fontSize: 14.5, lineHeight: 1.45,
      }}>
        {isTask && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 5 }}>
            <Icon name="clipboard" size={14} color="var(--accent)" /> งานที่มอบหมาย
          </div>
        )}
        <div style={{ textWrap: 'pretty' }}>{m.text}</div>
        {isTask && m.due && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>กำหนดเสร็จ: {fmtDate(m.due)}</div>}
        {isTask && (
          <div style={{ marginTop: 8 }}>
            {m.status === 'done'
              ? <Badge status="done" small />
              : <Button size="sm" variant="soft" icon="check" onClick={() => setMessageStatus(m.id, 'done')}>ทำเสร็จแล้ว</Button>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 6px 0' }}>
        {(m.createdAt.split(' ')[1] || '')}{!mine && m.from === 'admin' ? ' · หัวหน้า' : ''}
      </div>
    </div>
  );
}
function EmpMessages({ emp }) {
  const { state, setMessageStatus, empReply } = useStore();
  const all = state.messages.filter((m) => m.empId === emp.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [text, setText] = React.useState('');
  const listRef = React.useRef(null);
  React.useEffect(() => { all.filter((m) => m.from === 'admin' && m.status === 'unread').forEach((m) => setMessageStatus(m.id, 'read')); }, []);
  React.useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [all.length]);
  const send = () => { const v = text.trim(); if (!v) return; empReply(emp.id, v); setText(''); };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <EmpHeader title="ข้อความ" sub="แชทกับหัวหน้า / แอดมิน" />
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '4px 18px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {all.length === 0 && <Empty text="ยังไม่มีข้อความ" />}
        {all.map((m) => <ChatBubble key={m.id} m={m} setMessageStatus={setMessageStatus} />)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface)', marginBottom: 84 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="พิมพ์ข้อความตอบกลับ…" style={{ ...inputStyle, borderRadius: 999, padding: '11px 16px' }} />
        <button onClick={send} style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="arrow" size={20} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ---- PROFILE (read-only personal data; only notif prefs editable) ----
function EmpToggle({ label, desc, value, onChange, icon }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
      {icon && <Icon name={icon} size={20} color="var(--muted)" />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>}
      </div>
      <div style={{ width: 46, height: 28, borderRadius: 28, background: value ? 'var(--accent)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 22, height: 22, borderRadius: 22, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
    </div>
  );
}
function EmpProfile({ emp, prefs, onLogout, onLock }) {
  const { setPref, state, updateEmployee } = useStore();
  const branch = (state.branches || []).find((b) => b.id === emp.branchId);
  const [editing, setEditing] = React.useState(false);
  const docs = [
    { field: 'photo', label: 'รูปโปรไฟล์', icon: 'user' },
    { field: 'bankQR', label: 'QR บัญชี', icon: 'qr' },
    { field: 'idCardImg', label: 'บัตรประชาชน', icon: 'card' },
  ];
  const upload = (field) => (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => updateEmployee(emp.id, { [field]: rd.result });
    rd.readAsDataURL(f);
  };
  return (
    <div>
      <div style={{ padding: `${TAB_TOP}px 22px 16px`, textAlign: 'center' }}>
        <Avatar emp={emp} size={88} />
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>{emp.name}</div>
        <div style={{ color: 'var(--muted)' }}>{emp.position} · {emp.department}</div>
      </div>
      <div style={{ padding: '0 22px' }}>
        {/* notification settings — employee-controlled */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', margin: '4px 4px 10px' }}>การแจ้งเตือน</div>
        <Card pad={0} style={{ marginBottom: 16 }}>
          <EmpToggle label="เสียงแจ้งเตือน" desc="เล่นเสียงเมื่อมีข้อความใหม่" icon="bell" value={prefs.sound !== false} onChange={(v) => setPref(emp.id, { sound: v })} />
          {prefs.sound !== false && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>เลือกเสียงเตือน (แตะเพื่อฟัง)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(NOTIF_TONES).map(([key, t]) => {
                  const on = (prefs.tone || 'ding') === key;
                  return (
                    <button key={key} onClick={() => { setPref(emp.id, { tone: key }); playDing(key); }} style={{
                      padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                      border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                      background: on ? 'var(--accent-soft)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--ink)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {on && <Icon name="check" size={14} color="var(--accent)" />}🔊 {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <EmpToggle label="โหมดสั่น" desc="สั่นเตือนเมื่อมีข้อความใหม่" value={prefs.vibrate !== false} onChange={(v) => setPref(emp.id, { vibrate: v })} />
          <div onClick={onLock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
            <Icon name="lock" size={20} color="var(--muted)" />
            <div style={{ flex: 1, fontWeight: 600 }}>ดูตัวอย่างหน้าจอล็อก</div>
            <Icon name="arrow" size={18} color="var(--muted)" />
          </div>
        </Card>

        {/* general info — employee-editable */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 4px 10px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>ข้อมูลส่วนตัว</span>
          <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="edit" size={14} color="var(--accent)" /> แก้ไข
          </button>
        </div>
        <Card pad={6} style={{ marginBottom: 16 }}>
          <InfoRow label="ชื่อเล่น" value={emp.nickname} />
          <InfoRow label="เบอร์โทร" value={emp.phone || '—'} />
          <InfoRow label="เลขบัตรประชาชน" value={emp.idNumber || '—'} />
          <InfoRow label="ธนาคาร" value={emp.bankAccount ? `${emp.bankName} ${emp.bankAccount}` : '—'} />
          <InfoRow label="ติดต่อฉุกเฉิน" value={emp.emName ? `${emp.emName} (${emp.emRel})` : '—'} />
          <InfoRow label="เบอร์ฉุกเฉิน" value={emp.emPhone || '—'} last />
        </Card>

        {/* documents — employee-uploadable */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', margin: '4px 4px 10px' }}>เอกสาร / รูปภาพ (แตะเพื่ออัปโหลด)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {docs.map((d) => (
            <label key={d.field} style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={upload(d.field)} />
              <div style={{
                aspectRatio: '1', borderRadius: 14, border: '1.5px dashed var(--line)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: emp[d.field] ? `center/cover url(${emp[d.field]})` : 'var(--surface)', overflow: 'hidden',
              }}>
                {!emp[d.field] && <><Icon name={d.icon} size={22} color="var(--muted)" /><span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '0 4px' }}>{d.label}</span></>}
              </div>
            </label>
          ))}
        </div>

        {/* financial / time — locked, admin only */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 4px 10px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>การเงิน / เวลางาน</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="lock" size={13} /> แก้ไขโดยแอดมิน</span>
        </div>
        <Card pad={6} style={{ marginBottom: 16 }}>
          <InfoRow label="สาขาที่สังกัด" value={branch ? branch.label : '—'} />
          <InfoRow label="เวลางาน" value={`${rulesFor(state, emp).workStart}–${rulesFor(state, emp).workEnd}`} />
          <InfoRow label="ค่าแรง" value={emp.payType === 'daily' ? THB(emp.rate) + ' / วัน' : THB(emp.rate) + ' / เดือน'} />
          <InfoRow label="คอมมิชชั่น" value={emp.commission?.type === 'percent' ? emp.commission.value + '% ยอดขาย' : emp.commission?.type === 'unit' ? THB(emp.commission.value) + '/ชิ้น' : 'ไม่มี'} last />
        </Card>

        <Button full variant="ghost" icon="logout" onClick={onLogout}>ออกจากระบบ</Button>
        <div style={{ height: 24 }} />
      </div>
      {editing && <EmpEditProfileSheet emp={emp} onClose={() => setEditing(false)} onSave={(patch) => { updateEmployee(emp.id, patch); setEditing(false); }} />}
    </div>
  );
}
function EmpEditProfileSheet({ emp, onClose, onSave }) {
  const [f, setF] = React.useState({
    nickname: emp.nickname || '', phone: emp.phone || '', idNumber: emp.idNumber || '',
    bankName: emp.bankName || '', bankAccount: emp.bankAccount || '',
    emName: emp.emName || '', emRel: emp.emRel || '', emPhone: emp.emPhone || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet open onClose={onClose} title="แก้ไขข้อมูลส่วนตัว">
      <div style={{ fontSize: 12.5, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
        แก้ได้เฉพาะข้อมูลทั่วไป · ค่าแรง/เวลา/สาขา ต้องให้แอดมินแก้
      </div>
      <Field label="ชื่อเล่น"><TextInput value={f.nickname} onChange={set('nickname')} /></Field>
      <Field label="เบอร์โทร"><TextInput value={f.phone} onChange={set('phone')} placeholder="08x-xxx-xxxx" /></Field>
      <Field label="เลขบัตรประชาชน"><TextInput value={f.idNumber} onChange={set('idNumber')} /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="ธนาคาร"><TextInput value={f.bankName} onChange={set('bankName')} placeholder="เช่น กสิกรไทย" /></Field>
        <Field label="เลขบัญชี"><TextInput value={f.bankAccount} onChange={set('bankAccount')} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="ผู้ติดต่อฉุกเฉิน"><TextInput value={f.emName} onChange={set('emName')} /></Field>
        <Field label="ความสัมพันธ์"><TextInput value={f.emRel} onChange={set('emRel')} placeholder="เช่น บิดา" /></Field>
      </div>
      <Field label="เบอร์ฉุกเฉิน"><TextInput value={f.emPhone} onChange={set('emPhone')} placeholder="08x-xxx-xxxx" /></Field>
      <Button full size="lg" icon="check" onClick={() => onSave(f)}>บันทึก</Button>
    </Sheet>
  );
}
function InfoRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '50px 0', fontSize: 15 }}>{text}</div>;
}

// ---- TAB BAR + APP SHELL -----------------------------------------
const EMP_TABS = [
  { id: 'home', label: 'หน้าหลัก', icon: 'home' },
  { id: 'hist', label: 'ประวัติ', icon: 'calendar' },
  { id: 'pay', label: 'รายได้', icon: 'wallet' },
  { id: 'msg', label: 'ข้อความ', icon: 'chat' },
  { id: 'me', label: 'โปรไฟล์', icon: 'user' },
];

function EmployeeApp({ emp, onLogout }) {
  const { state, setMessageStatus } = useStore();
  const [tab, setTab] = React.useState('home');
  const [banner, setBanner] = React.useState(null);
  const [locked, setLocked] = React.useState(false);
  const prefs = state.prefs[emp.id] || { sound: true, vibrate: true };
  const myMsgs = state.messages.filter((m) => m.empId === emp.id);
  const unread = myMsgs.filter((m) => m.from === 'admin' && m.status === 'unread');
  const seen = React.useRef(null);

  // detect newly-arrived unread messages → fire notification + banner
  React.useEffect(() => {
    const ids = unread.map((m) => m.id).join(',');
    if (seen.current === null) {
      // first mount: if there are unread, surface the newest
      if (unread.length) { fireNotification(prefs); setBanner(unread[0]); }
    } else if (ids !== seen.current && unread.length) {
      fireNotification(prefs); setBanner(unread[0]);
    }
    seen.current = ids;
  }, [unread.map((m) => m.id).join(',')]);

  const openMsgFromNotif = () => { setBanner(null); setLocked(false); setTab('msg'); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      {tab === 'msg' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <EmpMessages emp={emp} />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {tab === 'home' && <EmpHome emp={emp} go={setTab} onLock={() => setLocked(true)} />}
          {tab === 'hist' && <EmpHistory emp={emp} />}
          {tab === 'pay' && <EmpPay emp={emp} />}
          {tab === 'me' && <EmpProfile emp={emp} prefs={prefs} onLogout={onLogout} onLock={() => setLocked(true)} />}
          <div style={{ height: 90 }} />
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--line)', display: 'flex', padding: '8px 8px 30px',
      }}>
        {EMP_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0',
              color: active ? 'var(--accent)' : 'var(--muted)', fontFamily: 'inherit', position: 'relative',
            }}>
              <div style={{ position: 'relative' }}>
                <Icon name={t.icon} size={23} stroke={active ? 2.4 : 2} />
                {t.id === 'msg' && (() => {
                  const n = state.messages.filter((m) => m.empId === emp.id && m.from === 'admin' && m.status === 'unread').length;
                  return n > 0 ? <div style={{ position: 'absolute', top: -6, right: -9, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 16, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{n}</div> : null;
                })()}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <NotifBanner notif={banner} onClose={() => setBanner(null)} onOpen={openMsgFromNotif} />
      {locked && <LockScreen emp={emp} notifs={unread} onUnlock={() => setLocked(false)} onOpenMsg={openMsgFromNotif} />}
    </div>
  );
}

// ---- LOGIN -------------------------------------------------------
function EmployeeLogin({ onLogin }) {
  const { state } = useStore();
  const [sel, setSel] = React.useState(null);
  if (sel) return <PinPad emp={sel} onSuccess={() => onLogin(sel)} onBack={() => setSel(null)} />;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: `${TAB_TOP + 20}px 24px 16px` }}>
        <img src="assets/jebar-logo.png" alt="JEBAR" style={{ height: 40, marginBottom: 14 }} />
        <div style={{ color: 'var(--muted)' }}>เลือกบัญชีของคุณเพื่อเข้าสู่ระบบ</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 22px' }}>
        {state.emps.map((e) => (
          <Card key={e.id} onClick={() => setSel(e)} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }} pad={14}>
            <Avatar emp={e} size={46} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{e.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{e.position}</div>
            </div>
            <Icon name="arrow" size={20} color="var(--muted)" />
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { EmployeeApp, EmployeeLogin, Empty, InfoRow });
