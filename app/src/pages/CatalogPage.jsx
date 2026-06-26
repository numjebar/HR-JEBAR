import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Icon fallback ────────────────────────────────────────────────────────────
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

// ─── JE BAR Logo (SVG) ───────────────────────────────────────────────────────
function JeBarLogo({ size = 48 }) {
  return (
    <svg width={size * 3.2} height={size} viewBox="0 0 192 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* JE */}
      <text x="0" y="46" fontFamily="Georgia, 'Times New Roman', serif" fontSize="52" fontWeight="700" fill="#2d2d2d" letterSpacing="-1">JE</text>
      {/* Golden triangle (A shape) — replaces A in BAR */}
      <g transform="translate(92,4)">
        {/* Triangle outline */}
        <polygon points="20,0 38,44 2,44" fill="none" stroke="#b8932a" strokeWidth="3.5" strokeLinejoin="round"/>
        {/* Bottom arc */}
        <path d="M6,44 Q20,52 34,44" fill="none" stroke="#b8932a" strokeWidth="3.5" strokeLinecap="round"/>
        {/* Coffee drop inside */}
        <ellipse cx="20" cy="28" rx="4" ry="5.5" fill="#b8932a"/>
        <path d="M20,22 Q23,19 20,16 Q17,19 20,22" fill="#b8932a"/>
      </g>
      {/* R */}
      <text x="132" y="46" fontFamily="Georgia, 'Times New Roman', serif" fontSize="52" fontWeight="700" fill="#2d2d2d" letterSpacing="-1">R</text>
      {/* Subtitle */}
      <text x="96" y="58" fontFamily="Georgia, 'Times New Roman', serif" fontSize="10" fill="#9a7a3a" textAnchor="middle" letterSpacing="2">Coffee &amp; Pastry</text>
    </svg>
  );
}

