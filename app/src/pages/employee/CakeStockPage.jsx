import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// ─── Icon mapping ─────────────────────────────────────────────────────────────
const ICON_MAP = [
  [/ชีสเค้ก|cheese\s*cake/i,        '🍰', '#FEF9C3'],
  [/ช็อค|chocolate|โกโก้/i,         '🍫', '#FEF3C7'],
  [/มัฟฟิน|muffin/i,                '🧁', '#FCE7F3'],
  [/คุกกี้|cookie/i,                '🍪', '#FFF7ED'],
  [/ครัวซอง|croissant/i,            '🥐', '#FEF3C7'],
  [/ทาร์ต|tart/i,                   '🥧', '#FEF9C3'],
  [/มาการอง|macaron/i,              '💜', '#EDE9FE'],
  [/บราวนี่|brownie/i,              '🟫', '#FEF3C7'],
  [/วาฟเฟิล|waffle/i,               '🧇', '#FEF9C3'],
  [/ขนมปัง|bread|บาแก็ต/i,         '🥖', '#FEF9C3'],
  [/มาชา|matcha/i,                  '🍵', '#ECFDF5'],
  [/สตรอว์|strawberry/i,            '🍓', '#FFF0F0'],
  [/เลมอน|lemon/i,                  '🍋', '#FEFCE8'],
  [/พาย|pie/i,                      '🥧', '#FEF9C3'],
  [/โรล|roll|ม้วน/i,                '🌀', '#F0F9FF'],
  [/เค้ก|cake/i,                    '🎂', '#FCE7F3'],
];

function getIcon(name) {
  for (const [re, icon] of ICON_MAP) if (re.test(name)) return icon;
  return '🍞';
}
function getBg(name) {
  for (const [re, , bg] of ICON_MAP) if (re.test(name)) return bg;
  return '#F9FAFB';
}

// ─── Categories ─────────────────────────────────────────────────────────────
const CAKE_CATEGORIES = [
  { id: 'cake',   label: '🎂 เค้ก',   re: /เค้ก|cake|โรล|roll|ม้วน|ชีสเค้ก|cheese|gateau|กาโต/i },
  { id: 'bread',  label: '🥖 ขนมปัง', re: /ขนมปัง|bread|บาแก็ต|baguette|ครัวซอง|croissant|โดนัท|donut|ปัง|toast|บัน|bun/i },
  { id: 'snack',  label: '🍪 Snack',  re: /คุกกี้|cookie|บราวนี่|brownie|มัฟฟิน|muffin|ทาร์ต|tart|พาย|pie|มาการอง|macaron|วาฟเฟิล|waffle|scone|สโคน|พุดดิ้ง|pudding|ช็อค|chocolate/i },
  { id: 'other',  label: '📦 อื่นๆ',  re: null },
];

function guessCategory(name) {
  for (const c of CAKE_CATEGORIES) if (c.re && c.re.test(name || '')) return c.id;
  return 'other';
}

// แมป "ประเภท" (menu.type จาก Operate) → หมวดย่อย bakery
// types: Cake, Bread, Cookie, Snack, Other bakery (+ เครื่องดื่มที่ถูกกรองออกแล้ว)
function typeToCategory(type) {
  const t = (type || '').toLowerCase();
  if (/cake|เค้ก|โรล|roll|gateau/.test(t)) return 'cake';
  if (/bread|ขนมปัง|ปัง|toast|bun|croissant|ครัวซอง/.test(t)) return 'bread';
  if (/cookie|snack|คุกกี้|สแน็ค|ขนมขบเคี้ยว/.test(t)) return 'snack';
  if (/other\s*bakery|อื่น/.test(t)) return 'other';
  return null; // ไม่รู้จัก → ให้ตัวเรียกไป fallback ต่อ
}
// ลำดับความสำคัญ: subCategory (override) → ประเภท → เดาจากชื่อ
function resolveCategory(menu) {
  return menu.subCategory || typeToCategory(menu.type) || guessCategory(menu.name);
}
// normalize ชื่อสำหรับ match ข้ามแอป (ตัดช่องว่าง + ตัวพิมพ์)
const normName = s => (s || '').trim().toLowerCase().replace(/\s+/g, '');
function catLabel(id) {
  return (CAKE_CATEGORIES.find(c => c.id === id) || {}).label || '📦 อื่นๆ';
}

// ─── Canvas Export (แยกจำนวนต่อสาขา + รวม · แสดงทุกรายการ ยอด 0 ก็แสดง) ──────────
function drawExport(canvas, { items, branches, qtyMap, spoiledByItem, empName }) {
  const cols = (branches && branches.length) ? branches : [{ id: '__all', label: 'จำนวน' }];
  const LM = 28, RM = 28;
  const numW = 46, nameW = 300;
  const brW = Math.max(74, Math.min(130, Math.round(660 / (cols.length + 1))));
  const totW = 96;
  const LINE_H = 46, HEADER_H = 170, FOOTER_H = 76;
  const W = LM + numW + nameW + cols.length * brW + totW + RM;
  const H = HEADER_H + LINE_H + items.length * LINE_H + FOOTER_H;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const F = (size, bold) => `${bold ? 'bold ' : ''}${size}px "Sarabun","Tahoma","Arial",sans-serif`;
  const fit = (text, maxW) => { if (ctx.measureText(text).width <= maxW) return text; let t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; };
  const qOf = (itemId, branchId) => qtyMap[`${itemId}__${branchId}`] || 0;

  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

  // Header strip
  ctx.fillStyle = '#4A2E1A'; ctx.fillRect(0, 0, W, 104);
  ctx.fillStyle = '#E8C89E'; ctx.font = F(28, true); ctx.textAlign = 'center';
  ctx.fillText('☕ JE BAR Coffee & Pastry', W / 2, 40);
  ctx.fillStyle = '#FFFFFF'; ctx.font = F(20, true);
  ctx.fillText('ใบเช็คสต็อคขนม', W / 2, 72);
  ctx.font = F(14);
  const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  ctx.fillText(`${dateStr}  |  ผู้เช็ค: ${empName}`, W / 2, 96);

  // Sub-header summary
  ctx.fillStyle = '#F9F5F0'; ctx.fillRect(0, 104, W, 62);
  const grandTotal = items.reduce((s, it) => s + cols.reduce((a, b) => a + qOf(it.id, b.id), 0), 0);
  const grandSpoiled = items.reduce((s, it) => s + ((spoiledByItem && spoiledByItem[it.id]) || 0), 0);
  ctx.fillStyle = '#6B4226'; ctx.font = F(13); ctx.textAlign = 'left';
  ctx.fillText(`รายการทั้งหมด: ${items.length}  |  รวมทุกสาขา: ${grandTotal} ชิ้น  |  ขนมเสีย: ${grandSpoiled} ชิ้น`, LM, 140);

  // Table header
  const y0 = HEADER_H;
  ctx.fillStyle = '#4A2E1A'; ctx.fillRect(0, y0, W, LINE_H);
  ctx.fillStyle = '#FFFFFF'; ctx.font = F(13.5, true);
  ctx.textAlign = 'left';
  ctx.fillText('#', LM + 4, y0 + 30);
  ctx.fillText('รายการขนม', LM + numW, y0 + 30);
  ctx.textAlign = 'right';
  cols.forEach((b, i) => {
    const x = LM + numW + nameW + i * brW + brW - 10;
    ctx.font = F(12.5, true);
    ctx.fillText(fit(String(b.label || '').replace(/^[^\wก-๙]+/, '').trim() || 'สาขา', brW - 14), x, y0 + 30);
  });
  ctx.font = F(13.5, true);
  ctx.fillText('รวม', LM + numW + nameW + cols.length * brW + totW - 10, y0 + 30);

  // Rows — ทุกรายการ (ยอด 0 แสดง 0)
  items.forEach((item, idx) => {
    const ry = y0 + LINE_H + idx * LINE_H;
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#FAF7F3';
    ctx.fillRect(0, ry, W, LINE_H);
    ctx.strokeStyle = '#E5DDD5'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ry + LINE_H - 0.5); ctx.lineTo(W, ry + LINE_H - 0.5); ctx.stroke();

    ctx.fillStyle = '#9CA3AF'; ctx.font = F(12.5); ctx.textAlign = 'left';
    ctx.fillText(String(idx + 1), LM + 4, ry + 30);

    ctx.fillStyle = '#1F2937'; ctx.font = F(14.5, true);
    ctx.fillText(fit(`${getIcon(item.name)}  ${item.name}`, nameW - 12), LM + numW, ry + 30);

    ctx.textAlign = 'right';
    let rowTotal = 0;
    cols.forEach((b, i) => {
      const q = qOf(item.id, b.id); rowTotal += q;
      const x = LM + numW + nameW + i * brW + brW - 10;
      ctx.fillStyle = q > 0 ? '#166534' : '#C4C4C4'; ctx.font = F(15, q > 0);
      ctx.fillText(String(q), x, ry + 30);
    });
    ctx.fillStyle = rowTotal > 0 ? '#4A2E1A' : '#C4C4C4'; ctx.font = F(16.5, true);
    ctx.fillText(String(rowTotal), LM + numW + nameW + cols.length * brW + totW - 10, ry + 30);
  });

  // Footer
  const fy = y0 + LINE_H + items.length * LINE_H;
  ctx.fillStyle = '#4A2E1A'; ctx.fillRect(0, fy, W, FOOTER_H);
  ctx.fillStyle = '#E8C89E'; ctx.font = F(13, true); ctx.textAlign = 'center';
  ctx.fillText(`รวม ${grandTotal} ชิ้น  |  เสีย ${grandSpoiled} ชิ้น  |  ${cols.length} สาขา  |  JE BAR`, W / 2, fy + 44);
}

