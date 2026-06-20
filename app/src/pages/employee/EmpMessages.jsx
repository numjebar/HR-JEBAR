import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import VoiceBtn from '../../components/VoiceBtn';

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return iso.slice(11, 16); }
}
function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); }
  catch { return iso.slice(0, 10); }
}

function groupByDate(messages) {
  const groups = [];
  let lastDate = '';
  for (const m of messages) {
    const d = (m.created_at || '').slice(0, 10);
    if (d !== lastDate) { groups.push({ type: 'date', value: d, key: `d-${d}` }); lastDate = d; }
    groups.push({ type: 'msg', value: m, key: m.id });
  }
  return groups;
}

export default function EmpMessages() {
  const { employee, employeeSessionToken } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  async function load() {
    const { data } = await supabase.rpc('employee_get_messages_v2', { p_session_token: employeeSessionToken });
    setMessages(data || []);
    await supabase.rpc('employee_mark_admin_messages_read_v2', { p_session_token: employeeSessionToken });
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ch = supabase.channel('emp-msgs')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `emp_id=eq.${employee?.id}`,
      }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [employee?.id]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setText('');
    await supabase.rpc('employee_send_message_v2', {
      p_session_token: employeeSessionToken,
      p_text: trimmed,
    });
    setBusy(false);
    load();
  }

  async function markTaskDone(id) {
    await supabase.rpc('employee_mark_task_done_v2', {
      p_session_token: employeeSessionToken,
      p_msg_id: id,
    });
    load();
  }

  const grouped = groupByDate(messages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 68px)', background: 'var(--bg)' }}>
      {/* header */}
      <div style={{
        padding: '14px 18px 12px',
        fontWeight: 800, fontSize: 17,
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>💬</span>
        ข้อความ
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
          แอดมิน ↔ พนักงาน
        </span>
      </div>

      {/* message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grouped.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>💬</span>
            <span style={{ fontSize: 14 }}>ยังไม่มีข้อความ</span>
          </div>
        )}
        {grouped.map(g => {
          if (g.type === 'date') {
            return (
              <div key={g.key} style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg)', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line)' }}>
                  {formatDate(g.value)}
                </span>
              </div>
            );
          }

          const m = g.value;
          const isAdmin = m.from === 'admin';
          const isTask = m.kind === 'task';

          return (
            <div key={g.key} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isAdmin ? 'flex-start' : 'flex-end',
              marginBottom: 10,
            }}>
              {isAdmin && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, paddingLeft: 4 }}>แอดมิน</div>
              )}

              <div style={{
                maxWidth: '80%',
                padding: isTask ? '12px 14px' : '10px 14px',
                borderRadius: isAdmin ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                background: isAdmin ? 'var(--surface)' : 'var(--accent)',
                color: isAdmin ? 'var(--ink)' : '#fff',
                border: isAdmin ? '1px solid var(--line)' : 'none',
                fontSize: 14, lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}>
                {isTask && (
                  <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 5, opacity: .8, display: 'flex', gap: 4, alignItems: 'center' }}>
                    📋 งานที่มอบหมาย
                    {m.status === 'done' && <span style={{ background: 'rgba(0,0,0,.12)', borderRadius: 99, padding: '1px 6px' }}>✓ เสร็จแล้ว</span>}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                {m.due && m.status === 'done' && (
                  <div style={{ fontSize: 11, opacity: .5, marginTop: 5 }}>⏰ กำหนด: {m.due}</div>
                )}
                {m.due && m.status !== 'done' && (() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const diffDays = Math.round((new Date(m.due + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
                  let text, color, bold;
                  if (diffDays < 0) { text = `⚠️ เกินกำหนด ${Math.abs(diffDays)} วัน`; color = '#b42318'; bold = true; }
                  else if (diffDays === 0) { text = '⏰ กำหนดวันนี้!'; color = '#b42318'; bold = true; }
                  else if (diffDays === 1) { text = '⏰ กำหนดพรุ่งนี้'; color = '#b45309'; bold = false; }
                  else if (diffDays <= 3) { text = `⏰ กำหนดใน ${diffDays} วัน`; color = '#b45309'; bold = false; }
                  else { text = `⏰ กำหนด: ${m.due}`; color = null; bold = false; }
                  return <div style={{ fontSize: 11, marginTop: 5, color: color || undefined, fontWeight: bold ? 700 : 400, opacity: color ? 1 : .7 }}>{text}</div>;
                })()}
              </div>

              {isTask && isAdmin && m.status !== 'done' && (
                <button onClick={() => markTaskDone(m.id)} style={{
                  marginTop: 5, fontSize: 12, color: 'var(--accent)',
                  background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                  borderRadius: 10, padding: '5px 14px', cursor: 'pointer', fontWeight: 700,
                }}>
                  ✓ ทำเสร็จแล้ว
                </button>
              )}

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                {formatTime(m.created_at)}
                {!isAdmin && m.read_at && <span style={{ marginLeft: 4, opacity: .6 }}>· อ่านแล้ว</span>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* input bar */}
      <div style={{
        padding: '10px 12px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <VoiceBtn
          onResult={v => setText(prev => prev ? prev + ' ' + v : v)}
          style={{ marginBottom: 1 }}
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{
            flex: 1, resize: 'none', borderRadius: 18,
            padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
            border: '1.5px solid var(--line)', background: 'var(--bg)',
            maxHeight: 120, overflowY: 'auto',
          }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={busy || !text.trim()}
          style={{ padding: '10px 18px', borderRadius: 18, fontSize: 14, fontWeight: 700, flexShrink: 0 }}
        >
          {busy ? '...' : 'ส่ง'}
        </button>
      </div>
    </div>
  );
}
