import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { fetchOperateCatalog } from '../../lib/operateCatalog';
import { formatBangkokDateISO } from '../../lib/bangkokTime';
import { inventoryAlertKey, isOpsEntryOnBangkokDay, opsEntryBangkokDay } from '../../lib/opsInboxHelpers';

const REVIEWED_KEY = 'hr_ops_reviewed_ids';

function loadReviewed() {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY) || '[]')); } catch { return new Set(); }
}
function saveReviewed(set) {
  localStorage.setItem(REVIEWED_KEY, JSON.stringify([...set]));
}

const SOURCE_LABELS = {
  'hr_employee_app': 'HR App',
  'hr-app': 'HR App',
  'hr-web': 'Web',
  'emp-portal': 'พนักงาน',
};

const TASK_LABELS = {
  bills: 'ถ่ายบิลซื้อของ',
  production: 'บันทึกการผลิตขนม',
  inventory: 'วัตถุดิบและสต๊อก',
  'cake-stock': 'สต๊อกขนม',
  'supplies-count': 'นับสต๊อกของใช้',
  'purchase-list': 'ใบสั่งซื้อ',
};

const TASK_OPTIONS = [
  { value: 'all', label: 'ทุกประเภท' },
  ...Object.entries(TASK_LABELS).map(([value, label]) => ({ value, label })),
];

