const CACHE_KEY = 'hr_jebar_catalog';
const CACHE_TTL = 30 * 60 * 1000; // 30 min
export const OPS_CONFIG_KEY = 'hr_ops_config'; // set by EmpHome after login

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
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/jebar_app_state?select=db&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const db = rows?.[0]?.db;
    if (!db) return null;

    const norm = (arr, type) =>
      (arr || []).filter(x => x.name).map(x => ({ name: x.name, unit: x.unit || '', type }));

    const data = {
      menus: norm(db.menus, 'เมนู'),
      ingredients: norm(db.ingredients, 'วัตถุดิบ'),
      materials: norm(db.materials || db.ingredients || [], 'วัสดุ'),
    };
    // all = menus + ingredients deduplicated by name
    data.all = [...data.menus, ...data.ingredients.filter(i => !data.menus.find(m => m.name === i.name))];

    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
    return data;
  } catch {
    return null;
  }
}
