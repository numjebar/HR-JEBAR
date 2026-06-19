import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [taskFilter, setTaskFilter] = useState(searchParams.get('task') || 'all');
  const [dateFilter, setDateFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          .limit(100),
        supabase.from('employees').select('id,name,nickname,color').eq('org_id', orgId),
        supabase.from('branches').select('id,label').eq('org_id', orgId),
      ]);

      if (entryError) throw entryError;

      setItems(entryRows || []);
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

  useEffect(() => {
    load();
  }, [orgId]);

  const filteredItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return items.filter((item) => {
      if (taskFilter !== 'all' && item.task_key !== taskFilter) return false;
      if (dateFilter === 'today' && (item.created_at || '').slice(0, 10) !== today) return false;
      if (dateFilter === 'week' && (item.created_at || '').slice(0, 10) < weekAgo) return false;
      return true;
    });
  }, [items, taskFilter, dateFilter]);

  const taskCounts = useMemo(() => {
    const counts = Object.keys(TASK_LABELS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    items.forEach((item) => {
      counts[item.task_key] = (counts[item.task_key] || 0) + 1;
    });
    return counts;
  }, [items]);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 6 }}>งานร้านจากพนักงาน</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            รวมรายการบิล ผลิตขนม วัตถุดิบ ของใช้ และใบสั่งซื้อที่พนักงานบันทึกเข้ามาจากแอป HR
          </div>
        </div>
        <button className="btn" onClick={load}>รีโหลด</button>
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
        <select value={taskFilter} onChange={(e) => { setTaskFilter(e.target.value); setSearchParams({}); }} style={{ width: 200 }}>
          {TASK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'all', l: 'ทั้งหมด' }, { k: 'today', l: 'วันนี้' }, { k: 'week', l: '7 วัน' }].map(({ k, l }) => (
            <button key={k} onClick={() => setDateFilter(k)} className="btn" style={{
              background: dateFilter === k ? 'var(--accent)' : 'var(--bg)',
              color: dateFilter === k ? '#fff' : 'var(--muted)',
              border: '1px solid var(--line)', padding: '7px 14px', fontSize: 13,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>แสดง {filteredItems.length} รายการ</div>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 18, background: '#fff8e8', border: '1px solid #f4dfab', color: '#7a5b2b' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 22, color: 'var(--muted)' }}>กำลังโหลดงานร้าน...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 22, color: 'var(--muted)' }}>ยังไม่มีรายการจากพนักงาน</div>
        ) : (
          filteredItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                padding: '16px 18px',
                borderBottom: index === filteredItems.length - 1 ? 'none' : '1px solid var(--line)',
                display: 'grid',
                gap: 10,
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
                    <div style={{ fontWeight: 700 }}>{TASK_LABELS[item.task_key] || item.task_key}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {employeeLabel(item.emp_id)} • {branchLabel(item.branch_id)} • {formatDateTime(item.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>source: {item.source}</div>
              </div>

              <PayloadPreview payload={item.payload || {}} imageName={item.image_name} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PayloadPreview({ payload, imageName }) {
  if (Array.isArray(payload.items)) {
    return <PurchaseListPreview payload={payload} />;
  }

  const SKIP_KEYS = new Set(['date', 'recordedBy']);
  const rows = Object.entries(payload).filter(
    ([key, value]) => !SKIP_KEYS.has(key) && String(value ?? '').trim() !== ''
  );

  return (
    <div style={{ background: '#faf7f2', border: '1px solid #eadcc6', borderRadius: 16, padding: 14 }}>
      {(payload.date || payload.recordedBy) && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 12, color: 'var(--muted)' }}>
          {payload.date && <span>📅 {payload.date}</span>}
          {payload.recordedBy && <span>👤 {payload.recordedBy}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีรายละเอียดใน payload</div>
        ) : (
          rows.map(([key, value]) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, fontSize: 13 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 700 }}>{humanizeKey(key)}</div>
              <div style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{String(value)}</div>
            </div>
          ))
        )}
        {imageName && (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, fontSize: 13 }}>
            <div style={{ color: 'var(--muted)', fontWeight: 700 }}>รูปแนบ</div>
            <div>{imageName}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseListPreview({ payload }) {
  const { date, recordedBy, items = [] } = payload;
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
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{item.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
