import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

const TASK_LABELS = {
  bills: 'ถ่ายบิลซื้อของ',
  production: 'บันทึกการผลิตขนม',
  inventory: 'วัตถุดิบและสต๊อก',
  'supplies-count': 'นับสต๊อกของใช้',
  'purchase-list': 'ใบสั่งซื้อก่อนไปซื้อ',
};

const TASK_OPTIONS = [
  { value: 'all', label: 'ทุกประเภท' },
  ...Object.entries(TASK_LABELS).map(([value, label]) => ({ value, label })),
];

export default function AdminOpsInbox() {
  const { orgId } = useAuthStore();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all');
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
    if (taskFilter === 'all') return items;
    return items.filter((item) => item.task_key === taskFilter);
  }, [items, taskFilter]);

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {Object.entries(TASK_LABELS).map(([key, label]) => (
          <div key={key} className="card" style={{ padding: '16px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>{taskCounts[key] || 0}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700 }}>กรองประเภท</div>
        <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} style={{ width: 240 }}>
          {TASK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>แสดง {filteredItems.length} รายการ</div>
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
  const rows = Object.entries(payload).filter(([, value]) => String(value ?? '').trim() !== '');

  return (
    <div style={{ background: '#faf7f2', border: '1px solid #eadcc6', borderRadius: 16, padding: 14 }}>
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

function humanizeKey(key) {
  const map = {
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
