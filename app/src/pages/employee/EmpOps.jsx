import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../lib/version';
import SearchSelect from '../../components/SearchSelect';
import VoiceBtn from '../../components/VoiceBtn';
import { fetchOperateCatalog } from '../../lib/operateCatalog';

const STORAGE_PREFIX = 'hr_emp_ops_';
const HISTORY_LIMIT = 8;

const TASKS = [
  { key: 'bills',          path: '/emp/ops/bills',          title: 'ถ่ายบิลซื้อของ',       subtitle: 'ถ่ายรูปบิล AI อ่านรายการ แล้วส่งให้ระบบจัดการต่อ', icon: '📷' },
  { key: 'production',     path: '/emp/ops/production',     title: 'บันทึกการผลิตขนม',     subtitle: 'บันทึกเมนูที่ผลิต จำนวน และรายละเอียดของแต่ละรอบ', icon: '🏭' },
  { key: 'inventory',      path: '/emp/ops/inventory',      title: 'วัตถุดิบและสต๊อก',      subtitle: 'ตรวจเช็กวัตถุดิบคงเหลือ และแจ้งสิ่งที่ควรติดตามต่อ', icon: '📦' },
  { key: 'cake-stock',     path: '/emp/ops/cake-stock',     title: 'เช็คสต๊อกเค้ก',         subtitle: 'นับเค้กหน้าตู้แยกตามสาขา พร้อมสถานะพร้อมขาย จอง หรือเสียหาย', icon: '🍰' },
  { key: 'supplies-count', path: '/emp/ops/supplies-count', title: 'นับสต๊อกของใช้',        subtitle: 'นับของใช้สิ้นเปลือง เช่น ทิชชู่ น้ำยา และอุปกรณ์หน้าร้าน', icon: '🧴' },
  { key: 'purchase-list',  path: '/emp/ops/purchase-list',  title: 'ใบสั่งซื้อก่อนไปซื้อ', subtitle: 'เตรียมรายการที่ต้องซื้อก่อนออกไปซื้อของจริงหน้าร้าน', icon: '🛒' },
];

const TASK_MAP = Object.fromEntries(TASKS.map((t) => [t.key, t]));

function todayISO() { return new Date().toISOString().slice(0, 10); }

const DEFAULT_DRAFTS = {
  bills: {
    vendor: '', amount: '', category: 'วัตถุดิบ', note: '',
    imageName: '', imagePreviewUrl: '', imageBase64: '', imageMimeType: '',
    aiItems: [], date: '', recordedBy: '',
  },
  production:       { product: '', quantity: '', unit: 'ชิ้น', batch: '', note: '', date: '', recordedBy: '' },
  inventory:        { itemName: '', stockLeft: '', unit: 'กก.', status: 'ปกติ', note: '', date: '', recordedBy: '' },
  'cake-stock':     { branchName: 'สาขากาดน้ำทอง', cakeName: '', available: '', reserved: '', damaged: '', status: 'พร้อมขาย', note: '', date: '', recordedBy: '' },
  'supplies-count': { area: 'หน้าร้าน', itemName: '', count: '', unit: 'ชิ้น', note: '', date: '', recordedBy: '' },
  'purchase-list':  { date: '', recordedBy: '', items: [] },
};

// ─── Gemini Vision ───────────────────────────────────────────────────────────
async function callGeminiVision(base64, mimeType, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
            { text: 'อ่านบิล/ใบเสร็จนี้ ดึงรายการสินค้าทุกรายการ รวมชื่อร้าน วันที่ และยอดรวม ตอบเป็น JSON เท่านั้น: {"vendor":"","date":"","total":0,"items":[{"name":"","qty":1,"unit":"","unitPrice":0}]}' },
          ],
        }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text);
}

// VoiceBtn imported from ../../components/VoiceBtn

// ─── Bill image section (camera + album + AI) ────────────────────────────────
function BillImageSection({ draft, setDraft, geminiKey }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const cameraRef = useRef();
  const albumRef  = useRef();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result.split(',')[1];
      setDraft({ ...draft, imageName: file.name, imagePreviewUrl: previewUrl, imageBase64: b64, imageMimeType: file.type, aiItems: [] });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const parseWithAI = async () => {
    if (!draft.imageBase64 || !geminiKey) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await callGeminiVision(draft.imageBase64, draft.imageMimeType, geminiKey);
      setDraft({
        ...draft,
        vendor: result.vendor || draft.vendor,
        amount: result.total ? String(result.total) : draft.amount,
        aiItems: (result.items || []).map(it => ({
          name: it.name || '', qty: it.qty || 1, unit: it.unit || '', unitPrice: it.unitPrice || 0,
        })),
      });
    } catch (err) {
      setAiError('AI อ่านไม่สำเร็จ: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Field label="รูปบิล">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => cameraRef.current.click()} style={iconBtnStyle}>📷 ถ่ายรูป</button>
        <button type="button" onClick={() => albumRef.current.click()} style={iconBtnStyle}>🖼️ อัลบัม</button>
        {draft.imageBase64 && (
          <button
            type="button" onClick={parseWithAI} disabled={aiLoading || !geminiKey}
            style={{ ...iconBtnStyle, background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' }}
          >
            {aiLoading ? '⏳ อ่านอยู่...' : '🤖 AI อ่านบิล'}
          </button>
        )}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={albumRef}  type="file" accept="image/*"                        style={{ display: 'none' }} onChange={handleFile} />
      {aiError && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{aiError}</div>}
      {!geminiKey && <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4 }}>ตั้งค่า AI Key ในหน้าโปรไฟล์ → ตั้งค่า AI (Gemini) เพื่อใช้ฟีเจอร์นี้</div>}
      {draft.imagePreviewUrl && (
        <div style={{ marginTop: 8 }}>
          <img
            src={draft.imagePreviewUrl} alt="รูปบิล"
            style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, border: '1px solid #eadcc6' }}
          />
          <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4 }}>{draft.imageName}</div>
        </div>
      )}
    </Field>
  );
}

