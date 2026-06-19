import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../lib/version';

const STORAGE_PREFIX = 'hr_emp_ops_';
const HISTORY_LIMIT = 8;

const TASKS = [
  {
    key: 'bills',
    path: '/emp/ops/bills',
    title: 'ถ่ายบิลซื้อของ',
    subtitle: 'ถ่ายรูปบิล แล้วส่งให้ระบบจัดการต่อ',
    icon: '📷',
  },
  {
    key: 'production',
    path: '/emp/ops/production',
    title: 'บันทึกการผลิตขนม',
    subtitle: 'บันทึกเมนูที่ผลิต จำนวน และรายละเอียดของแต่ละรอบ',
    icon: '🏭',
  },
  {
    key: 'inventory',
    path: '/emp/ops/inventory',
    title: 'วัตถุดิบและสต๊อก',
    subtitle: 'ตรวจเช็กวัตถุดิบคงเหลือ และแจ้งสิ่งที่ควรติดตามต่อ',
    icon: '📦',
  },
  {
    key: 'cake-stock',
    path: '/emp/ops/cake-stock',
    title: 'เช็คสต๊อกเค้ก',
    subtitle: 'นับเค้กหน้าตู้แยกตามสาขา พร้อมสถานะพร้อมขาย จอง หรือเสียหาย',
    icon: '🍰',
  },
  {
    key: 'supplies-count',
    path: '/emp/ops/supplies-count',
    title: 'นับสต๊อกของใช้',
    subtitle: 'นับของใช้สิ้นเปลือง เช่น ทิชชู่ น้ำยา และอุปกรณ์หน้าร้าน',
    icon: '🧴',
  },
  {
    key: 'purchase-list',
    path: '/emp/ops/purchase-list',
    title: 'ใบสั่งซื้อก่อนไปซื้อ',
    subtitle: 'เตรียมรายการที่ต้องซื้อก่อนออกไปซื้อของจริงหน้าร้าน',
    icon: '🛒',
  },
];

const TASK_MAP = Object.fromEntries(TASKS.map((task) => [task.key, task]));

const DEFAULT_DRAFTS = {
  bills: {
    vendor: '',
    amount: '',
    category: 'วัตถุดิบ',
    note: '',
    imageName: '',
    imagePreviewUrl: '',
  },
  production: {
    product: '',
    quantity: '',
    unit: 'ชิ้น',
    batch: '',
    note: '',
  },
  inventory: {
    itemName: '',
    stockLeft: '',
    unit: 'กก.',
    status: 'ปกติ',
    note: '',
  },
  'cake-stock': {
    branchName: 'สาขากาดน้ำทอง',
    cakeName: '',
    available: '',
    reserved: '',
    damaged: '',
    status: 'พร้อมขาย',
    note: '',
  },
  'supplies-count': {
    area: 'หน้าร้าน',
    itemName: '',
    count: '',
    unit: 'ชิ้น',
    note: '',
  },
  'purchase-list': {
    itemName: '',
    quantity: '',
    unit: 'ชิ้น',
    priority: 'วันนี้',
    note: '',
  },
};

