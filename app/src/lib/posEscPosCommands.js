function repeat(char, count) {
  return char.repeat(Math.max(0, count));
}

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function moneyText(value) {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

function line(text = '', charsPerLine = 42) {
  const clean = safeText(text);
  if (clean.length <= charsPerLine) return clean;
  return `${clean.slice(0, charsPerLine - 1)}…`;
}

function twoColumn(left, right, charsPerLine = 42) {
  const safeRight = safeText(right);
  const rightWidth = Math.min(safeRight.length, charsPerLine);
  const leftWidth = Math.max(0, charsPerLine - rightWidth - 1);
  return `${line(left, leftWidth).padEnd(leftWidth, ' ')} ${safeRight}`.slice(0, charsPerLine);
}

function center(text, charsPerLine = 42) {
  const clean = line(text, charsPerLine);
  const pad = Math.floor((charsPerLine - clean.length) / 2);
  return `${repeat(' ', pad)}${clean}`;
}

export function buildEscPosReceiptText({ receipt, profile, storeName = 'LUCID POS' }) {
  const charsPerLine = Number(profile?.charsPerLine || 42);
  const separator = repeat('-', charsPerLine);
  const paidAt = receipt?.paidAt ? new Date(receipt.paidAt).toLocaleString('th-TH') : '-';
  const rows = [
    center(storeName, charsPerLine),
    center(`#${receipt?.orderNo || '-'}`, charsPerLine),
    center(paidAt, charsPerLine),
    separator,
    ...(receipt?.items || []).map((item) => twoColumn(`${item.name} x ${item.qty}`, moneyText(item.total), charsPerLine)),
    separator,
    twoColumn('TOTAL', moneyText(receipt?.total), charsPerLine),
    twoColumn('PAYMENT', receipt?.paymentMethod || '-', charsPerLine),
    '',
    center('Thank you', charsPerLine),
  ];
  return rows.join('\n');
}

export function getEscPosCommandPlan(profile = {}) {
  return {
    initialize: 'ESC @',
    alignCenter: 'ESC a 1',
    alignLeft: 'ESC a 0',
    boldOn: 'ESC E 1',
    boldOff: 'ESC E 0',
    cut: 'GS V 66 0',
    openCashDrawer: profile.supportsCashDrawer ? profile.cashDrawerCommand || 'ESC p 0 25 250' : null,
    transport: profile.connection || 'browser',
  };
}
