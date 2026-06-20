import { useState, useRef, useEffect } from 'react';

export default function SearchSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'พิมพ์หรือค้นหา...',
  maxVisible = 5,
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setQ(value); }, [value]);

  useEffect(() => {
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const lower = q.trim().toLowerCase();
  const filtered = lower
    ? options.filter(o => (o.name || '').toLowerCase().includes(lower))
    : options;
  const visible = filtered.slice(0, 60);

  const ITEM_H = 46;
  const listH = Math.min(visible.length, maxVisible) * ITEM_H;

  function pick(name) {
    setQ(name);
    onChange(name);
    setOpen(false);
  }

  function handleChevron(e) {
    e.preventDefault();
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
      inputRef.current?.focus();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex' }}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex: 1,
            borderRadius: '12px 0 0 12px',
            borderRight: 'none',
            minWidth: 0,
          }}
        />
        <button
          type="button"
          onMouseDown={handleChevron}
          style={{
            flexShrink: 0,
            padding: '0 12px',
            background: open ? '#e8dfd4' : '#f6f3ee',
            border: '1px solid var(--line)',
            borderLeft: 'none',
            borderRadius: '0 12px 12px 0',
            cursor: 'pointer',
            fontSize: 13,
            color: '#7a5b2b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 36,
            transition: 'background .15s',
          }}
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 1000,
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1.5px solid #e0d4c0',
          borderRadius: 14,
          boxShadow: '0 8px 28px rgba(0,0,0,.14)',
          maxHeight: visible.length > 0 ? `${listH}px` : 'auto',
          overflowY: 'auto',
        }}>
          {visible.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#9a8070', textAlign: 'center' }}>
              ไม่พบรายการ "{q}"
            </div>
          ) : (
            visible.map((o, i) => (
              <button
                key={i}
                onMouseDown={e => { e.preventDefault(); pick(o.name); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  height: `${ITEM_H}px`,
                  background: 'none',
                  border: 'none',
                  borderBottom: i < visible.length - 1 ? '1px solid #f5ede0' : 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#2f241f',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.name}
                </span>
                {(o.unit || o.type) && (
                  <span style={{ fontSize: 11, color: '#9a8070', flexShrink: 0, marginLeft: 8 }}>
                    {o.unit ? `${o.unit} · ` : ''}{o.type}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