export default function EmpOps() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTaskKey = getTaskKeyFromPath(location.pathname);

  if (!currentTaskKey) {
    return <OpsHome navigate={navigate} />;
  }

  return <OpsTaskPage taskKey={currentTaskKey} navigate={navigate} />;
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
          <button
            key={task.key}
            onClick={() => navigate(task.path)}
            style={taskCardButtonStyle}
          >
            <div style={taskIconStyle}>{task.icon}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#2f241f' }}>{task.title}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>
                {task.subtitle}
              </div>
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
  const backend = useTaskBackend(taskKey);

  const summary = summarizeDraft(taskKey, draft);

  return (
    <div style={pageStyle}>
      <section style={heroCardStyle}>
        <button
          onClick={() => navigate('/emp/ops')}
          style={{ ...inlineGhostButtonStyle, marginBottom: 14 }}
        >
          ← กลับหน้าพนักงาน
        </button>
        <div style={{ fontSize: 40, marginBottom: 6 }}>{task.icon}</div>
        <div style={{ fontWeight: 800, fontSize: 34, color: '#2f241f', lineHeight: 1.15 }}>{task.title}</div>
        <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>{task.subtitle}</div>
      </section>

      <div style={pillTabsStyle}>
        {TASKS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => navigate(entry.path)}
            style={entry.key === taskKey ? tabActiveStyle : tabStyle}
          >
            {shortTabLabel(entry.key)}
          </button>
        ))}
      </div>

      <OpsFormCard
        taskKey={taskKey}
        draft={draft}
        setDraft={setDraft}
        resetDraft={resetDraft}
        saveLocalDraft={saveLocalDraft}
        backend={backend}
        summary={summary}
      />

      <HistorySection
        title="รายการล่าสุดจาก backend"
        subtitle="ถ้า SQL รันแล้ว ส่วนนี้จะแสดงรายการที่บันทึกจริงเข้า Supabase แล้ว"
        items={backend.items}
        loading={backend.loading}
        error={backend.error}
        renderItem={(item) => renderHistoryLine(taskKey, item.payload || {})}
        renderExtra={(item) => renderBackendExtra(taskKey, item)}
      />

      <HistorySection
        title="รายการสำรองในเครื่อง"
        subtitle="เอาไว้กันข้อมูลหายกรณีเน็ตมีปัญหาหรือ backend ยังไม่พร้อม"
        items={localHistory}
        loading={false}
        error=""
        renderItem={(item) => renderHistoryLine(taskKey, item.data)}
        renderExtra={(item) => renderLocalExtra(taskKey, item.data)}
        isLocal
      />

      <div style={versionStyle}>{APP_VERSION}</div>
    </div>
  );
}