// ─── AI items table ──────────────────────────────────────────────────────────
function AiItemsTable({ items, catalog, onChange }) {
  if (!items || items.length === 0) return null;
  return (
    <Field label={`รายการที่ AI อ่านได้ (${items.length} รายการ)`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9f3eb', color: '#7a5b2b' }}>
              {['ชื่อรายการ', 'จำนวน', 'หน่วย', 'ราคา/หน่วย'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, borderBottom: '1px solid #eadcc6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const matched = catalog?.all?.find(o => o.name.toLowerCase() === it.name.toLowerCase());
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#faf7f2' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0e8dc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SearchSelect
                        options={catalog?.all || []}
                        value={it.name}
                        onChange={v => { const next = [...items]; next[i] = { ...it, name: v }; onChange(next); }}
                        placeholder="ชื่อรายการ..."
                        maxVisible={4}
                      />
                      {matched && <span title="พบในระบบ" style={{ color: '#16a34a', fontSize: 16 }}>✓</span>}
                    </div>
                  </td>
                  <td style={{ padding: '7px 6px', borderBottom: '1px solid #f0e8dc', width: 64 }}>
                    <input type="number" value={it.qty} min="0" step="0.1"
                      onChange={e => { const next = [...items]; next[i] = { ...it, qty: e.target.value }; onChange(next); }}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '7px 6px', borderBottom: '1px solid #f0e8dc', width: 70 }}>
                    <input value={it.unit}
                      onChange={e => { const next = [...items]; next[i] = { ...it, unit: e.target.value }; onChange(next); }}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '7px 6px', borderBottom: '1px solid #f0e8dc', width: 80 }}>
                    <input type="number" value={it.unitPrice} min="0"
                      onChange={e => { const next = [...items]; next[i] = { ...it, unitPrice: e.target.value }; onChange(next); }}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Field>
  );
}