export default function AdminOpsInbox() {
  const { orgId } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [taskFilter, setTaskFilter] = useState(searchParams.get('task') || 'all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [empFilter, setEmpFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [replyEntry, setReplyEntry] = useState(null);
  const [reviewed, setReviewed] = useState(() => loadReviewed());
  const [hideReviewed, setHideReviewed] = useState(false);
  const [menuImgMap, setMenuImgMap] = useState({});

  const PAGE_SIZE = 50;

  const toggleReviewed = useCallback((id) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveReviewed(next);
      return next;
    });
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [{ data: entryRows, error: entryError }, { data: employeeRows }, { data: branchRows }] = await Promise.all([
        supabase
          .from('employee_ops_entries')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE + 1),
        supabase.from('employees').select('id,name,nickname,color').eq('org_id', orgId),
        supabase.from('branches').select('id,label').eq('org_id', orgId),
      ]);

      if (entryError) throw entryError;

      const rows = entryRows || [];
      setHasMore(rows.length > PAGE_SIZE);
      setItems(rows.slice(0, PAGE_SIZE));
      setEmployees(employeeRows || []);
      setBranches(branchRows || []);
    } catch (ex) {
      const message = String(ex?.message || '');
      if (message.includes('employee_ops_entries')) {
        setError('ยังไม่ได้รันไฟล์ 25_employee_ops_entries.sql ใน Supabase จึงยังเปิดกล่องงานร้านไม่ได้');
      } else {
        setError(ex?.message || 'โหลดงานร้านจากพนักงานไม่สำเร็จ');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1]?.created_at;
      const { data } = await supabase
        .from('employee_ops_entries')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .lt('created_at', cursor)
        .limit(PAGE_SIZE + 1);
      const rows = data || [];
      setHasMore(rows.length > PAGE_SIZE);
      setItems(prev => [...prev, ...rows.slice(0, PAGE_SIZE)]);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
  }, [orgId]);

  useEffect(() => {
    fetchOperateCatalog().then(cat => {
      if (!cat?.menus) return;
      const map = {};
      cat.menus.forEach(m => { if (m.name && m.imageUrl) map[m.name] = m.imageUrl; });
      setMenuImgMap(map);
    });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel('ops-inbox-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'employee_ops_entries',
        filter: `org_id=eq.${orgId}`,
      }, (payload) => {
        const newRow = payload.new;
        if (newRow) setItems(prev => [newRow, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [orgId]);

  const filteredItems = useMemo(() => {
    const today = formatBangkokDateISO();
    const weekAgo = formatBangkokDateISO(new Date(Date.now() - 7 * 86400000));
    const q = searchText.trim().toLowerCase();
    return items.filter((item) => {
      const itemDay = opsEntryBangkokDay(item);
      if (hideReviewed && reviewed.has(item.id)) return false;
      if (taskFilter !== 'all' && item.task_key !== taskFilter) return false;
      if (dateFilter === 'today' && itemDay !== today) return false;
      if (dateFilter === 'week' && itemDay < weekAgo) return false;
      if (dateFilter === 'custom') {
        const d = itemDay;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      if (empFilter !== 'all' && item.emp_id !== empFilter) return false;
      if (q) {
        const emp = employees.find(r => r.id === item.emp_id);
        const empName = (emp?.nickname || emp?.name || '').toLowerCase();
        const p = item.payload || {};
        const haystack = [
          empName,
          p.vendor || '',
          p.product || '',
          p.itemName || '',
          p.cakeName || '',
          p.note || '',
          (p.items || []).map(i => i.itemName).join(' '),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, taskFilter, dateFilter, dateFrom, dateTo, empFilter, searchText, employees, reviewed, hideReviewed]);

  const taskCounts = useMemo(() => {
    const counts = Object.keys(TASK_LABELS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    items.forEach((item) => {
      counts[item.task_key] = (counts[item.task_key] || 0) + 1;
    });
    return counts;
  }, [items]);

  const productionSummary = useMemo(() => {
    const todayStr = formatBangkokDateISO();
    const prodItems = filteredItems.filter(item =>
      item.task_key === 'production' && isOpsEntryOnBangkokDay(item, todayStr)
    );
    if (prodItems.length === 0) return null;
    const byProduct = new Map();
    prodItems.forEach(item => {
      const p = item.payload || {};
      const product = p.product || 'ไม่ระบุ';
      const qty = parseFloat(p.quantity || 0) || 0;
      const unit = p.unit || 'ชิ้น';
      if (!byProduct.has(product)) byProduct.set(product, { total: 0, unit, batches: 0 });
      const entry = byProduct.get(product);
      entry.total += qty;
      entry.batches += 1;
    });
    return [...byProduct.entries()];
  }, [filteredItems]);

  const billsSummary = useMemo(() => {
    const todayStr = formatBangkokDateISO();
    const billItems = filteredItems.filter(item =>
      item.task_key === 'bills' && isOpsEntryOnBangkokDay(item, todayStr)
    );
    if (billItems.length < 2) return null;
    const total = billItems.reduce((sum, item) => sum + (parseFloat(item.payload?.amount) || 0), 0);
    return { total, count: billItems.length };
  }, [filteredItems]);

  const cakeStockSummary = useMemo(() => {
    const todayStr = formatBangkokDateISO();
    const cakeItems = filteredItems.filter(item =>
      item.task_key === 'cake-stock' && isOpsEntryOnBangkokDay(item, todayStr)
    );
    if (cakeItems.length === 0) return null;
    const byBranch = new Map();
    cakeItems.forEach(item => {
      const p = item.payload || {};
      const branch = p.branchName || 'ไม่ระบุสาขา';
      if (!byBranch.has(branch)) byBranch.set(branch, new Map());
      const branchMap = byBranch.get(branch);
      const cakeName = p.cakeName || 'ไม่ระบุ';
      if (!branchMap.has(cakeName)) {
        branchMap.set(cakeName, { available: p.available ?? '-', reserved: p.reserved, status: p.status || '' });
      }
    });
    return [...byBranch.entries()].map(([branch, cakes]) => ({
      branch,
      cakes: [...cakes.entries()].map(([name, data]) => ({ name, ...data })),
    }));
  }, [filteredItems]);

  const inventoryAlertSummary = useMemo(() => {
    const todayStr = formatBangkokDateISO();
    const alertItems = filteredItems.filter(item => {
      if (!isOpsEntryOnBangkokDay(item, todayStr)) return false;
      const s = item.payload?.status;
      if (!s) return false;
      if (item.task_key === 'inventory' || item.task_key === 'supplies-count') return s !== 'ปกติ';
      if (item.task_key === 'cake-stock') return s !== 'พร้อมขาย';
      return false;
    });
    if (alertItems.length === 0) return null;
    const seen = new Set();
    return alertItems.filter(item => {
      const key = inventoryAlertKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(item => {
      const p = item.payload || {};
      const emp = employees.find(e => e.id === item.emp_id);
      const isCake = item.task_key === 'cake-stock';
      return {
        key: inventoryAlertKey(item),
        itemName: (isCake ? p.cakeName : p.itemName) || '?',
        stockLeft: isCake ? p.available : p.stockLeft,
        unit: isCake ? 'ชิ้น' : (p.unit || ''),
        status: p.status || '',
        empName: emp?.nickname || emp?.name || 'พนักงาน',
        isCake,
        branchName: isCake ? (p.branchName || '') : '',
      };
    });
  }, [filteredItems, employees]);

  const groupedItems = useMemo(() => {
    const today = formatBangkokDateISO();
    const yesterday = formatBangkokDateISO(new Date(Date.now() - 86400000));
    const groups = new Map();
    filteredItems.forEach(item => {
      const day = opsEntryBangkokDay(item);
      let label;
      if (day === today) label = 'วันนี้';
      else if (day === yesterday) label = 'เมื่อวาน';
      else {
        try {
          label = new Date(day + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } catch { label = day; }
      }
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });
    return [...groups.entries()];
  }, [filteredItems]);

  function employeeLabel(empId) {
    const emp = employees.find((row) => row.id === empId);
    return emp?.nickname || emp?.name || 'ไม่ทราบชื่อ';
  }

  function employeeColor(empId) {
    const emp = employees.find((row) => row.id === empId);
    return emp?.color || '#0E7C66';
  }

  function branchLabel(branchId) {
    return branches.find((row) => row.id === branchId)?.label || '-';
  }

  const [lineCopied, setLineCopied] = useState(false);

  function copySummaryForLine() {
    const todayStr = formatBangkokDateISO();
    const todayLabel = new Date(todayStr + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const lines = [`📊 สรุปงานร้านประจำวัน ${todayLabel}`, ''];

    if (productionSummary && productionSummary.length > 0) {
      lines.push('🏭 ผลิตขนม:');
      productionSummary.forEach(([product, data]) => {
        lines.push(`  • ${product}: ${data.total % 1 === 0 ? data.total : data.total.toFixed(1)} ${data.unit} (${data.batches} รอบ)`);
      });
      lines.push('');
    }

    if (billsSummary) {
      lines.push(`📷 บิลซื้อของ: ${billsSummary.count} ใบ รวม ฿${billsSummary.total.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`);
      lines.push('');
    }

    if (cakeStockSummary && cakeStockSummary.length > 0) {
      lines.push('🍰 สต๊อกเค้ก:');
      cakeStockSummary.forEach(({ branch, cakes }) => {
        lines.push(`  ${branch}:`);
        cakes.forEach(({ name, available, status }) => {
          lines.push(`    - ${name}: ${available} (${status || 'พร้อมขาย'})`);
        });
      });
      lines.push('');
    }

    if (inventoryAlertSummary && inventoryAlertSummary.length > 0) {
      lines.push('⚠️ สต๊อกต้องติดตาม:');
      inventoryAlertSummary.forEach(({ itemName, stockLeft, unit, status, isCake, branchName }) => {
        const loc = isCake && branchName ? ` (${branchName})` : '';
        lines.push(`  • ${isCake ? '🍰 ' : ''}${itemName}${loc}: ${stockLeft || '?'} ${unit} — ${status}`);
      });
      lines.push('');
    }

    const todayCount = filteredItems.filter(i => isOpsEntryOnBangkokDay(i, todayStr)).length;
    lines.push(`รวมทั้งหมด ${todayCount} รายการ`);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setLineCopied(true);
      setTimeout(() => setLineCopied(false), 2500);
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 6 }}>งานร้านจากพนักงาน</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            รวมรายการบิล ผลิตขนม วัตถุดิบ ของใช้ และใบสั่งซื้อที่พนักงานบันทึกเข้ามาจากแอป HR
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load}>รีโหลด</button>
          <button className="btn" onClick={copySummaryForLine} style={{ background: lineCopied ? '#ecfdf3' : undefined, color: lineCopied ? '#0d7a46' : undefined, border: lineCopied ? '1px solid #bbe7cf' : undefined }} title="คัดลอกสรุปวันนี้">
            {lineCopied ? '✓ คัดลอกแล้ว' : '📋 สรุปวันนี้'}
          </button>
          <button className="btn" onClick={() => exportCSV(filteredItems, employees, branches)} title="ส่งออก CSV">📥 CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {Object.entries(TASK_LABELS).map(([key, label]) => (
          <div key={key} className="card" style={{ padding: '16px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>{taskCounts[key] || 0}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="ค้นหา พนักงาน / สินค้า / รายการ..."
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={taskFilter} onChange={(e) => { setTaskFilter(e.target.value); setSearchParams({}); }} style={{ width: 200 }}>
          {TASK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">พนักงานทุกคน</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.nickname || emp.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ k: 'all', l: 'ทั้งหมด' }, { k: 'today', l: 'วันนี้' }, { k: 'week', l: '7 วัน' }, { k: 'custom', l: 'กำหนดเอง' }].map(({ k, l }) => (
            <button key={k} onClick={() => setDateFilter(k)} className="btn" style={{
              background: dateFilter === k ? 'var(--accent)' : 'var(--bg)',
              color: dateFilter === k ? '#fff' : 'var(--muted)',
              border: '1px solid var(--line)', padding: '7px 14px', fontSize: 13,
            }}>{l}</button>
          ))}
          {dateFilter === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150, fontSize: 13 }} placeholder="จาก" />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150, fontSize: 13 }} placeholder="ถึง" />
            </>
          )}
        </div>
        <button onClick={() => setHideReviewed(h => !h)} className="btn" style={{
          background: hideReviewed ? 'var(--accent)' : 'var(--bg)',
          color: hideReviewed ? '#fff' : 'var(--muted)',
          border: '1px solid var(--line)', padding: '7px 14px', fontSize: 13,
        }}>
          {hideReviewed ? '✓ ซ่อนดูแล้ว' : 'ซ่อนดูแล้ว'}
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          {filteredItems.length > 0 && (
            <button
              onClick={() => {
                setReviewed(prev => {
                  const next = new Set(prev);
                  filteredItems.forEach(item => next.add(item.id));
                  saveReviewed(next);
                  return next;
                });
              }}
              className="btn"
              style={{ fontSize: 12, padding: '4px 10px', color: '#0d7a46', border: '1px solid #bbe7cf', background: '#ecfdf3' }}
            >
              ✓ ดูทั้งหมดแล้ว
            </button>
          )}
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>แสดง {filteredItems.length} รายการ</div>
        </div>
      </div>

      {productionSummary && productionSummary.length > 0 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16, border: '1px solid #bbe7cf', background: '#ecfdf3' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#0d7a46', fontSize: 14 }}>🏭 สรุปการผลิตวันนี้</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {productionSummary.map(([product, data]) => (
              <div key={product} style={{ background: '#fff', border: '1px solid #bbe7cf', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a5e3a', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0d7a46' }}>
                  {data.total % 1 === 0 ? data.total : data.total.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 500 }}>{data.unit}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{data.batches} รอบ</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {billsSummary && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, border: '1px solid #c7d2fe', background: '#eef2ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, color: '#3730a3', fontSize: 14 }}>📷 บิลวันนี้</div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3730a3' }}>
              ฿{billsSummary.total.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 13, color: '#6366f1' }}>{billsSummary.count} ใบ</div>
          </div>
        </div>
      )}

      {cakeStockSummary && cakeStockSummary.length > 0 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16, border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#92400e', fontSize: 14 }}>🍰 สต๊อกเค้กวันนี้</div>
          {cakeStockSummary.map(({ branch, cakes }) => (
            <div key={branch} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#78350f', marginBottom: 8 }}>{branch}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {cakes.map(({ name, available, reserved, status }) => {
                  const isLow = status === 'ใกล้หมด' || status === 'หมด' || status === 'ต้องเติมจากครัว' || status === 'มีปัญหา';
                  const imgUrl = menuImgMap[name] || null;
                  return (
                    <div key={name} style={{ background: '#fff', border: `1.5px solid ${isLow ? '#fca5a5' : '#fde68a'}`, borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#f5efe6' }}>
                        {imgUrl
                          ? <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍰</div>
                        }
                        <div style={{
                          position: 'absolute', bottom: 4, right: 4,
                          background: isLow ? '#b42318' : '#92400e',
                          color: '#fff', borderRadius: 8, padding: '2px 7px',
                          fontSize: 14, fontWeight: 800, lineHeight: 1.2,
                        }}>{available}</div>
                        {isLow && (
                          <div style={{ position: 'absolute', top: 4, left: 4, background: '#fca5a5', borderRadius: 6, padding: '1px 5px', fontSize: 10, fontWeight: 700, color: '#7f1d1d' }}>
                            {status}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '6px 8px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#2f241f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                          {isLow ? '' : 'พร้อมขาย'}{reserved && reserved !== '0' ? ` · จอง ${reserved}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {inventoryAlertSummary && inventoryAlertSummary.length > 0 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16, border: '1px solid #fca5a5', background: '#fff1f1' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#b42318', fontSize: 14 }}>⚠️ สต๊อกต้องติดตามวันนี้ ({inventoryAlertSummary.length} รายการ)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {inventoryAlertSummary.map(({ key, itemName, stockLeft, unit, status, empName, isCake, branchName }) => {
              const isUrgent = status === 'ต้องสั่งเพิ่ม' || status === 'มีปัญหา' || status === 'หมดแล้ว' || status === 'หมด' || status === 'ต้องเติมจากครัว';
              const imgUrl = isCake ? (menuImgMap[itemName] || null) : null;
              if (isCake) {
                return (
                  <div key={key} style={{ background: '#fff', border: `1.5px solid ${isUrgent ? '#fca5a5' : '#fed7aa'}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#fef2f2' }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍰</div>
                      }
                      <div style={{
                        position: 'absolute', bottom: 4, right: 4,
                        background: isUrgent ? '#b42318' : '#c2410c',
                        color: '#fff', borderRadius: 8, padding: '2px 7px',
                        fontSize: 14, fontWeight: 800, lineHeight: 1.2,
                      }}>{stockLeft ?? '?'}</div>
                      <div style={{
                        position: 'absolute', top: 4, left: 4,
                        background: isUrgent ? '#fca5a5' : '#fed7aa',
                        borderRadius: 6, padding: '1px 5px',
                        fontSize: 10, fontWeight: 700,
                        color: isUrgent ? '#7f1d1d' : '#92400e',
                      }}>{status}</div>
                    </div>
                    <div style={{ padding: '6px 8px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2f241f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemName}</div>
                      {branchName && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{branchName}</div>}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{empName}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={key} style={{ background: '#fff', border: `1px solid ${isUrgent ? '#fca5a5' : '#fed7aa'}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2f241f', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isUrgent ? '#b42318' : '#c2410c' }}>
                    {stockLeft || '?'} <span style={{ fontSize: 11, fontWeight: 500 }}>{unit}</span>
                  </div>
                  <div style={{ fontSize: 11, color: isUrgent ? '#b42318' : '#9a3412', marginTop: 2, fontWeight: isUrgent ? 700 : 400 }}>{status}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{empName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 18, background: '#fff8e8', border: '1px solid #f4dfab', color: '#7a5b2b' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 0 }}>
        {loading ? (
          <div className="card" style={{ padding: 22, color: 'var(--muted)' }}>กำลังโหลดงานร้าน...</div>
        ) : filteredItems.length === 0 ? (
          <div className="card" style={{ padding: 22, color: 'var(--muted)' }}>ยังไม่มีรายการจากพนักงาน</div>
        ) : (
          groupedItems.map(([dateLabel, groupRows]) => (
            <div key={dateLabel} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase',
                letterSpacing: 1, padding: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {dateLabel}
                <span style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, padding: '1px 8px', fontWeight: 700, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>
                  {groupRows.length} รายการ
                </span>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {groupRows.map((item, index) => {
                  const isReviewed = reviewed.has(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '16px 18px',
                        borderBottom: index === groupRows.length - 1 ? 'none' : '1px solid var(--line)',
                        display: 'grid',
                        gap: 10,
                        opacity: isReviewed ? 0.5 : 1,
                        transition: 'opacity .2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              minWidth: 40,
                              height: 40,
                              borderRadius: 999,
                              background: employeeColor(item.emp_id),
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '0 10px',
                            }}
                          >
                            {employeeLabel(item.emp_id)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {TASK_LABELS[item.task_key] || item.task_key}
                              {isReviewed && <span style={{ fontSize: 11, color: '#0d7a46', background: '#ecfdf3', border: '1px solid #bbe7cf', borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>✓ ดูแล้ว</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {employeeLabel(item.emp_id)} • {branchLabel(item.branch_id)} • {formatDateTime(item.created_at)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          {item.source && <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '2px 8px' }}>{SOURCE_LABELS[item.source] || item.source}</div>}
                          <button
                            onClick={() => toggleReviewed(item.id)}
                            style={{ fontSize: 12, color: isReviewed ? '#0d7a46' : 'var(--muted)', background: isReviewed ? '#ecfdf3' : 'var(--bg)', border: `1px solid ${isReviewed ? '#bbe7cf' : 'var(--line)'}`, borderRadius: 8, padding: '2px 9px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {isReviewed ? '✓ ดูแล้ว' : 'ดูแล้ว'}
                          </button>
                          <button onClick={() => setReplyEntry(item)} style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 9px', cursor: 'pointer', fontWeight: 600 }}>
                            ↩ ตอบ
                          </button>
                        </div>
                      </div>
                      <PayloadPreview payload={item.payload || {}} imageName={item.image_name} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="btn" onClick={loadMore} disabled={loadingMore} style={{ padding: '10px 28px', fontSize: 14 }}>
            {loadingMore ? 'กำลังโหลด...' : `โหลดเพิ่ม`}
          </button>
        </div>
      )}

      {replyEntry && (
        <ReplyModal
          entry={replyEntry}
          employees={employees}
          orgId={orgId}
          onClose={() => setReplyEntry(null)}
          navigateToMessages={(empId) => navigate('/admin/messages', { state: { empId } })}
        />
      )}
    </div>
  );
}

function ReplyModal({ entry, employees, orgId, onClose, navigateToMessages }) {
  const [text, setText] = useState(() => {
    const p = entry.payload || {};
    if (entry.task_key === 'purchase-list') {
      const n = (p.items || []).length;
      return `อนุมัติใบสั่งซื้อแล้ว ✓ กรุณาดำเนินการตามรายการ${n > 0 ? ` (${n} รายการ)` : ''}`;
    }
    if (entry.task_key === 'inventory' && p.status && p.status !== 'ปกติ') {
      return `ทราบแล้ว ขอบคุณที่แจ้ง${p.itemName ? ` (${p.itemName})` : ''} กรุณาเพิ่มในใบสั่งซื้อด้วย ✓`;
    }
    if (entry.task_key === 'supplies-count' && p.status && p.status !== 'ปกติ') {
      return `ทราบแล้ว ขอบคุณที่แจ้ง${p.itemName ? ` (${p.itemName})` : ''} กรุณาสั่งซื้อเพิ่ม ✓`;
    }
    if (entry.task_key === 'production') {
      return `ทราบแล้ว ผลิต${p.product ? ` ${p.product}` : ''}${p.quantity ? ` ${p.quantity} ${p.unit || ''}` : ''} เรียบร้อย ✓`;
    }
    if (entry.task_key === 'cake-stock') {
      const isLow = p.status && p.status !== 'พร้อมขาย';
      if (isLow) {
        return `ทราบแล้ว ${p.cakeName || 'เค้ก'} เหลือน้อย (${p.available ?? '?'} ชิ้น) รบกวนเติมจากครัวด้วยนะคะ 🙏`;
      }
      return `ทราบสต๊อกเค้กแล้ว ขอบคุณ ✓`;
    }
    return '';
  });
  const [kind, setKind] = useState('message');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emp = employees.find(e => e.id === entry.emp_id);
  const empName = emp?.nickname || emp?.name || 'พนักงาน';

  async function send() {
    if (!text.trim() || !entry.emp_id) return;
    setBusy(true);
    try {
      await supabase.from('messages').insert({
        emp_id: entry.emp_id,
        org_id: orgId,
        from: 'admin',
        kind,
        text: text.trim(),
        status: 'unread',
        created_at: new Date().toISOString(),
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: 24, width: '100%', maxWidth: 520, display: 'grid', gap: 14, paddingBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>ตอบกลับ {empName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {TASK_LABELS[entry.task_key] || entry.task_key} · {formatDateTime(entry.created_at)}
            </div>
          </div>
          <button onClick={() => { navigateToMessages(entry.emp_id); onClose(); }} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}>
            💬 ประวัติ
          </button>
        </div>
        {sent ? (
          <div style={{ background: '#ecfdf3', border: '1px solid #bbe7cf', borderRadius: 14, padding: 16, textAlign: 'center', color: '#0d7a46', fontWeight: 700 }}>
            ✓ ส่งข้อความแล้ว
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
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`พิมพ์ข้อความถึง ${empName}...`}
              style={{ resize: 'vertical', fontSize: 14 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()} style={{ flex: 1 }}>
                {busy ? 'กำลังส่ง...' : 'ส่ง'}
              </button>
              <button className="btn" onClick={onClose} style={{ flex: 1 }}>ยกเลิก</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PayloadPreview({ payload, imageName }) {
  if (Array.isArray(payload.items)) {
    return <PurchaseListPreview payload={payload} />;  // payload passed in full
  }

  const SKIP_KEYS = new Set([
    'date', 'recordedBy', 'aiItems',
    'imagePreviewUrl', 'imageBase64', 'imageMimeType',
    'photoNames', 'photoCount', 'photoUrls', 'billImageUrl',
  ]);
  const rows = Object.entries(payload).filter(
    ([key, value]) => !SKIP_KEYS.has(key) && value != null && !Array.isArray(value) && typeof value !== 'object' && String(value).trim() !== ''
  );
  const aiItems = Array.isArray(payload.aiItems) ? payload.aiItems : [];
  const photoNames = Array.isArray(payload.photoNames) ? payload.photoNames : [];
  const photoCount = payload.photoCount || photoNames.length;
  const billImageUrl = payload.billImageUrl || '';

  return (
    <div style={{ background: '#faf7f2', border: '1px solid #eadcc6', borderRadius: 16, padding: 14 }}>
      {(payload.date || payload.recordedBy) && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 12, color: 'var(--muted)' }}>
          {payload.date && <span>📅 {payload.date}</span>}
          {payload.recordedBy && <span>👤 {payload.recordedBy}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0 && aiItems.length === 0 && !imageName && !billImageUrl && photoCount === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีรายละเอียดใน payload</div>
        ) : (
          rows.map(([key, value]) => {
            const valStr = String(value);
            const isAlertStatus = key === 'status' && valStr !== 'ปกติ' && valStr !== 'พร้อมขาย' && valStr !== 'done' && valStr !== 'read' && valStr !== 'unread';
            const isUrgent = isAlertStatus && (valStr === 'ต้องสั่งเพิ่ม' || valStr === 'มีปัญหา' || valStr === 'หมดแล้ว' || valStr === 'หมด');
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, fontSize: 13 }}>
                <div style={{ color: 'var(--muted)', fontWeight: 700 }}>{humanizeKey(key)}</div>
                <div style={{
                  color: isUrgent ? '#b42318' : isAlertStatus ? '#92400e' : 'var(--ink)',
                  fontWeight: isAlertStatus ? 700 : 400,
                  wordBreak: 'break-word',
                  background: isUrgent ? '#fff1f1' : isAlertStatus ? '#fffbeb' : undefined,
                  borderRadius: isAlertStatus ? 6 : undefined,
                  padding: isAlertStatus ? '1px 6px' : undefined,
                  display: 'inline-block',
                }}>
                  {isAlertStatus && (isUrgent ? '🔴 ' : '🟡 ')}{valStr}
                </div>
              </div>
            );
          })
        )}
        {aiItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, fontSize: 13 }}>
            <div style={{ color: 'var(--muted)', fontWeight: 700 }}>รายการจาก AI</div>
            <div style={{ color: 'var(--ink)' }}>
              {aiItems.slice(0, 5).map((it, i) => (
                <span key={i} style={{ display: 'inline-block', background: '#eef2ff', borderRadius: 6, padding: '2px 8px', fontSize: 12, marginRight: 4, marginBottom: 4 }}>
                  {it.name}{it.qty > 0 ? ` ×${it.qty}` : ''}{it.unit ? ` ${it.unit}` : ''}
                </span>
              ))}
              {aiItems.length > 5 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>+{aiItems.length - 5} รายการ</span>}
            </div>
          </div>
        )}
        {/* รูปบิล — ถ้ามี URL ให้แสดง thumbnail; ถ้ามีแค่ชื่อไฟล์แสดงข้อความ */}
        {(billImageUrl || imageName) && (
          <PhotosRow
            photoUrls={billImageUrl ? [billImageUrl] : []}
            photoNames={[imageName || 'รูปบิล']}
            photoCount={1}
            label="รูปบิล"
          />
        )}
        {(photoCount > 0 || payload.photoUrls?.length > 0) && (
          <PhotosRow photoUrls={payload.photoUrls || []} photoNames={photoNames} photoCount={photoCount} />
        )}
      </div>
    </div>
  );
}

function PurchaseListPreview({ payload }) {
  const { date, recordedBy, items = [], photoCount, photoNames = [], photoUrls = [] } = payload;
  const [copied, setCopied] = useState(false);

  function copyAsText() {
    const header = `ใบสั่งซื้อ${date ? ` วันที่ ${date}` : ''}${recordedBy ? ` (${recordedBy})` : ''}`;
    const lines = items.map((item, i) =>
      `${i + 1}. ${item.itemName}  ${item.quantity} ${item.unit}${item.note ? `  (${item.note})` : ''}`
    );
    navigator.clipboard.writeText([header, ...lines].join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ background: '#faf7f2', border: '1px solid #eadcc6', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        {date && <span>📅 {date}</span>}
        {recordedBy && <span>👤 {recordedBy}</span>}
        <span style={{ fontWeight: 700, color: '#bf6c2a' }}>🛒 {items.length} รายการ</span>
        {(payload.photoUrls?.length > 0 || photoCount > 0 || photoNames.length > 0) && (
          <span style={{ fontWeight: 700, color: '#4338ca' }}>📷 {payload.photoUrls?.length || photoCount || photoNames.length} รูป</span>
        )}
        {items.length > 0 && (
          <button onClick={copyAsText} style={{
            marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, fontSize: 12,
            background: copied ? '#ecfdf3' : '#fff', border: `1px solid ${copied ? '#bbe7cf' : '#eadcc6'}`,
            color: copied ? '#0d7a46' : '#9b7a5a', cursor: 'pointer', fontWeight: 600,
          }}>
            {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอก'}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีรายการสั่งซื้อ</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f0e8d8', color: '#6b4c2a' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>#</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>รายการ</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>หมวด</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>จำนวน</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>หน่วย</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>ความด่วน</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: '1px solid #eadcc6' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.itemName}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{item.category}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '6px 10px' }}>{item.unit}</td>
                  <td style={{ padding: '6px 10px', fontWeight: item.priority === 'วันนี้' ? 700 : 400,
                    color: item.priority === 'วันนี้' ? '#bf6c2a' : 'var(--muted)' }}>{item.priority || '-'}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{item.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(photoUrls.length > 0 || photoCount > 0) && (
        <div style={{ marginTop: 12 }}>
          <PhotosRow photoUrls={photoUrls} photoNames={photoNames} photoCount={photoCount} />
        </div>
      )}
    </div>
  );
}

function PhotosRow({ photoUrls = [], photoNames = [], photoCount = 0, label = 'รูปแนบ' }) {
  const [lightbox, setLightbox] = useState(null);
  const count = photoUrls.length || photoCount;
  if (count === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, fontSize: 13 }}>
      <div style={{ color: 'var(--muted)', fontWeight: 700 }}>{label}</div>
      <div>
        {photoUrls.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={photoNames[i] || `รูป ${i + 1}`}
                onClick={() => setLightbox({ url, name: photoNames[i] || `รูป ${i + 1}` })}
                style={{
                  width: 64, height: 64, objectFit: 'cover',
                  borderRadius: 10, border: '1.5px solid #eadcc6',
                  cursor: 'zoom-in',
                }}
              />
            ))}
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eef2ff', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
            📷 {count} รูป {photoNames.length > 0 ? `(${photoNames.join(', ')})` : ''}
          </span>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img
            src={lightbox.url}
            alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '88vh', borderRadius: 18, objectFit: 'contain' }}
          />
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <button onClick={() => setLightbox(null)} style={{ background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff', borderRadius: 12, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✕ ปิด
            </button>
          </div>
          {lightbox.name && (
            <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 12, pointerEvents: 'none' }}>
              {lightbox.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function humanizeKey(key) {
  const map = {
    date: 'วันที่',
    recordedBy: 'ผู้บันทึก',
    vendor: 'ร้าน / ผู้ขาย',
    amount: 'ยอดบิล',
    category: 'ประเภท',
    note: 'หมายเหตุ',
    imageName: 'ชื่อไฟล์รูป',
    product: 'เมนูที่ผลิต',
    quantity: 'จำนวน',
    unit: 'หน่วย',
    batch: 'รอบผลิต',
    itemName: 'รายการ',
    stockLeft: 'คงเหลือ',
    status: 'สถานะ',
    area: 'จุดที่นับ',
    count: 'จำนวนคงเหลือ',
    priority: 'ความด่วน',
    branchName: 'สาขา',
    cakeName: 'ชื่อเค้ก / เมนู',
    available: 'พร้อมขาย',
    reserved: 'จอง',
    damaged: 'เสียหาย / หมดอายุ',
  };
  return map[key] || key;
}

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function exportCSV(items, employees, branches) {
  function empName(empId) {
    const e = employees.find(r => r.id === empId);
    return e?.nickname || e?.name || '';
  }
  function branchName(branchId) {
    return branches.find(r => r.id === branchId)?.label || '';
  }
  function payloadSummary(item) {
    const p = item.payload || {};
    switch (item.task_key) {
      case 'bills':         return `${p.vendor||''} / ${p.amount||''} บาท / ${p.category||''}`;
      case 'production':    return `${p.product||''} / ${p.quantity||''} ${p.unit||''} / ${p.batch||''}`;
      case 'inventory':     return `${p.itemName||''} / ${p.stockLeft||''} ${p.unit||''} / ${p.status||''}`;
      case 'cake-stock':    return `${p.branchName||''} / ${p.cakeName||''} / พร้อมขาย ${p.available||0} จอง ${p.reserved||0} เสีย ${p.damaged||0}`;
      case 'supplies-count':return `${p.area||''} / ${p.itemName||''} / ${p.count||''} ${p.unit||''} / ${p.status||'ปกติ'}`;
      case 'purchase-list': return (p.items||[]).map(i=>`${i.itemName} ${i.quantity}${i.unit}`).join(' | ');
      default:              return JSON.stringify(p);
    }
  }

  const headers = ['วันที่บันทึก', 'ประเภทงาน', 'พนักงาน', 'สาขา', 'รายละเอียด', 'รูปแนบ'];
  const rows = items.map(item => [
    formatDateTime(item.created_at),
    TASK_LABELS[item.task_key] || item.task_key,
    empName(item.emp_id),
    branchName(item.branch_id),
    payloadSummary(item),
    item.payload?.photoCount || (item.payload?.photoUrls?.length) || (item.image_name ? 1 : 0),
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jebar-ops-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
