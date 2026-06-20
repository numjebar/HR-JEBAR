import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { DEFAULT_RULES, parseLocation } from '../../lib/payroll';

export default function AdminSettings() {
  const { orgId } = useAuthStore();
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [globalRules, setGlobalRules] = useState({ ...DEFAULT_RULES });
  const [branchRules, setBranchRules] = useState({ ...DEFAULT_RULES });
  const [shopRules, setShopRules] = useState([]);
  const [globalShopRules, setGlobalShopRules] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [opsUrl, setOpsUrl] = useState('');
  const [opsKey, setOpsKey] = useState('');
  const [opsSaved, setOpsSaved] = useState(false);

  async function load() {
    const [{ data: brs }, { data: st }] = await Promise.all([
      supabase.from('branches').select('*').eq('org_id', orgId).order('label'),
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
    ]);
    setBranches(brs || []);
    if (st) {
      setGlobalRules({ ...DEFAULT_RULES, ...(st.rules || {}) });
      setGlobalShopRules(st.shop_rules || []);
      const cfg = st.rules?.ops_config || {};
      setOpsUrl(cfg.url || '');
      setOpsKey(cfg.key || '');
    }
    if (brs && brs.length > 0 && !activeBranch) {
      selectBranch(brs[0]);
    } else if (activeBranch) {
      const updated = (brs || []).find((b) => b.id === activeBranch.id);
      if (updated) selectBranch(updated);
    }
  }

  function selectBranch(br) {
    setActiveBranch(br);
    setBranchRules({ ...DEFAULT_RULES, ...(br.rules || {}) });
    setShopRules(br.shop_rules || []);
  }

  useEffect(() => { load(); }, []);

  function cleanShopRules(rules) {
    return (rules || []).map((r) => r.trim()).filter(Boolean);
  }

  async function saveBranchRules() {
    if (!activeBranch) return;
    setBusy(true);
    const cleanedShopRules = cleanShopRules(shopRules);
    await supabase.from('branches').update({ rules: branchRules, shop_rules: cleanedShopRules }).eq('id', activeBranch.id);
    setShopRules(cleanedShopRules);
    setBusy(false);
    load();
  }

  async function saveGlobalRules() {
    setBusy(true);
    const cleanedGlobalShopRules = cleanShopRules(globalShopRules);
    const { data: st } = await supabase.from('org_settings').select('org_id,rules').eq('org_id', orgId).maybeSingle();
    const mergedRules = { ...(st?.rules || {}), ...globalRules };
    if (st) {
      await supabase.from('org_settings').update({ rules: mergedRules, shop_rules: cleanedGlobalShopRules }).eq('org_id', orgId);
    } else {
      await supabase.from('org_settings').insert({ org_id: orgId, rules: mergedRules, shop_rules: cleanedGlobalShopRules });
    }
    setGlobalShopRules(cleanedGlobalShopRules);
    setBusy(false);
  }

  async function saveOpsConfig() {
    setBusy(true);
    setOpsSaved(false);
    const { data: st } = await supabase.from('org_settings').select('org_id,rules').eq('org_id', orgId).maybeSingle();
    const merged = { ...(st?.rules || {}), ops_config: { url: opsUrl.trim(), key: opsKey.trim() } };
    if (st) {
      await supabase.from('org_settings').update({ rules: merged }).eq('org_id', orgId);
    } else {
      await supabase.from('org_settings').insert({ org_id: orgId, rules: merged, shop_rules: [] });
    }
    setBusy(false);
    setOpsSaved(true);
    setTimeout(() => setOpsSaved(false), 3000);
  }

  async function deleteBranch(id) {
    if (!confirm('ลบสาขานี้? พนักงานที่อยู่ในสาขานี้จะไม่มีสาขา')) return;
    await supabase.from('branches').delete().eq('id', id);
    setActiveBranch(null);
    load();
  }

  function setR(k, v) { setBranchRules((p) => ({ ...p, [k]: v })); }
  function setGR(k, v) { setGlobalRules((p) => ({ ...p, [k]: v })); }

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>ตั้งค่ากฎ</h1>

      {/* global anti-cheat */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🌐 การตั้งค่า Global (ทุกสาขา)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Toggle label="เปิด Geofence (บังคับอยู่ในพื้นที่)" checked={globalRules.geoEnabled} onChange={(v) => setGR('geoEnabled', v)} />
          <Toggle label="บังคับถ่ายเซลฟี่ตอนเช็คอิน" checked={globalRules.requireSelfie} onChange={(v) => setGR('requireSelfie', v)} />
        </div>
        <Section title="📜 ระเบียบร้าน Global (ใช้เมื่อสาขานั้นไม่ได้ตั้งระเบียบเอง)">
          <ShopRulesEditor rules={globalShopRules} onChange={setGlobalShopRules} />
        </Section>
        <button className="btn btn-primary" onClick={saveGlobalRules} disabled={busy} style={{ fontSize: 14 }}>บันทึก Global</button>
      </div>

      {/* branch selector + rules */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        {/* branch list */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>สาขา</div>
          {branches.map((b) => (
            <button key={b.id} onClick={() => selectBranch(b)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
              background: activeBranch?.id === b.id ? 'var(--accent-soft)' : 'var(--surface)',
              color: activeBranch?.id === b.id ? 'var(--accent)' : 'var(--ink)',
              border: '1px solid var(--line)', borderRadius: 10, marginBottom: 6,
              cursor: 'pointer', fontWeight: activeBranch?.id === b.id ? 700 : 400, fontSize: 14,
            }}>{b.label}</button>
          ))}
          <button className="btn" onClick={() => setShowAddBranch(true)} style={{ width: '100%', background: 'var(--surface)', border: '1px dashed var(--line)', color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            + เพิ่มสาขา
          </button>
        </div>

        {/* branch rule editor */}
        {activeBranch && (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{activeBranch.label}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ fontSize: 13, padding: '6px 14px', background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => setEditBranch(activeBranch)}>แก้ไขสาขา</button>
                <button className="btn btn-danger" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => deleteBranch(activeBranch.id)}>ลบสาขา</button>
              </div>
            </div>

            <Section title="⏰ เวลาทำงาน">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <NumberField label="เวลาเข้างาน" value={branchRules.workStart} type="time" onChange={(v) => setR('workStart', v)} />
                <NumberField label="เวลาเลิกงาน" value={branchRules.workEnd} type="time" onChange={(v) => setR('workEnd', v)} />
                <NumberField label="ผ่อนผัน (นาที)" value={branchRules.graceMin} onChange={(v) => setR('graceMin', +v)} />
              </div>
            </Section>

            <Section title="⏱ กฎมาสาย">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['tiered', 'permin'].map((m) => (
                  <button key={m} onClick={() => setR('lateMode', m)} className="btn" style={{ background: branchRules.lateMode === m ? 'var(--accent)' : 'var(--bg)', color: branchRules.lateMode === m ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 16px', fontSize: 13 }}>
                    {m === 'tiered' ? 'ขั้นบันได' : 'ต่อนาที'}
                  </button>
                ))}
              </div>
              {branchRules.lateMode === 'tiered' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <NumberField label="สายเกิน (นาที) → หักทันที" value={branchRules.lateBigMin} onChange={(v) => setR('lateBigMin', +v)} />
                  <NumberField label="สายเกิน (นาที) นับสะสม" value={branchRules.lateMinorMin} onChange={(v) => setR('lateMinorMin', +v)} />
                  <NumberField label="สะสมครบ (ครั้ง)" value={branchRules.lateMinorCount} onChange={(v) => setR('lateMinorCount', +v)} />
                  <NumberField label="หัก (ชั่วโมงค่าแรง)" value={branchRules.lateDeductHours} onChange={(v) => setR('lateDeductHours', +v)} />
                </div>
              ) : (
                <NumberField label="หักนาทีละ (บาท)" value={branchRules.lateDeductPerMin} onChange={(v) => setR('lateDeductPerMin', +v)} />
              )}
            </Section>

            <Section title="🕐 OT">
              <NumberField label="เริ่มนับ OT หลังเวลาเลิกงาน (นาที)" value={branchRules.otGraceMin ?? 30} onChange={(v) => setR('otGraceMin', +v)} />
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 12px' }}>
                ตัวอย่าง: เลิกงาน 18:00 ตั้ง 30 นาที จะเริ่มคิด OT ตั้งแต่ 18:30 เป็นต้นไป
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['multiplier', 'fixed'].map((m) => (
                  <button key={m} onClick={() => setR('otMode', m)} className="btn" style={{ background: branchRules.otMode === m ? 'var(--accent)' : 'var(--bg)', color: branchRules.otMode === m ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 16px', fontSize: 13 }}>
                    {m === 'multiplier' ? 'x เท่าของค่าแรง' : 'บาท/ชั่วโมงคงที่'}
                  </button>
                ))}
              </div>
              {branchRules.otMode === 'multiplier'
                ? <NumberField label="เท่าของค่าแรงรายชั่วโมง" value={branchRules.otMultiplier} onChange={(v) => setR('otMultiplier', +v)} />
                : <NumberField label="บาท/ชั่วโมง" value={branchRules.otRatePerHour} onChange={(v) => setR('otRatePerHour', +v)} />
              }
            </Section>

            <Section title="🏥 ประกันสังคม">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['percent', 'fixed'].map((m) => (
                  <button key={m} onClick={() => setR('ssMode', m)} className="btn" style={{ background: branchRules.ssMode === m ? 'var(--accent)' : 'var(--bg)', color: branchRules.ssMode === m ? '#fff' : 'var(--muted)', border: '1px solid var(--line)', padding: '7px 16px', fontSize: 13 }}>
                    {m === 'percent' ? 'เปอร์เซ็นต์' : 'ยอดคงที่'}
                  </button>
                ))}
              </div>
              {branchRules.ssMode === 'percent' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <NumberField label="% ของค่าจ้าง" value={branchRules.ssPercent} onChange={(v) => setR('ssPercent', +v)} />
                  <NumberField label="เพดานสูงสุด (บาท/รอบ)" value={branchRules.ssMax} onChange={(v) => setR('ssMax', +v)} />
                </div>
              ) : (
                <NumberField label="ยอดเงินคงที่ (บาท/รอบ)" value={branchRules.ssAmount} onChange={(v) => setR('ssAmount', +v)} />
              )}
            </Section>

            <Section title="🏖 การลา">
              <NumberField label="ลาด่วนเช้าไม่มีเหตุผล หักกี่แรง" value={branchRules.urgentLeaveDeductDays} onChange={(v) => setR('urgentLeaveDeductDays', +v)} />
            </Section>

            <Section title="📜 ระเบียบร้าน (แสดงในแอปพนักงาน)">
              <ShopRulesEditor rules={shopRules} onChange={setShopRules} />
            </Section>

            <button className="btn btn-primary" onClick={saveBranchRules} disabled={busy} style={{ width: '100%', marginTop: 8, fontSize: 15 }}>
              {busy ? 'กำลังบันทึก...' : 'บันทึกกฎสาขานี้'}
            </button>
          </div>
        )}
      </div>

      {/* OPS connection config */}
      <div className="card" style={{ padding: '20px 24px', marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>🔗 เชื่อมต่อระบบ OPS (JE BAR Operate)</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          ตั้งค่า URL และ Key ของ Supabase จากระบบ Operate เพื่อให้พนักงานเลือกรายการวัตถุดิบ/เมนูในใบสั่งซื้อได้
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Supabase URL (จาก Project Settings → API)</label>
            <input
              type="url"
              value={opsUrl}
              onChange={e => setOpsUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              style={{ width: '100%', fontSize: 14, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Anon Key (จาก Project Settings → API → anon public)</label>
            <input
              type="password"
              value={opsKey}
              onChange={e => setOpsKey(e.target.value)}
              placeholder="eyJhbGciOiJ..."
              style={{ width: '100%', fontSize: 14, fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={saveOpsConfig} disabled={busy || (!opsUrl && !opsKey)} style={{ fontSize: 14 }}>
              บันทึกการเชื่อมต่อ
            </button>
            {opsSaved && <span style={{ fontSize: 13, color: '#0d7a46', fontWeight: 700 }}>✓ บันทึกแล้ว — พนักงานจะเห็นรายการวัตถุดิบในครั้งต่อไปที่ล็อกอิน</span>}
          </div>
        </div>
      </div>

      {showAddBranch && <BranchFormModal orgId={orgId} onClose={() => { setShowAddBranch(false); load(); }} />}
      {editBranch && <BranchFormModal orgId={orgId} branch={editBranch} onClose={() => { setEditBranch(null); load(); }} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, type = 'number' }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={type === 'number' ? 'any' : undefined} />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 44, height: 24, borderRadius: 999, background: checked ? 'var(--accent)' : 'var(--line)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  );
}

function ShopRulesEditor({ rules, onChange }) {
  const visibleRules = rules.length > 0 ? rules : [''];
  function add() { onChange([...rules, '']); }
  function update(i, v) { const a = rules.length > 0 ? [...rules] : ['']; a[i] = v; onChange(a); }
  function remove(i) { onChange(rules.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibleRules.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <input value={r} onChange={(e) => update(i, e.target.value)} placeholder={`ข้อที่ ${i + 1}`} style={{ flex: 1 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--danger-fg)', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>×</button>
        </div>
      ))}
      <button className="btn" onClick={add} style={{ background: 'var(--bg)', border: '1px dashed var(--line)', color: 'var(--muted)', fontSize: 13, alignSelf: 'flex-start', padding: '8px 16px' }}>+ เพิ่มข้อ</button>
    </div>
  );
}

function BranchFormModal({ orgId, branch, onClose }) {
  const isEdit = !!branch;
  const [form, setForm] = useState({
    label: branch?.label || 'สาขาใหม่',
    lat: branch?.lat || 13.7466,
    lng: branch?.lng || 100.5347,
    radius: branch?.radius || 20,
  });
  const [locInput, setLocInput] = useState('');
  const [locErr, setLocErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  function parseLocInput() {
    const result = parseLocation(locInput);
    if (result) {
      setForm((p) => ({ ...p, lat: +result.lat.toFixed(6), lng: +result.lng.toFixed(6) }));
      setLocErr('');
    } else {
      setLocErr('ไม่รู้จักรูปแบบ: รองรับ "lat, lng" / Google Maps URL / Plus Code');
    }
  }

  function getGPS() {
    setGeoLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setForm((p) => ({ ...p, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) })); setGeoLoading(false); },
      () => { setLocErr('ไม่สามารถรับ GPS ได้'); setGeoLoading(false); }
    );
  }

  async function save() {
    setBusy(true);
    if (isEdit) {
      await supabase.from('branches').update({ label: form.label, lat: form.lat, lng: form.lng, radius: form.radius }).eq('id', branch.id);
    } else {
      await supabase.from('branches').insert({ ...form, org_id: orgId, rules: { ...DEFAULT_RULES }, shop_rules: [] });
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>{isEdit ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>ชื่อสาขา</label>
            <input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>รัศมี Geofence (เมตร)</label>
            <input type="number" value={form.radius} onChange={(e) => setForm((p) => ({ ...p, radius: +e.target.value }))} />
          </div>

          {/* location parser */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
              พิกัด — วาง Google Maps URL, "lat, lng" หรือ Plus Code
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={locInput} onChange={(e) => setLocInput(e.target.value)} placeholder="https://maps.google.com/... หรือ 13.7466, 100.5347" style={{ flex: 1 }} />
              <button className="btn" onClick={parseLocInput} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>ดึงพิกัด</button>
            </div>
            {locErr && <div style={{ fontSize: 12, color: 'var(--danger-fg)', marginBottom: 6 }}>{locErr}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Latitude</label>
                <input type="number" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: +e.target.value }))} step="0.000001" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Longitude</label>
                <input type="number" value={form.lng} onChange={(e) => setForm((p) => ({ ...p, lng: +e.target.value }))} step="0.000001" />
              </div>
            </div>
            <button className="btn" onClick={getGPS} disabled={geoLoading} style={{ marginTop: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13 }}>
              {geoLoading ? 'กำลังรับ GPS...' : '📍 ใช้ตำแหน่งปัจจุบัน'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy || !form.label}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  );
}