async function exportToImage(payload) {
  const canvas = document.createElement('canvas');
  drawExport(canvas, payload);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// ─── Spoiled reasons ──────────────────────────────────────────────────────────
const SPOILED_REASONS = [
  { value: 'expired',  label: '🗓 หมดอายุ' },
  { value: 'damaged',  label: '💥 เสียหาย/แตก' },
  { value: 'quality',  label: '❌ คุณภาพไม่ผ่าน' },
  { value: 'other',    label: '📝 อื่นๆ' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = {
  adjust: 'ปรับจำนวน',
  spoiled: 'บันทึกขนมเสีย',
  open: 'เปิดขาย',
  close: 'ปิดขาย',
  request_add: 'ขอเพิ่มรายการ',
  request_delete: 'ขอลบรายการ',
  approve: 'อนุมัติ',
  reject: 'ปฏิเสธ',
  reorder: 'เรียงลำดับ',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CakeStockPage({ navigate }) {
  const { employee } = useAuthStore();
  const myBranchId = employee?.branch_id;
  const empId = employee?.id;
  const empName = employee?.nickname || employee?.name || 'พนักงาน';
  const orgId = employee?.org_id;

  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(myBranchId || null);
  const [items, setItems] = useState([]);         // cake_items (active)
  const [stockMap, setStockMap] = useState({});   // { item_id: qty }
  const [spoiledMap, setSpoiledMap] = useState({}); // { item_id: qty_spoiled }
  const [spoiledDetails, setSpoiledDetails] = useState({}); // { item_id: { reason, photo } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [operateSyncing, setOperateSyncing] = useState(false);
  const [operateSyncMsg, setOperateSyncMsg] = useState('');
  const [savingSpoiled, setSavingSpoiled] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState(null); // ISO string

  // Modals
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showRequestAdd, setShowRequestAdd] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestQty, setRequestQty] = useState(1);
  const [requestSending, setRequestSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // item to request delete
  const [myPendingRequests, setMyPendingRequests] = useState([]);

  // Detail drawer
  const [detailItem, setDetailItem] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSavedId, setPriceSavedId] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [operateMenus, setOperateMenus] = useState([]); // เมนู bakery จาก Operate (ไว้ cross-check)
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [pushingOperate, setPushingOperate] = useState(false);
  const [detailBranchQty, setDetailBranchQty] = useState([]); // จำนวนแยกสาขาของเมนูที่เปิดดูรายละเอียด
  // Inline qty input buffer { item_id: string }
  const [qtyInput, setQtyInput] = useState({});

  // Production claim: unclaimed production entries { [normName]: [{id,qty,unit,batch,jobNo,empName,time}] }
  const [prodClaims, setProdClaims] = useState({});
  const [claimedIds, setClaimedIds] = useState(new Set());

  // Drag-to-reorder
  const dragItem = useRef(null);
  const dragOver = useRef(null);
  const [dragActiveIdx, setDragActiveIdx] = useState(null);   // which item is being dragged
  const [dragOverIdx, setDragOverIdx] = useState(null);       // which slot it's hovering

  // Menu suggestions for the "request add" modal
  const [menuSuggestions, setMenuSuggestions] = useState([]);

  // Catalog
  const [creatingCatalog, setCreatingCatalog] = useState(false);
  const [catalogLink, setCatalogLink] = useState('');
  const [catalogCopied, setCatalogCopied] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(null); // item_id being uploaded

  // Non-beverage categories to exclude from sync (case-insensitive)
  const BEVERAGE_CATS = ['beverage', 'drink', 'coffee', 'tea', 'เครื่องดื่ม', 'กาแฟ', 'ชา'];
  function isNonBeverage(m) {
    const cat = (m.category || '').toLowerCase();
    return !BEVERAGE_CATS.some(c => cat.includes(c));
  }

  // Auto-sync ALL non-beverage menu items (รวม หยุดขาย) from jebar_app_state → cake_items
  useEffect(() => {
    if (!orgId) return;
    supabase.from('jebar_app_state')
      .select('db')
      .eq('shop_code', 'jebar')
      .limit(1)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data?.db?.menus) return;
        const menus = data.db.menus;
        // รวมทุก non-beverage ไม่กรอง status
        const bakeryMenus = menus.filter(m => isNonBeverage(m));

        // Modal suggestions = เฉพาะที่ยังขายอยู่
        setMenuSuggestions(bakeryMenus.filter(m => m.status !== 'หยุดขาย').map(m => m.name));
        setOperateMenus(bakeryMenus); // เก็บไว้ cross-check ตัวเช็คข้อมูล

        if (!bakeryMenus.length) return;
        const opPrice = m => m.priceStore ?? m.price ?? m.selling_price ?? null;
        const { data: existing } = await supabase
          .from('cake_items').select('id,name,price,category').eq('org_id', orgId);
        const existingNames = new Set((existing || []).map(e => e.name));
        const existingByNorm = {};
        (existing || []).forEach(e => { existingByNorm[normName(e.name)] = e; });

        // 1) เพิ่มเมนูใหม่
        const toInsert = bakeryMenus
          .filter(m => !existingNames.has(m.name))
          .map((m, i) => ({
            org_id: orgId,
            name: m.name,
            sort_order: 9000 + i,
            is_open: m.status !== 'หยุดขาย',
            price: opPrice(m),
            category: resolveCategory(m),
          }));
        if (toInsert.length) await supabase.from('cake_items').insert(toInsert);

        // 2) เติมราคา/หมวดให้เมนูเดิมที่ยัง "ว่าง" อัตโนมัติ (ไม่ทับค่าที่ตั้งเอง)
        let filled = 0;
        for (const m of bakeryMenus) {
          const ex = existingByNorm[normName(m.name)];
          if (!ex) continue;
          const patch = {};
          if (ex.price == null && opPrice(m) != null) patch.price = opPrice(m);
          if (ex.category == null) { const c = resolveCategory(m); if (c) patch.category = c; }
          if (Object.keys(patch).length) {
            const { error: upErr } = await supabase.from('cake_items').update(patch).eq('id', ex.id);
            if (!upErr) filled++;
          }
        }
        if (toInsert.length || filled) load();
      });
  }, [orgId]);

  // Load my pending requests (refresh when modal opens/closes)
  useEffect(() => {
    if (!empId || !orgId) return;
    supabase.from('cake_items')
      .select('id,name')
      .eq('org_id', orgId)
      .eq('status', 'pending_add')
      .eq('requested_by', empId)
      .order('id', { ascending: false })
      .then(({ data }) => { if (data) setMyPendingRequests(data); });
  }, [empId, orgId, showRequestAdd]);

  // Load branches
  useEffect(() => {
    if (!orgId) return;
    supabase.from('branches').select('id,label').eq('org_id', orgId).order('label')
      .then(({ data }) => {
        if (data) setBranches(data);
      });
  }, [orgId]);

  // Set default tab to own branch once branches loaded
  useEffect(() => {
    if (branches.length && !activeBranchId) {
      setActiveBranchId(myBranchId || branches[0]?.id);
    }
  }, [branches, myBranchId, activeBranchId]);

  // Load items + stock for active branch (or all branches)
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let stockPromise;
      if (activeBranchId === 'all') {
        stockPromise = supabase.from('cake_stock').select('item_id,qty,qty_spoiled').eq('org_id', orgId);
      } else if (activeBranchId) {
        stockPromise = supabase.from('cake_stock').select('item_id,qty,qty_spoiled').eq('org_id', orgId).eq('branch_id', activeBranchId);
      } else {
        stockPromise = Promise.resolve({ data: [] });
      }
      const [{ data: itemData }, { data: stockData }] = await Promise.all([
        supabase.from('cake_items')
          .select('id,name,sort_order,is_open,status,photo_url,price,category')
          .eq('org_id', orgId)
          .in('status', ['active'])
          .order('sort_order'),
        stockPromise,
      ]);
      if (itemData) setItems(itemData);
      if (stockData) {
        const m = {};
        const s = {};
        stockData.forEach(r => {
          m[r.item_id] = (m[r.item_id] || 0) + r.qty;
          s[r.item_id] = (s[r.item_id] || 0) + (r.qty_spoiled || 0);
        });
        setStockMap(m);
        setSpoiledMap(s);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, activeBranchId]);

  useEffect(() => { load(); }, [load]);

  // Load today's production entries + already-claimed IDs (ต่อสาขา)
  // เส้นทาง: ผลิต → employee_ops_entries(task_key=production, dispatches[]) → แต่ละสาขากดรับยอดของตัวเอง
  // กันรับซ้ำด้วย cake_stock_log(action=production_claim, note=entryId, branch_id) — เป็นบัญชีกลางที่ Operate อ่าน/เขียนร่วม
  useEffect(() => {
    if (!orgId || !activeBranchId || activeBranchId === 'all') { setProdClaims({}); setClaimedIds(new Set()); return; }
    const todayStr = new Date().toISOString().slice(0, 10);
    const normB = s => (s || '').trim().toLowerCase().replace(/\s+/g, '');
    const myBranchLabel = (branches.find(b => b.id === activeBranchId) || {}).label || '';
    Promise.all([
      supabase.from('employee_ops_entries')
        .select('id,payload,created_at')
        .eq('org_id', orgId)
        .eq('task_key', 'production')
        .gte('created_at', `${todayStr}T00:00:00`)
        .lte('created_at', `${todayStr}T23:59:59`)
        .order('created_at', { ascending: true }),
      supabase.from('cake_stock_log')
        .select('note')
        .eq('org_id', orgId)
        .eq('action', 'production_claim')
        .eq('branch_id', activeBranchId)
        .gte('created_at', `${todayStr}T00:00:00`),
    ]).then(([{ data: prodData }, { data: claimData }]) => {
      const alreadyClaimed = new Set((claimData || []).map(c => c.note).filter(Boolean));
      setClaimedIds(alreadyClaimed);
      const grouped = {};
      (prodData || []).forEach(e => {
        if (alreadyClaimed.has(String(e.id))) return;
        const name = (e.payload?.product || '').trim();
        if (!name) return;
        // ยอดที่ส่งมาให้ "สาขานี้" จาก dispatches; ถ้าไม่มี dispatches (รายการเก่า) ใช้ยอดรวมทั้งก้อน
        const dispatches = Array.isArray(e.payload?.dispatches) ? e.payload.dispatches : [];
        let qtyForBranch;
        if (dispatches.length) {
          const d = dispatches.find(x => normB(x.branchName || x.branch_name || x.branch) === normB(myBranchLabel));
          qtyForBranch = d ? (parseFloat(d.qty) || 0) : 0;
        } else {
          qtyForBranch = parseFloat(e.payload?.quantity || 0) || 0;
        }
        if (qtyForBranch <= 0) return; // ไม่ได้ส่งมาให้สาขานี้
        const key = name.toLowerCase();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
          id: String(e.id),
          qty: qtyForBranch,
          unit: e.payload?.unit || 'ชิ้น',
          batch: e.payload?.batch || '',
          jobNo: e.payload?.jobNo || '',
          empName: e.payload?.recordedBy || '',
          time: (e.created_at || '').slice(11, 16),
          productName: name,
        });
      });
      setProdClaims(grouped);
    }).catch(() => {});
  }, [orgId, activeBranchId, branches]);

  // isMyBranch: false in 'all' mode (read-only), true on own branch or if no branch assigned
  const isMyBranch = activeBranchId !== 'all' && (!myBranchId || activeBranchId === myBranchId);

  // Write a log event
  async function writeLog(itemId, itemName, action, delta, qtyAfter, note) {
    await supabase.from('cake_stock_log').insert({
      org_id: orgId,
      branch_id: activeBranchId,
      item_id: itemId,
      item_name: itemName,
      emp_id: empId,
      emp_name: empName,
      action,
      delta,
      qty_after: qtyAfter,
      note,
    });
  }

  // Adjust qty (upsert into cake_stock)
  async function adjustQty(item, delta) {
    if (!isMyBranch) return;
    const prev = stockMap[item.id] || 0;
    const next = Math.max(0, prev + delta);
    setSaving(item.id);
    setStockMap(old => ({ ...old, [item.id]: next }));
    try {
      const { error } = await supabase.from('cake_stock').upsert({
        org_id: orgId,
        branch_id: activeBranchId,
        item_id: item.id,
        qty: next,
        updated_by: empId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id,item_id' });
      if (error) throw error;
      await writeLog(item.id, item.name, 'adjust', delta, next, null);
    } catch (err) {
      setStockMap(old => ({ ...old, [item.id]: prev }));
      alert('บันทึกไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setSaving(null);
    }
  }

  // Set qty to absolute value (called from editable input)
  async function setQtyAbsolute(item, newQty) {
    if (!isMyBranch) return;
    const prev = stockMap[item.id] || 0;
    const next = Math.max(0, Math.round(Number(newQty) || 0));
    if (next === prev) return;
    setSaving(item.id);
    setStockMap(old => ({ ...old, [item.id]: next }));
    try {
      const { error } = await supabase.from('cake_stock').upsert({
        org_id: orgId, branch_id: activeBranchId, item_id: item.id,
        qty: next, updated_by: empId, updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id,item_id' });
      if (error) throw error;
      await writeLog(item.id, item.name, 'adjust', next - prev, next, null);
    } catch (err) {
      setStockMap(old => ({ ...old, [item.id]: prev }));
      alert('บันทึกไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setSaving(null);
    }
  }

  // Receive production into stock (semi-auto claim)
  async function claimProduction(item, entries) {
    if (!isMyBranch || !entries?.length) return;
    const totalQty = entries.reduce((s, e) => s + e.qty, 0);
    const prev = stockMap[item.id] || 0;
    const next = prev + totalQty;
    setSaving(item.id);
    setStockMap(old => ({ ...old, [item.id]: next }));
    try {
      const { error } = await supabase.from('cake_stock').upsert({
        org_id: orgId, branch_id: activeBranchId, item_id: item.id,
        qty: next, updated_by: empId, updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id,item_id' });
      if (error) throw error;
      // Log each claimed entry with its ID in the note field
      for (const e of entries) {
        await writeLog(item.id, item.name, 'production_claim', e.qty, next, e.id);
      }
      // Remove from pending claims
      const claimedKey = item.name.toLowerCase();
      setProdClaims(prev => { const n = { ...prev }; delete n[claimedKey]; return n; });
      setClaimedIds(prev => { const n = new Set(prev); entries.forEach(e => n.add(e.id)); return n; });
      // Update detail view qty
      if (detailItem?.id === item.id) setDetailItem(d => ({ ...d }));
    } catch (err) {
      setStockMap(old => ({ ...old, [item.id]: prev }));
      alert('บันทึกไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setSaving(null);
    }
  }

  // Adjust spoiled qty
  async function adjustSpoiled(item, delta) {
    if (!isMyBranch) return;
    const prev = spoiledMap[item.id] || 0;
    const next = Math.max(0, prev + delta);
    setSavingSpoiled(item.id);
    setSpoiledMap(old => ({ ...old, [item.id]: next }));
    try {
      const { error } = await supabase.from('cake_stock').upsert({
        org_id: orgId,
        branch_id: activeBranchId,
        item_id: item.id,
        qty_spoiled: next,
        updated_by: empId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id,item_id' });
      if (error) throw error;
      await writeLog(item.id, item.name, 'spoiled', delta, next, null);
    } catch (err) {
      setSpoiledMap(old => ({ ...old, [item.id]: prev }));
      alert('บันทึกไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setSavingSpoiled(null);
    }
  }

  // Toggle open/close (is_open) — only own branch context, but is_open is global per item
  // Only admin can do this; employees see toggle but request goes through
  // For simplicity: update is_open directly (admin-like), per approved design
  async function toggleOpen(item) {
    const newOpen = !item.is_open;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_open: newOpen } : i));
    await supabase.from('cake_items').update({ is_open: newOpen, updated_at: new Date().toISOString() }).eq('id', item.id);
    await writeLog(item.id, item.name, newOpen ? 'open' : 'close', null, null, null);
  }

  // Save price to cake_items (manual override — ปกติราคาจะ sync จาก Operate)
  async function savePrice(item) {
    if (priceInput === '' || priceInput == null) { alert('กรุณาใส่ราคาก่อนบันทึก'); return; }
    const p = parseFloat(priceInput);
    if (isNaN(p) || p < 0) { alert('ราคาไม่ถูกต้อง'); return; }
    setPriceSaving(true);
    try {
      const { error } = await supabase.from('cake_items').update({ price: p }).eq('id', item.id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, price: p } : i));
      setDetailItem(prev => prev ? { ...prev, price: p } : prev);
      setPriceSavedId(item.id);
      setTimeout(() => setPriceSavedId(null), 2000);
    } catch (err) {
      alert('บันทึกราคาไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setPriceSaving(false);
    }
  }

  // Save sub-category override to cake_items
  async function saveCategory(item, cat) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: cat } : i));
    setDetailItem(prev => prev && prev.id === item.id ? { ...prev, category: cat } : prev);
    try {
      const { error } = await supabase.from('cake_items').update({ category: cat }).eq('id', item.id);
      if (error) throw error;
      await writeLog(item.id, item.name, 'adjust', null, null, `จัดหมวด: ${catLabel(cat)}`);
    } catch (err) {
      alert('บันทึกหมวดไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    }
  }

  // Seed price input when opening the detail drawer
  useEffect(() => {
    setPriceInput(detailItem?.price != null ? String(detailItem.price) : '');
  }, [detailItem?.id]);

  // โหลดจำนวนแยกสาขาเมื่อเปิดรายละเอียด
  useEffect(() => {
    if (!detailItem || !orgId) { setDetailBranchQty([]); return; }
    let cancelled = false;
    supabase.from('cake_stock').select('branch_id,qty').eq('org_id', orgId).eq('item_id', detailItem.id)
      .then(({ data }) => {
        if (cancelled) return;
        const byBranch = {};
        (data || []).forEach(r => { byBranch[r.branch_id] = (byBranch[r.branch_id] || 0) + (Number(r.qty) || 0); });
        const list = (branches.length ? branches : Object.keys(byBranch).map(id => ({ id, label: id })))
          .map(b => ({ id: b.id, label: b.label, qty: byBranch[b.id] || 0 }));
        setDetailBranchQty(list);
      });
    return () => { cancelled = true; };
  }, [detailItem?.id, orgId, branches]);

  // Push เมนูที่ "ไม่เจอใน Operate" ขึ้นไปสร้างเป็นเมนูใน Operate (jebar_app_state.db.menus)
  // อ่าน state สดก่อนเขียน + append เท่านั้น (ไม่แตะเมนูเดิม) เพื่อลดการชนกับ Operate
  async function pushOrphansToOperate() {
    const opNorm = new Set(operateMenus.map(m => normName(m.name)));
    const orphans = items.filter(it => operateMenus.length > 0 && !opNorm.has(normName(it.name)));
    if (!orphans.length) { setOperateSyncMsg('ไม่มีรายการที่ต้องส่งขึ้น Operate'); return; }
    if (!window.confirm(`ส่ง ${orphans.length} รายการขึ้นไปสร้างเป็นเมนูใน Operate?\n\n• หมวด: Bakery (+ หมวดย่อยตามที่จัดไว้)\n• ราคา: ตามที่ตั้งในแอป (ถ้ายังไม่มีจะเป็น 0)\n• เจ้าของไปใส่สูตร/ต้นทุนเพิ่มใน Operate ทีหลังได้\n\nแนะนำ: ปิดหน้า Operate ขณะส่ง แล้วเปิดใหม่เพื่อให้โหลดเมนูล่าสุด`)) return;
    setPushingOperate(true);
    setOperateSyncMsg('');
    try {
      const { data, error } = await supabase.from('jebar_app_state').select('db').eq('shop_code', 'jebar').limit(1).single();
      if (error || !data?.db) throw error || new Error('อ่านข้อมูล Operate ไม่ได้');
      const opDb = data.db;
      const menus = Array.isArray(opDb.menus) ? [...opDb.menus] : [];
      const existNorm = new Set(menus.map(m => normName(m.name)));
      const catType = { cake: 'Cake', bread: 'Bread', snack: 'Snack', other: 'Other bakery' };
      const ts = Date.now().toString(36).toUpperCase();
      let added = 0;
      orphans.forEach((it, i) => {
        if (existNorm.has(normName(it.name))) return; // กันซ้ำ
        const cat = it.category || guessCategory(it.name);
        menus.push({
          id: `HRB${ts}${i}`,
          name: it.name,
          category: 'Bakery',
          type: catType[cat] || 'Other bakery',
          priceStore: Number(it.price) || 0,
          priceLine: 0,
          status: it.is_open ? 'ขาย' : 'หยุดขาย',
          source: 'hr',
          createdAt: new Date().toISOString(),
        });
        existNorm.add(normName(it.name));
        added++;
      });
      if (!added) { setOperateSyncMsg('รายการเหล่านี้มีใน Operate อยู่แล้ว'); return; }
      const { error: upErr } = await supabase.from('jebar_app_state').update({ db: { ...opDb, menus } }).eq('shop_code', 'jebar');
      if (upErr) throw upErr;
      setOperateMenus(prev => [...prev, ...orphans]); // ให้ป้าย "ไม่เจอใน Operate" หาย
      setOperateSyncMsg(`✓ ส่งขึ้น Operate แล้ว ${added} รายการ — เปิด Operate (กดโหลด/รีเฟรช) เพื่อใส่สูตร/ราคาเพิ่ม`);
    } catch (e) {
      alert('ส่งขึ้น Operate ไม่สำเร็จ: ' + (e?.message || 'ลองใหม่'));
    } finally {
      setPushingOperate(false);
    }
  }

  // Upload product photo to Supabase Storage, save URL to cake_items
  async function uploadItemPhoto(item, file) {
    if (!file) return;
    setPhotoUploading(item.id);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `cake-items/${item.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('ops-photos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('ops-photos').getPublicUrl(path);
      await supabase.from('cake_items').update({ photo_url: publicUrl }).eq('id', item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, photo_url: publicUrl } : i));
      if (detailItem?.id === item.id) setDetailItem(prev => ({ ...prev, photo_url: publicUrl }));
    } finally {
      setPhotoUploading(null);
    }
  }

  // Create a shareable catalog session link
  async function createCatalog() {
    if (!orgId) return;
    setCreatingCatalog(true);
    setCatalogLink('');
    try {
      const { data, error } = await supabase.from('catalog_sessions').insert({
        org_id: orgId,
        branch_id: activeBranchId === 'all' ? null : (activeBranchId || null),
        created_by: empName,
      }).select('id').single();
      if (error || !data) throw error || new Error('ไม่สามารถสร้างลิงก์ได้');
      const link = `${window.location.origin}/catalog/${data.id}`;
      setCatalogLink(link);
    } finally {
      setCreatingCatalog(false);
    }
  }

  function copyCatalogLink() {
    if (!catalogLink) return;
    navigator.clipboard.writeText(catalogLink).then(() => {
      setCatalogCopied(true);
      setTimeout(() => setCatalogCopied(false), 2500);
    });
  }

  // Auto-sort: open items first
  async function autoSort() {
    const sorted = [
      ...items.filter(i => i.is_open),
      ...items.filter(i => !i.is_open),
    ].map((item, idx) => ({ ...item, sort_order: idx }));
    setItems(sorted);
    await Promise.all(
      sorted.map(item => supabase.from('cake_items').update({ sort_order: item.sort_order }).eq('id', item.id))
    );
    await writeLog(null, 'ทั้งหมด', 'reorder', null, null, 'auto-sort');
  }

  // Drag handlers
  function onDragStart(idx) { dragItem.current = idx; setDragActiveIdx(idx); setDragOverIdx(idx); }
  function onDragEnter(idx) { dragOver.current = idx; setDragOverIdx(idx); }
  function onDragEnd() {
    setDragActiveIdx(null);
    setDragOverIdx(null);
    if (dragItem.current === null || dragOver.current === null) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragItem.current, 1);
    newItems.splice(dragOver.current, 0, moved);
    dragItem.current = null;
    dragOver.current = null;
    const updated = newItems.map((item, idx) => ({ ...item, sort_order: idx }));
    setItems(updated);
    Promise.all(
      updated.map(item => supabase.from('cake_items').update({ sort_order: item.sort_order }).eq('id', item.id))
    ).then(() => writeLog(null, 'ทั้งหมด', 'reorder', null, null, 'drag'));
  }

  // Move item up or down (mobile-friendly alternative to drag)
  function moveItem(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    const updated = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setItems(updated);
    Promise.all(
      updated.map(item => supabase.from('cake_items').update({ sort_order: item.sort_order }).eq('id', item.id))
    ).then(() => writeLog(null, 'ทั้งหมด', 'reorder', null, null, 'move'));
  }

  // Touch drag state
  const touchDragIdx = useRef(null);

  function onTouchStart(e, idx) {
    touchDragIdx.current = idx;
    e.currentTarget.style.opacity = '0.5';
  }
  function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest('[data-drag-idx]');
    if (row) dragOver.current = parseInt(row.dataset.dragIdx);
  }
  function onTouchEnd(e, idx) {
    e.currentTarget.style.opacity = '1';
    dragItem.current = touchDragIdx.current;
    onDragEnd();
    touchDragIdx.current = null;
  }

  // Request to add item
  async function submitRequestAdd() {
    if (!requestName.trim()) return;
    setRequestSending(true);
    try {
      await supabase.from('cake_items').insert({
        org_id: orgId,
        name: requestName.trim(),
        sort_order: 9999,
        is_open: true,
        status: 'pending_add',
        requested_by: empId,
      });
      await writeLog(null, requestName.trim(), 'request_add', requestQty || null, null, `ขอเพิ่มโดย ${empName}`);
      setShowRequestAdd(false);
      setRequestName('');
      setRequestQty(1);
      alert('ส่งคำขอแล้ว รอแอดมินอนุมัติ');
    } finally {
      setRequestSending(false);
    }
  }

  // Request to delete item
  async function submitRequestDelete(item) {
    await supabase.from('cake_items').update({ status: 'pending_delete', requested_by: empId }).eq('id', item.id);
    await writeLog(item.id, item.name, 'request_delete', null, null, `ขอลบโดย ${empName}`);
    setPendingDelete(null);
    alert(`ส่งคำขอลบ "${item.name}" แล้ว รอแอดมินอนุมัติ`);
    load();
  }

  // ดึงยอดจาก Operate (jebar_app_state → shopStock)
  async function syncFromOperate() {
    if (!isMyBranch || operateSyncing) return;
    setOperateSyncing(true);
    setOperateSyncMsg('');
    try {
      const { data, error } = await supabase
        .from('jebar_app_state')
        .select('db')
        .eq('shop_code', 'jebar')
        .limit(1)
        .single();
      if (error || !data?.db) { setOperateSyncMsg('ดึงข้อมูล Operate ไม่สำเร็จ'); return; }

      const menus = data.db.menus || [];
      const shopStock = data.db.shopStock || [];

      // หา label ของ branch ที่ active อยู่
      const activeBranch = branches.find(b => b.id === activeBranchId);
      const branchLabel = activeBranch?.label || '';

      // normalize สำหรับ fuzzy match
      const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, '');

      // map menuId → onHand โดยกรอง branchId ตรงกับ branchLabel
      const onHandByMenuId = {};
      shopStock.forEach(s => {
        if (norm(s.branchId) === norm(branchLabel) || !branchLabel) {
          onHandByMenuId[s.menuId] = Number(s.onHand) || 0;
        }
      });

      // map ชื่อ (normalized) → onHand
      const onHandByName = {};
      menus.forEach(m => {
        if (onHandByMenuId[m.id] !== undefined) {
          onHandByName[norm(m.name)] = onHandByMenuId[m.id];
        }
      });

      // map ชื่อ (normalized) → ราคา (priceStore) + หมวด (จาก type/subCategory) จาก Operate
      const metaByName = {};
      menus.forEach(m => {
        metaByName[norm(m.name)] = {
          price: m.priceStore ?? m.price ?? m.selling_price ?? null,
          category: resolveCategory(m),
        };
      });

      // อัปเดต cake_stock (qty) + cake_items (price, category) ให้ตรงกับ Operate
      let updated = 0;
      const newStockMap = { ...stockMap };
      const itemPatch = {}; // { item_id: {price?, category?} }
      for (const item of items) {
        const key = norm(item.name);
        // qty
        if (onHandByName[key] !== undefined) {
          const newQty = onHandByName[key];
          const { error: upsertErr } = await supabase.from('cake_stock').upsert({
            org_id: orgId,
            branch_id: activeBranchId,
            item_id: item.id,
            qty: newQty,
            updated_by: empId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'branch_id,item_id' });
          if (!upsertErr) {
            newStockMap[item.id] = newQty;
            updated++;
          }
        }
        // price + category — ดึงจาก Operate เป็นแหล่งข้อมูลหลัก
        const meta = metaByName[key];
        if (meta) {
          const patch = {};
          if (meta.price != null && Number(meta.price) !== Number(item.price)) patch.price = meta.price;
          const cat = meta.category || guessCategory(item.name);
          if (cat && cat !== item.category) patch.category = cat;
          if (Object.keys(patch).length) {
            const { error: upErr } = await supabase.from('cake_items').update(patch).eq('id', item.id);
            if (!upErr) itemPatch[item.id] = patch;
          }
        }
      }
      setStockMap(newStockMap);
      if (Object.keys(itemPatch).length) {
        setItems(prev => prev.map(i => itemPatch[i.id] ? { ...i, ...itemPatch[i.id] } : i));
      }
      setOperateSyncMsg(updated > 0 ? `ดึงจาก Operate แล้ว ${updated} รายการ (ยอด+ราคา+หมวด)` : 'ไม่พบข้อมูลสต็อกจาก Operate');
    } catch {
      setOperateSyncMsg('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setOperateSyncing(false);
      setTimeout(() => setOperateSyncMsg(''), 4000);
    }
  }

  // Load history log
  async function openHistory() {
    setShowHistory(true);
    setLogsLoading(true);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('cake_stock_log')
      .select('*')
      .eq('org_id', orgId)
      .eq('branch_id', activeBranchId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  }

  // Export image — แยกจำนวนทุกสาขา + รวม · รายการครบ (ยอด 0 แสดง 0)
  async function handleExport() {
    // ดึงสต็อกทุกสาขา (ทั้ง org) เพื่อทำคอลัมน์ต่อสาขา
    const { data: stockData } = await supabase.from('cake_stock')
      .select('item_id,branch_id,qty,qty_spoiled').eq('org_id', orgId);
    const qtyMap = {}, spoiledByItem = {};
    (stockData || []).forEach(r => {
      qtyMap[`${r.item_id}__${r.branch_id}`] = (qtyMap[`${r.item_id}__${r.branch_id}`] || 0) + (Number(r.qty) || 0);
      spoiledByItem[r.item_id] = (spoiledByItem[r.item_id] || 0) + (Number(r.qty_spoiled) || 0);
    });
    // คอลัมน์สาขา: ใช้ branches; ถ้าไม่มี ให้ดึงจาก branch_id ที่พบ
    let cols = branches.length ? branches
      : [...new Set((stockData || []).map(r => r.branch_id).filter(Boolean))].map(id => ({ id, label: id }));
    if (!cols.length) cols = [{ id: '__all', label: 'จำนวน' }];
    // export เฉพาะเมนูที่เปิดขาย (เปิด+ยอด 0 ก็เอา) — ตัดเมนูที่ปิดขายออก
    const exportItems = items.filter(i => i.is_open);
    const blob = await exportToImage({ items: exportItems, branches: cols, qtyMap, spoiledByItem, empName });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cake-stock-ทุกสาขา-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalQty = items.reduce((s, i) => s + (stockMap[i.id] || 0), 0);
  const openCount = items.filter(i => (stockMap[i.id] || 0) > 0).length;

  // Submit report snapshot to employee_ops_entries (task_key='cake-stock')
  async function submitReport() {
    if (!isMyBranch || submitting) return;
    const activeBranch = branches.find(b => b.id === activeBranchId);
    const branchName = activeBranch?.label || 'ไม่ระบุสาขา';
    // Upload spoiled photos to Storage, replace base64 with URLs
    const photoUrls = {};
    const spoiledItemsWithPhoto = items.filter(i => i.is_open && spoiledDetails[i.id]?.photo?.startsWith('data:'));
    for (const item of spoiledItemsWithPhoto) {
      try {
        const b64 = spoiledDetails[item.id].photo;
        const [meta, data] = b64.split(',');
        const mime = (meta.match(/:(.*?);/) || [])[1] || 'image/jpeg';
        const bytes = atob(data);
        const arr = new Uint8Array(bytes.length);
        for (let k = 0; k < bytes.length; k++) arr[k] = bytes.charCodeAt(k);
        const blob = new Blob([arr], { type: mime });
        const ext = mime.split('/')[1] || 'jpg';
        const path = `waste/${orgId}/${activeBranchId}/${Date.now()}-${item.id}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage.from('jebar-images').upload(path, blob, { contentType: mime, upsert: true });
        if (!upErr && up) {
          const { data: pub } = supabase.storage.from('jebar-images').getPublicUrl(up.path);
          photoUrls[item.id] = pub?.publicUrl || '';
        }
      } catch { /* ถ้า upload ไม่สำเร็จ ข้ามไป */ }
    }

    const openItems = items.filter(i => i.is_open).map(i => ({
      name: i.name,
      qty: stockMap[i.id] || 0,
      qty_spoiled: spoiledMap[i.id] || 0,
      spoiled_reason: (spoiledDetails[i.id]?.reason) || '',
      spoiled_note: (spoiledDetails[i.id]?.note) || '',
      spoiled_photo: photoUrls[i.id] || '',
    }));

    // Check if someone from same branch already submitted today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from('employee_ops_entries')
      .select('payload,created_at')
      .eq('task_key', 'cake-stock')
      .eq('org_id', orgId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Filter to same branch only (payload.branch_id)
    const sameBranch = (existing || []).filter(r => r.payload?.branch_id === activeBranchId);
    if (sameBranch.length > 0) {
      const prev = sameBranch[0];
      const prevName = prev.payload?.submitted_by || 'ไม่ระบุ';
      const prevTime = new Date(prev.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const isSelf = prevName === empName;
      const msg = isSelf
        ? `คุณส่งรายงานไปแล้วเมื่อ ${prevTime}\nต้องการส่งอัปเดตข้อมูลใหม่ไหม?`
        : `${prevName} ส่งรายงานสาขานี้แล้วเมื่อ ${prevTime}\nต้องการส่งเพิ่มเติมไหม?`;
      if (!window.confirm(msg)) return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('employee_submit_ops_entry', {
        p_emp_id: empId,
        p_task_key: 'cake-stock',
        p_payload: {
          submitted_by: empName,
          branch_id: activeBranchId,
          branch_name: branchName,
          submitted_at: new Date().toISOString(),
          items: openItems,
          total_qty: openItems.reduce((s, i) => s + i.qty, 0),
          total_spoiled: openItems.reduce((s, i) => s + i.qty_spoiled, 0),
        },
      });
      if (error) throw error;
      const now = new Date().toISOString();
      setLastSubmitted(now);
      alert(`ส่งรายงานแล้ว ✓\n${branchName} · ${openItems.length} รายการ\n${new Date(now).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (err) {
      alert('ส่งรายงานไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── ตัวเช็คข้อมูล (ราคา / match กับ Operate) ───
  const opNormSet = new Set(operateMenus.map(m => normName(m.name)));
  const itemNoPrice = it => it.price == null || it.price === '';
  const itemNotInOp = it => operateMenus.length > 0 && !opNormSet.has(normName(it.name));
  const itemMissing = it => itemNoPrice(it) || itemNotInOp(it);
  const noPriceCount = items.filter(itemNoPrice).length;
  const notInOpCount = items.filter(itemNotInOp).length;
  const missingCount = items.filter(itemMissing).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--ink)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/emp/ops')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>สต็อกขนม</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>{isMyBranch ? 'สาขาของคุณ — แก้ไขได้' : 'ดูข้อมูลเท่านั้น'}</div>
        </div>
        <button onClick={openHistory} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>ประวัติ</button>
        <button onClick={handleExport} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Export</button>
      </div>

      {/* Operate sync message */}
      {operateSyncMsg && (
        <div style={{ background: 'var(--accent-soft)', borderBottom: '1px solid var(--line)', padding: '8px 16px', fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {operateSyncMsg}
        </div>
      )}

      {/* Branch tabs */}
      {branches.length > 0 && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', overflowX: 'auto', display: 'flex', padding: '0 8px' }}>
          {/* All-branches tab */}
          <button
            onClick={() => setActiveBranchId('all')}
            style={{
              whiteSpace: 'nowrap', padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: activeBranchId === 'all' ? 700 : 400,
              color: activeBranchId === 'all' ? 'var(--ink)' : 'var(--muted)',
              background: 'none',
              borderBottom: activeBranchId === 'all' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            รวมทุกสาขา
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              style={{
                whiteSpace: 'nowrap', padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 14,
                fontWeight: b.id === activeBranchId ? 700 : 400,
                color: b.id === activeBranchId ? 'var(--ink)' : 'var(--muted)',
                background: 'none',
                borderBottom: b.id === activeBranchId ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {b.id === myBranchId ? '★ ' : ''}{b.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary bar */}
      <div style={{ background: 'var(--surface)', padding: '12px 16px', display: 'flex', gap: 16, borderBottom: '1px solid var(--line)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{totalQty}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>รวมทั้งหมด</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{openCount}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>รายการมีสินค้า</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>{items.length - openCount}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>รายการว่าง</div>
        </div>
        <div style={{ flex: 1 }} />
        {isMyBranch && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={syncFromOperate} disabled={operateSyncing}
              style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--accent)', opacity: operateSyncing ? 0.6 : 1 }}>
              {operateSyncing ? '...' : '↻'} Operate
            </button>
            <button onClick={autoSort} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--ink)' }}>
              ↕ จัดลำดับ
            </button>
            <button onClick={() => setShowRequestAdd(true)} style={{ background: 'var(--ink)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
              + เพิ่ม
            </button>
          </div>
        )}
        {/* Catalog button — always visible */}
        <button
          onClick={createCatalog}
          disabled={creatingCatalog}
          style={{ background: '#7c3aed', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', flexShrink: 0, opacity: creatingCatalog ? 0.7 : 1 }}
        >
          {creatingCatalog ? '...' : '🔗 แคตตาล็อก'}
        </button>
      </div>

      {/* Submit report bar — only own branch */}
      {isMyBranch && (
        <div style={{ background: lastSubmitted ? 'var(--accent-soft)' : 'var(--bg)', padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            {lastSubmitted ? (
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                ✓ ส่งรายงานแล้ว · {new Date(lastSubmitted).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                เช็คสต็อคเสร็จแล้ว? กดส่งให้แอดมิน
              </div>
            )}
          </div>
          <button
            onClick={submitReport}
            disabled={submitting}
            style={{
              background: lastSubmitted ? 'var(--accent)' : 'var(--ink)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'กำลังส่ง...' : lastSubmitted ? '✓ ส่งอีกครั้ง' : 'ส่งรายงาน'}
          </button>
        </div>
      )}

      {/* Catalog link banner */}
      {catalogLink && (
        <div style={{ margin: '8px 12px 0', background: '#f5f3ff', border: '1.5px solid #7c3aed', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>🔗 ลิงก์แคตตาล็อกพร้อมแล้ว</div>
            <button onClick={() => setCatalogLink('')} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#a78bfa', padding: 0, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: '#6d28d9', background: '#ede9fe', borderRadius: 8, padding: '6px 10px', wordBreak: 'break-all', marginBottom: 8 }}>{catalogLink}</div>
          <button onClick={copyCatalogLink} style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', background: catalogCopied ? '#16a34a' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {catalogCopied ? '✓ คัดลอกแล้ว!' : '📋 คัดลอกลิงก์'}
          </button>
          <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 6, textAlign: 'center' }}>ส่งให้ลูกค้าผ่าน LINE หรือ Messenger ได้เลย</div>
        </div>
      )}

      {/* Production claim banner */}
      {isMyBranch && Object.keys(prodClaims).length > 0 && (
        <div style={{ margin: '8px 12px 0', background: '#E6F4F0', border: '1.5px solid var(--accent)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 13h12l1-13"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>📦 ผลผลิตใหม่ {Object.keys(prodClaims).length} รายการ</div>
            <div style={{ fontSize: 11, color: '#5a9a8a', marginTop: 1 }}>กดรายละเอียดแต่ละรายการเพื่อรับเข้าสต็อก</div>
          </div>
        </div>
      )}

      {/* My pending requests banner */}
      {myPendingRequests.length > 0 && (
        <div style={{ margin: '8px 12px 0', background: '#FFF7ED', border: '1.5px solid #F97316', borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2410C', marginBottom: 4 }}>📋 รายการที่ขอเพิ่ม ({myPendingRequests.length})</div>
          {myPendingRequests.map(r => (
            <div key={r.id} style={{ fontSize: 12, color: '#9A3412', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⏳</span>
              <span style={{ flex: 1 }}>{r.name}</span>
              <span style={{ color: '#D97706', fontWeight: 600, fontSize: 11 }}>รอแอดมินอนุมัติ</span>
            </div>
          ))}
        </div>
      )}

      {/* ตัวเช็คข้อมูล — รายการที่ขาดราคา / ไม่เจอใน Operate */}
      {isMyBranch && items.length > 0 && missingCount > 0 && (
        <div style={{ margin: '10px 12px 0', background: '#FFF7ED', border: '1.5px solid #F97316', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C2410C' }}>
              ⚠️ ตรวจข้อมูล — {missingCount} รายการยังไม่ครบ
            </div>
            <button onClick={() => setShowMissingOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: showMissingOnly ? '#C2410C' : '#FED7AA', color: showMissingOnly ? '#fff' : '#9A3412' }}>
              {showMissingOnly ? '✓ กำลังกรอง' : 'ดูเฉพาะที่ขาด'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: '#9A3412', flexWrap: 'wrap' }}>
            {noPriceCount > 0 && <span>💰 ไม่มีราคา: <b>{noPriceCount}</b></span>}
            {notInOpCount > 0 && <span>🔗 ไม่เจอใน Operate: <b>{notInOpCount}</b></span>}
          </div>
          {notInOpCount > 0 && (
            <>
              <div style={{ fontSize: 10.5, color: '#B45309', marginTop: 6 }}>
                💡 "ไม่เจอใน Operate" = เมนูนี้มีแค่ในแอปพนักงาน ยังไม่มีใน Operate (ไม่มีสูตร/ต้นทุน/GP%)
              </div>
              <button onClick={pushOrphansToOperate} disabled={pushingOperate}
                style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, opacity: pushingOperate ? 0.6 : 1 }}>
                {pushingOperate ? 'กำลังส่ง...' : `⬆️ ส่ง ${notInOpCount} รายการขึ้น Operate (สร้างเมนู Bakery)`}
              </button>
              <div style={{ fontSize: 10, color: '#B45309', marginTop: 4 }}>
                เจ้าของไปใส่สูตร/ต้นทุนเพิ่มใน Operate ทีหลังได้ — ราคา/หมวดจะ sync กลับมาเอง
              </div>
            </>
          )}
        </div>
      )}

      {/* Category filter chips */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 12px 2px', WebkitOverflowScrolling: 'touch' }}>
          {[{ id: 'all', label: `ทั้งหมด (${items.length})` },
            ...CAKE_CATEGORIES.map(c => ({
              id: c.id,
              label: `${c.label} (${items.filter(it => (it.category || guessCategory(it.name)) === c.id).length})`,
            }))
          ].map(c => {
            const on = catFilter === c.id;
            return (
              <button key={c.id} onClick={() => setCatFilter(c.id)} style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit',
                border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                background: on ? 'var(--accent)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: on ? 700 : 400, whiteSpace: 'nowrap',
              }}>{c.label}</button>
            );
          })}
        </div>
      )}
      {catFilter !== 'all' && (
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 16px 0' }}>
          ℹ️ ปิดการเรียงลำดับชั่วคราวขณะกรองหมวด — กด "ทั้งหมด" เพื่อจัดลำดับ
        </div>
      )}

      {/* Item list */}
      <div style={{ padding: '12px 12px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="15" width="20" height="6" rx="2"/><rect x="5" y="11" width="14" height="4"/><line x1="5" y1="11" x2="19" y2="11"/><line x1="12" y1="6" x2="12" y2="11"/><path d="M12 6 Q10 3.5 12 2 Q14 3.5 12 6z" fill="currentColor" stroke="none"/></svg>
            </div>
            <div>ยังไม่มีรายการขนม</div>
          </div>
        ) : (
          items.map((item, idx) => {
            const itemCat = item.category || guessCategory(item.name);
            if (catFilter !== 'all' && itemCat !== catFilter) return null;
            if (showMissingOnly && !itemMissing(item)) return null;
            const qty = stockMap[item.id] || 0;
            const spoiled = spoiledMap[item.id] || 0;
            const isSaving = saving === item.id;
            const isSavingSpoiled = savingSpoiled === item.id;
            const canEdit = isMyBranch;
            const canReorder = canEdit && catFilter === 'all';
            const details = spoiledDetails[item.id] || {};
            const photoInputId = `spoiled-photo-${item.id}`;
            const qtyVal = qtyInput[item.id] !== undefined ? qtyInput[item.id] : String(qty);
            const pendingEntries = prodClaims[item.name.toLowerCase()] || [];
            const pendingTotal = pendingEntries.reduce((s, e) => s + e.qty, 0);
            return (
              <div key={item.id} style={{ marginBottom: 8 }}>
              <div
                data-drag-idx={idx}
                draggable={canReorder}
                onDragStart={() => canReorder && onDragStart(idx)}
                onDragEnter={() => canReorder && onDragEnter(idx)}
                onDragOver={canReorder ? e => e.preventDefault() : undefined}
                onDragEnd={canReorder ? onDragEnd : undefined}
                onTouchStart={canReorder ? e => onTouchStart(e, idx) : undefined}
                onTouchMove={canReorder ? onTouchMove : undefined}
                onTouchEnd={canReorder ? e => onTouchEnd(e, idx) : undefined}
                style={{
                  background: dragOverIdx === idx && dragActiveIdx !== idx ? 'var(--hover)' : item.is_open ? 'var(--surface)' : '#F1F1F3',
                  border: pendingTotal > 0 ? '1.5px solid var(--accent)' : item.is_open ? '1.5px solid transparent' : '1.5px dashed #C9CCD1',
                  borderRadius: 14,
                  padding: '12px 14px',
                  boxShadow: item.is_open ? 'var(--shadow-sm)' : 'none',
                  opacity: dragActiveIdx === idx ? 0.35 : 1,
                  userSelect: 'none', WebkitUserSelect: 'none',
                  transition: 'background 0.1s, opacity 0.1s',
                  borderTop: dragOverIdx === idx && dragActiveIdx !== idx ? '2px solid var(--accent)' : undefined,
                }}
              >
                {/* ── Top row: icon + name + status + chevron ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {canReorder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, cursor: 'grab' }}>
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', padding: '1px 4px', fontSize: 12, color: idx === 0 ? '#E5E7EB' : '#C4B8AC', cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                        style={{ background: 'none', border: 'none', padding: '1px 4px', fontSize: 12, color: idx === items.length - 1 ? '#E5E7EB' : '#C4B8AC', cursor: idx === items.length - 1 ? 'default' : 'pointer', lineHeight: 1 }}>▼</button>
                    </div>
                  )}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: getBg(item.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
                    {item.photo_url
                      ? <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getIcon(item.name)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: item.is_open ? 'var(--ink)' : '#9CA3AF', lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      {item.is_open
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#DCFCE7', borderRadius: 8, padding: '2px 8px' }}>● เปิดขาย</span>
                        : <span style={{ fontSize: 10, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', borderRadius: 8, padding: '2px 8px' }}>⛔ ปิดขาย</span>}
                      <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 8, padding: '1px 7px' }}>
                        {catLabel(itemCat)}
                      </span>
                      {item.price != null && item.price !== '' ? (
                        <span style={{ fontSize: 10, color: '#166534', background: '#DCFCE7', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>฿{item.price}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#C2410C', background: '#FFEDD5', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>ไม่มีราคา</span>
                      )}
                      {itemNotInOp(item) && (
                        <span style={{ fontSize: 10, color: '#B91C1C', background: '#FEE2E2', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>ไม่เจอใน Operate</span>
                      )}
                      {spoiled > 0 && (
                        <span style={{ fontSize: 10, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                          🗑 เสีย {spoiled}
                        </span>
                      )}
                      {pendingTotal > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', background: '#E6F4F0', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                          📦 +{pendingTotal} รอรับ
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailItem(item)}
                    style={{ background: '#F5F0EB', border: 'none', borderRadius: 8, padding: '4px 8px', fontSize: 11, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    รายละเอียด ›
                  </button>
                </div>

                {/* ── Bottom row: stepper + unit ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  {canEdit ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#F9F5F0', borderRadius: 10, padding: 3 }}>
                      <button
                        onClick={() => adjustQty(item, -1)}
                        disabled={qty === 0 || isSaving}
                        style={{ width: 38, height: 38, border: 'none', borderRadius: 8, fontSize: 22, fontWeight: 700, cursor: qty === 0 ? 'not-allowed' : 'pointer', color: qty === 0 ? '#D1D5DB' : '#DC2626', background: qty === 0 ? 'transparent' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: qty === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.08)', flexShrink: 0 }}
                      >−</button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={isSaving ? qty : qtyVal}
                        disabled={isSaving}
                        onChange={e => setQtyInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => {
                          const v = Number(qtyVal);
                          if (!isNaN(v) && v !== qty) setQtyAbsolute(item, v);
                          setQtyInput(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.target.blur(); }
                        }}
                        style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 22, border: 'none', background: 'transparent', outline: 'none', color: qty > 0 ? '#166534' : '#9CA3AF', minWidth: 0, fontFamily: 'inherit' }}
                      />
                      <button
                        onClick={() => adjustQty(item, +1)}
                        disabled={isSaving}
                        style={{ width: 38, height: 38, border: 'none', borderRadius: 8, fontSize: 22, fontWeight: 700, cursor: 'pointer', color: '#16A34A', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', flexShrink: 0 }}
                      >+</button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 22, color: qty > 0 ? '#166534' : '#9CA3AF' }}>{qty || '—'}</div>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>ชิ้น</span>
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>

      {/* Request Delete Confirm Modal */}
      {pendingDelete && (
        <ModalOverlay onClose={() => setPendingDelete(null)}>
          <div style={{ padding: '20px 20px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>ขอลบรายการ</div>
            <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>
              ส่งคำขอลบ <strong>"{pendingDelete.name}"</strong> ให้แอดมินอนุมัติ?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPendingDelete(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontSize: 15 }}>
                ยกเลิก
              </button>
              <button onClick={() => submitRequestDelete(pendingDelete)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                ขอลบ
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Request Add Modal */}
      {showRequestAdd && (
        <ModalOverlay onClose={() => setShowRequestAdd(false)}>
          <div style={{ padding: '20px 20px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>ขอเพิ่มรายการขนม</div>

            {/* Suggestions from JE BAR menu */}
            {menuSuggestions.length > 0 && (() => {
              const existingNames = new Set(items.map(i => i.name));
              const suggestions = menuSuggestions.filter(n => !existingNames.has(n));
              return suggestions.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>จากเมนู JE BAR — แตะเพื่อเลือก</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestions.map(name => (
                      <button key={name} onClick={() => setRequestName(name)}
                        style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1.5px solid ${requestName === name ? 'var(--accent)' : 'var(--line)'}`,
                          background: requestName === name ? 'var(--accent)' : 'var(--bg)',
                          color: requestName === name ? '#fff' : 'var(--ink)',
                          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {getIcon(name)} {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            <input
              autoFocus
              value={requestName}
              onChange={e => setRequestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitRequestAdd()}
              placeholder="ชื่อรายการขนม เช่น เลมอนทาร์ต"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--line)',
                fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />

            {/* Qty input */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>จำนวนเริ่มต้น</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setRequestQty(q => Math.max(0, q - 1))}
                  style={{ width: 36, height: 36, borderRadius: 9, border: '1.5px solid var(--line)', background: 'var(--bg)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <input
                  type="number" min="0" value={requestQty}
                  onChange={e => setRequestQty(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 64, textAlign: 'center', padding: '8px 4px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <button onClick={() => setRequestQty(q => q + 1)}
                  style={{ width: 36, height: 36, borderRadius: 9, border: '1.5px solid var(--line)', background: 'var(--bg)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>ชิ้น</span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              คำขอจะส่งให้แอดมินอนุมัติก่อนแสดงในระบบ
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowRequestAdd(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontSize: 15 }}>
                ยกเลิก
              </button>
              <button
                onClick={submitRequestAdd}
                disabled={!requestName.trim() || requestSending}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, opacity: requestName.trim() ? 1 : 0.5 }}
              >
                {requestSending ? 'กำลังส่ง...' : 'ส่งคำขอ'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* History Modal */}
      {showHistory && (
        <ModalOverlay onClose={() => setShowHistory(false)}>
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ประวัติ 30 วัน</span>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '65vh', padding: '8px 0' }}>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>กำลังโหลด...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>ยังไม่มีประวัติ</div>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 18, flexShrink: 0 }}>{getIcon(log.item_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{log.item_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {ACTION_LABELS[log.action] || log.action}
                      {log.action === 'adjust' && log.delta != null && (
                        <span style={{ marginLeft: 6, color: log.delta > 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                          {log.delta > 0 ? `+${log.delta}` : log.delta} → {log.qty_after} ชิ้น
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      {log.emp_name} · {fmtTime(log.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Detail Drawer ── */}
      {detailItem && (() => {
        const di = detailItem;
        const dQty = stockMap[di.id] || 0;
        const dSpoiled = spoiledMap[di.id] || 0;
        const dPendingEntries = prodClaims[di.name.toLowerCase()] || [];
        const dPendingTotal = dPendingEntries.reduce((s, e) => s + e.qty, 0);
        const dDetails = spoiledDetails[di.id] || {};
        const dIsSaving = saving === di.id;
        const dIsSavingSpoiled = savingSpoiled === di.id;
        const photoInputId = `spoiled-photo-detail-${di.id}`;
        return (
          <div onClick={() => setDetailItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 430, maxHeight: '88vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease' }}>
              {/* Header */}
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: getBg(di.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, overflow: 'hidden' }}>
                  {di.photo_url ? <img src={di.photo_url} alt={di.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getIcon(di.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{di.name}</div>
                  <div style={{ fontSize: 11, color: di.is_open ? '#16A34A' : '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{di.is_open ? '● เปิดขาย' : '○ ปิดขาย'}</div>
                </div>
                <button onClick={() => setDetailItem(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>
                {/* จำนวนแยกสาขา + รวม */}
                {detailBranchQty.length > 0 && (
                  <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>จำนวนแยกสาขา</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {detailBranchQty.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ color: 'var(--ink)' }}>{b.id === myBranchId ? '★ ' : ''}{b.label}</span>
                          <span style={{ fontWeight: 700, color: b.qty > 0 ? '#166534' : '#9CA3AF' }}>{b.qty} ชิ้น</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, paddingTop: 6, marginTop: 1, borderTop: '1px solid var(--line)', fontWeight: 800 }}>
                        <span>รวมทุกสาขา</span>
                        <span style={{ color: 'var(--accent)' }}>{detailBranchQty.reduce((s, b) => s + b.qty, 0)} ชิ้น</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Production claim card */}
                {isMyBranch && dPendingTotal > 0 && (
                  <div style={{ background: '#fff', border: '1.5px solid var(--accent)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 13h12l1-13"/></svg>
                      ผลผลิตวันนี้รอรับเข้าสต็อก
                    </div>
                    {dPendingEntries.map((e, i) => (
                      <div key={i} style={{ background: '#F0FAF7', borderRadius: 10, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                            {e.jobNo ? `[${e.jobNo}] ` : ''}{e.batch || 'รอบผลิต'} · {e.empName || ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#5a9a8a', marginTop: 1 }}>{e.time}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>+{e.qty} {e.unit}</div>
                      </div>
                    ))}
                    <div style={{ background: '#E6F4F0', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
                      ยอดเก่า <strong>{dQty}</strong> + ผลิตมา <strong>{dPendingTotal}</strong> = <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{dQty + dPendingTotal} ชิ้น</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { setProdClaims(p => { const n={...p}; delete n[di.name.toLowerCase()]; return n; }); }}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#F5F0EB', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        ข้ามไป
                      </button>
                      <button
                        onClick={() => claimProduction(di, dPendingEntries)}
                        disabled={saving === di.id}
                        style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {saving === di.id ? '…' : '✓ รับเข้าสต็อก'}
                      </button>
                    </div>
                  </div>
                )}
                {/* Qty adjust */}
                <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>ปรับจำนวน</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#F9F5F0', borderRadius: 12, padding: 4 }}>
                    <button onClick={() => adjustQty(di, -1)} disabled={dQty === 0 || dIsSaving}
                      style={{ width: 44, height: 44, border: 'none', borderRadius: 10, fontSize: 24, fontWeight: 700, cursor: dQty === 0 ? 'not-allowed' : 'pointer', color: dQty === 0 ? '#D1D5DB' : '#DC2626', background: dQty === 0 ? 'transparent' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: dQty === 0 ? 'none' : '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0 }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 28, color: dQty > 0 ? '#166534' : '#9CA3AF' }}>{dIsSaving ? '…' : dQty}</div>
                    <button onClick={() => adjustQty(di, +1)} disabled={dIsSaving}
                      style={{ width: 44, height: 44, border: 'none', borderRadius: 10, fontSize: 24, fontWeight: 700, cursor: 'pointer', color: '#16A34A', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0 }}>+</button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>ชิ้น</div>
                </div>

                {/* Spoiled */}
                {isMyBranch && (
                  <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 10 }}>ของเสีย</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', borderRadius: 10, padding: '6px 8px', marginBottom: dSpoiled > 0 ? 12 : 0 }}>
                      <button onClick={() => adjustSpoiled(di, -1)} disabled={dSpoiled === 0 || dIsSavingSpoiled}
                        style={{ width: 32, height: 32, border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 700, cursor: dSpoiled === 0 ? 'not-allowed' : 'pointer', color: dSpoiled === 0 ? '#FECACA' : '#DC2626', background: dSpoiled === 0 ? 'transparent' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 18, color: dSpoiled > 0 ? '#DC2626' : '#FCA5A5' }}>{dIsSavingSpoiled ? '…' : `🗑 ${dSpoiled}`}</div>
                      <button onClick={() => adjustSpoiled(di, +1)} disabled={dIsSavingSpoiled}
                        style={{ width: 32, height: 32, border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#DC2626', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    {dSpoiled > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', marginBottom: 8 }}>ระบุสาเหตุ</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {SPOILED_REASONS.map(r => (
                            <button key={r.value}
                              onClick={() => setSpoiledDetails(prev => ({ ...prev, [di.id]: { ...prev[di.id], reason: r.value } }))}
                              style={{ padding: '5px 11px', borderRadius: 16, border: '1.5px solid', borderColor: dDetails.reason === r.value ? '#DC2626' : '#FECACA', background: dDetails.reason === r.value ? '#FEE2E2' : '#fff', color: dDetails.reason === r.value ? '#B91C1C' : '#9CA3AF', fontSize: 12, fontWeight: dDetails.reason === r.value ? 700 : 400, cursor: 'pointer' }}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <input type="text"
                          placeholder={dDetails.reason === 'other' ? 'ระบุสาเหตุ...' : 'หมายเหตุเพิ่มเติม (ไม่บังคับ)'}
                          value={dDetails.note || ''}
                          onChange={e => setSpoiledDetails(prev => ({ ...prev, [di.id]: { ...prev[di.id], note: e.target.value } }))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #FECACA', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, outline: 'none', background: '#fff', color: '#1F2937' }} />
                        <input type="file" accept="image/*" capture="environment" id={photoInputId} style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setSpoiledDetails(prev => ({ ...prev, [di.id]: { ...prev[di.id], photo: ev.target.result } }));
                            reader.readAsDataURL(file);
                          }} />
                        {dDetails.photo ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={dDetails.photo} alt="waste" style={{ height: 52, width: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid #FECACA' }} />
                            <button onClick={() => setSpoiledDetails(prev => ({ ...prev, [di.id]: { ...prev[di.id], photo: '' } }))}
                              style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ ลบรูป</button>
                          </div>
                        ) : (
                          <label htmlFor={photoInputId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px dashed #FECACA', background: '#fff', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            📷 ถ่ายรูปของเสีย
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Product photo for catalog */}
                <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>รูปสินค้า (สำหรับแคตตาล็อก)</div>
                  {di.photo_url ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={di.photo_url} alt={di.name} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1.5px solid var(--line)' }} />
                      <label style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '3px 7px', cursor: 'pointer' }}>
                        <span style={{ fontSize: 12, color: '#fff' }}>✏️</span>
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                          onChange={e => { if (e.target.files[0]) uploadItemPhoto(di, e.target.files[0]); e.target.value = ''; }} />
                      </label>
                    </div>
                  ) : (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1.5px dashed var(--line)', background: 'var(--bg)', cursor: photoUploading === di.id ? 'wait' : 'pointer' }}>
                      {photoUploading === di.id ? (
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>กำลังอัปโหลด...</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 20 }}>📷</span>
                          <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>เพิ่มรูปขนม</span>
                        </>
                      )}
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        disabled={!!photoUploading}
                        onChange={e => { if (e.target.files[0]) uploadItemPhoto(di, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  )}
                  {/* Price input */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>ราคา ฿</span>
                    <input
                      type="number" inputMode="decimal" placeholder="ยังไม่ได้ตั้ง"
                      value={priceInput}
                      onChange={e => setPriceInput(e.target.value)}
                      style={{ flex: 1, fontSize: 14, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', maxWidth: 100 }}
                    />
                    <button
                      onClick={() => savePrice(di)}
                      disabled={priceSaving}
                      style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: priceSavedId === di.id ? '#16a34a' : '#b0882a', color: '#fff', cursor: 'pointer' }}
                    >{priceSaving ? '...' : priceSavedId === di.id ? '✓ บันทึกแล้ว' : 'บันทึก'}</button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    💡 ราคาปกติดึงจาก Operate (ราคาหน้าร้าน) อัตโนมัติ — แก้ที่นี่เพื่อ override เฉพาะแอปพนักงาน
                  </div>

                  {/* Sub-category */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>หมวดหมู่ (bakery)</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {CAKE_CATEGORIES.map(c => {
                        const cur = di.category || guessCategory(di.name);
                        const on = cur === c.id;
                        return (
                          <button key={c.id} onClick={() => saveCategory(di, c.id)}
                            style={{ padding: '5px 12px', borderRadius: 16, border: '1.5px solid', borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? 'var(--accent)' : 'var(--bg)', color: on ? '#fff' : 'var(--ink)', fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      💡 ปกติดึงจาก "หมวดย่อย" ในเมนู Operate — แก้ที่นี่เพื่อ override
                    </div>
                  </div>
                </div>

                {/* Status + Delete */}
                {isMyBranch && (
                  <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>สถานะการขาย</div>
                    <button onClick={() => { toggleOpen(di); setDetailItem(prev => ({ ...prev, is_open: !prev.is_open })); }}
                      style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, background: di.is_open ? '#DCFCE7' : '#F3F4F6', color: di.is_open ? '#166534' : '#6B7280' }}>
                      {di.is_open ? '● เปิดขาย' : '○ ปิดขาย'}
                    </button>
                    <button onClick={() => { setPendingDelete(di); setDetailItem(null); }}
                      style={{ background: 'none', border: 'none', fontSize: 15, color: '#D1C4B5', cursor: 'pointer', padding: '4px 2px' }} title="ขอลบรายการ">🗑</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── ModalOverlay ─────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, animation: 'slideUp 0.2s ease' }}
      >
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  );
}
