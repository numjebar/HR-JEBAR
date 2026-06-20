const CACHE_KEY = 'hr_jebar_catalog';
const CACHE_TTL = 30 * 60 * 1000; // 30 min
export const OPS_CONFIG_KEY = 'hr_ops_config'; // set by EmpHome after login

// In-memory error tracking — survives within a session without storage overhead
let _lastCatalogError = '';

export function getLastCatalogError() { return _lastCatalogError; }

export function clearCatalogCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

export async function fetchOperateCatalog() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch { /* ignore */ }

  let url = import.meta.env.VITE_OPERATE_SUPABASE_URL;
  let key = import.meta.env.VITE_OPERATE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    try {
      const cfg = JSON.parse(sessionStorage.getItem(OPS_CONFIG_KEY) || '{}');
      url = cfg.url || '';
      key = cfg.key || '';
    } catch { /* ignore */ }
  }
  if (!url || !key) {
    _lastCatalogError = 'no_config';
    return null;
  }

  try {
    const res = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/jebar_app_state?select=db&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) {
      _lastCatalogError = `http_${res.status}`;
      return null;
    }
    const rows = await res.json();
    const db = rows?.[0]?.db;
    if (!db) {
      _lastCatalogError = 'no_data';
      return null;
    }

    // JE-BAR-Operate uses 'inactive' for menus/stockItems, 'ไม่ใช้' for ingredients/packages
    const INACTIVE = new Set(['inactive', 'ไม่ใช้']);
    const isActive = (x) => !INACTIVE.has(x.status);
    const norm = (arr, type) =>
      (arr || []).filter(x => x.name && isActive(x)).map(x => ({ name: x.name, unit: x.unit || '', type }));

    // "ของใช้สิ้นเปลือง" — prefer ingredients with that category, otherwise use stockItems
    const suppliesCategory = new Set(['ของใช้สิ้นเปลือง', 'supplies', 'ของใช้']);
    const suppliesList = (db.ingredients || []).filter(x =>
      x.name && isActive(x) && suppliesCategory.has(x.category)
    ).map(x => ({ name: x.name, unit: x.unit || '', type: 'วัสดุ' }));

    const data = {
      menus: norm(db.menus, 'เมนู'),
      ingredients: norm(db.ingredients, 'วัตถุดิบ'),
      materials: suppliesList.length > 0 ? suppliesList : norm(db.stockItems || [], 'วัสดุ'),
    };
    // all = menus + ingredients deduplicated by name
    data.all = [...data.menus, ...data.ingredients.filter(i => !data.menus.find(m => m.name === i.name))];

    _lastCatalogError = '';
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
    return data;
  } catch {
    _lastCatalogError = 'network';
    return null;
  }
}
