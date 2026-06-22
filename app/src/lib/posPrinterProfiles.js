export const POS_PRINTER_CONNECTIONS = [
  { value: 'browser', label: 'Browser Print' },
  { value: 'bluetooth', label: 'Bluetooth ESC/POS' },
  { value: 'usb', label: 'USB ESC/POS' },
  { value: 'lan', label: 'LAN ESC/POS' },
];

export const POS_PRINTER_PROFILES = [
  {
    id: 'browser-80mm',
    name: 'Browser Receipt 80mm',
    brand: 'Generic',
    connection: 'browser',
    paperWidthMm: 80,
    charsPerLine: 42,
    supportsCashDrawer: false,
    cashDrawerCommand: null,
    notes: 'ใช้ window.print() และ CSS print-only ก่อนต่อ ESC/POS จริง',
  },
  {
    id: 'epson-tm-80mm',
    name: 'Epson TM Series 80mm',
    brand: 'Epson',
    connection: 'lan',
    paperWidthMm: 80,
    charsPerLine: 42,
    supportsCashDrawer: true,
    cashDrawerCommand: 'ESC p 0 25 250',
    notes: 'Profile ตั้งต้นสำหรับ Epson ESC/POS ผ่าน LAN/USB/Bluetooth bridge',
  },
  {
    id: 'xprinter-58mm',
    name: 'XPrinter 58mm',
    brand: 'XPrinter',
    connection: 'usb',
    paperWidthMm: 58,
    charsPerLine: 32,
    supportsCashDrawer: true,
    cashDrawerCommand: 'ESC p 0 25 250',
    notes: 'Profile ตั้งต้นสำหรับร้านเล็ก/ตลาดนัดที่ใช้กระดาษ 58mm',
  },
  {
    id: 'sunmi-built-in-58mm',
    name: 'Sunmi Built-in 58mm',
    brand: 'Sunmi',
    connection: 'bluetooth',
    paperWidthMm: 58,
    charsPerLine: 32,
    supportsCashDrawer: false,
    cashDrawerCommand: null,
    notes: 'Profile ตั้งต้นสำหรับเครื่อง Android POS ที่มี printer ในตัว',
  },
];

export function getPrinterProfile(profileId) {
  return POS_PRINTER_PROFILES.find((profile) => profile.id === profileId) || POS_PRINTER_PROFILES[0];
}

export function formatPrinterProfile(profile) {
  if (!profile) return 'ไม่ระบุเครื่องพิมพ์';
  return `${profile.name} · ${profile.paperWidthMm}mm · ${profile.connection.toUpperCase()}`;
}