function OpsFormCard({ taskKey, draft, setDraft, resetDraft, saveLocalDraft, backend, summary }) {
  const { employeeSessionToken } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function submitBackend() {
    if (!hasAnyInput(draft) || saving) return;

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

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
      setSuccessMessage('บันทึกเข้า backend แล้ว');
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('employee_submit_ops_entry_v2') || message.includes('employee_ops_entries')) {
        setErrorMessage('ยังไม่ได้รันไฟล์ 25_employee_ops_entries.sql ใน Supabase SQL Editor');
      } else {
        setErrorMessage(error?.message || 'บันทึกเข้า backend ไม่สำเร็จ');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#2f241f', marginBottom: 6 }}>
        {taskKey === 'bills' ? 'บันทึกบิลซื้อของ' : 'บันทึกข้อมูล'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        เก็บข้อมูลเบื้องต้นลงเข้าระบบร้านหลัก
      </div>

      {renderFormFields(taskKey, draft, setDraft)}

      <div style={summaryPillStyle}>ร่างล่าสุด: {summary}</div>
      {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}
      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

      <div style={actionRowStyle}>
        <button className="btn btn-primary" onClick={submitBackend} disabled={!hasAnyInput(draft) || saving} style={{ flex: 1 }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกเข้า backend'}
        </button>
        <button className="btn" onClick={resetDraft} style={{ flex: 1 }}>
          ล้างฟอร์ม
        </button>
      </div>
    </div>
  );
}

function renderFormFields(taskKey, draft, setDraft) {
  switch (taskKey) {
    case 'bills':
      return (
        <div style={fieldGridStyle}>
          <Field label="ร้าน / ผู้ขาย">
            <input
              value={draft.vendor}
              onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
              placeholder="เช่น แม็คโคร / ร้านวัตถุดิบ"
            />
          </Field>
          <Field label="ยอดบิล">
            <input
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              placeholder="เช่น 1250"
              inputMode="numeric"
            />
          </Field>
          <Field label="ประเภท">
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option>วัตถุดิบ</option>
              <option>ของใช้</option>
              <option>อุปกรณ์</option>
              <option>อื่นๆ</option>
            </select>
          </Field>
          <Field label="รูปบิล">
            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageInput(e, draft, setDraft)} />
            {draft.imageName ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไฟล์ล่าสุด: {draft.imageName}</div>
                {draft.imagePreviewUrl ? (
                  <a href={draft.imagePreviewUrl} target="_blank" rel="noreferrer" style={previewLinkStyle}>
                    เปิดดูรูปที่เลือก
                  </a>
                ) : null}
              </div>
            ) : null}
          </Field>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น ซื้อเพิ่มสำหรับพรุ่งนี้"
            />
          </Field>
        </div>
      );
    case 'production':
      return (
        <div style={fieldGridStyle}>
          <Field label="เมนูที่ผลิต">
            <input
              value={draft.product}
              onChange={(e) => setDraft({ ...draft, product: e.target.value })}
              placeholder="เช่น ครัวซองต์เนยสด"
            />
          </Field>
          <TwoColRow>
            <Field label="จำนวน">
              <input
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                <option>ชิ้น</option>
                <option>ถาด</option>
                <option>ก้อน</option>
                <option>กก.</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="รอบผลิต / batch">
            <input
              value={draft.batch}
              onChange={(e) => setDraft({ ...draft, batch: e.target.value })}
              placeholder="เช่น เช้า / บ่าย / รอบ 1"
            />
          </Field>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น อบเพิ่มเพราะหน้าร้านขาด"
            />
          </Field>
        </div>
      );
    case 'inventory':
      return (
        <div style={fieldGridStyle}>
          <Field label="ชื่อวัตถุดิบ">
            <input
              value={draft.itemName}
              onChange={(e) => setDraft({ ...draft, itemName: e.target.value })}
              placeholder="เช่น แป้งเค้ก / เนย / ไข่"
            />
          </Field>
          <TwoColRow>
            <Field label="คงเหลือ">
              <input
                value={draft.stockLeft}
                onChange={(e) => setDraft({ ...draft, stockLeft: e.target.value })}
                placeholder="0"
                inputMode="decimal"
              />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                <option>กก.</option>
                <option>กรัม</option>
                <option>ลิตร</option>
                <option>ฟอง</option>
                <option>ชิ้น</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="สถานะ">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option>ปกติ</option>
              <option>ใกล้หมด</option>
              <option>ต้องสั่งเพิ่ม</option>
              <option>มีปัญหา</option>
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น ไข่เหลือพอถึงพรุ่งนี้เช้า"
            />
          </Field>
        </div>
      );
    case 'cake-stock':
      return (
        <div style={fieldGridStyle}>
          <Field label="สาขาที่เช็ก">
            <select value={draft.branchName} onChange={(e) => setDraft({ ...draft, branchName: e.target.value })}>
              <option>สาขากาดน้ำทอง</option>
              <option>สาขากาดกองเก่า</option>
            </select>
          </Field>
          <Field label="ชื่อเค้ก / เมนู">
            <input
              value={draft.cakeName}
              onChange={(e) => setDraft({ ...draft, cakeName: e.target.value })}
              placeholder="เช่น เค้กส้ม / ช็อกโกแลต / Red velvet"
            />
          </Field>
          <TwoColRow>
            <Field label="พร้อมขาย">
              <input
                value={draft.available}
                onChange={(e) => setDraft({ ...draft, available: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="จอง">
              <input
                value={draft.reserved}
                onChange={(e) => setDraft({ ...draft, reserved: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
          </TwoColRow>
          <TwoColRow>
            <Field label="เสียหาย / หมดอายุ">
              <input
                value={draft.damaged}
                onChange={(e) => setDraft({ ...draft, damaged: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="สถานะ">
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option>พร้อมขาย</option>
                <option>ใกล้หมด</option>
                <option>หมด</option>
                <option>ต้องเติมจากครัว</option>
                <option>มีปัญหา</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น สาขานี้ต้องเติมเค้กส้ม 2 ชิ้นก่อนบ่าย"
            />
          </Field>
        </div>
      );
    case 'supplies-count':
      return (
        <div style={fieldGridStyle}>
          <Field label="จุดที่นับ">
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
              <option>หน้าร้าน</option>
              <option>ครัว</option>
              <option>สต๊อกหลังร้าน</option>
              <option>ล้างจาน</option>
            </select>
          </Field>
          <Field label="รายการของใช้">
            <input
              value={draft.itemName}
              onChange={(e) => setDraft({ ...draft, itemName: e.target.value })}
              placeholder="เช่น ทิชชู่ / แก้ว 16 oz / น้ำยาล้างจาน"
            />
          </Field>
          <TwoColRow>
            <Field label="จำนวนคงเหลือ">
              <input
                value={draft.count}
                onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                <option>ชิ้น</option>
                <option>แพค</option>
                <option>ขวด</option>
                <option>ลัง</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น เหลือน้อยมาก ควรซื้อวันนี้"
            />
          </Field>
        </div>
      );
    case 'purchase-list':
      return (
        <div style={fieldGridStyle}>
          <Field label="รายการที่ต้องซื้อ">
            <input
              value={draft.itemName}
              onChange={(e) => setDraft({ ...draft, itemName: e.target.value })}
              placeholder="เช่น เนย / ถุงหิ้ว / ทิชชู่"
            />
          </Field>
          <TwoColRow>
            <Field label="จำนวน">
              <input
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="หน่วย">
              <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                <option>ชิ้น</option>
                <option>แพค</option>
                <option>กก.</option>
                <option>ลัง</option>
              </select>
            </Field>
          </TwoColRow>
          <Field label="ความด่วน">
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
              <option>วันนี้</option>
              <option>ภายใน 2 วัน</option>
              <option>ซื้อรอบหน้า</option>
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น ใช้กับเมนูครัวซองต์ / สั่งขนาดใหญ่"
            />
          </Field>
        </div>
      );
    default:
      return null;
  }
}

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
    danger: { background: '#fff1f1', border: '#f3c3c3', color: '#b42318' },
  };
  const palette = tones[tone] || tones.warning;

  return (
    <div
      style={{
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        borderRadius: 16,
        padding: '12px 14px',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={emptyStateStyle}>{children}</div>;
}

function useTaskDraft(taskKey) {
  const storageKey = `${STORAGE_PREFIX}${taskKey}`;
  const initial = DEFAULT_DRAFTS[taskKey];
  const [draft, setDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(draft));
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
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  function saveLocalDraft(payload) {
    const next = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        savedAt: new Date().toISOString(),
        data: payload,
      },
      ...items,
    ].slice(0, HISTORY_LIMIT);

    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  return [items, saveLocalDraft];
}

function useTaskBackend(taskKey) {
  const { employeeSessionToken } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.rpc('employee_get_ops_entries_v2', {
        p_session_token: employeeSessionToken,
        p_task_key: taskKey,
        p_limit: HISTORY_LIMIT,
      });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('employee_get_ops_entries_v2') || message.includes('employee_ops_entries')) {
        setError('ส่วน backend ของ OPS ยังไม่พร้อม ใช้รายการสำรองในเครื่องไปก่อนจนกว่าจะรัน SQL');
      } else {
        setError(error?.message || 'โหลดรายการล่าสุดไม่สำเร็จ');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [employeeSessionToken, taskKey]);

  return { items, loading, error, reload };
}

function getTaskKeyFromPath(pathname) {
  if (!pathname.startsWith('/emp/ops')) return null;
  const slug = pathname.replace('/emp/ops', '').replace(/^\//, '');
  if (!slug) return null;
  return TASK_MAP[slug] ? slug : null;
}

function sanitizePayload(taskKey, draft) {
  const payload = { ...draft };
  if (taskKey === 'bills') {
    delete payload.imagePreviewUrl;
  }
  return payload;
}

function hasAnyInput(draft) {
  return Object.values(draft).some((value) => String(value || '').trim() !== '');
}

function handleImageInput(event, draft, setDraft) {
  const file = event.target.files?.[0];
  if (!file) return;
  const previewUrl = URL.createObjectURL(file);
  setDraft({
    ...draft,
    imageName: file.name,
    imagePreviewUrl: previewUrl,
  });
}

function summarizeDraft(taskKey, draft) {
  switch (taskKey) {
    case 'bills':
      return `${draft.vendor || '-'} / ${draft.amount || '-'} บาท / ${draft.category || 'วัตถุดิบ'}`;
    case 'production':
      return `${draft.product || '-'} / ${draft.quantity || '0'} ${draft.unit || ''} / ${draft.batch || '-'}`;
    case 'inventory':
      return `${draft.itemName || '-'} / ${draft.stockLeft || '0'} ${draft.unit || ''} / ${draft.status || '-'}`;
    case 'cake-stock':
      return `${draft.branchName || '-'} / ${draft.cakeName || '-'} / พร้อมขาย ${draft.available || '0'} จอง ${draft.reserved || '0'} เสีย ${draft.damaged || '0'}`;
    case 'supplies-count':
      return `${draft.area || '-'} / ${draft.itemName || '-'} / ${draft.count || '0'} ${draft.unit || ''}`;
    case 'purchase-list':
      return `${draft.itemName || '-'} / ${draft.quantity || '0'} ${draft.unit || ''} / ${draft.priority || '-'}`;
    default:
      return '-';
  }
}

function renderHistoryLine(taskKey, payload) {
  switch (taskKey) {
    case 'bills':
      return `${payload.vendor || '-'} / ${payload.amount || '-'} บาท / ${payload.category || 'วัตถุดิบ'}`;
    case 'production':
      return `${payload.product || '-'} / ${payload.quantity || '0'} ${payload.unit || ''} / ${payload.batch || '-'}`;
    case 'inventory':
      return `${payload.itemName || '-'} / ${payload.stockLeft || '0'} ${payload.unit || ''} / ${payload.status || '-'}`;
    case 'cake-stock':
      return `${payload.branchName || '-'} / ${payload.cakeName || '-'} / พร้อมขาย ${payload.available || '0'} จอง ${payload.reserved || '0'} เสีย ${payload.damaged || '0'} / ${payload.status || '-'}`;
    case 'supplies-count':
      return `${payload.area || '-'} / ${payload.itemName || '-'} / ${payload.count || '0'} ${payload.unit || ''}`;
    case 'purchase-list':
      return `${payload.itemName || '-'} / ${payload.quantity || '0'} ${payload.unit || ''} / ${payload.priority || '-'}`;
    default:
      return '-';
  }
}

function renderBackendExtra(taskKey, item) {
  if (taskKey !== 'bills' || !item.image_name) return null;
  return <div style={{ fontSize: 12, color: '#7a5b2b', marginTop: 4 }}>รูปที่แนบ: {item.image_name}</div>;
}

function renderLocalExtra(taskKey, payload) {
  if (taskKey !== 'bills') return null;
  if (!payload.imageName && !payload.imagePreviewUrl) return null;

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
      {payload.imageName ? <div style={{ fontSize: 12, color: '#7a5b2b' }}>รูปที่แนบ: {payload.imageName}</div> : null}
      {payload.imagePreviewUrl ? (
        <a href={payload.imagePreviewUrl} target="_blank" rel="noreferrer" style={previewLinkStyle}>
          เปิดดูรูปที่เลือก
        </a>
      ) : null}
    </div>
  );
}

function shortTabLabel(taskKey) {
  const labels = {
    bills: 'ถ่ายบิล',
    production: 'ผลิตขนม',
    inventory: 'วัตถุดิบ',
    'cake-stock': 'สต๊อกเค้ก',
    'supplies-count': 'ของใช้',
    'purchase-list': 'ใบซื้อ',
  };
  return labels[taskKey] || taskKey;
}

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

const pageStyle = {
  padding: '16px 16px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const heroCardStyle = {
  padding: 18,
  borderRadius: 26,
  background: 'linear-gradient(180deg, rgba(255,249,241,.96) 0%, rgba(255,255,255,.96) 100%)',
  border: '1px solid rgba(197,162,117,.24)',
};

const cardStyle = {
  padding: 18,
  borderRadius: 24,
  display: 'grid',
  gap: 12,
  background: 'var(--surface)',
  border: '1px solid var(--line)',
};

const taskCardButtonStyle = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr 22px',
  alignItems: 'center',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  textDecoration: 'none',
  color: 'inherit',
  background: '#fff',
  border: '1px solid #eadcc6',
  cursor: 'pointer',
};

const taskIconStyle = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 26,
};

const fieldGridStyle = {
  display: 'grid',
  gap: 12,
};

const actionRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const summaryPillStyle = {
  background: '#f6efe3',
  border: '1px solid #eadcc6',
  borderRadius: 16,
  padding: '12px 14px',
  fontSize: 13,
  color: '#7a5b2b',
};

const emptyStateStyle = {
  background: '#faf7f2',
  border: '1px dashed #dccfbf',
  borderRadius: 18,
  padding: '18px 14px',
  textAlign: 'center',
  color: 'var(--muted)',
  fontSize: 13,
};

const historyCardStyle = {
  background: '#faf7f2',
  border: '1px solid #eadcc6',
  borderRadius: 18,
  padding: '12px 14px',
};

const pillTabsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const tabStyle = {
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const tabActiveStyle = {
  ...tabStyle,
  background: 'var(--accent)',
  color: '#fff',
  borderColor: 'var(--accent)',
};

const previewLinkStyle = {
  display: 'inline-block',
  marginTop: 2,
  fontSize: 12,
  color: '#0e7c66',
  fontWeight: 700,
  textDecoration: 'none',
};

const inlineGhostButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 700,
  padding: 0,
  cursor: 'pointer',
};

const versionStyle = {
  alignSelf: 'flex-end',
  fontSize: 10,
  color: 'var(--muted)',
  background: 'rgba(255,255,255,.92)',
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '3px 8px',
};