export default function CatalogPage() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (token) load(); }, [token]);

  async function load() {
    setLoading(true);
    try {
      const { data: sess, error: sessErr } = await supabase
        .from('catalog_sessions').select('*').eq('id', token).single();
      if (sessErr || !sess) { setError('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว'); return; }
      if (new Date(sess.expires_at) < new Date()) { setError('ลิงก์หมดอายุแล้ว'); return; }
      setSession(sess);

      const { data: itemData } = await supabase
        .from('cake_items').select('id,name,is_open,photo_url,price')
        .eq('org_id', sess.org_id).eq('is_open', true).in('status', ['active']).order('sort_order');

      let stockQ = supabase.from('cake_stock').select('item_id,qty').eq('org_id', sess.org_id);
      if (sess.branch_id) stockQ = stockQ.eq('branch_id', sess.branch_id);
      const { data: stockData } = await stockQ;

      const sm = {};
      (stockData || []).forEach(r => { sm[r.item_id] = (sm[r.item_id] || 0) + r.qty; });
      setStockMap(sm);
      setItems((itemData || []).filter(it => (sm[it.id] || 0) > 0));
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  function setItemQty(id, v) {
    setQty(prev => ({ ...prev, [id]: Math.max(0, Math.min(stockMap[id] || 0, v)) }));
  }

  const selected = items.filter(it => (qty[it.id] || 0) > 0);
  const totalPieces = selected.reduce((s, it) => s + qty[it.id], 0);
  const totalPrice = selected.reduce((s, it) => s + (it.price || 0) * qty[it.id], 0);

  function buildOrderText() {
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const lines = selected.map(it => {
      const p = it.price ? ` × ฿${it.price} = ฿${it.price * qty[it.id]}` : '';
      return `• ${it.name}  ${qty[it.id]} ชิ้น${p}`;
    });
    const priceRow = totalPrice > 0 ? `\nรวมราคา: ฿${totalPrice}` : '';
    return `🧁 สั่งขนม JE BAR\n${today}\n${lines.join('\n')}\nรวม: ${totalPieces} ชิ้น${priceRow}`;
  }

  function copyOrder() {
    navigator.clipboard.writeText(buildOrderText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (loading) return (
    <div style={S.center}><div style={{ fontSize: 48 }}>🧁</div><div style={{ color: '#9ca3af', marginTop: 12 }}>กำลังโหลด...</div></div>
  );
  if (error) return (
    <div style={S.center}><div style={{ fontSize: 48 }}>😕</div><div style={{ color: '#ef4444', marginTop: 12, textAlign: 'center' }}>{error}</div></div>
  );

  const dateStr = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f4ef', fontFamily: "'Sarabun', 'Helvetica Neue', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e0d4', padding: '18px 20px 14px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <JeBarLogo size={40} />
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2d2d2d', fontFamily: "Georgia, 'Times New Roman', serif" }}>
              ขนมในตู้วันนี้
            </div>
            <div style={{ fontSize: 13, color: '#9a7a3a', marginTop: 3 }}>{dateStr}</div>
          </div>
        </div>
      </div>

      {/* ── How to order ── */}
      <div style={{ background: '#fdf6e3', borderBottom: '1px solid #e8d9a8', padding: '10px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>วิธีจอง</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {['เลือกจำนวนที่ต้องการ', 'กดคัดลอกข้อความสั่งซื้อ', 'วางส่งใน LINE OA หรือ Facebook Inbox', 'รอร้านตรวจสอบและยืนยันรายการ'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#b8932a', minWidth: 14 }}>{i + 1}.</span>
                <span style={{ fontSize: 13, color: '#78350f' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Item list ── */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 0' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🫙</div>
            <div>ขณะนี้ยังไม่มีขนมพร้อมขาย</div>
          </div>
        ) : items.map(item => {
          const stock = stockMap[item.id] || 0;
          const sel = qty[item.id] || 0;
          const isLow = stock <= 3;
          return (
            <div key={item.id} style={{
              background: '#fff',
              borderBottom: '1px solid #ede8df',
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px',
            }}>
              {/* Photo / Icon */}
              <div style={{ width: 76, height: 76, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#f5f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.photo_url
                  ? <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 36 }}>{getIcon(item.name)}</span>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  {item.price && <div style={{ fontSize: 15, fontWeight: 800, color: '#2d2d2d' }}>{item.price}.-</div>}
                  <div style={{ fontSize: 13, color: isLow ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {isLow ? '⚡ ' : ''}เหลือ {stock} ชิ้น
                  </div>
                </div>
              </div>

              {/* Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                <button
                  onClick={() => setItemQty(item.id, sel - 1)}
                  disabled={sel === 0}
                  style={{ width: 34, height: 34, border: '1px solid #d1d5db', borderRadius: '8px 0 0 8px', background: sel === 0 ? '#f9f9f9' : '#fff', fontSize: 18, fontWeight: 700, cursor: sel === 0 ? 'not-allowed' : 'pointer', color: sel === 0 ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <div style={{ width: 36, height: 34, border: '1px solid #d1d5db', borderLeft: 'none', borderRight: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: sel > 0 ? '#16a34a' : '#9ca3af', background: '#fff' }}>
                  {sel}
                </div>
                <button
                  onClick={() => setItemQty(item.id, sel + 1)}
                  disabled={sel >= stock}
                  style={{ width: 34, height: 34, border: '1px solid #d1d5db', borderRadius: '0 8px 8px 0', background: sel >= stock ? '#f9f9f9' : '#fff', fontSize: 18, fontWeight: 700, cursor: sel >= stock ? 'not-allowed' : 'pointer', color: sel >= stock ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Summary + Copy ── */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px', paddingBottom: 40 }}>
        {/* Copy button */}
        <button
          onClick={copyOrder}
          disabled={totalPieces === 0}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: copied ? '#16a34a' : totalPieces > 0 ? '#7ab89a' : '#d1d5db',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: totalPieces === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s', marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 18 }}>📋</span>
          {copied ? 'คัดลอกแล้ว! นำไปวางใน LINE ได้เลย' : 'คัดลอกข้อความสั่งซื้อ'}
        </button>

        {/* Summary box */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e0d4', padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2d2d2d', marginBottom: 10 }}>สรุปการจอง</div>
          {selected.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af' }}>ยังไม่ได้เลือกรายการ</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {selected.map(it => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <div style={{ color: '#374151', flex: 1 }}>{it.name}</div>
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>{qty[it.id]} ชิ้น</span>
                    {it.price && <span style={{ color: '#92400e', fontWeight: 600 }}>฿{it.price * qty[it.id]}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>รวม {totalPieces} ชิ้น</span>
            {totalPrice > 0 && <span style={{ fontSize: 18, fontWeight: 800, color: '#2d2d2d' }}>{totalPrice}.-</span>}
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
          กดคัดลอก แล้วนำข้อความไปวางส่งให้ร้านใน LINE OA หรือ Facebook Inbox ค่ะ
        </div>
      </div>
    </div>
  );
}

const S = {
  center: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Sarabun', sans-serif", background: '#f7f4ef', fontSize: 15,
  },
};
