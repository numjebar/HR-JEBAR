import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ICON_MAP = [
  [/ชีสเค้ก|cheese\s*cake/i, '🍰'],
  [/ช็อค|chocolate|โกโก้/i,  '🍫'],
  [/มัฟฟิน|muffin/i,         '🧁'],
  [/คุกกี้|cookie/i,         '🍪'],
  [/ครัวซอง|croissant/i,     '🥐'],
  [/ทาร์ต|tart/i,            '🥧'],
  [/มาการอง|macaron/i,       '💜'],
  [/บราวนี่|brownie/i,       '🟫'],
  [/วาฟเฟิล|waffle/i,        '🧇'],
  [/ขนมปัง|bread|บาแก็ต/i,  '🥖'],
  [/มาชา|matcha/i,           '🍵'],
  [/สตรอว์|strawberry/i,     '🍓'],
  [/เลมอน|lemon/i,           '🍋'],
  [/พาย|pie/i,               '🥧'],
  [/โรล|roll|ม้วน/i,         '🌀'],
  [/เค้ก|cake/i,             '🎂'],
];
function getIcon(name) {
  for (const [re, icon] of ICON_MAP) if (re.test(name)) return icon;
  return '🍞';
}

function fmtPrice(p) {
  if (!p) return '';
  return `฿${Number(p).toFixed(0)}`;
}

export default function CatalogPage() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState({});     // { item_id: number }
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      // Load session
      const { data: sess, error: sessErr } = await supabase
        .from('catalog_sessions')
        .select('*')
        .eq('id', token)
        .single();

      if (sessErr || !sess) { setError('ลิงก์แคตตาล็อกไม่ถูกต้องหรือหมดอายุแล้ว'); return; }
      if (new Date(sess.expires_at) < new Date()) { setError('ลิงก์แคตตาล็อกหมดอายุแล้ว'); return; }
      setSession(sess);

      // Load items (only open items)
      const { data: itemData } = await supabase
        .from('cake_items')
        .select('id,name,is_open,photo_url,price')
        .eq('org_id', sess.org_id)
        .eq('is_open', true)
        .in('status', ['active'])
        .order('sort_order');

      // Load stock
      let stockQ = supabase.from('cake_stock').select('item_id,qty').eq('org_id', sess.org_id);
      if (sess.branch_id) stockQ = stockQ.eq('branch_id', sess.branch_id);
      const { data: stockData } = await stockQ;

      const sm = {};
      (stockData || []).forEach(r => { sm[r.item_id] = (sm[r.item_id] || 0) + r.qty; });
      setStockMap(sm);

      // Only show items with stock > 0
      const available = (itemData || []).filter(it => (sm[it.id] || 0) > 0);
      setItems(available);
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  function setItemQty(id, v) {
    const max = stockMap[id] || 0;
    setQty(prev => ({ ...prev, [id]: Math.max(0, Math.min(max, v)) }));
  }

  const selected = items.filter(it => (qty[it.id] || 0) > 0);
  const totalItems = selected.reduce((s, it) => s + (qty[it.id] || 0), 0);

  function buildOrderText() {
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const lines = selected.map(it => {
      const price = it.price ? ` (${fmtPrice(it.price * qty[it.id])})` : '';
      return `• ${it.name} ${qty[it.id]} ชิ้น${price}`;
    });
    return `🧁 สั่งขนม JE BAR — ${today}\n${lines.join('\n')}\nรวม: ${totalItems} ชิ้น`;
  }

  function copyOrder() {
    navigator.clipboard.writeText(buildOrderText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // ── Render ──
  if (loading) return (
    <div style={styles.centered}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧁</div>
      <div style={{ color: '#9ca3af', fontSize: 15 }}>กำลังโหลด...</div>
    </div>
  );

  if (error) return (
    <div style={styles.centered}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
      <div style={{ color: '#ef4444', fontSize: 15, textAlign: 'center' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#faf7f2', fontFamily: "'Sarabun', sans-serif", paddingBottom: totalItems > 0 ? 100 : 24 }}>
      {/* Header */}
      <div style={{ background: '#4A2E1A', color: '#E8C89E', padding: '20px 16px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>☕ JE BAR Coffee & Pastry</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>เมนูขนมวันนี้</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        {items.length > 0 && (
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 14px', display: 'inline-block', fontSize: 13 }}>
            มีขนม {items.length} รายการ
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '12px 12px 0' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🫙</div>
            <div>ขณะนี้ยังไม่มีขนมพร้อมขาย</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {items.map(item => {
              const stock = stockMap[item.id] || 0;
              const selected = qty[item.id] || 0;
              return (
                <div key={item.id} style={{
                  background: '#fff',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
                  border: selected > 0 ? '2px solid #16a34a' : '2px solid transparent',
                  transition: 'border-color 0.15s',
                }}>
                  {/* Photo */}
                  <div style={{ width: '100%', aspectRatio: '1', background: '#f5f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 48 }}>{getIcon(item.name)}</span>
                    )}
                    {/* Remaining badge */}
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: stock <= 3 ? '#dc2626' : 'rgba(0,0,0,0.55)',
                      color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      padding: '2px 8px',
                    }}>
                      เหลือ {stock} ชิ้น
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', lineHeight: 1.3 }}>{item.name}</div>
                    {item.price && (
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#4A2E1A', marginTop: 2 }}>฿{item.price}</div>
                    )}

                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8, background: '#f9f5f0', borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        onClick={() => setItemQty(item.id, selected - 1)}
                        disabled={selected === 0}
                        style={{ flex: 1, height: 36, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700, cursor: selected === 0 ? 'not-allowed' : 'pointer', color: selected === 0 ? '#d1d5db' : '#dc2626' }}
                      >−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 18, color: selected > 0 ? '#16a34a' : '#9ca3af' }}>{selected}</div>
                      <button
                        onClick={() => setItemQty(item.id, selected + 1)}
                        disabled={selected >= stock}
                        style={{ flex: 1, height: 36, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700, cursor: selected >= stock ? 'not-allowed' : 'pointer', color: selected >= stock ? '#d1d5db' : '#16a34a' }}
                      >+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order footer */}
      {totalItems > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>รายการที่เลือก</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b' }}>
              {totalItems} ชิ้น
              {selected.length > 0 && (() => {
                const total = selected.reduce((s, it) => s + (it.price || 0) * (qty[it.id] || 0), 0);
                return total > 0 ? <span style={{ fontSize: 14, fontWeight: 600, color: '#4A2E1A', marginLeft: 8 }}>฿{total}</span> : null;
              })()}
            </div>
          </div>
          <button
            onClick={copyOrder}
            style={{
              background: copied ? '#16a34a' : '#4A2E1A',
              color: '#E8C89E', border: 'none', borderRadius: 14,
              padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {copied ? '✓ คัดลอกแล้ว!' : '📋 คัดลอกออเดอร์'}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  centered: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Sarabun', sans-serif", background: '#faf7f2',
  },
};
