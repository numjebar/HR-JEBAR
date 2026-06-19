// ─────────────────────────────────────────────────────────────
// Payroll Engine — ported verbatim from design_handoff/app/store.jsx
// ─────────────────────────────────────────────────────────────

// ---- date helpers ------------------------------------------------
export const pad = (n) => String(n).padStart(2, '0');
export function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function parseYmd(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function parseHM(s) { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; }
export function fmtHM(min) { if (min == null) return '—'; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
export function nowHM() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export const THB = (n) => '฿' + Math.round(n).toLocaleString('en-US');
export const THB2 = (n) => '฿' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });
export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export function fmtDate(iso) { const d = new Date(iso + 'T00:00'); return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`; }
export function fmtDateFull(iso) { const d = new Date(iso + 'T00:00'); return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

// ---- default rules -----------------------------------------------
export const DEFAULT_RULES = {
  workStart: '09:00',
  workEnd: '18:00',
  workHours: 8,
  graceMin: 5,
  lateDeductPerMin: 2,
  lateMode: 'tiered',
  lateBigMin: 30,
  lateMinorMin: 15,
  lateMinorCount: 3,
  lateDeductHours: 1,
  otGraceMin: 30,
  otMode: 'multiplier',
  otMultiplier: 1.5,
  otRatePerHour: 80,
  ssMode: 'percent',
  ssPercent: 5,
  ssMax: 750,
  ssAmount: 750,
  urgentLeaveDeductDays: 2,
  geoEnabled: true,
  requireSelfie: true,
};

// ---- distance (haversine) ----------------------------------------
export function geoDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---- Open Location Code (Plus Code) ------------------------------
export const OLC = (function () {
  const A = '23456789CFGHJMPQRVWX', SEP = '+', SEPPOS = 8, BASE = 20;
  const clipLat = (l) => Math.min(90, Math.max(-90, l));
  const normLng = (l) => { while (l < -180) l += 360; while (l >= 180) l -= 360; return l; };
  function encode(lat, lng) {
    lat = clipLat(lat); lng = normLng(lng);
    if (lat === 90) lat -= 1e-10;
    let latP = lat + 90, lngP = lng + 180, r = BASE, code = '';
    for (let i = 0; i < 5; i++) {
      const ld = Math.floor(latP / r); code += A[ld]; latP -= ld * r;
      const nd = Math.floor(lngP / r); code += A[nd]; lngP -= nd * r;
      r /= BASE;
    }
    return code;
  }
  function decode(code) {
    code = code.replace(SEP, '').toUpperCase().replace(/0+$/, '');
    let lat = -90, lng = -180, r = BASE, size = BASE;
    for (let i = 0; i < code.length && i < 10; i += 2) {
      lat += A.indexOf(code[i]) * r;
      if (i + 1 < code.length) lng += A.indexOf(code[i + 1]) * r;
      size = r; r /= BASE;
    }
    return { lat: lat + size / 2, lng: lng + size / 2 };
  }
  function recoverNearest(short, refLat, refLng) {
    short = short.toUpperCase();
    const plus = short.indexOf(SEP);
    const padding = SEPPOS - plus;
    if (padding <= 0) return decode(short);
    const resolution = Math.pow(BASE, 2 - padding / 2);
    const half = resolution / 2;
    const refCode = encode(clipLat(refLat), normLng(refLng));
    const merged = refCode.substring(0, padding) + short.replace(SEP, '');
    const d = decode(merged.substring(0, SEPPOS) + SEP + merged.substring(SEPPOS));
    let { lat, lng } = d;
    if (refLat + half < lat && lat - resolution > -90) lat -= resolution;
    else if (refLat - half > lat && lat + resolution < 90) lat += resolution;
    if (refLng + half < lng) lng -= resolution;
    else if (refLng - half > lng) lng += resolution;
    return { lat, lng };
  }
  return { encode, decode, recoverNearest };
})();

export const THAI_PROVINCES = `กรุงเทพ 13.75 100.52|สมุทรปราการ 13.6 100.6|นนทบุรี 13.86 100.51|ปทุมธานี 14.02 100.53|อยุธยา 14.35 100.58|อ่างทอง 14.59 100.45|ลพบุรี 14.8 100.65|สิงห์บุรี 14.89 100.4|ชัยนาท 15.19 100.13|สระบุรี 14.53 100.91|ชลบุรี 13.36 100.98|ระยอง 12.68 101.28|จันทบุรี 12.61 102.1|ตราด 12.24 102.51|ฉะเชิงเทรา 13.69 101.07|ปราจีนบุรี 14.05 101.37|นครนายก 14.2 101.21|สระแก้ว 13.82 102.07|นครราชสีมา 14.97 102.1|บุรีรัมย์ 14.99 103.1|สุรินทร์ 14.88 103.49|ศรีสะเกษ 15.12 104.32|อุบลราชธานี 15.24 104.85|ยโสธร 15.79 104.15|ชัยภูมิ 15.81 102.03|อำนาจเจริญ 15.86 104.63|หนองบัวลำภู 17.2 102.44|ขอนแก่น 16.44 102.83|อุดรธานี 17.41 102.79|เลย 17.49 101.72|หนองคาย 17.88 102.74|มหาสารคาม 16.18 103.3|ร้อยเอ็ด 16.05 103.65|กาฬสินธุ์ 16.43 103.51|สกลนคร 17.16 104.15|นครพนม 17.39 104.78|มุกดาหาร 16.54 104.72|บึงกาฬ 18.36 103.65|เชียงใหม่ 18.79 98.98|ลำพูน 18.57 99.0|ลำปาง 18.29 99.49|อุตรดิตถ์ 17.62 100.1|แพร่ 18.14 100.14|น่าน 18.78 100.77|พะเยา 19.17 99.9|เชียงราย 19.91 99.83|แม่ฮ่องสอน 19.3 97.97|นครสวรรค์ 15.7 100.12|อุทัยธานี 15.38 100.02|กำแพงเพชร 16.48 99.52|ตาก 16.87 99.13|สุโขทัย 17.01 99.82|พิษณุโลก 16.82 100.27|พิจิตร 16.44 100.35|เพชรบูรณ์ 16.42 101.16|ราชบุรี 13.54 99.81|กาญจนบุรี 14.02 99.53|สุพรรณบุรี 14.47 100.12|นครปฐม 13.82 100.06|สมุทรสาคร 13.55 100.27|สมุทรสงคราม 13.41 100.0|เพชรบุรี 13.11 99.94|ประจวบคีรีขันธ์ 11.81 99.8|นครศรีธรรมราช 8.43 99.96|กระบี่ 8.09 98.91|พังงา 8.45 98.53|ภูเก็ต 7.88 98.39|สุราษฎร์ธานี 9.14 99.33|ระนอง 9.96 98.64|ชุมพร 10.49 99.18|สงขลา 7.2 100.6|สตูล 6.62 100.07|ตรัง 7.56 99.61|พัทลุง 7.62 100.08|ปัตตานี 6.87 101.25|ยะลา 6.54 101.28|นราธิวาส 6.43 101.82`
  .split('|').map((s) => { const [name, lat, lng] = s.split(' '); return { name, lat: +lat, lng: +lng }; });

export function parseLocation(input, refLat, refLng) {
  input = (input || '').trim();
  if (!input) return null;
  let m = input.match(/^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/);
  if (m) return { lat: +m[1], lng: +m[2] };
  m = input.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      input.match(/[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      input.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
      input.match(/[?&]ll=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  const pc = input.match(/([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3})/i);
  if (pc) {
    const code = pc[1].toUpperCase();
    const beforePlus = code.indexOf('+');
    if (beforePlus >= 8) return OLC.decode(code);
    let ref = null;
    for (const p of THAI_PROVINCES) { if (input.indexOf(p.name) >= 0) { ref = p; break; } }
    const rLat = ref ? ref.lat : (refLat != null ? refLat : 13.75);
    const rLng = ref ? ref.lng : (refLng != null ? refLng : 100.52);
    return OLC.recoverNearest(code, rLat, rLng);
  }
  return null;
}

// ---- payroll engine ----------------------------------------------
export function hourlyRate(emp) {
  return (Number(emp?.rate) || 0) / 8;
}
export function dayRate(emp) {
  return Number(emp?.rate) || 0;
}

export function scheduledDaysInRange(range, dayOff) {
  if (!range?.from || !range?.to) return 0;
  const start = parseYmd(range.from);
  const end = parseYmd(range.to);
  if (!start || !end || end < start) return 0;
  const blockedDays = new Set((dayOff || []).map(Number).filter((n) => Number.isInteger(n)));
  let total = 0;
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    if (!blockedDays.has(cursor.getDay())) total += 1;
  }
  return total;
}

export function countDaysInRange(range) {
  if (!range?.from || !range?.to) return 0;
  const start = parseYmd(range.from);
  const end = parseYmd(range.to);
  if (!start || !end || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

export function offDaysInRange(range, dayOff) {
  if (!range?.from || !range?.to) return 0;
  const start = parseYmd(range.from);
  const end = parseYmd(range.to);
  if (!start || !end || end < start) return 0;
  const blockedDays = new Set((dayOff || []).map(Number).filter((n) => Number.isInteger(n)));
  let total = 0;
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    if (blockedDays.has(cursor.getDay())) total += 1;
  }
  return total;
}

export function scheduledDaysPerWeek(dayOff) {
  const blockedDays = new Set((dayOff || []).map(Number).filter((n) => Number.isInteger(n)));
  if (blockedDays.size === 0) return 6;
  return Math.max(1, 7 - blockedDays.size);
}

export function computePay(emp, recs, sales, adjusts, rules, range) {
  const workStart = parseHM(rules.workStart);
  let daysWorked = 0, lateMinTotal = 0, lateDeduct, otMin = 0, otPay = 0, leaveDays = 0, paidLeaveDays = 0, absentDays = 0;
  const defaultDayRate = dayRate(emp);
  const todayIso = ymd(new Date());
  const progressTo = range?.to && todayIso < range.to ? todayIso : range?.to;
  const elapsedRange = range?.from && progressTo ? { from: range.from, to: progressTo } : null;
  const scheduledDays = emp.pay_type === 'daily'
    ? 1
    : emp.pay_type === 'weekly'
      ? scheduledDaysPerWeek(emp?.day_off)
      : (scheduledDaysInRange(range, emp?.day_off) || 26);
  const cycleDaysTotal = countDaysInRange(range);
  const cycleDaysElapsed = countDaysInRange(elapsedRange);
  const offDaysTotal = offDaysInRange(range, emp?.day_off);
  const offDaysElapsed = offDaysInRange(elapsedRange, emp?.day_off);
  const scheduledDaysElapsed = emp.pay_type === 'daily'
    ? Math.min(1, cycleDaysElapsed || 0)
    : Math.max(0, cycleDaysElapsed - offDaysElapsed);
  const effectiveDayRate = defaultDayRate;
  const effectiveHourRate = effectiveDayRate / Math.max(1, Number(rules.workHours || 8));
  const lateMins = [];

  recs.forEach((r) => {
    if (r.status === 'leave') {
      leaveDays++;
      if (r.paid) paidLeaveDays++;
      return;
    }
    if (r.status === 'absent') { absentDays++; return; }
    daysWorked++;
    const ci = parseHM(r.clock_in);
    if (ci != null) {
      const lm = ci - workStart - rules.graceMin;
      if (lm > 0) { lateMinTotal += lm; lateMins.push(lm); }
    }
    const recOtMin = overtimeMinutesOf(r, rules);
    if (recOtMin) { otMin += recOtMin; otPay += (recOtMin / 60) * (rules.otMode === 'fixed' ? (rules.otRatePerHour || 0) : effectiveHourRate * rules.otMultiplier); }
  });

  const paidUnits = daysWorked + paidLeaveDays;
  const base = effectiveDayRate * paidUnits;

  let lateBigDays = 0, lateMidDays = 0, lateMidUnits = 0;
  if (rules.lateMode === 'permin') {
    lateDeduct = lateMinTotal * rules.lateDeductPerMin;
  } else {
    lateMins.forEach((lm) => {
      if (lm > rules.lateBigMin) lateBigDays++;
      else if (lm > rules.lateMinorMin) lateMidDays++;
    });
    lateMidUnits = Math.floor(lateMidDays / rules.lateMinorCount);
    lateDeduct = (lateBigDays + lateMidUnits) * rules.lateDeductHours * effectiveHourRate;
  }

  let commission = 0;
  const commPct = emp.commission?.type === 'percent' ? emp.commission.value : 0;
  const commPerUnit = emp.commission?.type === 'unit' ? emp.commission.value : 0;
  sales.forEach((s) => {
    if (commPct) commission += s.amount * commPct / 100;
    else if (commPerUnit) commission += (s.units || 0) * commPerUnit;
    else commission += s.commission || 0;
  });

  let bonus = 0, damage = 0, advance = 0, otherDeduct = 0;
  adjusts.forEach((a) => {
    if (a.type === 'bonus') bonus += a.amount;
    else if (a.type === 'damage') damage += a.amount;
    else if (a.type === 'advance') advance += a.amount;
    else otherDeduct += a.amount;
  });

  const gross = base + otPay + commission + bonus;
  const ss = rules.ssMode === 'fixed' ? (rules.ssAmount || 0) : Math.min(gross * rules.ssPercent / 100, rules.ssMax);
  const deductTotal = lateDeduct + damage + advance + otherDeduct + ss;
  const net = gross - deductTotal;

  return {
    daysWorked, leaveDays, paidLeaveDays, absentDays, lateMinTotal, lateDeduct,
    lateBigDays, lateMidDays, lateMidUnits,
    otMin, otPay, base, commission, bonus, damage, advance, otherDeduct,
    configuredRate: emp.rate,
    configuredPayType: emp.pay_type,
    scheduledDaysInCycle: scheduledDays,
    scheduledDaysElapsed,
    cycleDaysTotal,
    cycleDaysElapsed,
    offDaysTotal,
    offDaysElapsed,
    scheduledDaysLabel:
      emp.pay_type === 'daily'
        ? 'คิดตามวันทำงานจริง'
        : emp.pay_type === 'weekly'
          ? `${scheduledDays} วันทำงานต่อสัปดาห์`
          : `${scheduledDays} วันทำงานในรอบเดือน`,
    effectiveDayRate,
    paidUnits,
    ss, gross, deductTotal, net,
  };
}

export function lateMinutesOf(rec, rules) {
  if (!rec || !rec.clock_in) return 0;
  const lm = parseHM(rec.clock_in) - parseHM(rules.workStart) - rules.graceMin;
  return lm > 0 ? lm : 0;
}

export function overtimeMinutesOf(rec, rules) {
  if (!rec || !rec.clock_out) return 0;
  const outMin = parseHM(rec.clock_out);
  const endMin = parseHM(rules.workEnd);
  if (outMin == null || endMin == null) return 0;
  const graceMin = Number(rules.otGraceMin || 0);
  return Math.max(0, outMin - endMin - graceMin);
}

// ---- period helpers ----------------------------------------------
export function rangeFor(period, anchor) {
  const base = anchor ? new Date(anchor + 'T00:00') : new Date();
  const t = ymd(base);
  if (period === 'day') return { from: t, to: t };
  if (period === 'week') {
    const dow = (base.getDay() + 6) % 7;
    const mon = addDays(base, -dow);
    return { from: ymd(mon), to: ymd(addDays(mon, 6)) };
  }
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}
export function inRange(date, r) { return date >= r.from && date <= r.to; }

function monthAnchorDate(year, monthIndex, startDay) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(startDay, lastDay));
}

export function rangeForEmployee(period, emp, anchor) {
  if (period === 'day') return rangeFor('day', anchor);
  const base = anchor ? new Date(anchor + 'T00:00') : new Date();
  const startDate = parseYmd(emp?.start_date);
  if (!startDate) return rangeFor(period, anchor);

  if (period === 'week') {
    const weeklyStartDay = Number.isInteger(Number(emp?.weekly_cycle_start_day))
      ? Number(emp.weekly_cycle_start_day)
      : startDate.getDay();
    const daysSinceCycleStart = (base.getDay() - weeklyStartDay + 7) % 7;
    const cycleStart = addDays(base, -daysSinceCycleStart);
    return { from: ymd(cycleStart), to: ymd(addDays(cycleStart, 6)) };
  }

  const startDay = Number(emp?.monthly_cycle_start_day) || startDate.getDate();
  let cycleStart = monthAnchorDate(base.getFullYear(), base.getMonth(), startDay);
  if (base < cycleStart) {
    cycleStart = monthAnchorDate(base.getFullYear(), base.getMonth() - 1, startDay);
  }
  const nextCycleStart = monthAnchorDate(cycleStart.getFullYear(), cycleStart.getMonth() + 1, startDay);
  return { from: ymd(cycleStart), to: ymd(addDays(nextCycleStart, -1)) };
}

// ---- rules hierarchy ---------------------------------------------
export function rulesFor(globalRules, branch, emp) {
  return { ...DEFAULT_RULES, ...(globalRules || {}), ...(branch?.rules || {}), ...(emp?.rule_overrides || {}) };
}
export function shopRulesFor(globalShopRules, branch) {
  const branchRules = (branch?.shop_rules || []).map((r) => String(r).trim()).filter(Boolean);
  const fallbackRules = (globalShopRules || []).map((r) => String(r).trim()).filter(Boolean);
  return branchRules.length ? branchRules : fallbackRules;
}
