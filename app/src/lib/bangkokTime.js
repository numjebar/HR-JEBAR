const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const bangkokTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: BANGKOK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const bangkokMinuteFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function toValidDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateParts(value) {
  const date = toValidDate(value);
  if (!date) return null;
  const parts = bangkokDateFormatter.formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value || '';
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function formatBangkokDateISO(date = new Date()) {
  const parts = dateParts(date);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function bangkokDayUtcRange(date = new Date()) {
  const day = formatBangkokDateISO(date);
  if (!day) return { startIso: '', endIso: '' };
  const start = new Date(`${day}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function formatBangkokTime(value) {
  const date = toValidDate(value);
  if (!date) return '';
  return bangkokTimeFormatter.format(date);
}

export function minutesSinceMidnightBangkok(value = new Date()) {
  const date = toValidDate(value);
  if (!date) return null;
  const parts = bangkokMinuteFormatter.formatToParts(date);
  const get = type => Number(parts.find(p => p.type === type)?.value || 0);
  return get('hour') * 60 + get('minute');
}
