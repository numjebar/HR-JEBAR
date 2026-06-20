import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ymd } from '../../lib/payroll';

export default function AdminMessages() {
  const { orgId } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('message');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const bottomRef = useRef(null);

  async function loadEmployees() {
    const { data } = await supabase
      .from('employees').select('id,name,nickname,color,photo_url,org_id')
      .eq('org_id', orgId).order('name');
    // unread count per emp
    const { data: unreads } = await supabase
      .from('messages').select('emp_id')
      .eq('org_id', orgId).eq('from', 'emp').eq('status', 'unread');
    const counts = {};
    (unreads || []).forEach((m) => { counts[m.emp_id] = (counts[m.emp_id] || 0) + 1; });
    setEmployees((data || []).map((e) => ({ ...e, unread: counts[e.id] || 0 })));
  }

  async function loadThread(emp) {
    setSelected(emp);
    const { data } = await supabase
      .from('messages').select('*')
      .eq('emp_id', emp.id).order('created_at', { ascending: true });
    setThread(data || []);
    // mark emp messages as read
    await supabase.from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('emp_id', emp.id).eq('from', 'emp').eq('status', 'unread');
    loadEmployees();
  }

  useEffect(() => { loadEmployees(); }, []);

  useEffect(() => {
    if (!selected) return;
    const ch = supabase.channel('admin-msgs').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `emp_id=eq.${selected.id}`,
    }, () => loadThread(selected)).subscribe();
    return () => supabase.removeChannel(ch);
  }, [selected]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  async function send() {
    if (!text.trim() || !selected) return;
    setBusy(true);
    await supabase.from('messages').insert({
      emp_id: selected.id, org_id: orgId,
      from: 'admin', kind, text: text.trim(),
      due: due || null, status: 'unread',
      created_at: new Date().toISOString(),
    });
    setText('');
    setDue('');
    setBusy(false);
    loadThread(selected);
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* employee list */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--line)', overflowY: 'auto', background: 'var(--surface)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>ข้อความ & สั่งงาน</div>
          <button onClick={() => setShowBroadcast(true)} title="ส่งให้ทุกคน" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            📣
          </button>
        </div>
        {employees.map((emp) => (
          <button key={emp.id} onClick={() => loadThread(emp)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px',
            background: selected?.id === emp.id ? 'var(--accent-soft)' : 'none',
            border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ width: emp.photo_url ? 40 : 'auto', minWidth: 40, maxWidth: 96, height: 40, padding: emp.photo_url ? 0 : '0 10px', borderRadius: emp.photo_url ? '50%' : 999, background: emp.color || '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: emp.photo_url ? 14 : 12, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {emp.photo_url ? <img src={emp.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (emp.nickname || emp.name || 'พนักงาน')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: selected?.id === emp.id ? 700 : 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected?.id === emp.id ? 'var(--accent)' : 'var(--ink)' }}>
                {emp.nickname || emp.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
            </div>
            {emp.unread > 0 && (
              <div style={{ background: 'var(--danger-fg)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {emp.unread}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* thread */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', fontWeight: 700, fontSize: 15 }}>
            {selected.name}
          </div>

          {/* messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {thread.map((m) => {
              const isAdmin = m.from === 'admin';
              const readLabel = m.status === 'done' ? '✓✓ ทำงานเสร็จ' : m.status === 'read' ? `✓✓ อ่านแล้ว ${m.read_at ? m.read_at.slice(11,16) : ''}` : m.status === 'unread' ? '✓' : '';
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                  {!isAdmin && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{selected.nickname || selected.name}</div>}
                  <div style={{
                    maxWidth: '65%', padding: '10px 14px', borderRadius: 16,
                    background: isAdmin ? 'var(--accent)' : 'var(--surface)',
                    color: isAdmin ? '#fff' : 'var(--ink)',
                    border: isAdmin ? 'none' : '1px solid var(--line)',
                    fontSize: 14,
                  }}>
                    {m.kind === 'task' && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: .8 }}>📋 งานที่มอบหมาย {m.due ? `· กำหนด ${m.due}` : ''}</div>}
                    {m.text}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                    <span>{m.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    {isAdmin && <span style={{ color: m.status === 'done' ? 'var(--accent)' : 'inherit' }}>{readLabel}</span>}
                  </div>
                </div>
              );
            })}
            {thread.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>ยังไม่มีข้อความ</div>}
            <div ref={bottomRef} />
          </div>

          {/* compose */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['message', 'task'].map((k) => (
                <button key={k} onClick={() => setKind(k)} className="btn" style={{ background: kind === k ? 'var(--accent)' : 'var(--bg)', color: kind === k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '6px 16px', fontSize: 13 }}>
                  {k === 'message' ? '💬 ข้อความ' : '📋 มอบงาน'}
                </button>
              ))}
              {kind === 'task' && (
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 160, fontSize: 13 }} placeholder="กำหนดส่ง" min={ymd(new Date())} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()} style={{ padding: '10px 20px', flexShrink: 0 }}>
                ส่ง
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          เลือกพนักงานเพื่อดูข้อความ
        </div>
      )}

      {showBroadcast && (
        <BroadcastModal
          employees={employees}
          orgId={orgId}
          onClose={() => setShowBroadcast(false)}
        />
      )}
    </div>
  );
}

function BroadcastModal({ employees, orgId, onClose }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('message');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [targetIds, setTargetIds] = useState(null);

  const activeEmps = employees.filter(e => e.id);

  async function send() {
    if (!text.trim() || activeEmps.length === 0) return;
    setBusy(true);
    const targets = targetIds || activeEmps.map(e => e.id);
    const rows = targets.map(empId => ({
      emp_id: empId, org_id: orgId,
      from: 'admin', kind, text: text.trim(),
      status: 'unread', created_at: new Date().toISOString(),
    }));
    await supabase.from('messages').insert(rows);
    setSent(true);
    setBusy(false);
    setTimeout(onClose, 1400);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: 24, width: '100%', maxWidth: 520, display: 'grid', gap: 14, paddingBottom: 32 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>📣 ส่งให้ทุกคน</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>พนักงาน {activeEmps.length} คนจะได้รับข้อความนี้</div>
        </div>
        {sent ? (
          <div style={{ background: '#ecfdf3', border: '1px solid #bbe7cf', borderRadius: 14, padding: 16, textAlign: 'center', color: '#0d7a46', fontWeight: 700 }}>
            ✓ ส่งให้พนักงานทุกคนแล้ว
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {['message', 'task'].map(k => (
                <button key={k} onClick={() => setKind(k)} className="btn" style={{ background: kind === k ? 'var(--accent)' : 'var(--bg)', color: kind === k ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '6px 14px', fontSize: 13 }}>
                  {k === 'message' ? '💬 ข้อความ' : '📋 มอบงาน'}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="พิมพ์ข้อความถึงพนักงานทุกคน..."
              style={{ resize: 'vertical', fontSize: 14 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()} style={{ flex: 1 }}>
                {busy ? 'กำลังส่ง...' : `ส่งให้ ${activeEmps.length} คน`}
              </button>
              <button className="btn" onClick={onClose} style={{ flex: 1 }}>ยกเลิก</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
