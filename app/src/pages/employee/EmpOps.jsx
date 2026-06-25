import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../lib/version';
import SearchSelect from '../../components/SearchSelect';
import VoiceBtn from '../../components/VoiceBtn';
import PhotoSection from '../../components/PhotoSection';
import { fetchOperateCatalog, clearCatalogCache, OPS_CONFIG_KEY, getLastCatalogError } from '../../lib/operateCatalog';
import { uploadOpsPhotos, uploadSingleBase64 } from '../../lib/opsStorage';
import CakeStockPage from './CakeStockPage';

const STORAGE_PREFIX = 'hr_emp_ops_';
const HISTORY_LIMIT = 8;

function catalogNoDataMsg(catalog, listEmpty) {
  const err = getLastCatalogError();
  if (err === 'no_config') return 'แอดมินยังไม่ได้ตั้งค่าเชื่อม OPS —';
  if (err && err.startsWith('http')) return `เชื่อม OPS ไม่สำเร็จ (${err.replace('http_', 'HTTP ')}) —`;
  if (err === 'network') return 'ไม่สามารถเชื่อมต่อ OPS ได้ —';
  if (err === 'no_data') return 'ยังไม่มีข้อมูลใน Supabase —';
  if (!catalog) return 'ยังไม่ได้เชื่อมฐานข้อมูล OPS —';
  if (listEmpty) return 'ยังไม่มีรายการในระบบ Operate —';
  return '';
}

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
  production:       { product: '', quantity: '', unit: 'ชิ้น', batch: '', note: '', date: '', recordedBy: '', photos: [] },
  inventory:        { itemName: '', stockLeft: '', unit: 'กก.', status: 'ปกติ', note: '', date: '', recordedBy: '', photos: [] },
  'cake-stock':     { branchName: 'สาขากาดน้ำทอง', cakeName: '', available: '', reserved: '', damaged: '', status: 'พร้อมขาย', note: '', date: '', recordedBy: '', photos: [] },
  'supplies-count': { area: 'หน้าร้าน', itemName: '', count: '', unit: 'ชิ้น', status: 'ปกติ', note: '', date: '', recordedBy: '', photos: [] },
  'purchase-list':  { date: '', recordedBy: '', items: [], photos: [] },
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
  const [lightbox, setLightbox] = useState(false);
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

  const clearImage = () => {
    setDraft({ ...draft, imageName: '', imagePreviewUrl: '', imageBase64: '', imageMimeType: '', aiItems: [] });
  };

  const parseWithAI = async () => {
    if (!draft.imageBase64 || !geminiKey) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await callGeminiVision(draft.imageBase64, draft.imageMimeType, geminiKey);
      let billDate = draft.date;
      if (result.date) {
        try {
          const d = new Date(result.date);
          if (!isNaN(d.getTime()) && Math.abs(d.getFullYear() - new Date().getFullYear()) <= 1) {
            billDate = d.toISOString().slice(0, 10);
          }
        } catch {}
      }
      setDraft({
        ...draft,
        vendor: result.vendor || draft.vendor,
        amount: result.total ? String(result.total) : draft.amount,
        date: billDate,
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
        {draft.imagePreviewUrl && (
          <button type="button" onClick={clearImage}
            style={{ ...iconBtnStyle, background: '#fff1f1', borderColor: '#fca5a5', color: '#b42318' }}>
            🗑 ลบรูป
          </button>
        )}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={albumRef}  type="file" accept="image/*"                        style={{ display: 'none' }} onChange={handleFile} />
      {aiError && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{aiError}</div>}
      {!geminiKey && <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4 }}>ตั้งค่า AI Key ในหน้าโปรไฟล์ → ตั้งค่า AI (Gemini) เพื่อใช้ฟีเจอร์นี้</div>}
      {draft.imagePreviewUrl && (
        <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
          <img
            src={draft.imagePreviewUrl} alt="รูปบิล"
            onClick={() => setLightbox(true)}
            style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 12, border: '1px solid #eadcc6', cursor: 'zoom-in', display: 'block' }}
          />
          <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4 }}>{draft.imageName} · แตะรูปเพื่อดูเต็ม</div>
        </div>
      )}
      {lightbox && draft.imagePreviewUrl && (
        <div onClick={() => setLightbox(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={draft.imagePreviewUrl} alt="รูปบิล" onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '86vh', borderRadius: 18, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
            <button onClick={e => { e.stopPropagation(); clearImage(); setLightbox(false); }} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 12, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🗑 ลบ</button>
            <button onClick={() => setLightbox(false)} style={{ background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff', borderRadius: 12, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✕ ปิด</button>
          </div>
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
function PurchaseListForm({ draft, setDraft, catalog, catalogReady, catalogRetrying = false, reloadCatalog, employeeSessionToken }) {
  const [newItem, setNewItem] = useState({ category: 'วัตถุดิบ', itemName: '', quantity: '', unit: 'กก.', priority: 'วันนี้', note: '' });
  const [stockInfo, setStockInfo] = useState(null); // null | 'checking' | {stockLeft, unit, status} | {notFound}
  const [stockBlocked, setStockBlocked] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!employeeSessionToken) return;
    Promise.all([
      supabase.rpc('employee_get_ops_entries_v2', { p_session_token: employeeSessionToken, p_task_key: 'inventory', p_limit: 20 }),
      supabase.rpc('employee_get_ops_entries_v2', { p_session_token: employeeSessionToken, p_task_key: 'supplies-count', p_limit: 20 }),
    ]).then(([invRes, supRes]) => {
      const allRows = [...(invRes.data || []), ...(supRes.data || [])];
      const alertRows = allRows.filter(e => {
        const s = e.payload?.status;
        return s && s !== 'ปกติ' && s !== 'พร้อมขาย';
      }).sort((a, b) => {
        const urgentStatuses = new Set(['ต้องสั่งเพิ่ม', 'มีปัญหา', 'หมดแล้ว']);
        return (urgentStatuses.has(b.payload?.status) ? 1 : 0) - (urgentStatuses.has(a.payload?.status) ? 1 : 0);
      });
      const seen = new Set();
      const unique = alertRows.filter(e => {
        const name = e.payload?.itemName;
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      }).slice(0, 8);
      setSuggestions(unique);
    }).catch(() => {});
  }, [employeeSessionToken]);

  // Pre-fill from URL params (e.g. coming from inventory/supplies quick-add shortcut)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const suggestName = params.get('suggest');
    if (!suggestName) return;
    const validCategories = new Set(['วัตถุดิบ', 'ข้อมูลหลัก', 'ของใช้สิ้นเปลือง']);
    const catParam = params.get('cat');
    const category = catParam && validCategories.has(catParam) ? catParam : 'วัตถุดิบ';
    setNewItem(ni => ({
      ...ni,
      category,
      itemName: suggestName,
      unit: params.get('unit') || ni.unit,
      priority: params.get('urgent') === '1' ? 'วันนี้' : 'พรุ่งนี้',
    }));
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const categoryOptions = {
    'วัตถุดิบ':          catalog?.ingredients || [],
    'ข้อมูลหลัก':       catalog?.menus || [],
    'ของใช้สิ้นเปลือง': catalog?.materials || [],
  };

  async function checkStock(itemName) {
    if (!itemName.trim() || !employeeSessionToken) { setStockInfo(null); setStockBlocked(false); return; }
    setStockInfo('checking');
    try {
      const [invRes, supRes] = await Promise.all([
        supabase.rpc('employee_get_ops_entries_v2', { p_session_token: employeeSessionToken, p_task_key: 'inventory', p_limit: 30 }),
        supabase.rpc('employee_get_ops_entries_v2', { p_session_token: employeeSessionToken, p_task_key: 'supplies-count', p_limit: 30 }),
      ]);
      const allData = [...(invRes.data || []), ...(supRes.data || [])];
      const match = allData.find(e =>
        (e.payload?.itemName || '').toLowerCase() === itemName.trim().toLowerCase()
      );
      if (match) {
        const p = match.payload;
        const qty = parseFloat(p.stockLeft || p.count) || 0;
        const normalStatus = match.task_key === 'supplies-count' ? 'ปกติ' : 'ปกติ';
        const blocked = p.status === normalStatus && qty > 5;
        setStockInfo({ stockLeft: p.stockLeft || p.count, unit: p.unit, status: p.status });
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

  function applySuggestion(item) {
    const p = item.payload || {};
    const isSupplies = item.task_key === 'supplies-count';
    const category = isSupplies ? 'ของใช้สิ้นเปลือง' : 'วัตถุดิบ';
    const urgentStatuses = new Set(['ต้องสั่งเพิ่ม', 'มีปัญหา', 'หมดแล้ว']);
    const priority = urgentStatuses.has(p.status) ? 'วันนี้' : 'พรุ่งนี้';
    const stockLeft = p.stockLeft || p.count;
    setNewItem(ni => ({ ...ni, category, itemName: p.itemName || '', unit: p.unit || ni.unit, priority }));
    setStockInfo({ stockLeft, unit: p.unit, status: p.status });
    setStockBlocked(p.status === 'ปกติ' && parseFloat(stockLeft) > 5);
  }

  function pickItem(v) {
    const catList = categoryOptions[newItem.category] || [];
    const catalogItem = catList.find(i => i.name === v);
    setNewItem(ni => ({ ...ni, itemName: v, ...(catalogItem?.unit ? { unit: catalogItem.unit } : {}) }));
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
      {/* ── Low-stock suggestions ── */}
      {suggestions.length > 0 && (
        <div style={{ background: '#fff8e8', border: '1px solid #f4dfab', borderRadius: 18, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#7a5b2b', marginBottom: 10 }}>
            ⚡ แนะนำจากสต๊อกต้องติดตาม ({suggestions.length} รายการ)
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {suggestions.map(item => {
              const p = item.payload || {};
              const isSupplies = item.task_key === 'supplies-count';
              const urgentStatuses = new Set(['ต้องสั่งเพิ่ม', 'มีปัญหา', 'หมดแล้ว']);
              const isUrgent = urgentStatuses.has(p.status);
              const stockLeft = p.stockLeft || p.count;
              const alreadyAdded = (draft.items || []).some(i => i.itemName.toLowerCase() === (p.itemName || '').toLowerCase());
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', borderRadius: 12, border: '1px solid #f4dfab' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#2f241f' }}>
                      {isSupplies ? '🧴 ' : '📦 '}{p.itemName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      เหลือ {stockLeft} {p.unit}
                      <span style={{ marginLeft: 6, fontWeight: 700, color: isUrgent ? '#b42318' : '#7a5b2b' }}>{p.status}</span>
                    </div>
                  </div>
                  {alreadyAdded ? (
                    <span style={{ fontSize: 12, color: '#0d7a46', fontWeight: 700, flexShrink: 0 }}>✓ เพิ่มแล้ว</span>
                  ) : (
                    <button type="button" onClick={() => applySuggestion(item)} style={{ padding: '6px 12px', borderRadius: 10, border: '1.5px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      + เลือก
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              placeholder={!catalogReady ? 'กำลังโหลด...' : (!catalog ? 'พิมพ์ชื่อรายการ...' : 'พิมพ์หรือเลือกรายการ...')} />
            <VoiceBtn onResult={pickItem} />
          </div>
          {catalogReady && (!catalog || opts.length === 0) && (
            <div style={{ fontSize: 12, color: '#9a8070', marginTop: 6, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>💡 {catalogNoDataMsg(catalog, opts.length === 0)} พิมพ์ชื่อรายการได้เลย</span>
              {catalogRetrying && <span style={{ color: '#0369a1', fontSize: 11 }}>⏳ กำลังลองเชื่อมต่อ...</span>}
              {reloadCatalog && <button type="button" onClick={reloadCatalog} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>🔄 ลองใหม่</button>}
            </div>
          )}
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" style={{ flex: 1 }} value={newItem.quantity} min="0" inputMode="decimal"
                onChange={e => setNewItem(ni => ({ ...ni, quantity: e.target.value }))} placeholder="0" />
              <VoiceBtn onResult={v => setNewItem(ni => ({ ...ni, quantity: v.replace(/[^0-9.]/g, '') }))} size={36} />
            </div>
          </Field>
          <Field label="หน่วย">
            {(() => {
              const presets = ['กก.', 'กรัม', 'ลิตร', 'มล.', 'ชิ้น', 'แพค', 'ฟอง', 'ลัง', 'ขวด', 'ถุง'];
              const extra = newItem.unit && !presets.includes(newItem.unit) ? newItem.unit : null;
              return (
                <select value={newItem.unit} onChange={e => setNewItem(ni => ({ ...ni, unit: e.target.value }))}>
                  {extra && <option value={extra}>{extra}</option>}
                  {presets.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              );
            })()}
          </Field>
        </TwoColRow>

        <Field label="ความด่วน">
          <select value={newItem.priority}
            onChange={e => setNewItem(ni => ({ ...ni, priority: e.target.value }))}>
            <option>วันนี้</option>
            <option>พรุ่งนี้</option>
            <option>ภายในสัปดาห์</option>
            <option>ไม่ด่วน</option>
          </select>
        </Field>

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
                  {item.category} · {item.quantity} {item.unit}
                  {item.priority && item.priority !== 'ไม่ด่วน' && (
                    <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: item.priority === 'วันนี้' ? '#fff3cd' : '#f6f3ee',
                      color: item.priority === 'วันนี้' ? '#7a5b2b' : '#9a8070' }}>
                      ⏰ {item.priority}
                    </span>
                  )}
                  {item.note ? ` · ${item.note}` : ''}
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

      {/* ── Photos ── */}
      <PhotoSection
        photos={draft.photos || []}
        onChange={photos => setDraft(prev => ({ ...prev, photos }))}
        label="รูปประกอบใบสั่งซื้อ (ไม่บังคับ)"
      />
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function EmpOps() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const taskKey   = getTaskKeyFromPath(location.pathname);

  if (!taskKey) return <OpsHome navigate={navigate} />;
  if (taskKey === 'cake-stock') return <CakeStockPage navigate={navigate} />;
  return <OpsTaskPage taskKey={taskKey} navigate={navigate} />;
}

function hasDraftData(taskKey) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${taskKey}`);
    if (!raw) return false;
    const s = JSON.parse(raw);
    switch (taskKey) {
      case 'bills':          return !!(s.vendor || s.amount || s.imageName);
      case 'purchase-list':  return (s.items?.length || 0) > 0;
      case 'production':     return !!(s.product || s.quantity || s.batch || s.note);
      case 'inventory':      return !!(s.itemName || s.stockLeft || s.note);
      case 'cake-stock':     return !!(s.cakeName || s.available || s.reserved || s.damaged || s.note);
      case 'supplies-count': return !!(s.itemName || s.count || s.note);
      default:               return false;
    }
  } catch { return false; }
}

function OpsHome({ navigate }) {
  const { employeeSessionToken } = useAuthStore();
  const [todayCounts, setTodayCounts] = useState({});
  const [todayAlerts, setTodayAlerts] = useState({});

  useEffect(() => {
    if (!employeeSessionToken) return;
    const today = new Date().toISOString().slice(0, 10);
    Promise.all(
      TASKS.map(task =>
        supabase.rpc('employee_get_ops_entries_v2', {
          p_session_token: employeeSessionToken,
          p_task_key: task.key,
          p_limit: 10,
        }).then(({ data }) => {
          const todayEntries = (data || []).filter(e => (e.created_at || '').startsWith(today));
          const hasAlert =
            ((task.key === 'inventory' || task.key === 'supplies-count') && todayEntries.some(e => e.payload?.status && e.payload.status !== 'ปกติ')) ||
            (task.key === 'cake-stock' && todayEntries.some(e => e.payload?.status && e.payload.status !== 'พร้อมขาย'));
          return { key: task.key, count: todayEntries.length, hasAlert };
        })
      )
    ).then(results => {
      const counts = {};
      const alerts = {};
      results.forEach(r => { counts[r.key] = r.count; alerts[r.key] = r.hasAlert; });
      setTodayCounts(counts);
      setTodayAlerts(alerts);
    }).catch(() => {});
  }, [employeeSessionToken]);

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>งานร้านของพนักงาน</div>
        <div style={{ fontWeight: 800, fontSize: 28, color: '#2f241f' }}>LUCID OPS</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
          ใช้ส่งบิล บันทึกการผลิต เช็กวัตถุดิบ เช็กสต๊อกเค้ก สต๊อกของใช้ และเตรียมรายการซื้อ
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        {TASKS.map((task) => {
          const todayCount = todayCounts[task.key] || 0;
          const hasDraft = hasDraftData(task.key);
          const hasAlert = todayAlerts[task.key];
          return (
            <button key={task.key} onClick={() => navigate(task.path)} style={taskCardButtonStyle}>
              <div style={taskIconStyle}>{task.icon}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#2f241f', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {task.title}
                  {todayCount > 0 && (
                    <span style={{ background: '#ecfdf3', color: '#0d7a46', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                      ✓ {todayCount}
                    </span>
                  )}
                  {hasAlert && (
                    <span style={{ background: '#fff1f1', color: '#b42318', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      ⚠️ ต้องติดตาม
                    </span>
                  )}
                  {hasDraft && (
                    <span style={{ background: '#fff8e8', color: '#7a5b2b', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                      • ร่างค้าง
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>{task.subtitle}</div>
              </div>
              <div style={{ fontSize: 24, color: '#9b7a5a' }}>›</div>
            </button>
          );
        })}
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
  const [catalogReady, setCatalogReady] = useState(false); // true once fetch attempt completes
  const [catalogRetrying, setCatalogRetrying] = useState(false); // true while auto-retrying
  const [branches, setBranches] = useState([]);
  const backend = useTaskBackend(taskKey);
  const { orgId, employeeSessionToken: taskPageToken } = useAuthStore();

  // Gemini key: env var first, then localStorage fallback
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('hr_gemini_key') || '';

  async function reloadCatalog() {
    clearCatalogCache();
    setCatalogReady(false);
    // Re-fetch org settings so admin's just-saved ops_config reaches sessionStorage
    try {
      const { data } = await supabase.rpc('employee_home_data_v2', { p_session_token: taskPageToken });
      const cfg = data?.settings?.rules?.ops_config;
      if (cfg?.url && cfg?.key) {
        try { sessionStorage.setItem(OPS_CONFIG_KEY, JSON.stringify({ url: cfg.url, key: cfg.key })); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    const c = await fetchOperateCatalog();
    if (c) setCatalog(c);
    setCatalogReady(true);
  }

  useEffect(() => {
    let alive = true;
    // Retry up to 4 times (at 3s, 7s, 13s, 21s) while EmpShell is still loading ops_config
    const RETRY_DELAYS = [3000, 4000, 6000, 8000];
    let retryIdx = 0;
    function tryFetch() {
      fetchOperateCatalog().then(c => {
        if (!alive) return;
        if (c) { setCatalog(c); setCatalogReady(true); setCatalogRetrying(false); return; }
        if (retryIdx === 0) setCatalogReady(true); // show UI after first attempt
        if (retryIdx < RETRY_DELAYS.length) {
          setCatalogRetrying(true);
          setTimeout(() => { if (alive) { retryIdx++; tryFetch(); } }, RETRY_DELAYS[retryIdx]);
        } else {
          setCatalogRetrying(false);
        }
      });
    }
    tryFetch();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    supabase.from('branches').select('id,label').eq('org_id', orgId).then(({ data }) => {
      if (data?.length) {
        setBranches(data);
        if (taskKey === 'cake-stock') {
          setDraft(prev => {
            const hasMatch = data.some(b => b.label === prev.branchName);
            return hasMatch ? prev : { ...prev, branchName: data[0].label };
          });
        }
      }
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

      {catalogReady && catalog && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#0d7a46', background: '#ecfdf3', border: '1px solid #bbe7cf', borderRadius: 99, padding: '4px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ✓ OPS: {catalog.menus?.length || 0} เมนู · {catalog.ingredients?.length || 0} วัตถุดิบ · {catalog.materials?.length || 0} วัสดุ
          </span>
        </div>
      )}
      {catalogRetrying && !catalog && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#0369a1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '4px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ⏳ กำลังเชื่อมต่อ OPS...
          </span>
        </div>
      )}

      <OpsFormCard
        taskKey={taskKey} draft={draft} setDraft={setDraft} resetDraft={resetDraft}
        saveLocalDraft={saveLocalDraft} backend={backend} summary={summary}
        catalog={catalog} catalogReady={catalogReady} catalogRetrying={catalogRetrying} reloadCatalog={reloadCatalog} geminiKey={geminiKey} branches={branches}
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

function CakeStockBatchForm({ catalog, catalogReady, catalogRetrying, reloadCatalog, draft, setDraft, branches, employeeSessionToken, backend, saveLocalDraft, todayCakeLog, setCakeRefreshTick }) {
  const buildRows = (menus) => (menus || []).map(m => ({
    cakeName: m.name, imageUrl: m.imageUrl || null,
    category: m.category || '', priceStore: m.priceStore || 0,
    included: false, available: 0, reserved: 0, damaged: 0,
  }));

  const [rows, setRows] = useState(() => buildRows(catalog?.menus));
  const [catTab, setCatTab] = useState('all');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [warnDups, setWarnDups] = useState([]);
  const [dupMode, setDupMode] = useState(false);

  useEffect(() => {
    setRows(buildRows(catalog?.menus));
  }, [(catalog?.menus || []).map(m => m.name).join('|')]);

  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))];
  const includedRows = rows.filter(r => r.included);
  const includedCount = includedRows.length;
  const totalQty = includedRows.reduce((s, r) => s + (r.available || 0), 0);

  const displayRows = catTab === 'all' ? rows
    : catTab === 'selected' ? rows.filter(r => r.included)
    : rows.filter(r => r.category === catTab);

  function updateRow(cakeName, field, val) {
    setRows(prev => prev.map(r => r.cakeName === cakeName ? { ...r, [field]: val } : r));
  }
  function toggleInclude(cakeName) {
    setRows(prev => prev.map(r => r.cakeName === cakeName ? { ...r, included: !r.included } : r));
  }

  function buildLogMap() {
    const map = {};
    todayCakeLog.forEach(c => { if (!map[c.cakeName]) map[c.cakeName] = c; });
    return map;
  }

  function findDups(toSave) {
    const logMap = buildLogMap();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return toSave
      .filter(row => {
        const entry = logMap[row.cakeName];
        if (!entry) return false;
        const [h, m] = entry.time.split(':').map(Number);
        return Math.abs(nowMin - (h * 60 + m)) < 30;
      })
      .map(row => ({ cakeName: row.cakeName, time: logMap[row.cakeName].time }));
  }

  async function doSave(toSave) {
    setSaving(true); setErrMsg(''); setSuccess('');
    let saved = 0;
    try {
      for (const row of toSave) {
        const avail = row.available || 0;
        const dmg = row.damaged || 0;
        const autoStatus = avail === 0 ? 'หมด' : (avail <= 2 || dmg > 0) ? 'ใกล้หมด' : 'พร้อมขาย';
        const payload = {
          branchName: draft.branchName, cakeName: row.cakeName,
          available: String(avail), reserved: String(row.reserved || 0), damaged: String(dmg),
          status: autoStatus, note: '', date: draft.date, recordedBy: draft.recordedBy,
        };
        const { error } = await supabase.rpc('employee_submit_ops_entry_v2', {
          p_session_token: employeeSessionToken, p_task_key: 'cake-stock', p_payload: payload,
        });
        if (error) throw error;
        saveLocalDraft(payload);
        saved++;
      }
      await backend.reload();
      setCakeRefreshTick(t => t + 1);
      setSuccess(`บันทึก ${saved} รายการเข้า backend แล้ว`);
      setRows(prev => prev.map(r => ({ ...r, included: false, available: 0, reserved: 0, damaged: 0 })));
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('employee_submit_ops_entry_v2') || msg.includes('employee_ops_entries')) {
        setErrMsg('ยังไม่ได้รันไฟล์ 25_employee_ops_entries.sql ใน Supabase SQL Editor');
      } else {
        setErrMsg(msg || 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    const toSave = rows.filter(r => r.included);
    if (!toSave.length || saving) return;
    const dups = findDups(toSave);
    if (dups.length > 0) { setWarnDups(dups); setDupMode(true); return; }
    doSave(toSave);
  }

  function confirmDupSave() {
    const toSave = rows.filter(r => r.included);
    setWarnDups([]); setDupMode(false);
    doSave(toSave);
  }

  function clearAll() {
    setRows(prev => prev.map(r => ({ ...r, included: false, available: 0, reserved: 0, damaged: 0 })));
    setSuccess(''); setErrMsg(''); setWarnDups([]); setDupMode(false); setCatTab('all');
  }

  const accentTeal = '#1aa6a6';
  const logMap = buildLogMap();

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="สาขาที่เช็ก">
        <select value={draft.branchName} onChange={e => setDraft({ ...draft, branchName: e.target.value })}>
          {branches.length > 0
            ? branches.map(b => <option key={b.id} value={b.label}>{b.label}</option>)
            : [<option key="1">สาขากาดน้ำทอง</option>, <option key="2">สาขากาดกองเก่า</option>]
          }
        </select>
      </Field>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { label: 'รายการทั้งหมด', value: rows.length },
          { label: 'เลือกแล้ว', value: includedCount, color: accentTeal },
          { label: 'บันทึกวันนี้', value: todayCakeLog.length, color: 'var(--accent)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 0', textAlign: 'center', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color || 'var(--ink)', lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: 'all', label: `ทั้งหมด (${rows.length})` },
          { key: 'selected', label: `ที่เลือก (${includedCount})` },
          ...categories.map(c => ({ key: c, label: c })),
        ].map(t => (
          <button key={t.key} onClick={() => setCatTab(t.key)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            border: catTab === t.key ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
            background: catTab === t.key ? 'var(--accent-soft)' : 'var(--surface)',
            color: catTab === t.key ? 'var(--accent)' : 'var(--ink)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {displayRows.map(row => {
          const logged = logMap[row.cakeName];
          const isRecentDup = logged && (() => {
            const [h, m] = logged.time.split(':').map(Number);
            return Math.abs(new Date().getHours() * 60 + new Date().getMinutes() - (h * 60 + m)) < 30;
          })();
          return (
            <div key={row.cakeName} style={{
              borderRadius: 14, overflow: 'hidden',
              border: `2px solid ${row.included ? 'var(--accent)' : 'var(--line)'}`,
              background: row.included ? '#f0f9ff' : 'var(--surface)',
            }}>
              {/* Image */}
              <div style={{ position: 'relative' }}>
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt={row.cakeName}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', background: '#f5f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    🍰
                  </div>
                )}
                {/* Select toggle */}
                <button onClick={() => toggleInclude(row.cakeName)} style={{
                  position: 'absolute', top: 7, right: 7,
                  width: 28, height: 28, borderRadius: 999,
                  background: row.included ? 'var(--accent)' : 'rgba(255,255,255,.92)',
                  border: `2px solid ${row.included ? 'var(--accent)' : '#ccc'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1,
                }}>
                  {row.included ? '✓' : ''}
                </button>
                {/* Logged today badge */}
                {logged && (
                  <div style={{
                    position: 'absolute', bottom: 5, left: 5,
                    background: isRecentDup ? '#f59e0b' : '#22c55e',
                    color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '2px 6px',
                  }}>
                    {isRecentDup ? '⚠' : '✓'} {logged.time}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '8px 10px 6px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4 }}>{row.cakeName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {row.category && (
                    <span style={{ fontSize: 10, background: '#f3f4f6', borderRadius: 999, padding: '1px 7px', color: '#6b7280', fontWeight: 600 }}>
                      {row.category}
                    </span>
                  )}
                  {row.priceStore > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: accentTeal }}>฿{row.priceStore}</span>
                  )}
                </div>
              </div>

              {/* Expanded controls (when selected) */}
              {row.included && (
                <div style={{ padding: '0 10px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>พร้อมขาย (ชิ้น)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateRow(row.cakeName, 'available', Math.max(0, (row.available || 0) - 1))}
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--line)', background: '#f9fafb', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                      −
                    </button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{row.available || 0}</span>
                    <button onClick={() => updateRow(row.cakeName, 'available', (row.available || 0) + 1)}
                      style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${accentTeal}`, background: '#e6f7f7', fontSize: 20, cursor: 'pointer', color: accentTeal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                      +
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                    {[['reserved', 'จอง', '#3b82f6'], ['damaged', 'เสีย', '#ef4444']].map(([field, label, clr]) => (
                      <div key={field}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2, fontWeight: 600 }}>{label}</div>
                        <input type="number" min="0" value={row[field] || 0}
                          onChange={e => updateRow(row.cakeName, field, parseInt(e.target.value) || 0)}
                          style={{
                            width: '100%', padding: '5px 6px', borderRadius: 6, textAlign: 'center',
                            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                            border: `1.5px solid ${Number(row[field]) > 0 ? clr : 'var(--line)'}`,
                            background: Number(row[field]) > 0 && field === 'damaged' ? '#fef2f2' : 'var(--surface-2)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Today's log */}
      {todayCakeLog.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
            🍰 บันทึกวันนี้แล้ว {todayCakeLog.length} รายการ ({draft.branchName})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {todayCakeLog.map((c, i) => (
              <span key={i} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '2px 8px', fontSize: 11, color: '#78350f' }}>
                {c.cakeName} · {c.available}{c.reserved && c.reserved !== '0' ? ` จอง${c.reserved}` : ''} @{c.time}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dup warning */}
      {dupMode && warnDups.length > 0 && (
        <div style={{ background: '#fff8e8', border: '1.5px solid #f59e0b', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 8 }}>
            ⚠️ พบรายการที่บันทึกไปแล้วภายใน 30 นาที
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {warnDups.map((d, i) => (
              <div key={i} style={{ fontSize: 13, color: '#78350f' }}>• {d.cakeName} — บันทึกแล้วเมื่อ {d.time}</div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>ต้องการบันทึกซ้ำหรือไม่? (เช็ครอบสอง หรือแก้ไขยอด)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn" onClick={() => { setDupMode(false); setWarnDups([]); }}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={confirmDupSave} style={{ background: '#d97706', borderColor: '#d97706' }}>
              ยืนยันบันทึกซ้ำ
            </button>
          </div>
        </div>
      )}

      {success && <Notice tone="success">{success}</Notice>}
      {errMsg && <Notice tone="danger">{errMsg}</Notice>}

      {/* Bottom summary bar */}
      {includedCount > 0 && !dupMode && (
        <div style={{ background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>เลือกแล้ว {includedCount} รายการ</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>รวมพร้อมขาย {totalQty} ชิ้น</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {!dupMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-primary" onClick={saveAll} disabled={includedCount === 0 || saving}>
            {saving ? 'กำลังบันทึก...' : `บันทึก${includedCount > 0 ? ` ${includedCount}` : ''} รายการ`}
          </button>
          <button className="btn" onClick={clearAll}>ล้างค่า</button>
        </div>
      )}
    </div>
  );
}

function OpsFormCard({ taskKey, draft, setDraft, resetDraft, saveLocalDraft, backend, summary, catalog, catalogReady, catalogRetrying = false, reloadCatalog, geminiKey, branches = [] }) {
  const { employeeSessionToken, employee, orgId } = useAuthStore();
  const empName = employee?.name || '';
  const navigate = useNavigate();
  const [saving, setSaving]    = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [lastRecord, setLastRecord] = useState(null);

  useEffect(() => {
    const needsHint = taskKey === 'inventory' || taskKey === 'supplies-count';
    if (!needsHint || !draft.itemName || !orgId) { setLastRecord(null); return; }
    let cancelled = false;
    supabase
      .from('employee_ops_entries')
      .select('payload,created_at')
      .eq('org_id', orgId)
      .eq('task_key', taskKey)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        const q = draft.itemName.trim().toLowerCase();
        const match = (data || []).find(e => (e.payload?.itemName || '').toLowerCase() === q);
        setLastRecord(match || null);
      });
    return () => { cancelled = true; };
  }, [draft.itemName, taskKey, orgId]);

  const [lastCakeRecord, setLastCakeRecord] = useState(null);

  useEffect(() => {
    if (taskKey !== 'cake-stock' || !draft.cakeName || !draft.branchName || !orgId) { setLastCakeRecord(null); return; }
    let cancelled = false;
    supabase
      .from('employee_ops_entries')
      .select('payload,created_at')
      .eq('org_id', orgId)
      .eq('task_key', 'cake-stock')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        const qCake = draft.cakeName.trim().toLowerCase();
        const qBranch = draft.branchName.trim().toLowerCase();
        const match = (data || []).find(e =>
          (e.payload?.cakeName || '').toLowerCase() === qCake &&
          (e.payload?.branchName || '').toLowerCase() === qBranch
        );
        setLastCakeRecord(match || null);
      });
    return () => { cancelled = true; };
  }, [draft.cakeName, draft.branchName, taskKey, orgId]);

  const [todayProductionTotal, setTodayProductionTotal] = useState(null);
  const [todayProductionBatches, setTodayProductionBatches] = useState([]);
  const [prodRefreshTick, setProdRefreshTick] = useState(0);

  const [todayCakeLog, setTodayCakeLog] = useState([]);
  const [cakeRefreshTick, setCakeRefreshTick] = useState(0);

  useEffect(() => {
    if (taskKey !== 'production' || !draft.product || !orgId) {
      setTodayProductionTotal(null);
      setTodayProductionBatches([]);
      return;
    }
    let cancelled = false;
    const todayStr = new Date().toISOString().slice(0, 10);
    supabase
      .from('employee_ops_entries')
      .select('payload,created_at')
      .eq('org_id', orgId)
      .eq('task_key', 'production')
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const q = draft.product.trim().toLowerCase();
        const matching = (data || []).filter(e => (e.payload?.product || '').trim().toLowerCase() === q);
        if (matching.length === 0) { setTodayProductionTotal(null); setTodayProductionBatches([]); return; }
        let total = 0;
        matching.forEach(e => { total += parseFloat(e.payload?.quantity || 0) || 0; });
        setTodayProductionTotal({ total, unit: matching[0]?.payload?.unit || '', count: matching.length });
        setTodayProductionBatches(matching.map(e => ({ batch: e.payload?.batch || '', quantity: e.payload?.quantity || '0', unit: e.payload?.unit || '', note: e.payload?.note || '', time: (e.created_at || '').slice(11, 16) })));
      });
    return () => { cancelled = true; };
  }, [draft.product, taskKey, orgId, prodRefreshTick]);

  useEffect(() => {
    if (taskKey !== 'cake-stock' || !orgId) { setTodayCakeLog([]); return; }
    let cancelled = false;
    const todayStr = new Date().toISOString().slice(0, 10);
    supabase
      .from('employee_ops_entries')
      .select('payload,created_at')
      .eq('org_id', orgId)
      .eq('task_key', 'cake-stock')
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const qBranch = (draft.branchName || '').trim().toLowerCase();
        const entries = (data || []).filter(e => (e.payload?.branchName || '').trim().toLowerCase() === qBranch);
        setTodayCakeLog(entries.map(e => ({
          cakeName: e.payload?.cakeName || '',
          available: e.payload?.available || '0',
          reserved: e.payload?.reserved || '0',
          damaged: e.payload?.damaged || '0',
          status: e.payload?.status || '',
          time: (e.created_at || '').slice(11, 16),
        })));
      });
    return () => { cancelled = true; };
  }, [draft.branchName, taskKey, orgId, cakeRefreshTick]);

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
    setSaving(true); setSuccess(''); setErrMsg(''); setUploadMsg('');
    try {
      const payload = sanitizePayload(taskKey, draft);

      let photoUploadFailed = false;

      // อัปโหลดรูปบิลไปยัง Supabase Storage (bills form)
      if (taskKey === 'bills' && draft.imageBase64 && draft.imageMimeType && orgId) {
        setUploadMsg('⏳ กำลังอัปโหลดรูปบิล...');
        const result = await uploadSingleBase64(draft.imageBase64, draft.imageMimeType, draft.imageName, orgId, 'bills');
        if (result?.url) { payload.billImageUrl = result.url; }
        else { photoUploadFailed = true; }
        setUploadMsg('');
      }

      // อัปโหลดรูปแนบ (forms อื่น)
      const photos = taskKey !== 'bills' ? (draft.photos || []) : [];
      if (photos.length > 0 && orgId) {
        setUploadMsg(`⏳ กำลังอัปโหลด ${photos.length} รูป...`);
        const uploaded = await uploadOpsPhotos(photos, orgId, taskKey);
        if (uploaded.length > 0) {
          payload.photoUrls = uploaded.map(u => u.url);
          payload.photoNames = uploaded.map(u => u.name);
          payload.photoCount = uploaded.length;
        } else {
          photoUploadFailed = true;
        }
        setUploadMsg('');
      }

      const { error } = await supabase.rpc('employee_submit_ops_entry_v2', {
        p_session_token: employeeSessionToken,
        p_task_key: taskKey,
        p_payload: payload,
      });
      if (error) throw error;
      saveLocalDraft(payload);
      await backend.reload();
      if (taskKey === 'production') setProdRefreshTick(t => t + 1);
      if (taskKey === 'cake-stock') setCakeRefreshTick(t => t + 1);
      const uploadedCount = (payload.photoUrls?.length || 0) + (payload.billImageUrl ? 1 : 0);
      if (photoUploadFailed) {
        setSuccess(`บันทึกข้อมูลแล้ว — แต่รูปอัปโหลดไม่สำเร็จ (แอดมินต้องรัน SQL ไฟล์ 28 เพื่อเปิด Storage bucket)`);
      } else {
        setSuccess(`บันทึกเข้า backend แล้ว${uploadedCount > 0 ? ` (อัปโหลด ${uploadedCount} รูปสำเร็จ)` : ''}`);
      }
    } catch (error) {
      setUploadMsg('');
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

  const isBatchCake = taskKey === 'cake-stock' && catalogReady && (catalog?.menus || []).length > 0;
  if (isBatchCake) {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#2f241f', marginBottom: 6 }}>เช็คสต๊อกเค้ก</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>เลือกรายการและบันทึกจำนวนพร้อมกันหลายรายการ</div>
        <TwoColRow>
          <Field label="วันที่">
            <input type="date" value={draft.date || ''} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="ผู้บันทึก">
            <input value={draft.recordedBy || ''} onChange={e => setDraft({ ...draft, recordedBy: e.target.value })} placeholder="ชื่อ" />
          </Field>
        </TwoColRow>
        <CakeStockBatchForm
          catalog={catalog}
          catalogReady={catalogReady}
          catalogRetrying={catalogRetrying}
          reloadCatalog={reloadCatalog}
          draft={draft}
          setDraft={setDraft}
          branches={branches}
          employeeSessionToken={employeeSessionToken}
          backend={backend}
          saveLocalDraft={saveLocalDraft}
          todayCakeLog={todayCakeLog}
          setCakeRefreshTick={setCakeRefreshTick}
        />
      </div>
    );
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
        ? <PurchaseListForm draft={draft} setDraft={setDraft} catalog={catalog} catalogReady={catalogReady} catalogRetrying={catalogRetrying} reloadCatalog={reloadCatalog} employeeSessionToken={employeeSessionToken} />
        : renderFormFields(taskKey, draft, setDraft, catalog, geminiKey, branches, lastRecord, todayProductionTotal, lastCakeRecord, todayProductionBatches, todayCakeLog, catalogReady, reloadCatalog, catalogRetrying)
      }

      <div style={summaryPillStyle}>ร่างล่าสุด: {summary}</div>
      {uploadMsg && <Notice tone="warning">{uploadMsg}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}
      {success && (taskKey === 'inventory' || taskKey === 'supplies-count') && draft.itemName && draft.status && draft.status !== 'ปกติ' && (
        <div style={{ background: '#fff8e8', border: '1px solid #f4dfab', borderRadius: 16, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ color: '#7a5b2b' }}>⚡ {draft.itemName} {draft.status} — เพิ่มในใบสั่งซื้อ?</span>
          <button
            type="button"
            onClick={() => navigate(`/emp/ops/purchase-list?suggest=${encodeURIComponent(draft.itemName)}&unit=${encodeURIComponent(draft.unit || '')}&urgent=${draft.status === 'ต้องสั่งเพิ่ม' || draft.status === 'มีปัญหา' || draft.status === 'หมดแล้ว' ? '1' : '0'}&cat=${encodeURIComponent(taskKey === 'supplies-count' ? 'ของใช้สิ้นเปลือง' : 'วัตถุดิบ')}`)}
            style={{ padding: '6px 12px', borderRadius: 10, border: '1.5px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            + ใบสั่งซื้อ
          </button>
        </div>
      )}
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
function LastRecordHint({ record, taskKey }) {
  if (!record) return null;
  const p = record.payload || {};
  const dateStr = record.created_at ? new Date(record.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
  let text = '';
  if (taskKey === 'inventory') text = `ครั้งล่าสุด (${dateStr}): ${p.stockLeft || '?'} ${p.unit || ''} — ${p.status || ''}`;
  if (taskKey === 'supplies-count') text = `ครั้งล่าสุด (${dateStr}): ${p.count || '?'} ${p.unit || ''}${p.status && p.status !== 'ปกติ' ? ' — ' + p.status : ''}`;
  if (!text) return null;
  return (
    <div style={{ fontSize: 12, color: '#7a5b2b', background: '#fff8e8', border: '1px solid #f4dfab', borderRadius: 10, padding: '6px 10px', marginTop: -8 }}>
      📋 {text}
    </div>
  );
}

function renderFormFields(taskKey, draft, setDraft, catalog, geminiKey, branches = [], lastRecord = null, todayProductionTotal = null, lastCakeRecord = null, todayProductionBatches = [], todayCakeLog = [], catalogReady = false, reloadCatalog = null, catalogRetrying = false) {
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
                onChange={v => {
                  const item = (catalog?.menus || []).find(i => i.name === v);
                  setDraft({ ...draft, product: v, ...(item?.unit ? { unit: item.unit } : {}) });
                }}
                placeholder={!catalogReady ? 'กำลังโหลด...' : (!catalog ? 'พิมพ์ชื่อเมนู...' : (catalog.menus || []).length === 0 ? 'พิมพ์ชื่อเมนู...' : 'พิมพ์หรือเลือกเมนู...')}
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, product: v })} />
            </div>
            {catalogReady && (!catalog || (catalog.menus || []).length === 0) && (
              <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>💡 {catalogNoDataMsg(catalog, (catalog?.menus || []).length === 0)} พิมพ์ชื่อเมนูได้เลย</span>
                {catalogRetrying && <span style={{ color: '#0369a1', fontSize: 11 }}>⏳ กำลังลองเชื่อมต่อ...</span>}
                {reloadCatalog && <button type="button" onClick={reloadCatalog} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>🔄 ลองใหม่</button>}
              </div>
            )}
          </Field>
          {todayProductionTotal && (
            <div style={{ background: '#ecfdf3', border: '1px solid #bbe7cf', borderRadius: 12, padding: '10px 12px', marginTop: -8 }}>
              <div style={{ fontSize: 12, color: '#0d7a46', fontWeight: 700, marginBottom: todayProductionBatches.length > 0 ? 6 : 0 }}>
                🏭 วันนี้ผลิตแล้ว: {todayProductionTotal.total} {todayProductionTotal.unit} ({todayProductionTotal.count} รอบ)
              </div>
              {todayProductionBatches.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {todayProductionBatches.map((b, i) => (
                    <span key={i} style={{ background: '#fff', border: '1px solid #bbe7cf', borderRadius: 8, padding: '2px 8px', fontSize: 11, color: '#1a5e3a' }}>
                      {b.batch ? `${b.batch} · ` : ''}{b.quantity} {b.unit}{b.note ? ` (${b.note})` : ''} @{b.time}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <TwoColRow>
            <Field label="จำนวน">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.quantity} inputMode="numeric"
                  onChange={e => setDraft({ ...draft, quantity: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, quantity: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
            <Field label="หน่วย">
              {(() => {
                const presets = ['ชิ้น', 'ถาด', 'ก้อน', 'กก.', 'กรัม', 'ลิตร'];
                const extra = draft.unit && !presets.includes(draft.unit) ? draft.unit : null;
                return (
                  <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                    {extra && <option value={extra}>{extra}</option>}
                    {presets.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                );
              })()}
            </Field>
          </TwoColRow>
          <Field label="รอบผลิต / batch">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ flex: 1 }} value={draft.batch}
                onChange={e => setDraft({ ...draft, batch: e.target.value })} placeholder="เช่น เช้า / บ่าย / รอบ 1" />
              <VoiceBtn onResult={v => setDraft({ ...draft, batch: v })} size={36} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {['เช้า', 'บ่าย', 'เย็น', 'รอบ 1', 'รอบ 2'].map(b => (
                <button key={b} type="button" onClick={() => setDraft({ ...draft, batch: b })} style={{
                  padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${draft.batch === b ? 'var(--accent)' : 'var(--line)'}`,
                  background: draft.batch === b ? 'var(--accent-soft)' : 'var(--bg)',
                  color: draft.batch === b ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {b}
                </button>
              ))}
            </div>
          </Field>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น อบเพิ่มเพราะหน้าร้านขาด" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
          <PhotoSection
            photos={draft.photos || []}
            onChange={photos => setDraft({ ...draft, photos })}
            label="รูปการผลิต (ไม่บังคับ)"
          />
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
                onChange={v => {
                  const item = (catalog?.ingredients || []).find(i => i.name === v);
                  setDraft({ ...draft, itemName: v, ...(item?.unit ? { unit: item.unit } : {}) });
                }}
                placeholder={!catalogReady ? 'กำลังโหลด...' : (!catalog ? 'พิมพ์ชื่อวัตถุดิบ...' : (catalog.ingredients || []).length === 0 ? 'พิมพ์ชื่อวัตถุดิบ...' : 'พิมพ์หรือเลือกวัตถุดิบ...')}
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, itemName: v })} />
            </div>
            {catalogReady && (!catalog || (catalog.ingredients || []).length === 0) && (
              <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>💡 {catalogNoDataMsg(catalog, (catalog?.ingredients || []).length === 0)} พิมพ์ชื่อวัตถุดิบได้เลย</span>
                {catalogRetrying && <span style={{ color: '#0369a1', fontSize: 11 }}>⏳ กำลังลองเชื่อมต่อ...</span>}
                {reloadCatalog && <button type="button" onClick={reloadCatalog} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>🔄 ลองใหม่</button>}
              </div>
            )}
          </Field>
          <LastRecordHint record={lastRecord} taskKey="inventory" />
          <TwoColRow>
            <Field label="คงเหลือ">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.stockLeft} inputMode="decimal"
                  onChange={e => setDraft({ ...draft, stockLeft: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, stockLeft: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
            <Field label="หน่วย">
              {(() => {
                const presets = ['กก.', 'กรัม', 'ลิตร', 'มล.', 'ฟอง', 'ชิ้น', 'ถุง'];
                const extra = draft.unit && !presets.includes(draft.unit) ? draft.unit : null;
                return (
                  <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                    {extra && <option value={extra}>{extra}</option>}
                    {presets.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                );
              })()}
            </Field>
          </TwoColRow>
          <Field label="สถานะ">
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option>ปกติ</option><option>ใกล้หมด</option><option>หมดแล้ว</option><option>ต้องสั่งเพิ่ม</option><option>มีปัญหา</option>
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น ไข่เหลือพอถึงพรุ่งนี้เช้า" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
          <PhotoSection
            photos={draft.photos || []}
            onChange={photos => setDraft({ ...draft, photos })}
            label="รูปวัตถุดิบ (ไม่บังคับ)"
          />
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
                placeholder={!catalogReady ? 'กำลังโหลด...' : (!catalog ? 'พิมพ์ชื่อเค้ก...' : (catalog.menus || []).length === 0 ? 'พิมพ์ชื่อเค้ก...' : 'พิมพ์หรือเลือกเค้ก...')}
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, cakeName: v })} />
            </div>
            {catalogReady && (!catalog || (catalog.menus || []).length === 0) && (
              <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>💡 {catalogNoDataMsg(catalog, (catalog?.menus || []).length === 0)} พิมพ์ชื่อเค้กได้เลย</span>
                {catalogRetrying && <span style={{ color: '#0369a1', fontSize: 11 }}>⏳ กำลังลองเชื่อมต่อ...</span>}
                {reloadCatalog && <button type="button" onClick={reloadCatalog} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>🔄 ลองใหม่</button>}
              </div>
            )}
          </Field>
          {lastCakeRecord && (() => {
            const p = lastCakeRecord.payload || {};
            const dateStr = lastCakeRecord.created_at ? new Date(lastCakeRecord.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
            return (
              <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '6px 10px', marginTop: -8 }}>
                🍰 ล่าสุด ({dateStr}): พร้อมขาย {p.available ?? '?'} · จอง {p.reserved ?? '?'} · {p.status || ''}
              </div>
            );
          })()}
          <TwoColRow>
            <Field label="พร้อมขาย">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.available} inputMode="numeric"
                  onChange={e => setDraft({ ...draft, available: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, available: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
            <Field label="จอง">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.reserved} inputMode="numeric"
                  onChange={e => setDraft({ ...draft, reserved: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, reserved: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
          </TwoColRow>
          <TwoColRow>
            <Field label="เสียหาย / หมดอายุ">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.damaged} inputMode="numeric"
                  onChange={e => setDraft({ ...draft, damaged: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, damaged: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
            <Field label="สถานะ">
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                <option>พร้อมขาย</option><option>ใกล้หมด</option><option>หมด</option>
                <option>ต้องเติมจากครัว</option><option>มีปัญหา</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น สาขานี้ต้องเติมเค้กส้ม 2 ชิ้น" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
          <PhotoSection
            photos={draft.photos || []}
            onChange={photos => setDraft({ ...draft, photos })}
            label="รูปสต๊อกเค้ก (ไม่บังคับ)"
          />
          {todayCakeLog.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
                🍰 วันนี้เช็กแล้ว {todayCakeLog.length} รายการ ({draft.branchName})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {todayCakeLog.map((c, i) => (
                  <span key={i} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '2px 8px', fontSize: 11, color: '#78350f' }}>
                    {c.cakeName} · {c.available}{c.reserved && c.reserved !== '0' ? ` จอง${c.reserved}` : ''}{c.status && c.status !== 'พร้อมขาย' ? ` · ${c.status}` : ''} @{c.time}
                  </span>
                ))}
              </div>
            </div>
          )}
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
                onChange={v => {
                  const item = (catalog?.materials || []).find(i => i.name === v);
                  setDraft({ ...draft, itemName: v, ...(item?.unit ? { unit: item.unit } : {}) });
                }}
                placeholder={!catalogReady ? 'กำลังโหลด...' : (!catalog ? 'พิมพ์ชื่อของใช้...' : (catalog.materials || []).length === 0 ? 'พิมพ์ชื่อของใช้...' : 'พิมพ์หรือเลือกของใช้...')}
              />
              <VoiceBtn onResult={v => setDraft({ ...draft, itemName: v })} />
            </div>
            {catalogReady && (!catalog || (catalog.materials || []).length === 0) && (
              <div style={{ fontSize: 12, color: '#9a8070', marginTop: 4, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>💡 {catalogNoDataMsg(catalog, (catalog?.materials || []).length === 0)} พิมพ์ชื่อของใช้ได้เลย</span>
                {catalogRetrying && <span style={{ color: '#0369a1', fontSize: 11 }}>⏳ กำลังลองเชื่อมต่อ...</span>}
                {reloadCatalog && <button type="button" onClick={reloadCatalog} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>🔄 ลองใหม่</button>}
              </div>
            )}
          </Field>
          <LastRecordHint record={lastRecord} taskKey="supplies-count" />
          <TwoColRow>
            <Field label="จำนวนคงเหลือ">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ flex: 1 }} value={draft.count} inputMode="numeric"
                  onChange={e => setDraft({ ...draft, count: e.target.value })} placeholder="0" />
                <VoiceBtn onResult={v => setDraft({ ...draft, count: v.replace(/[^0-9.]/g, '') })} size={36} />
              </div>
            </Field>
            <Field label="หน่วย">
              {(() => {
                const presets = ['ชิ้น', 'แพค', 'ขวด', 'ลัง', 'ถุง', 'กล่อง'];
                const extra = draft.unit && !presets.includes(draft.unit) ? draft.unit : null;
                return (
                  <select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>
                    {extra && <option value={extra}>{extra}</option>}
                    {presets.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                );
              })()}
            </Field>
          </TwoColRow>
          <Field label="สถานะ">
            <select value={draft.status || 'ปกติ'} onChange={e => setDraft({ ...draft, status: e.target.value })}
              style={{ background: draft.status && draft.status !== 'ปกติ' ? '#fff8e8' : undefined }}>
              <option>ปกติ</option>
              <option>ใกล้หมด</option>
              <option>ต้องสั่งเพิ่ม</option>
              <option>หมดแล้ว</option>
              <option>มีปัญหา</option>
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea rows={3} style={{ flex: 1 }} value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="เช่น เหลือน้อยมาก ควรซื้อวันนี้" />
              <VoiceBtn onResult={v => setDraft({ ...draft, note: (draft.note ? draft.note + ' ' : '') + v })} />
            </div>
          </Field>
          <PhotoSection
            photos={draft.photos || []}
            onChange={photos => setDraft({ ...draft, photos })}
            label="รูปสต๊อกของใช้ (ไม่บังคับ)"
          />
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
    if (toSave.photos) delete toSave.photos; // blob URLs are session-only
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
  // Store only photo names, strip base64 & blob URLs
  if (Array.isArray(p.photos) && p.photos.length > 0) {
    p.photoNames = p.photos.map(ph => ph.name);
    p.photoCount = p.photos.length;
  }
  delete p.photos;
  return p;
}

function hasAnyInput(taskKey, draft) {
  if (taskKey === 'bills')          return !!(draft.vendor || draft.amount || draft.imageName);
  if (taskKey === 'purchase-list')  return (draft.items?.length || 0) > 0;
  if (taskKey === 'production')     return !!(draft.product || draft.quantity || draft.batch || draft.note);
  if (taskKey === 'inventory')      return !!(draft.itemName || draft.stockLeft || draft.note);
  if (taskKey === 'cake-stock')     return !!(draft.cakeName || draft.available || draft.reserved || draft.damaged || draft.note);
  if (taskKey === 'supplies-count') return !!(draft.itemName || draft.count || draft.note);
  return false;
}

function summarizeDraft(taskKey, draft) {
  switch (taskKey) {
    case 'bills':         return `${draft.vendor||'-'} / ${draft.amount||'-'} บาท / ${draft.category||'วัตถุดิบ'}${draft.aiItems?.length ? ` / AI ${draft.aiItems.length} รายการ` : ''}`;
    case 'production':    return `${draft.product||'-'} / ${draft.quantity||'0'} ${draft.unit||''} / ${draft.batch||'-'}`;
    case 'inventory':     return `${draft.itemName||'-'} / ${draft.stockLeft||'0'} ${draft.unit||''} / ${draft.status||'-'}`;
    case 'cake-stock':    return `${draft.branchName||'-'} / ${draft.cakeName||'-'} / พร้อมขาย ${draft.available||'0'} จอง ${draft.reserved||'0'} เสีย ${draft.damaged||'0'}`;
    case 'supplies-count':return `${draft.area||'-'} / ${draft.itemName||'-'} / ${draft.count||'0'} ${draft.unit||''} / ${draft.status||'ปกติ'}`;
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
    case 'supplies-count':return `${payload.area||'-'} / ${payload.itemName||'-'} / ${payload.count||'0'} ${payload.unit||''} / ${payload.status||'ปกติ'}`;
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
        {items.slice(0, 3).map(i => `${i.itemName} ${i.quantity}${i.unit}${i.priority && i.priority !== 'ไม่ด่วน' ? ` (${i.priority})` : ''}`).join(' · ')}
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
        {items.slice(0, 3).map(i => `${i.itemName} ${i.quantity}${i.unit}${i.priority && i.priority !== 'ไม่ด่วน' ? ` (${i.priority})` : ''}`).join(' · ')}
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