// ─── Purchase List Form (multi-item + category + stock check) ────────────────
function PurchaseListForm({ draft, setDraft, catalog, employeeSessionToken }) {
  const [newItem, setNewItem] = useState({ category: 'วัตถุดิบ', itemName: '', quantity: '', unit: 'กก.', note: '' });
  const [stockInfo, setStockInfo] = useState(null); // null | 'checking' | {stockLeft, unit, status} | {notFound}
  const [stockBlocked, setStockBlocked] = useState(false);

  const categoryOptions = {
    'วัตถุดิบ':          catalog?.ingredients || [],
    'ข้อมูลหลัก':       catalog?.menus || [],
    'ของใช้สิ้นเปลือง': catalog?.materials || [],
  };

  async function checkStock(itemName) {
    if (!itemName.trim() || !employeeSessionToken) { setStockInfo(null); setStockBlocked(false); return; }
    setStockInfo('checking');
    try {
      const { data } = await supabase.rpc('employee_get_ops_entries_v2', {
        p_session_token: employeeSessionToken,
        p_task_key: 'inventory',
        p_limit: 30,
      });
      const match = (data || []).find(e =>
        (e.payload?.itemName || '').toLowerCase() === itemName.trim().toLowerCase()
      );
      if (match) {
        const p = match.payload;
        const qty = parseFloat(p.stockLeft) || 0;
        const blocked = p.status === 'ปกติ' && qty > 5;
        setStockInfo({ stockLeft: p.stockLeft, unit: p.unit, status: p.status });
        setStockBlocked(blocked);
      } else {
        setStockInfo({ notFound: true });
        setStockBlocked(false);
      }
    } catch {
      setStockInfo(null);
      setStockBlocked(false);
    }
  }

  function pickItem(v) {
    setNewItem(ni => ({ ...ni, itemName: v }));
    checkStock(v);
  }

  function addItem() {
    if (!newItem.itemName.trim() || !newItem.quantity) return;
    const item = { ...newItem, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    setDraft(prev => ({ ...prev, items: [...(prev.items || []), item] }));
    setNewItem(ni => ({ ...ni, itemName: '', quantity: '', note: '' }));
    setStockInfo(null);
    setStockBlocked(false);
  }

  function removeItem(id) {
    setDraft(prev => ({ ...prev, items: (prev.items || []).filter(i => i.id !== id) }));
  }

  const opts = categoryOptions[newItem.category] || [];

  return (
    <div style={fieldGridStyle}>
      {/* ── Add item panel ── */}
      <div style={{ background: '#f6f3ee', border: '1px solid #e8dfd4', borderRadius: 20, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#5a3e2b' }}>+ เพิ่มรายการสั่งซื้อ</div>

        <Field label="หมวดหมู่">
          <select value={newItem.category}
            onChange={e => setNewItem(ni => ({ ...ni, category: e.target.value, itemName: '' }))}>
            <option>วัตถุดิบ</option>
            <option>ข้อมูลหลัก</option>
            <option>ของใช้สิ้นเปลือง</option>
          </select>
        </Field>

        <Field label="รายการ">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchSelect options={opts} value={newItem.itemName} onChange={pickItem}
              placeholder="พิมพ์หรือเลือกรายการ..." />
            <VoiceBtn onResult={pickItem} />
          </div>
        </Field>

        {/* stock check feedback */}
        {stockInfo === 'checking' && (
          <div style={{ fontSize: 12, color: '#9a8070' }}>⏳ กำลังเช็คสต๊อก...</div>
        )}
        {stockInfo && stockInfo !== 'checking' && !stockInfo.notFound && (
          <div style={{
            padding: '10px 14px', borderRadius: 14, fontSize: 13,
            background: stockBlocked ? '#fff8e8' : '#ecfdf3',
            border: `1px solid ${stockBlocked ? '#f4dfab' : '#bbe7cf'}`,
            color: stockBlocked ? '#7a5b2b' : '#0d7a46',
          }}>
            {stockBlocked
              ? `⚠️ สต๊อกยังเหลือ ${stockInfo.stockLeft} ${stockInfo.unit} (${stockInfo.status}) — กรุณาไปตรวจสอบของจริงก่อนสั่งซื้อ`
              : `✓ สต๊อก ${stockInfo.stockLeft} ${stockInfo.unit} / ${stockInfo.status}`}
          </div>
        )}
        {stockInfo?.notFound && (
          <div style={{ fontSize: 12, color: '#9a8070' }}>ไม่พบข้อมูลสต๊อกล่าสุดสำหรับรายการนี้</div>
        )}

        <TwoColRow>
          <Field label="จำนวน">
            <input type="number" value={newItem.quantity} min="0" inputMode="decimal"
              onChange={e => setNewItem(ni => ({ ...ni, quantity: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="หน่วย">
            <select value={newItem.unit}
              onChange={e => setNewItem(ni => ({ ...ni, unit: e.target.value }))}>
              <option>กก.</option><option>กรัม</option><option>ลิตร</option>
              <option>ชิ้น</option><option>แพค</option><option>ฟอง</option><option>ลัง</option>
            </select>
          </Field>
        </TwoColRow>

        <Field label="หมายเหตุ">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ flex: 1 }} value={newItem.note}
              onChange={e => setNewItem(ni => ({ ...ni, note: e.target.value }))}
              placeholder="เช่น ซื้อด่วน สำหรับวีคเอนด์" />
            <VoiceBtn onResult={v => setNewItem(ni => ({ ...ni, note: v }))} />
          </div>
        </Field>

        <button
          type="button" onClick={addItem}
          disabled={!newItem.itemName.trim() || !newItem.quantity || stockBlocked}
          style={{
            padding: '12px 16px', borderRadius: 14, fontWeight: 800, fontSize: 15,
            border: 'none', cursor: stockBlocked ? 'not-allowed' : 'pointer',
            background: stockBlocked ? '#e5e7eb' : '#2f241f',
            color: stockBlocked ? '#9a8070' : '#fff',
          }}
        >
          {stockBlocked ? '🚫 ตรวจสอบของก่อน' : '+ เพิ่มรายการ'}
        </button>
      </div>

      {/* ── Items list ── */}
      {(draft.items || []).length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#5a3e2b' }}>
            รายการสั่งซื้อ ({draft.items.length} รายการ)
          </div>
          {draft.items.map((item, i) => (
            <div key={item.id || i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff', border: '1px solid #eadcc6', borderRadius: 16, padding: '12px 14px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#2f241f', fontSize: 14 }}>{item.itemName}</div>
                <div style={{ fontSize: 12, color: '#9a8070', marginTop: 2 }}>
                  {item.category} · {item.quantity} {item.unit}{item.note ? ` · ${item.note}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => removeItem(item.id)}
                style={{ padding: '5px 10px', borderRadius: 10, background: '#fff1f1', border: '1px solid #f3c3c3', color: '#b42318', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function EmpOps() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const taskKey   = getTaskKeyFromPath(location.pathname);

  if (!taskKey) return <OpsHome navigate={navigate} />;
  return <OpsTaskPage taskKey={taskKey} navigate={navigate} />;
}

function OpsHome({ navigate }) {
  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>งานร้านของพนักงาน</div>
        <div style={{ fontWeight: 800, fontSize: 28, color: '#2f241f' }}>JEBAR OPS</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
          ใช้ส่งบิล บันทึกการผลิต เช็กวัตถุดิบ เช็กสต๊อกเค้ก สต๊อกของใช้ และเตรียมรายการซื้อ
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        {TASKS.map((task) => (
          <button key={task.key} onClick={() => navigate(task.path)} style={taskCardButtonStyle}>
            <div style={taskIconStyle}>{task.icon}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#2f241f' }}>{task.title}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>{task.subtitle}</div>
            </div>
            <div style={{ fontSize: 24, color: '#9b7a5a' }}>›</div>
          </button>
        ))}
      </div>

      <div style={versionStyle}>{APP_VERSION}</div>
    </div>
  );
}

function OpsTaskPage({ taskKey, navigate }) {
  const task = TASK_MAP[taskKey];
  const [draft, setDraft, resetDraft] = useTaskDraft(taskKey);
  const [localHistory, saveLocalDraft] = useTaskLocalHistory(taskKey);
  const [catalog, setCatalog] = useState(null);
  const [branches, setBranches] = useState([]);
  const backend = useTaskBackend(taskKey);
  const { orgId } = useAuthStore();

  // Gemini key: env var first, then localStorage fallback
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('hr_gemini_key') || '';

  useEffect(() => {
    fetchOperateCatalog().then(c => { if (c) setCatalog(c); });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    supabase.from('branches').select('id,label').eq('org_id', orgId).then(({ data }) => {
      if (data?.length) setBranches(data);
    });
  }, [orgId]);

  const summary = summarizeDraft(taskKey, draft);

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <button onClick={() => navigate('/emp/ops')} style={{ ...inlineGhostButtonStyle, marginBottom: 14 }}>
          ← กลับหน้าพนักงาน
        </button>
        <div style={{ fontSize: 40, marginBottom: 6 }}>{task.icon}</div>
        <div style={{ fontWeight: 800, fontSize: 34, color: '#2f241f', lineHeight: 1.15 }}>{task.title}</div>
        <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>{task.subtitle}</div>
      </section>

      <div style={pillTabsStyle}>
        {TASKS.map((entry) => (
          <button key={entry.key} onClick={() => navigate(entry.path)} style={entry.key === taskKey ? tabActiveStyle : tabStyle}>
            {shortTabLabel(entry.key)}
          </button>
        ))}
      </div>

      <OpsFormCard
        taskKey={taskKey} draft={draft} setDraft={setDraft} resetDraft={resetDraft}
        saveLocalDraft={saveLocalDraft} backend={backend} summary={summary}
        catalog={catalog} geminiKey={geminiKey} branches={branches}
      />

      <HistorySection
        title="รายการล่าสุดจาก backend"
        subtitle="ส่วนนี้จะแสดงรายการที่บันทึกเข้า Supabase แล้ว"
        items={backend.items} loading={backend.loading} error={backend.error}
        renderItem={(item) => renderHistoryLine(taskKey, item.payload || {})}
        renderExtra={(item) => renderBackendExtra(taskKey, item)}
      />

      <HistorySection
        title="รายการสำรองในเครื่อง"
        subtitle="เก็บไว้กันข้อมูลหายกรณีเน็ตมีปัญหา"
        items={localHistory} loading={false} error=""
        renderItem={(item) => renderHistoryLine(taskKey, item.data)}
        renderExtra={(item) => renderLocalExtra(taskKey, item.data)}
        isLocal
      />

      <div style={versionStyle}>{APP_VERSION}</div>
    </div>
  );
}

function OpsFormCard({ taskKey, draft, setDraft, resetDraft, saveLocalDraft, backend, summary, catalog, geminiKey, branches = [] }) {
  const { employeeSessionToken, employee } = useAuthStore();
  const empName = employee?.name || '';
  const [saving, setSaving]    = useState(false);

  useEffect(() => {
    setDraft(prev => ({
      ...prev,
      date: prev.date || todayISO(),
      recordedBy: prev.recordedBy || empName,
    }));
  }, [empName]);
  const [success, setSuccess]  = useState('');
  const [errMsg, setErrMsg]    = useState('');

  async function submitBackend() {
    if (!hasAnyInput(taskKey, draft) || saving) return;
    setSaving(true); setSuccess(''); setErrMsg('');
    try {
      const payload = sanitizePayload(taskKey, draft);
      const { error } = await supabase.rpc('employee_submit_ops_entry_v2', {
        p_session_token: employeeSessionToken,
        p_task_key: taskKey,
        p_payload: payload,
      });
      if (error) throw error;
      saveLocalDraft(payload);
      await backend.reload();
      setSuccess('บันทึกเข้า backend แล้ว');
    } catch (error) {
      const msg = String(error?.message || '');
      if (msg.includes('employee_submit_ops_entry_v2') || msg.includes('employee_ops_entries')) {
        setErrMsg('ยังไม่ได้รันไฟล์ 25_employee_ops_entries.sql ใน Supabase SQL Editor');
      } else {
        setErrMsg(error?.message || 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setSaving(false);
    }
  }

  const cardTitle = taskKey === 'bills' ? 'บันทึกบิลซื้อของ' : taskKey === 'purchase-list' ? 'ใบสั่งซื้อ' : 'บันทึกข้อมูล';

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#2f241f', marginBottom: 6 }}>{cardTitle}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>เก็บข้อมูลเบื้องต้นลงเข้าระบบร้านหลัก</div>

      {/* ── Standard header: date + recorded-by ── */}
      <TwoColRow>
        <Field label="วันที่">
          <input type="date" value={draft.date || ''} onChange={e => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="ผู้บันทึก">
          <input value={draft.recordedBy || ''} onChange={e => setDraft({ ...draft, recordedBy: e.target.value })} placeholder="ชื่อ" />
        </Field>
      </TwoColRow>

      {taskKey === 'purchase-list'
        ? <PurchaseListForm draft={draft} setDraft={setDraft} catalog={catalog} employeeSessionToken={employeeSessionToken} />
        : renderFormFields(taskKey, draft, setDraft, catalog, geminiKey, branches)
      }

      <div style={summaryPillStyle}>ร่างล่าสุด: {summary}</div>
      {success && <Notice tone="success">{success}</Notice>}
      {errMsg  && <Notice tone="danger">{errMsg}</Notice>}

      <div style={actionRowStyle}>
        <button className="btn btn-primary" onClick={submitBackend}
          disabled={!hasAnyInput(taskKey, draft) || saving} style={{ flex: 1 }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกเข้า backend'}
        </button>
        <button className="btn" onClick={resetDraft} style={{ flex: 1 }}>ล้างฟอร์ม</button>
      </div>
    </div>
  );
}

// ─── Form fields per task ────────────────────────────────────────────────────
function renderFormFields(taskKey, draft, setDraft, catalog, geminiKey, branches = []) {
  switch (taskKey) {
    case 'bills':
      return (
        <div style={fieldGridStyle}>
          <BillImageSection draft={draft} setDraft={setDraft} geminiKey={geminiKey} />

          <AiItemsTable
            items={draft.aiItems}
            catalog={catalog}
            onChange={aiItems => setDraft({ ...draft, aiItems })}
          />

          <Field label="ร้าน / ผู้ขาย">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ flex: 1 }} value={draft.vendor}
                onChange={e => setDraft({ ...draft, vendor: e.target.value })}
                placeholder="เช่น แม็คโคร / ร้านวัตถุดิบ" />
              <VoiceBtn onResult={v => setDraft({ ...draft, vendor: v })} />
            </div>
          </Field>

          <TwoColRow>
            <Field label="ยอดบิล">
              <input value={draft.amount} inputMode="numeric"
                onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="เช่น 1250" />
            </Field>
            <Field label="ประเภท">
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                <option>วัตถุดิบ</option><option>ของใช้</option><option>อุปกรณ์</option><option>อื่นๆ</option>
              </select>
            </Field>
          </TwoColRow>

          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })}
                placeholder="เช่น ซื้อเพิ่มสำหรับพรุ่งนี้" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
        </div>
      );

    case 'production':
      return (
        <div style={fieldGridStyle}>
          <Field label="เมนูที่ผลิต">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchSelect
                options={catalog?.menus || []}
                value={draft.product}
                onChange={v => setDraft({ ...draft, product: v })}
                placeholder="พิมพ์ชื่อเมนู หรือเลือก..."
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, product: v })} />
            </div>
          </Field>
          <TwoColRow>
            <Field label="จำนวน">
              <input value={draft.quantity} inputMode="numeric"
                onChange={e => setDraft({ ...draft, quantity: e.target.value })} placeholder="0" />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                <option>ชิ้น</option><option>ถาด</option><option>ก้อน</option><option>กก.</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="รอบผลิต / batch">
            <input value={draft.batch}
              onChange={e => setDraft({ ...draft, batch: e.target.value })} placeholder="เช่น เช้า / บ่าย / รอบ 1" />
          </Field>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น อบเพิ่มเพราะหน้าร้านขาด" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
        </div>
      );

    case 'inventory':
      return (
        <div style={fieldGridStyle}>
          <Field label="ชื่อวัตถุดิบ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchSelect
                options={catalog?.ingredients || []}
                value={draft.itemName}
                onChange={v => setDraft({ ...draft, itemName: v })}
                placeholder="พิมพ์ชื่อวัตถุดิบ หรือเลือก..."
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, itemName: v })} />
            </div>
          </Field>
          <TwoColRow>
            <Field label="คงเหลือ">
              <input value={draft.stockLeft} inputMode="decimal"
                onChange={e => setDraft({ ...draft, stockLeft: e.target.value })} placeholder="0" />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                <option>กก.</option><option>กรัม</option><option>ลิตร</option><option>ฟอง</option><option>ชิ้น</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="สถานะ">
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option>ปกติ</option><option>ใกล้หมด</option><option>ต้องสั่งเพิ่ม</option><option>มีปัญหา</option>
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น ไข่เหลือพอถึงพรุ่งนี้เช้า" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
        </div>
      );

    case 'cake-stock':
      return (
        <div style={fieldGridStyle}>
          <Field label="สาขาที่เช็ก">
            <select value={draft.branchName} onChange={e => setDraft({ ...draft, branchName: e.target.value })}>
              {branches.length > 0
                ? branches.map(b => <option key={b.id} value={b.label}>{b.label}</option>)
                : [<option key="1">สาขากาดน้ำทอง</option>, <option key="2">สาขากาดกองเก่า</option>]
              }
            </select>
          </Field>
          <Field label="ชื่อเค้ก / เมนู">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchSelect
                options={catalog?.menus || []}
                value={draft.cakeName}
                onChange={v => setDraft({ ...draft, cakeName: v })}
                placeholder="พิมพ์ชื่อเค้ก หรือเลือก..."
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, cakeName: v })} />
            </div>
          </Field>
          <TwoColRow>
            <Field label="พร้อมขาย">
              <input value={draft.available} inputMode="numeric"
                onChange={e => setDraft({ ...draft, available: e.target.value })} placeholder="0" />
            </Field>
            <Field label="จอง">
              <input value={draft.reserved} inputMode="numeric"
                onChange={e => setDraft({ ...draft, reserved: e.target.value })} placeholder="0" />
            </Field>
          </TwoColRow>
          <TwoColRow>
            <Field label="เสียหาย / หมดอายุ">
              <input value={draft.damaged} inputMode="numeric"
                onChange={e => setDraft({ ...draft, damaged: e.target.value })} placeholder="0" />
            </Field>
            <Field label="สถานะ">
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                <option>พร้อมขาย</option><option>ใกล้หมด</option><option>หมด</option>
                <option>ต้องเติมจากครัว</option><option>มีปัญหา</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="หมายเหตุ">
            <textarea rows={3} value={draft.note}
              onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น สาขานี้ต้องเติมเค้กส้ม 2 ชิ้น" />
          </Field>
        </div>
      );

    case 'supplies-count':
      return (
        <div style={fieldGridStyle}>
          <Field label="จุดที่นับ">
            <select value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })}>
              <option>หน้าร้าน</option><option>ครัว</option><option>สต๊อกหลังร้าน</option><option>ล้างจาน</option>
            </select>
          </Field>
          <Field label="รายการของใช้">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchSelect
                options={catalog?.materials || []}
                value={draft.itemName}
                onChange={v => setDraft({ ...draft, itemName: v })}
                placeholder="พิมพ์ชื่อของใช้ หรือเลือก..."
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, itemName: v })} />
            </div>
          </Field>
          <TwoColRow>
            <Field label="จำนวนคงเหลือ">
              <input value={draft.count} inputMode="numeric"
                onChange={e => setDraft({ ...draft, count: e.target.value })} placeholder="0" />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                <option>ชิ้น</option><option>แพค</option><option>ขวด</option><option>ลัง</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="หมายเหตุ">
            <textarea rows={3} value={draft.note}
              onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น เหลือน้อยมาก ควรซื้อวันนี้" />
          </Field>
        </div>
      );

    case 'purchase-list':
      return null; // handled by PurchaseListForm in OpsFormCard

    default:
      return null;
  }
}

// ─── History sections ─────────────────────────────────────────────────────────
function HistorySection({ title, subtitle, items, loading, error, renderItem, renderExtra, isLocal = false }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 18, color: '#2f241f', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{subtitle}</div>
      {error ? <Notice tone="warning">{error}</Notice> : null}
      {loading ? (
        <EmptyState>กำลังโหลดรายการล่าสุด...</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>{isLocal ? 'ยังไม่มีรายการที่บันทึกไว้ในเครื่อง' : 'ยังไม่มีรายการที่ส่งเข้า backend'}</EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} style={historyCardStyle}>
              <div style={{ fontWeight: 700, color: '#2f241f' }}>{renderItem(item)}</div>
              {renderExtra ? renderExtra(item) : null}
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                บันทึกเมื่อ {formatDateTime(isLocal ? item.savedAt : item.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

function TwoColRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>{children}</div>;
}

function Notice({ tone = 'warning', children }) {
  const tones = {
    success: { background: '#ecfdf3', border: '#bbe7cf', color: '#0d7a46' },
    warning: { background: '#fff8e8', border: '#f4dfab', color: '#7a5b2b' },
    danger:  { background: '#fff1f1', border: '#f3c3c3', color: '#b42318' },
  };
  const p = tones[tone] || tones.warning;
  return (
    <div style={{ background: p.background, border: `1px solid ${p.border}`, color: p.color, borderRadius: 16, padding: '12px 14px', fontSize: 13 }}>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={emptyStateStyle}>{children}</div>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useTaskDraft(taskKey) {
  const storageKey = `${STORAGE_PREFIX}${taskKey}`;
  const initial = DEFAULT_DRAFTS[taskKey];
  const [draft, setDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const stored = raw ? { ...initial, ...JSON.parse(raw) } : { ...initial };
      if (!stored.date) stored.date = todayISO();
      return stored;
    } catch { return { ...initial, date: todayISO() }; }
  });

  useEffect(() => {
    const toSave = { ...draft };
    // strip non-serializable / large fields
    delete toSave.imagePreviewUrl;
    delete toSave.imageBase64;
    delete toSave.imageMimeType;
    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, [storageKey, draft]);

  function resetDraft() {
    setDraft(initial);
    localStorage.setItem(storageKey, JSON.stringify(initial));
  }

  return [draft, setDraft, resetDraft];
}

function useTaskLocalHistory(taskKey) {
  const storageKey = `${STORAGE_PREFIX}${taskKey}_history`;
  const [items, setItems] = useState(() => {
    try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  });

  function saveLocalDraft(payload) {
    const next = [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, savedAt: new Date().toISOString(), data: payload },
      ...items,
    ].slice(0, HISTORY_LIMIT);
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  return [items, saveLocalDraft];
}

function useTaskBackend(taskKey) {
  const { employeeSessionToken } = useAuthStore();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  async function reload() {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('employee_get_ops_entries_v2', {
        p_session_token: employeeSessionToken,
        p_task_key: taskKey,
        p_limit: HISTORY_LIMIT,
      });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('employee_get_ops_entries_v2') || msg.includes('employee_ops_entries')) {
        setError('ส่วน backend ของ OPS ยังไม่พร้อม ใช้รายการสำรองในเครื่องไปก่อน');
      } else {
        setError(err?.message || 'โหลดรายการล่าสุดไม่สำเร็จ');
      }
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [employeeSessionToken, taskKey]);

  return { items, loading, error, reload };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTaskKeyFromPath(pathname) {
  if (!pathname.startsWith('/emp/ops')) return null;
  const slug = pathname.replace('/emp/ops', '').replace(/^\//, '');
  if (!slug) return null;
  return TASK_MAP[slug] ? slug : null;
}

function sanitizePayload(taskKey, draft) {
  const p = { ...draft };
  if (taskKey === 'bills') {
    delete p.imagePreviewUrl;
    delete p.imageBase64;
    delete p.imageMimeType;
  }
  return p;
}

function hasAnyInput(taskKey, draft) {
  if (taskKey === 'bills') return !!(draft.vendor || draft.amount || draft.imageName);
  if (taskKey === 'purchase-list') return (draft.items?.length || 0) > 0;
  const { date, recordedBy, ...rest } = draft;
  return Object.values(rest).some(v => v && !Array.isArray(v) && typeof v !== 'object' && String(v).trim() !== '');
}

function summarizeDraft(taskKey, draft) {
  switch (taskKey) {
    case 'bills':         return `${draft.vendor||'-'} / ${draft.amount||'-'} บาท / ${draft.category||'วัตถุดิบ'}${draft.aiItems?.length ? ` / AI ${draft.aiItems.length} รายการ` : ''}`;
    case 'production':    return `${draft.product||'-'} / ${draft.quantity||'0'} ${draft.unit||''} / ${draft.batch||'-'}`;
    case 'inventory':     return `${draft.itemName||'-'} / ${draft.stockLeft||'0'} ${draft.unit||''} / ${draft.status||'-'}`;
    case 'cake-stock':    return `${draft.branchName||'-'} / ${draft.cakeName||'-'} / พร้อมขาย ${draft.available||'0'} จอง ${draft.reserved||'0'} เสีย ${draft.damaged||'0'}`;
    case 'supplies-count':return `${draft.area||'-'} / ${draft.itemName||'-'} / ${draft.count||'0'} ${draft.unit||''}`;
    case 'purchase-list': return `${draft.recordedBy||'-'} / ${draft.date||'-'} / ${draft.items?.length||0} รายการ`;
    default:              return '-';
  }
}

function renderHistoryLine(taskKey, payload) {
  switch (taskKey) {
    case 'bills':         return `${payload.vendor||'-'} / ${payload.amount||'-'} บาท / ${payload.category||'วัตถุดิบ'}`;
    case 'production':    return `${payload.product||'-'} / ${payload.quantity||'0'} ${payload.unit||''} / ${payload.batch||'-'}`;
    case 'inventory':     return `${payload.itemName||'-'} / ${payload.stockLeft||'0'} ${payload.unit||''} / ${payload.status||'-'}`;
    case 'cake-stock':    return `${payload.branchName||'-'} / ${payload.cakeName||'-'} / พร้อมขาย ${payload.available||'0'} จอง ${payload.reserved||'0'} เสีย ${payload.damaged||'0'} / ${payload.status||'-'}`;
    case 'supplies-count':return `${payload.area||'-'} / ${payload.itemName||'-'} / ${payload.count||'0'} ${payload.unit||''}`;
    case 'purchase-list': return `${payload.recordedBy||'-'} / ${payload.date||'-'} / ${payload.items?.length||0} รายการ`;
    default:              return '-';
  }
}

function renderBackendExtra(taskKey, item) {
  if (taskKey === 'purchase-list') {
    const items = (item.payload?.items || []);
    if (!items.length) return null;
    return (
      <div style={{ fontSize: 12, color: '#6d5a3f', marginTop: 4 }}>
        {items.slice(0, 3).map(i => `${i.itemName} ${i.quantity}${i.unit}`).join(' · ')}
        {items.length > 3 ? ` +${items.length - 3} รายการ` : ''}
      </div>
    );
  }
  if (taskKey !== 'bills') return null;
  const p = item.payload || {};
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
      {item.image_name && <div style={{ fontSize: 12, color: '#7a5b2b' }}>รูปที่แนบ: {item.image_name}</div>}
      {p.aiItems?.length > 0 && (
        <div style={{ fontSize: 12, color: '#6d5a3f' }}>AI อ่านได้ {p.aiItems.length} รายการ: {p.aiItems.slice(0,3).map(i=>i.name).join(', ')}{p.aiItems.length>3?'...':''}</div>
      )}
    </div>
  );
}

function renderLocalExtra(taskKey, payload) {
  if (taskKey === 'purchase-list') {
    const items = payload?.items || [];
    if (!items.length) return null;
    return (
      <div style={{ fontSize: 12, color: '#6d5a3f', marginTop: 4 }}>
        {items.slice(0, 3).map(i => `${i.itemName} ${i.quantity}${i.unit}`).join(' · ')}
        {items.length > 3 ? ` +${items.length - 3} รายการ` : ''}
      </div>
    );
  }
  if (taskKey !== 'bills') return null;
  const items = payload?.aiItems;
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
      {payload?.imageName && <div style={{ fontSize: 12, color: '#7a5b2b' }}>รูปที่แนบ: {payload.imageName}</div>}
      {items?.length > 0 && (
        <div style={{ fontSize: 12, color: '#6d5a3f' }}>AI อ่านได้ {items.length} รายการ: {items.slice(0,3).map(i=>i.name).join(', ')}{items.length>3?'...':''}</div>
      )}
    </div>
  );
}

function shortTabLabel(taskKey) {
  const m = { bills:'ถ่ายบิล', production:'ผลิตขนม', inventory:'วัตถุดิบ', 'cake-stock':'สต๊อกเค้ก', 'supplies-count':'ของใช้', 'purchase-list':'ใบซื้อ' };
  return m[taskKey] || taskKey;
}

function formatDateTime(value) {
  try { return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return value; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const pageStyle         = { padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 };
const heroCardStyle     = { padding: 18, borderRadius: 26, background: 'linear-gradient(180deg,rgba(255,249,241,.96) 0%,rgba(255,255,255,.96) 100%)', border: '1px solid rgba(197,162,117,.24)' };
const cardStyle         = { padding: 18, borderRadius: 24, display: 'grid', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)' };
const taskCardButtonStyle = { display: 'grid', gridTemplateColumns: '64px 1fr 22px', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, color: 'inherit', background: '#fff', border: '1px solid #eadcc6', cursor: 'pointer' };
const taskIconStyle     = { width: 54, height: 54, borderRadius: 18, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 };
const fieldGridStyle    = { display: 'grid', gap: 12 };
const actionRowStyle    = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const summaryPillStyle  = { background: '#f6efe3', border: '1px solid #eadcc6', borderRadius: 16, padding: '12px 14px', fontSize: 13, color: '#7a5b2b' };
const emptyStateStyle   = { background: '#faf7f2', border: '1px dashed #dccfbf', borderRadius: 18, padding: '18px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 };
const historyCardStyle  = { background: '#faf7f2', border: '1px solid #eadcc6', borderRadius: 18, padding: '12px 14px' };
const pillTabsStyle     = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const tabStyle          = { borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const tabActiveStyle    = { ...tabStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' };
const inlineGhostButtonStyle = { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, padding: 0, cursor: 'pointer' };
const versionStyle      = { alignSelf: 'flex-end', fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,.92)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 8px' };
const iconBtnStyle      = { padding: '9px 14px', borderRadius: 12, border: '1.5px solid #e0d4c0', background: '#faf7f2', color: '#5a3e2b', cursor: 'pointer', fontSize: 14, fontWeight: 700 };
