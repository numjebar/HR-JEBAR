import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function EmpMessages() {
  const { employee, employeeSessionToken } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  async function load() {
    const { data } = await supabase.rpc('employee_get_messages_v2', {
      p_session_token: employeeSessionToken,
    });
    setMessages(data || []);
    await supabase.rpc('employee_mark_admin_messages_read_v2', {
      p_session_token: employeeSessionToken,
    });
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // realtime
  useEffect(() => {
    const ch = supabase.channel('emp-msgs').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `emp_id=eq.${employee.id}`,
    }, () => load()).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await supabase.rpc('employee_send_message_v2', {
      p_session_token: employeeSessionToken,
      p_text: text.trim(),
    });
    setText('');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ padding: '16px 16px 8px', fontWeight: 700, fontSize: 18, borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        ข้อความ
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.map((m) => {
          const isAdmin = m.from === 'admin';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-start' : 'flex-end', marginBottom: 14 }}>
              {isAdmin && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>แอดมิน</div>}
              <div style={{
                maxWidth: '78%', padding: '10px 14px', borderRadius: 16,
                background: isAdmin ? 'var(--surface)' : 'var(--accent)',
                color: isAdmin ? 'var(--ink)' : '#fff',
                border: isAdmin ? '1px solid var(--line)' : 'none',
                fontSize: 14,
              }}>
                {m.kind === 'task' && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: .8 }}>📋 งานที่มอบหมาย</div>}
                {m.text}
                {m.due && <div style={{ fontSize: 11, opacity: .7, marginTop: 4 }}>กำหนด: {m.due}</div>}
              </div>
              {m.kind === 'task' && m.from === 'admin' && m.status !== 'done' && (
                <button onClick={() => markTaskDone(m.id)} style={{
                  marginTop: 6, fontSize: 12, color: 'var(--accent)', background: 'none',
                  border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                }}>ทำเสร็จแล้ว ✓</button>
              )}
              {m.kind === 'task' && m.status === 'done' && (
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>✓ เสร็จแล้ว</span>
              )}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                {m.created_at?.slice(11, 16)}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>ยังไม่มีข้อความ</div>}
        <div ref={bottomRef} />
      </div>

      {/* reply input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()} style={{ padding: '10px 16px' }}>
          ส่ง
        </button>
      </div>
    </div>
  );
}
