// ─────────────────────────────────────────────────────────────
// HR JEBAR — data store, sample data, payroll engine, persistence
// ─────────────────────────────────────────────────────────────
const STORE_KEY = 'hrjebar_v12';

// ---- date helpers -------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseHM(s) { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function fmtHM(min) { if (min == null) return '—'; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
function nowHM() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const THB = (n) => '฿' + Math.round(n).toLocaleString('en-US');
const THB2 = (n) => '฿' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
function fmtDate(iso) { const d = new Date(iso + 'T00:00'); return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`; }
function fmtDateFull(iso) { const d = new Date(iso + 'T00:00'); return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

// ---- default rules ------------------------------------------------
const DEFAULT_RULES = {
  workStart: '09:00',
  workEnd: '18:00',
  workHours: 8,
  graceMin: 5,
  lateDeductPerMin: 2,      // บาท/นาที (โหมดคิดตามนาที)
  // โหมดหักมาสาย: 'tiered' (ขั้นบันไดตามกฎร้าน) | 'permin' (ตามนาที)
  lateMode: 'tiered',
  lateBigMin: 30,           // สายเกินกี่นาที → หักทันที
  lateMinorMin: 15,         // สายเกินกี่นาที = นับ 1 ครั้งสะสม
  lateMinorCount: 3,        // สะสมครบกี่ครั้ง → หัก
  lateDeductHours: 1,       // หักกี่ชั่วโมง (ของค่าแรงรายชั่วโมง)
  // OT: 'multiplier' = เท่าของค่าแรงรายชม. | 'fixed' = บาท/ชั่วโมงคงที่
  otMode: 'multiplier',
  otMultiplier: 1.5,        // เท่าของค่าแรงรายชั่วโมง
  otRatePerHour: 80,        // บาท/ชั่วโมง (โหมดยอดเงิน)
  // ประกันสังคม: 'percent' = % มีเพดาน | 'fixed' = ยอดเงินคงที่/รอบ
  ssMode: 'percent',
  ssPercent: 5,             // ประกันสังคม %
  ssMax: 750,               // เพดานประกันสังคม/เดือน
  ssAmount: 750,            // ยอดเงินคงที่ (โหมดยอดเงิน)
  // leave policy
  urgentLeaveDeductDays: 2, // ลาด่วนตอนเช้าโดยไม่มีเหตุผล → หักกี่ "แรง" (วันค่าจ้าง)
  // anti-cheat / check-in
  geoEnabled: true,
  geoLat: 13.7466,          // พิกัดร้าน (ตัวอย่าง: สยาม กรุงเทพฯ)
  geoLng: 100.5347,
  geoRadius: 20,            // รัศมีที่อนุญาต (เมตร)
  geoLabel: 'ร้านสาขาสยาม',
  requireSelfie: true,      // ต้องถ่ายเซลฟี่ตอนเช็คอิน
};

// ---- distance between two lat/lng in meters (haversine) ----------
function geoDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---- Open Location Code (Plus Code) + Google Maps / lat,lng parsing ----
const OLC = (function () {
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
    return code; // 10 digits, no separator
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

// approx provincial reference points (for short Plus Codes that include a province name)
const THAI_PROVINCES = `กรุงเทพ 13.75 100.52|สมุทรปราการ 13.6 100.6|นนทบุรี 13.86 100.51|ปทุมธานี 14.02 100.53|อยุธยา 14.35 100.58|อ่างทอง 14.59 100.45|ลพบุรี 14.8 100.65|สิงห์บุรี 14.89 100.4|ชัยนาท 15.19 100.13|สระบุรี 14.53 100.91|ชลบุรี 13.36 100.98|ระยอง 12.68 101.28|จันทบุรี 12.61 102.1|ตราด 12.24 102.51|ฉะเชิงเทรา 13.69 101.07|ปราจีนบุรี 14.05 101.37|นครนายก 14.2 101.21|สระแก้ว 13.82 102.07|นครราชสีมา 14.97 102.1|บุรีรัมย์ 14.99 103.1|สุรินทร์ 14.88 103.49|ศรีสะเกษ 15.12 104.32|อุบลราชธานี 15.24 104.85|ยโสธร 15.79 104.15|ชัยภูมิ 15.81 102.03|อำนาจเจริญ 15.86 104.63|หนองบัวลำภู 17.2 102.44|ขอนแก่น 16.44 102.83|อุดรธานี 17.41 102.79|เลย 17.49 101.72|หนองคาย 17.88 102.74|มหาสารคาม 16.18 103.3|ร้อยเอ็ด 16.05 103.65|กาฬสินธุ์ 16.43 103.51|สกลนคร 17.16 104.15|นครพนม 17.39 104.78|มุกดาหาร 16.54 104.72|บึงกาฬ 18.36 103.65|เชียงใหม่ 18.79 98.98|ลำพูน 18.57 99.0|ลำปาง 18.29 99.49|อุตรดิตถ์ 17.62 100.1|แพร่ 18.14 100.14|น่าน 18.78 100.77|พะเยา 19.17 99.9|เชียงราย 19.91 99.83|แม่ฮ่องสอน 19.3 97.97|นครสวรรค์ 15.7 100.12|อุทัยธานี 15.38 100.02|กำแพงเพชร 16.48 99.52|ตาก 16.87 99.13|สุโขทัย 17.01 99.82|พิษณุโลก 16.82 100.27|พิจิตร 16.44 100.35|เพชรบูรณ์ 16.42 101.16|ราชบุรี 13.54 99.81|กาญจนบุรี 14.02 99.53|สุพรรณบุรี 14.47 100.12|นครปฐม 13.82 100.06|สมุทรสาคร 13.55 100.27|สมุทรสงคราม 13.41 100.0|เพชรบุรี 13.11 99.94|ประจวบคีรีขันธ์ 11.81 99.8|นครศรีธรรมราช 8.43 99.96|กระบี่ 8.09 98.91|พังงา 8.45 98.53|ภูเก็ต 7.88 98.39|สุราษฎร์ธานี 9.14 99.33|ระนอง 9.96 98.64|ชุมพร 10.49 99.18|สงขลา 7.2 100.6|สตูล 6.62 100.07|ตรัง 7.56 99.61|พัทลุง 7.62 100.08|ปัตตานี 6.87 101.25|ยะลา 6.54 101.28|นราธิวาส 6.43 101.82`
  .split('|').map((s) => { const [name, lat, lng] = s.split(' '); return { name, lat: +lat, lng: +lng }; });

// parse a Google Maps URL, "lat, lng", or Plus Code → { lat, lng } (or null)
function parseLocation(input, refLat, refLng) {
  input = (input || '').trim();
  if (!input) return null;
  // plain "lat, lng"
  let m = input.match(/^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // google maps url forms
  m = input.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      input.match(/[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      input.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
      input.match(/[?&]ll=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // plus code
  const pc = input.match(/([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3})/i);
  if (pc) {
    const code = pc[1].toUpperCase();
    const beforePlus = code.indexOf('+');
    if (beforePlus >= 8) return OLC.decode(code);
    // short code → need a reference; look for a province name in the text, else use given ref
    let ref = null;
    for (const p of THAI_PROVINCES) { if (input.indexOf(p.name) >= 0) { ref = p; break; } }
    const rLat = ref ? ref.lat : (refLat != null ? refLat : 13.75);
    const rLng = ref ? ref.lng : (refLng != null ? refLng : 100.52);
    return OLC.recoverNearest(code, rLat, rLng);
  }
  return null;
}

// ---- payroll engine ----------------------------------------------
// emp: employee, recs: that emp's attendance in period, sales/adjusts in period
function hourlyRate(emp) {
  if (emp.payType === 'daily') return emp.rate / 8;
  return emp.rate / (26 * 8); // monthly → assume 26 working days
}
function dayRate(emp) {
  if (emp.payType === 'daily') return emp.rate;
  return emp.rate / 26;
}

function computePay(emp, recs, sales, adjusts, rules) {
  const workStart = parseHM(rules.workStart);
  let daysWorked = 0, lateMinTotal = 0, lateDeduct = 0, otMin = 0, otPay = 0, base = 0, leaveDays = 0, absentDays = 0;
  const hr = hourlyRate(emp);
  const dr = dayRate(emp);
  const lateMins = []; // นาทีที่สายของแต่ละวัน (>0)

  recs.forEach((r) => {
    if (r.status === 'leave') { leaveDays++; if (r.paid) base += dr; return; }
    if (r.status === 'absent') { absentDays++; return; }
    // present or late
    daysWorked++;
    base += dr;
    const ci = parseHM(r.clockIn);
    if (ci != null) {
      const lm = ci - workStart - rules.graceMin;
      if (lm > 0) { lateMinTotal += lm; lateMins.push(lm); }
    }
    if (r.otMin) { otMin += r.otMin; otPay += (r.otMin / 60) * (rules.otMode === 'fixed' ? (rules.otRatePerHour || 0) : hr * rules.otMultiplier); }
  });

  // ---- late deduction ----
  let lateBigDays = 0, lateMidDays = 0, lateMidUnits = 0;
  if (rules.lateMode === 'permin') {
    lateDeduct = lateMinTotal * rules.lateDeductPerMin;
  } else {
    // tiered: >lateBigMin → หักทันที ; 15–30 นาที สะสมครบ lateMinorCount → หัก
    lateMins.forEach((lm) => {
      if (lm > rules.lateBigMin) lateBigDays++;
      else if (lm > rules.lateMinorMin) lateMidDays++;
    });
    lateMidUnits = Math.floor(lateMidDays / rules.lateMinorCount);
    lateDeduct = (lateBigDays + lateMidUnits) * rules.lateDeductHours * hr;
  }

  // commission
  let commission = 0;
  const commPct = emp.commission?.type === 'percent' ? emp.commission.value : 0;
  const commPerUnit = emp.commission?.type === 'unit' ? emp.commission.value : 0;
  sales.forEach((s) => {
    if (commPct) commission += s.amount * commPct / 100;
    else if (commPerUnit) commission += (s.units || 0) * commPerUnit;
    else commission += s.commission || 0;
  });

  // adjustments
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
    daysWorked, leaveDays, absentDays, lateMinTotal, lateDeduct,
    lateBigDays, lateMidDays, lateMidUnits,
    otMin, otPay, base, commission, bonus, damage, advance, otherDeduct,
    ss, gross, deductTotal, net,
  };
}

function lateMinutesOf(rec, rules) {
  if (!rec || !rec.clockIn) return 0;
  const lm = parseHM(rec.clockIn) - parseHM(rules.workStart) - rules.graceMin;
  return lm > 0 ? lm : 0;
}

// ---- seed data ----------------------------------------------------
function seedState() {
  const today = new Date();
  const emps = [
    { id: 'e1', name: 'สมชาย ใจดี', nickname: 'ชาย', position: 'หัวหน้าร้าน', department: 'หน้าร้าน', phone: '081-234-5678', payType: 'monthly', rate: 22000, startDate: '2023-03-01', idNumber: '1-1011-23456-78-9', bankName: 'กสิกรไทย', bankAccount: '012-3-45678-9', commission: { type: 'percent', value: 2 }, photo: null, color: '#0E7C66', pin: '1234' },
    { id: 'e2', name: 'สุดารัตน์ แสงทอง', nickname: 'แอน', position: 'พนักงานขาย', department: 'หน้าร้าน', phone: '089-876-5432', payType: 'daily', rate: 480, startDate: '2024-01-15', idNumber: '1-2022-34567-12-3', bankName: 'ไทยพาณิชย์', bankAccount: '405-6-78901-2', commission: { type: 'percent', value: 3 }, photo: null, color: '#B45309', pin: '1111' },
    { id: 'e3', name: 'ธนพล วงศ์ไทย', nickname: 'พล', position: 'พนักงานคลัง', department: 'คลังสินค้า', phone: '062-345-6789', payType: 'daily', rate: 450, startDate: '2024-06-01', idNumber: '1-3033-45678-23-4', bankName: 'กรุงเทพ', bankAccount: '123-4-56789-0', commission: { type: 'none', value: 0 }, photo: null, color: '#1D4ED8', pin: '2222' },
    { id: 'e4', name: 'กนกวรรณ พูลสุข', nickname: 'นก', position: 'พนักงานขาย', department: 'หน้าร้าน', phone: '094-567-8901', payType: 'daily', rate: 480, startDate: '2025-02-10', idNumber: '1-4044-56789-34-5', bankName: 'กสิกรไทย', bankAccount: '067-8-90123-4', commission: { type: 'percent', value: 3 }, photo: null, color: '#9333EA', pin: '3333' },
    { id: 'e5', name: 'อนุชา ทองคำ', nickname: 'ชา', position: 'พนักงานจัดส่ง', department: 'จัดส่ง', phone: '085-678-9012', payType: 'daily', rate: 500, startDate: '2024-09-20', idNumber: '1-5055-67890-45-6', bankName: 'ออมสิน', bankAccount: '020-1-23456-7', commission: { type: 'unit', value: 15 }, photo: null, color: '#DC2626', pin: '4444' },
  ];
  // emergency contact + notes + branch per employee
  const extra = {
    e1: { emName: 'สมศรี ใจดี', emRel: 'ภรรยา', emPhone: '081-111-2222', notes: 'มีใบขับขี่ ขับรถส่งของได้', branchId: 'b1', closingTasks: ['ปิดเครื่องคิดเงิน + สรุปยอด', 'เช็คเงินสดในลิ้นชัก'], ruleOverrides: { ssMode: 'fixed', ssAmount: 432 } },
    e2: { emName: 'ประเสริฐ แสงทอง', emRel: 'บิดา', emPhone: '089-333-4444', notes: 'แพ้อาหารทะเล', branchId: 'b1', closingTasks: ['ล้างของให้เรียบร้อย', 'กวาด-ถูพื้นร้าน', 'ปิดไฟ-แอร์ก่อนออก'] },
    e3: { emName: 'มาลี วงศ์ไทย', emRel: 'มารดา', emPhone: '062-555-6666', notes: 'ยกของหนักได้ดี', branchId: 'b1', closingTasks: ['จัดเรียงสต็อกเข้าชั้น', 'ล็อกประตูคลัง'] },
    e4: { emName: 'สุชาติ พูลสุข', emRel: 'พี่ชาย', emPhone: '094-777-8888', notes: '', branchId: 'b2', closingTasks: [] },
    e5: { emName: 'จันทร์เพ็ญ ทองคำ', emRel: 'ภรรยา', emPhone: '085-999-0000', notes: 'มีมอเตอร์ไซค์ส่วนตัว', branchId: 'b2', closingTasks: ['ตรวจเช็ครถส่งของ', 'คืนกุญแจรถ'] },
  };
  emps.forEach((e) => { const x = extra[e.id]; e.emName = x.emName; e.emRel = x.emRel; e.emPhone = x.emPhone; e.notes = x.notes; e.branchId = x.branchId; e.closingTasks = x.closingTasks; e.ruleOverrides = x.ruleOverrides || {}; });

  // attendance for last 21 days
  const att = [];
  const seededIns = {
    e1: '08:52', e2: '09:18', e3: '08:58', e4: '09:34', e5: '08:47',
  };
  for (let i = 20; i >= 1; i--) {
    const d = addDays(today, -i);
    if (d.getDay() === 0) continue; // ปิดวันอาทิตย์
    emps.forEach((e) => {
      const seed = (i * 7 + e.id.charCodeAt(1)) % 10;
      let status = 'present', clockIn = null, clockOut = '18:0' + (seed % 6), otMin = 0, leaveType = null;
      if (seed === 0) { status = 'leave'; leaveType = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน'][i % 3]; clockOut = null; }
      else {
        const baseMin = parseHM('09:00') + (seed - 4) * 4; // some early, some late
        clockIn = fmtHM(Math.max(parseHM('08:40'), baseMin));
        if (parseHM(clockIn) > parseHM('09:05')) status = 'late';
        if (seed >= 7) otMin = [60, 90, 120][seed % 3];
        clockOut = otMin ? fmtHM(parseHM('18:00') + otMin) : '18:0' + (seed % 6);
      }
      att.push({ id: `a_${e.id}_${i}`, empId: e.id, date: ymd(d), clockIn, clockOut, status, otMin, leaveType, paid: leaveType !== 'ลากิจ' });
    });
  }
  // today: only some clocked in
  const td = ymd(today);
  att.push({ id: 'a_e1_0', empId: 'e1', date: td, clockIn: seededIns.e1, clockOut: null, status: 'present', otMin: 0, paid: true });
  att.push({ id: 'a_e3_0', empId: 'e3', date: td, clockIn: seededIns.e3, clockOut: null, status: 'present', otMin: 0, paid: true });
  att.push({ id: 'a_e2_0', empId: 'e2', date: td, clockIn: seededIns.e2, clockOut: null, status: 'late', otMin: 0, paid: true });

  // sales / commission entries (this period)
  const sales = [
    { id: 's1', empId: 'e2', date: ymd(addDays(today, -2)), amount: 18500, note: 'ยอดขายหน้าร้าน' },
    { id: 's2', empId: 'e2', date: ymd(addDays(today, -5)), amount: 12400, note: 'ยอดขายหน้าร้าน' },
    { id: 's3', empId: 'e4', date: ymd(addDays(today, -3)), amount: 22100, note: 'ยอดขายหน้าร้าน' },
    { id: 's4', empId: 'e4', date: ymd(addDays(today, -7)), amount: 9800, note: 'ยอดขายหน้าร้าน' },
    { id: 's5', empId: 'e5', date: ymd(addDays(today, -1)), amount: 0, units: 34, note: 'จัดส่ง 34 ออเดอร์' },
    { id: 's6', empId: 'e1', date: ymd(addDays(today, -4)), amount: 45000, note: 'ยอดขายรวมกะ' },
  ];

  // adjustments
  const adjusts = [
    { id: 'd1', empId: 'e3', date: ymd(addDays(today, -6)), type: 'damage', amount: 850, note: 'ทำแก้วแตก 1 ลัง' },
    { id: 'd2', empId: 'e2', date: ymd(addDays(today, -9)), type: 'advance', amount: 2000, note: 'เบิกล่วงหน้า' },
    { id: 'd3', empId: 'e1', date: ymd(addDays(today, -3)), type: 'bonus', amount: 1500, note: 'โบนัสยอดขายดีเด่น' },
    { id: 'd4', empId: 'e5', date: ymd(addDays(today, -8)), type: 'damage', amount: 1200, note: 'ของเสียหายระหว่างส่ง' },
  ];

  // leave requests
  const leaves = [
    { id: 'l1', empId: 'e4', type: 'ลาป่วย', dateFrom: ymd(addDays(today, 2)), dateTo: ymd(addDays(today, 2)), reason: 'มีนัดหมอ', status: 'pending' },
    { id: 'l2', empId: 'e2', type: 'ลาพักร้อน', dateFrom: ymd(addDays(today, 5)), dateTo: ymd(addDays(today, 6)), reason: 'กลับต่างจังหวัด', status: 'pending' },
    { id: 'l3', empId: 'e3', type: 'ลากิจ', dateFrom: ymd(addDays(today, -1)), dateTo: ymd(addDays(today, -1)), reason: 'ธุระครอบครัว', status: 'approved' },
  ];

  // messages / chat (admin ↔ employee)
  const messages = [
    { id: 'm1', empId: 'e2', from: 'admin', kind: 'task', text: 'ช่วยจัดเรียงสินค้าโปรโมชันหน้าร้านใหม่ก่อน 11 โมง', createdAt: ymd(today) + ' 08:30', status: 'unread', due: ymd(today) },
    { id: 'm2', empId: 'e1', from: 'admin', kind: 'message', text: 'ประชุมทีมหน้าร้านบ่ายนี้ 14:00 นะครับ', createdAt: ymd(today) + ' 08:05', status: 'read', readAt: ymd(today) + ' 08:12' },
    { id: 'm2b', empId: 'e1', from: 'emp', kind: 'message', text: 'รับทราบครับ เดี๋ยวเข้าประชุมตรงเวลา', createdAt: ymd(today) + ' 08:14', status: 'read' },
    { id: 'm3', empId: 'e3', from: 'admin', kind: 'task', text: 'เช็คสต็อกคลัง A ให้เสร็จภายในวันนี้', createdAt: ymd(addDays(today, -1)) + ' 16:20', status: 'done', readAt: ymd(addDays(today, -1)) + ' 16:35', due: ymd(today) },
    { id: 'm4', empId: 'e2', from: 'admin', kind: 'message', text: 'งานเมื่อวานเรียบร้อยดีมากครับ ขอบคุณนะ', createdAt: ymd(addDays(today, -1)) + ' 18:40', status: 'read', readAt: ymd(addDays(today, -1)) + ' 19:02' },
    { id: 'm4b', empId: 'e2', from: 'emp', kind: 'message', text: 'ขอบคุณค่ะ 🙏', createdAt: ymd(addDays(today, -1)) + ' 19:05', status: 'read' },
  ];

  const shopRules = [
    'เข้างานตรงเวลา 09:00 น. ผ่อนผันได้ไม่เกิน 5 นาที',
    'มาสายเกิน 15 นาที สะสมครบ 3 ครั้ง หักเงิน 1 ชั่วโมง',
    'มาสายเกิน 30 นาที (ครึ่งชั่วโมง) หักเงิน 1 ชั่วโมงทันที',
    'ลากิจ/ลาป่วย แจ้งล่วงหน้าผ่านแอปก่อนเวลางานอย่างน้อย 1 ชั่วโมง',
    'ทำสินค้า/อุปกรณ์เสียหาย หักตามมูลค่าจริง',
    'แต่งกายสุภาพเรียบร้อยตามระเบียบร้าน',
    'ห้ามใช้โทรศัพท์ส่วนตัวขณะให้บริการลูกค้า',
  ];

  const branches = [
    {
      id: 'b1', label: 'สาขาสยาม', lat: 13.7466, lng: 100.5347, radius: 20,
      rules: { ...DEFAULT_RULES, workStart: '09:00', workEnd: '18:00', lateMode: 'tiered', lateBigMin: 30, lateMinorMin: 15, lateMinorCount: 3, lateDeductHours: 1, otMultiplier: 1.5, ssPercent: 5 },
      shopRules: [
        'เข้างาน 09:00 น. ผ่อนผันได้ไม่เกิน 5 นาที',
        'มาสายเกิน 15 นาที สะสมครบ 3 ครั้ง หักเงิน 1 ชั่วโมง',
        'มาสายเกิน 30 นาที หักเงิน 1 ชั่วโมงทันที',
        'ทำสินค้า/อุปกรณ์เสียหาย หักตามมูลค่าจริง',
        'ทำเช็กลิสต์ปิดร้านให้ครบก่อนลงเวลาออก',
      ],
    },
    {
      id: 'b2', label: 'สาขาลาดพร้าว', lat: 13.8160, lng: 100.5610, radius: 20,
      rules: { ...DEFAULT_RULES, workStart: '10:00', workEnd: '19:00', lateMode: 'permin', lateDeductPerMin: 3, graceMin: 10, otMultiplier: 1.25, ssPercent: 5 },
      shopRules: [
        'เข้างาน 10:00 น. ผ่อนผันได้ไม่เกิน 10 นาที',
        'มาสายหักนาทีละ 3 บาท (หลังเวลาผ่อนผัน)',
        'ค่าล่วงเวลา (OT) คิด 1.25 เท่า',
        'ตรวจเช็ครถ-อุปกรณ์ก่อนคืนกะทุกครั้ง',
      ],
    },
  ];

  return { emps, att, sales, adjusts, leaves, messages, prefs: {}, shopRules, branches, rules: { ...DEFAULT_RULES }, _seededAt: td };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // live (real-use) data is always kept; demo data re-seeds each new day to keep "today" fresh
    if (s.live) return s;
    if (s._seededAt !== ymd(new Date())) return null;
    return s;
  } catch (e) { return null; }
}

// ---- period range helpers ----------------------------------------
function rangeFor(period, anchor) {
  const base = anchor ? new Date(anchor + 'T00:00') : new Date();
  const t = ymd(base);
  if (period === 'day') return { from: t, to: t };
  if (period === 'week') {
    const dow = (base.getDay() + 6) % 7; // Monday=0
    const mon = addDays(base, -dow);
    return { from: ymd(mon), to: ymd(addDays(mon, 6)) };
  }
  // month
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}
function inRange(date, r) { return date >= r.from && date <= r.to; }

// ---- per-branch resolution ---------------------------------------
function branchOf(state, emp) { return (state.branches || []).find((b) => b.id === emp?.branchId) || null; }
// effective rules for an employee = global anti-cheat + branch pay/time rules + per-person overrides
function rulesFor(state, emp) {
  const br = branchOf(state, emp);
  return { ...state.rules, ...(br?.rules || {}), ...(emp?.ruleOverrides || {}) };
}
function shopRulesFor(state, emp) {
  const br = branchOf(state, emp);
  return (br?.shopRules && br.shopRules.length) ? br.shopRules : (state.shopRules || []);
}

// ---- React store context -----------------------------------------
const StoreContext = React.createContext(null);
function useStore() { return React.useContext(StoreContext); }

function StoreProvider({ children }) {
  const [state, setState] = React.useState(() => loadState() || seedState());
  React.useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);

  const uid = () => Math.random().toString(36).slice(2, 9);
  const td = ymd(new Date());

  const actions = React.useMemo(() => ({
    reset() { localStorage.removeItem(STORE_KEY); setState(seedState()); },
    startFresh() {
      const blank = {
        emps: [], att: [], sales: [], adjusts: [], leaves: [], messages: [], prefs: {},
        shopRules: ['เข้างานตรงเวลา ผ่อนผันได้ไม่เกิน 5 นาที'],
        branches: [{ id: 'b_main', label: 'สาขาหลัก', lat: 13.7466, lng: 100.5347, radius: 20, rules: { ...DEFAULT_RULES }, shopRules: [] }],
        rules: { ...DEFAULT_RULES }, _seededAt: ymd(new Date()), live: true,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(blank));
      setState(blank);
    },
    clockIn(empId, meta = {}) {
      setState((s) => {
        const ex = s.att.find((a) => a.empId === empId && a.date === td);
        const emp = s.emps.find((e) => e.id === empId);
        const er = rulesFor(s, emp);
        const t = nowHM();
        const status = parseHM(t) > parseHM(er.workStart) + er.graceMin ? 'late' : 'present';
        const extra = { clockIn: t, status, checkin: { selfie: meta.selfie || null, dist: meta.dist ?? null, lat: meta.lat ?? null, lng: meta.lng ?? null } };
        if (ex) return { ...s, att: s.att.map((a) => a === ex ? { ...a, ...extra } : a) };
        return { ...s, att: [...s.att, { id: 'a_' + uid(), empId, date: td, clockOut: null, otMin: 0, paid: true, ...extra }] };
      });
    },
    clockOut(empId, meta = {}) {
      setState((s) => {
        const ex = s.att.find((a) => a.empId === empId && a.date === td);
        if (!ex) return s;
        const emp = s.emps.find((e) => e.id === empId);
        const er = rulesFor(s, emp);
        const t = nowHM();
        const otMin = Math.max(0, parseHM(t) - parseHM(er.workEnd));
        return { ...s, att: s.att.map((a) => a === ex ? { ...a, clockOut: t, otMin, closingDone: meta.closingDone || null } : a) };
      });
    },
    requestLeave(empId, type, dateFrom, dateTo, reason) {
      setState((s) => {
        const emp = s.emps.find((e) => e.id === empId);
        const er = rulesFor(s, emp);
        const today = ymd(new Date());
        const noReason = !reason || !reason.trim() || reason.trim() === '-';
        // ลาด่วนตอนเช้า = แจ้งลาวันนี้ หลังเวลาเข้างาน โดยไม่มีเหตุผล
        const isUrgent = dateFrom === today && parseHM(nowHM()) >= parseHM(er.workStart) && noReason;
        const leave = { id: 'l_' + uid(), empId, type, dateFrom, dateTo, reason, status: 'pending', urgent: isUrgent };
        let adjusts = s.adjusts;
        if (isUrgent && er.urgentLeaveDeductDays > 0) {
          const dr = dayRate(emp);
          adjusts = [{ id: 'd_' + uid(), empId, date: today, type: 'other', amount: Math.round(dr * er.urgentLeaveDeductDays), note: `ลาด่วนเช้าวันงานโดยไม่มีเหตุผล (หัก ${er.urgentLeaveDeductDays} แรง)`, auto: true }, ...s.adjusts];
        }
        return { ...s, leaves: [leave, ...s.leaves], adjusts };
      });
    },
    setLeaveStatus(id, status) {
      setState((s) => ({ ...s, leaves: s.leaves.map((l) => l.id === id ? { ...l, status } : l) }));
    },
    addEmployee(emp) {
      setState((s) => ({ ...s, emps: [...s.emps, { ...emp, id: 'e_' + uid() }] }));
    },
    updateEmployee(id, patch) {
      setState((s) => ({ ...s, emps: s.emps.map((e) => e.id === id ? { ...e, ...patch } : e) }));
    },
    setEmployeeRules(id, overrides) {
      setState((s) => ({ ...s, emps: s.emps.map((e) => e.id === id ? { ...e, ruleOverrides: overrides } : e) }));
    },
    addAdjustment(adj) {
      setState((s) => ({ ...s, adjusts: [{ id: 'd_' + uid(), date: td, ...adj }, ...s.adjusts] }));
    },
    deleteAdjustment(id) {
      setState((s) => ({ ...s, adjusts: s.adjusts.filter((a) => a.id !== id) }));
    },
    deleteSale(id) {
      setState((s) => ({ ...s, sales: s.sales.filter((x) => x.id !== id) }));
    },
    addSale(sale) {
      setState((s) => ({ ...s, sales: [{ id: 's_' + uid(), date: td, ...sale }, ...s.sales] }));
    },
    sendMessage(empId, kind, text, due, from = 'admin') {
      setState((s) => ({ ...s, messages: [{ id: 'm_' + uid(), empId, from, kind, text, due: due || null, createdAt: td + ' ' + nowHM(), status: from === 'admin' ? 'unread' : 'read' }, ...s.messages] }));
    },
    empReply(empId, text) {
      setState((s) => ({ ...s, messages: [{ id: 'm_' + uid(), empId, from: 'emp', kind: 'message', text, due: null, createdAt: td + ' ' + nowHM(), status: 'unread' }, ...s.messages] }));
    },
    markEmpRead(empId) {
      setState((s) => ({ ...s, messages: s.messages.map((m) => (m.empId === empId && m.from === 'emp' && m.status === 'unread') ? { ...m, status: 'read' } : m) }));
    },
    setMessageStatus(id, status) {
      setState((s) => ({ ...s, messages: s.messages.map((m) => m.id === id ? { ...m, status, readAt: (status === 'read' || status === 'done') && !m.readAt ? td + ' ' + nowHM() : m.readAt } : m) }));
    },
    updateRules(patch) {
      setState((s) => ({ ...s, rules: { ...s.rules, ...patch } }));
    },
    setShopRules(arr) {
      setState((s) => ({ ...s, shopRules: arr }));
    },
    addBranch(branch) {
      setState((s) => ({ ...s, branches: [...s.branches, { id: 'b_' + uid(), label: 'สาขาใหม่', lat: 13.7466, lng: 100.5347, radius: 20, ...branch }] }));
    },
    updateBranch(id, patch) {
      setState((s) => ({ ...s, branches: s.branches.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    },
    updateBranchRules(id, patch) {
      setState((s) => ({ ...s, branches: s.branches.map((b) => b.id === id ? { ...b, rules: { ...DEFAULT_RULES, ...(b.rules || {}), ...patch } } : b) }));
    },
    setBranchShopRules(id, arr) {
      setState((s) => ({ ...s, branches: s.branches.map((b) => b.id === id ? { ...b, shopRules: arr } : b) }));
    },
    deleteBranch(id) {
      setState((s) => ({ ...s, branches: s.branches.filter((b) => b.id !== id) }));
    },
    setPref(empId, patch) {
      setState((s) => ({ ...s, prefs: { ...s.prefs, [empId]: { sound: true, vibrate: true, ...(s.prefs[empId] || {}), ...patch } } }));
    },
  }), []);

  return <StoreContext.Provider value={{ state, ...actions }}>{children}</StoreContext.Provider>;
}

Object.assign(window, {
  StoreContext, StoreProvider, useStore,
  ymd, addDays, parseHM, fmtHM, nowHM, THB, THB2, fmtDate, fmtDateFull,
  THAI_MONTHS, THAI_DAYS, computePay, lateMinutesOf, hourlyRate, dayRate, DEFAULT_RULES, geoDistance,
  rangeFor, inRange, rulesFor, shopRulesFor, branchOf, OLC, parseLocation, THAI_PROVINCES,
});
