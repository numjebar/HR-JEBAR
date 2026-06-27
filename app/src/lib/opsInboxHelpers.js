import { formatBangkokDateISO } from './bangkokTime.js';

const normalizeKeyPart = (value) => String(value || '').trim().toLowerCase();

export function inventoryAlertKey(item) {
  const p = item?.payload || {};
  const isCake = item?.task_key === 'cake-stock';
  const name = normalizeKeyPart(isCake ? p.cakeName : p.itemName);
  if (!name) return '';
  const branch = isCake ? normalizeKeyPart(p.branchName) : '';
  return [item.task_key, name, branch].join('::');
}

export function opsEntryBangkokDay(item) {
  return formatBangkokDateISO(item?.created_at);
}

export function isOpsEntryOnBangkokDay(item, bangkokDay = formatBangkokDateISO()) {
  return !!bangkokDay && opsEntryBangkokDay(item) === bangkokDay;
}
