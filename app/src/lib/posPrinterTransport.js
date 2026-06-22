export const POS_PRINTER_TRANSPORT_STATUS = {
  ready: 'ready',
  unsupported: 'unsupported',
  simulated: 'simulated',
};

export function getPrinterTransportCapabilities(connection = 'browser') {
  if (connection === 'browser') {
    return {
      status: POS_PRINTER_TRANSPORT_STATUS.ready,
      label: 'Browser Print',
      canPrint: true,
      canOpenDrawer: false,
      notes: 'ใช้ window.print() ผ่าน browser print dialog',
    };
  }

  if (connection === 'usb') {
    return {
      status: typeof navigator !== 'undefined' && 'usb' in navigator ? POS_PRINTER_TRANSPORT_STATUS.ready : POS_PRINTER_TRANSPORT_STATUS.unsupported,
      label: 'WebUSB ESC/POS',
      canPrint: typeof navigator !== 'undefined' && 'usb' in navigator,
      canOpenDrawer: typeof navigator !== 'undefined' && 'usb' in navigator,
      notes: 'ต้องเลือก USB device และขอ permission ก่อนส่ง bytes จริง',
    };
  }

  if (connection === 'bluetooth') {
    return {
      status: typeof navigator !== 'undefined' && 'bluetooth' in navigator ? POS_PRINTER_TRANSPORT_STATUS.ready : POS_PRINTER_TRANSPORT_STATUS.unsupported,
      label: 'WebBluetooth ESC/POS',
      canPrint: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
      canOpenDrawer: false,
      notes: 'ต้อง pair Bluetooth printer ก่อนส่ง bytes จริง',
    };
  }

  if (connection === 'lan') {
    return {
      status: POS_PRINTER_TRANSPORT_STATUS.simulated,
      label: 'LAN Bridge ESC/POS',
      canPrint: false,
      canOpenDrawer: false,
      notes: 'Browser ส่ง TCP raw socket ตรงไม่ได้ ต้องมี local bridge/server',
    };
  }

  return {
    status: POS_PRINTER_TRANSPORT_STATUS.unsupported,
    label: 'Unknown transport',
    canPrint: false,
    canOpenDrawer: false,
    notes: 'ยังไม่รองรับ transport นี้',
  };
}

export async function runPrinterTransportPreview({ profile, escPosText }) {
  const capabilities = getPrinterTransportCapabilities(profile?.connection || 'browser');
  return {
    ok: capabilities.canPrint || capabilities.status === POS_PRINTER_TRANSPORT_STATUS.simulated,
    profileId: profile?.id || null,
    transport: profile?.connection || 'browser',
    capabilities,
    bytesEstimated: new Blob([escPosText || '']).size,
    simulatedAt: new Date().toISOString(),
  };
}


export async function executePrinterTransport({ profile, escPosText, printWindow = null } = {}) {
  const capabilities = getPrinterTransportCapabilities(profile?.connection || 'browser');
  const targetWindow = printWindow || (typeof window !== 'undefined' ? window : null);

  if ((profile?.connection || 'browser') === 'browser') {
    if (!targetWindow?.print) {
      return {
        ok: false,
        action: 'browser-print',
        capabilities,
        error: 'window.print is not available',
      };
    }
    targetWindow.print();
    return {
      ok: true,
      action: 'browser-print',
      capabilities,
      bytesEstimated: new Blob([escPosText || '']).size,
      printedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    action: 'escpos-transport',
    capabilities,
    bytesEstimated: new Blob([escPosText || '']).size,
    error: capabilities.notes,
  };
}
