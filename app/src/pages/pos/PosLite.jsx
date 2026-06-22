import { useCallback, useEffect, useMemo, useState } from 'react';
import { createOrderLocal, getDeviceSession, getProductsLocal, getSyncQueueStats, listSyncEvents, saveDeviceSession, saveProductsLocal } from '../../lib/posLocalStore';
import { syncPendingPosEvents } from '../../lib/posSync';
import { startPosBackgroundSync } from '../../lib/posBackgroundSync';
import { registerPosDevice, renewPosDeviceLicense } from '../../lib/posDevice';
import { buildEscPosReceiptText, getEscPosCommandPlan } from '../../lib/posEscPosCommands';
import { executePrinterTransport, getPrinterTransportCapabilities, runPrinterTransportPreview } from '../../lib/posPrinterTransport';
import { formatPrinterProfile, getPrinterProfile, POS_PRINTER_PROFILES } from '../../lib/posPrinterProfiles';

const SAMPLE_PRODUCTS = [
  { id: 'sample-americano', name: 'Americano', price: 55, category: 'coffee', active: true },
  { id: 'sample-latte', name: 'Latte', price: 65, category: 'coffee', active: true },
  { id: 'sample-thai-tea', name: 'Thai Tea', price: 60, category: 'beverage', active: true },
  { id: 'sample-brownie', name: 'Brownie', price: 75, category: 'bakery', active: true },
];


const TEST_RECEIPT = {
  orderNo: 'TEST-PRINT',
  total: 120,
  paymentMethod: 'test',
  paidAt: new Date().toISOString(),
  items: [
    { name: 'Americano', qty: 1, total: 55 },
    { name: 'Brownie', qty: 1, total: 65 },
  ],
};

const money = (n) => `฿${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + (Number(item.price || 0) * item.qty), 0);
}

export default function PosLite() {
  const [tenantId, setTenantId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('POS เครื่องหลัก');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [printerProfileId, setPrinterProfileId] = useState('browser-80mm');
  const [message, setMessage] = useState('พร้อมขายแบบ Offline First');
  const [syncStatus, setSyncStatus] = useState('ยังไม่เริ่ม background sync');
  const [syncStats, setSyncStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0, processing: 0 });
  const [syncEvents, setSyncEvents] = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [escPosPreview, setEscPosPreview] = useState('');
  const [printerTransportStatus, setPrinterTransportStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const printerProfile = useMemo(() => getPrinterProfile(printerProfileId), [printerProfileId]);
  const transportCapabilities = useMemo(() => getPrinterTransportCapabilities(printerProfile.connection), [printerProfile.connection]);
  const syncStatusText = tenantId && deviceId ? syncStatus : 'รอ tenantId/deviceId เพื่อเริ่ม background sync';

  const loadSyncStatus = useCallback(async () => {
    if (!tenantId) {
      setSyncStats({ total: 0, pending: 0, synced: 0, failed: 0, processing: 0 });
      setSyncEvents([]);
      return;
    }
    const [stats, events] = await Promise.all([
      getSyncQueueStats(tenantId),
      listSyncEvents(tenantId, 8),
    ]);
    setSyncStats(stats);
    setSyncEvents(events);
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    if (!tenantId) return undefined;

    getDeviceSession(tenantId).then((session) => {
      if (!active || !session) return;
      setStoreId((current) => current || session.storeId || '');
      setDeviceId((current) => current || session.deviceId || '');
      setPrinterProfileId((current) => session.printerProfileId || session.printerProfile?.id || current);
      setMessage('โหลด device session จากเครื่องแล้ว');
    });

    return () => { active = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !deviceId) {
      return undefined;
    }

    const controller = startPosBackgroundSync({
      tenantId,
      batchSize: 10,
      intervalMs: 60_000,
      runImmediately: false,
      onResult: (result) => {
        setSyncStatus(`sync ${result.trigger}: ${result.reason} / synced ${result.synced || 0}`);
        loadSyncStatus();
      },
      onError: (error) => {
        setSyncStatus(error?.message || 'background sync error');
      },
    });
    return () => controller.stop();
  }, [tenantId, deviceId, loadSyncStatus]);

  const saveCurrentDeviceSession = async () => {
    if (!tenantId || !deviceId) {
      setMessage('ต้องมี tenantId และ deviceId ก่อนบันทึก device session');
      return;
    }
    await saveDeviceSession({
      tenantId,
      storeId: storeId || null,
      deviceId,
      deviceName,
      printerProfileId: printerProfile.id,
      printerProfile,
    });
    setMessage('บันทึก device session ลงเครื่องแล้ว');
  };

  const savePrinterProfileToDevice = async () => {
    if (!tenantId) {
      setMessage('ต้องมี tenantId ก่อนบันทึก printer profile');
      return;
    }
    const session = await getDeviceSession(tenantId);
    await saveDeviceSession({
      ...(session || {}),
      tenantId,
      storeId: storeId || session?.storeId || null,
      deviceId: deviceId || session?.deviceId || '',
      deviceName: deviceName || session?.deviceName || 'POS เครื่องหลัก',
      printerProfileId: printerProfile.id,
      printerProfile,
    });
    setMessage(`บันทึก Printer Profile แล้ว: ${printerProfile.name}`);
  };

  const renewCurrentDeviceLicense = async () => {
    if (!tenantId) {
      setMessage('ต้องมี tenantId ก่อนต่ออายุ license');
      return;
    }
    setBusy(true);
    try {
      const session = await renewPosDeviceLicense({ tenantId, licenseDays: 7 });
      setDeviceId(session.deviceId);
      setMessage(`ต่ออายุ license แล้ว ถึง ${session.licenseExpiresAt || 'ไม่ระบุ'}`);
    } catch (error) {
      setMessage(error?.message || 'ต่ออายุ license ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const registerCurrentDevice = async () => {
    if (!tenantId) {
      setMessage('ต้องมี tenantId ก่อนลงทะเบียนเครื่อง');
      return;
    }
    setBusy(true);
    try {
      const session = await registerPosDevice({
        tenantId,
        storeId: storeId || null,
        deviceName,
        platform: 'web',
        licenseDays: 7,
        printerProfile,
      });
      setDeviceId(session.deviceId);
      setPrinterProfileId(session.printerProfileId || session.printerProfile?.id || printerProfile.id);
      setMessage(`ลงทะเบียนเครื่องแล้ว license ถึง ${session.licenseExpiresAt || 'ไม่ระบุ'}`);
    } catch (error) {
      setMessage(error?.message || 'ลงทะเบียนเครื่องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const loadProducts = useCallback(async () => {
    if (!tenantId) {
      setMessage('กรอก tenantId ก่อนโหลดเมนูจากเครื่อง');
      return;
    }
    const rows = await getProductsLocal(tenantId);
    setProducts(rows);
    setMessage(rows.length ? `โหลดเมนูจากเครื่อง ${rows.length} รายการ` : 'ยังไม่มีเมนูในเครื่อง');
  }, [tenantId]);

  const seedSampleProducts = async () => {
    if (!tenantId) {
      setMessage('กรอก tenantId ก่อนเพิ่มเมนูตัวอย่าง');
      return;
    }
    await saveProductsLocal(tenantId, SAMPLE_PRODUCTS);
    await loadProducts();
  };

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...current, { ...product, qty: 1 }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart((current) => current
      .map((item) => item.id === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item)
      .filter((item) => item.qty > 0));
  };

  const printLastReceipt = async () => {
    if (!lastReceipt) {
      setMessage('ยังไม่มีสลิปให้พิมพ์');
      return;
    }
    const text = buildEscPosReceiptText({ receipt: lastReceipt, profile: printerProfile });
    const result = await executePrinterTransport({ profile: printerProfile, escPosText: text });
    setPrinterTransportStatus(result);
    setMessage(result.ok ? 'ส่งไป browser print dialog แล้ว' : `ยังพิมพ์จริงไม่ได้: ${result.error || result.capabilities.notes}`);
  };

  const buildEscPosPreview = (receipt = lastReceipt, mode = 'receipt') => {
    if (!receipt) {
      setMessage('ยังไม่มีสลิปสำหรับสร้าง ESC/POS preview');
      return;
    }
    const text = buildEscPosReceiptText({ receipt, profile: printerProfile });
    const plan = getEscPosCommandPlan(printerProfile);
    const preview = [
      `Transport: ${plan.transport}`,
      `Init: ${plan.initialize}`,
      `Cut: ${plan.cut}`,
      `Cash drawer: ${plan.openCashDrawer || 'not supported'}`,
      '',
      text,
    ].join('\n');
    setEscPosPreview(preview);
    setPrinterTransportStatus(null);
    setMessage(mode === 'test' ? 'สร้าง Test Print ESC/POS preview แล้ว ยังไม่ได้ส่งไปเครื่องพิมพ์จริง' : 'สร้าง ESC/POS preview แล้ว ยังไม่ได้ส่งไปเครื่องพิมพ์จริง');
  };

  const runTransportPreview = async () => {
    if (!escPosPreview) {
      setMessage('ต้องสร้าง ESC/POS preview ก่อนทดสอบ transport');
      return;
    }
    const result = await runPrinterTransportPreview({ profile: printerProfile, escPosText: escPosPreview });
    setPrinterTransportStatus(result);
    setMessage(result.ok ? `Transport preview: ${result.capabilities.label} (${result.bytesEstimated} bytes)` : `Transport ยังไม่พร้อม: ${result.capabilities.notes}`);
  };

  const buildPrinterTestPreview = () => {
    const receipt = {
      ...TEST_RECEIPT,
      paidAt: new Date().toISOString(),
      printerProfile: {
        id: printerProfile.id,
        name: printerProfile.name,
        paperWidthMm: printerProfile.paperWidthMm,
        connection: printerProfile.connection,
        supportsCashDrawer: printerProfile.supportsCashDrawer,
      },
    };
    setLastReceipt(receipt);
    buildEscPosPreview(receipt, 'test');
  };

  const checkout = async () => {
    if (!tenantId || !deviceId) {
      setMessage('ต้องมี tenantId และ deviceId ก่อนขาย');
      return;
    }
    if (!cart.length) {
      setMessage('ยังไม่มีสินค้าในตะกร้า');
      return;
    }

    setBusy(true);
    try {
      const result = await createOrderLocal({
        tenantId,
        storeId: storeId || null,
        deviceId,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          qty: item.qty,
          unitPrice: item.price,
          total: item.price * item.qty,
          metadata: { category: item.category || '' },
        })),
        payments: [{ method: paymentMethod, amount: total }],
        status: 'paid',
        metadata: { source: 'pos-lite-screen', printerProfileId: printerProfile.id },
      });
      setEscPosPreview('');
      setLastReceipt({
        orderNo: result.order.orderNo,
        total: result.order.total,
        paymentMethod,
        paidAt: result.order.paidAt || result.order.localCreatedAt,
        items: result.order.items,
        printerProfile: {
          id: printerProfile.id,
          name: printerProfile.name,
          paperWidthMm: printerProfile.paperWidthMm,
          connection: printerProfile.connection,
          supportsCashDrawer: printerProfile.supportsCashDrawer,
        },
      });
      setCart([]);
      setMessage(`บันทึกลงเครื่องแล้ว: ${result.order.orderNo} (${money(result.order.total)})`);

      if (navigator.onLine) {
        const syncResult = await syncPendingPosEvents({ tenantId, batchSize: 10 });
        setMessage(`บันทึกลงเครื่องแล้ว และ sync result: ${syncResult.reason} / synced ${syncResult.synced}`);
      }
      await loadSyncStatus();
    } catch (error) {
      setMessage(error?.message || 'บันทึกออเดอร์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>LUCID POS Lite</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>ขายได้ก่อน แม้อินเทอร์เน็ตดับ แล้วค่อย sync ขึ้น Cloud</div>
          </div>
          <div className="badge badge-green">Offline First</div>
        </header>

        <section className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Tenant ID</div>
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="tenant uuid" />
          </label>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Store ID</div>
            <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="store uuid (optional)" />
          </label>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Device Name</div>
            <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="เช่น POS เคาน์เตอร์ 1" />
          </label>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Device ID</div>
            <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="device uuid" />
          </label>
          <div style={{ display: 'grid', alignContent: 'end', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy} onClick={registerCurrentDevice}>ลงทะเบียนเครื่อง</button>
            <button className="btn" disabled={busy} onClick={renewCurrentDeviceLicense}>ต่ออายุ License</button>
            <button className="btn" disabled={busy} onClick={saveCurrentDeviceSession}>บันทึกเครื่องนี้</button>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{syncStatusText}</div>
          </div>
        </section>

        <section className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Printer Profile</div>
            <select value={printerProfileId} onChange={(e) => setPrinterProfileId(e.target.value)}>
              {POS_PRINTER_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ fontWeight: 800, color: 'var(--ink)' }}>{formatPrinterProfile(printerProfile)}</div>
            <div>{printerProfile.notes}</div>
            <div>Transport: {transportCapabilities.label} — {transportCapabilities.notes}</div>
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <button className="btn" style={{ padding: '7px 10px', fontSize: 13 }} onClick={savePrinterProfileToDevice}>บันทึก Profile เครื่องนี้</button>
            <button className="btn" style={{ padding: '7px 10px', fontSize: 13 }} onClick={buildPrinterTestPreview}>Test Print Preview</button>
            <button className="btn" style={{ padding: '7px 10px', fontSize: 13 }} onClick={runTransportPreview}>Transport Check</button>
            <span className="badge">กระดาษ {printerProfile.paperWidthMm}mm</span>
            <span className={printerProfile.supportsCashDrawer ? 'badge badge-green' : 'badge'}>
              {printerProfile.supportsCashDrawer ? 'รองรับ Cash Drawer' : 'ไม่เปิดลิ้นชัก'}
            </span>
          </div>
        </section>

        <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
          <section className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>เมนูในเครื่อง</div>
                <div style={{ color: 'var(--muted)' }}>ใช้ IndexedDB local catalog</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={loadProducts}>โหลดเมนู</button>
                <button className="btn btn-primary" onClick={seedSampleProducts}>เพิ่มเมนูตัวอย่าง</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {products.map((product) => (
                <button
                  key={product.id}
                  className="card"
                  onClick={() => addToCart(product)}
                  style={{ padding: 14, textAlign: 'left', cursor: 'pointer', background: '#fff' }}
                >
                  <div style={{ fontWeight: 800 }}>{product.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{product.category || 'menu'}</div>
                  <div style={{ marginTop: 10, color: 'var(--accent)', fontWeight: 800 }}>{money(product.price)}</div>
                </button>
              ))}
              {!products.length && (
                <div style={{ color: 'var(--muted)', padding: 16 }}>ยังไม่มีเมนู — เพิ่มเมนูตัวอย่างหรือ sync catalog ลงเครื่องก่อน</div>
              )}
            </div>
          </section>

          <aside className="card" style={{ padding: 16, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>ตะกร้า</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {cart.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ color: 'var(--muted)' }}>{money(item.price)} × {item.qty}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn" style={{ padding: '6px 9px' }} onClick={() => updateQty(item.id, -1)}>-</button>
                    <button className="btn" style={{ padding: '6px 9px' }} onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
              ))}
              {!cart.length && <div style={{ color: 'var(--muted)' }}>ยังไม่มีสินค้าในตะกร้า</div>}
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800 }}>สถานะ Sync</div>
                <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={loadSyncStatus}>รีเฟรช</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 12 }}>
                <div className="badge badge-green">รอ {syncStats.pending || 0}</div>
                <div className="badge badge-green">สำเร็จ {syncStats.synced || 0}</div>
                <div className="badge badge-red">พลาด {syncStats.failed || 0}</div>
                <div className="badge">รวม {syncStats.total || 0}</div>
              </div>
              <div style={{ display: 'grid', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                {syncEvents.map((event) => (
                  <div key={event.localEventId} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{event.status}</span>
                    <span>{event.localEventId?.slice(-8) || '-'}</span>
                  </div>
                ))}
                {!syncEvents.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มี sync queue</div>}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800 }}>สลิปล่าสุด</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => buildEscPosPreview()}>ESC/POS</button>
                  <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={printLastReceipt}>พิมพ์</button>
                </div>
              </div>
              {lastReceipt ? (
                <div style={{ border: '1px dashed var(--line)', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }} id="pos-receipt-preview">
                  <div style={{ textAlign: 'center', fontWeight: 900 }}>LUCID POS</div>
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>#{lastReceipt.orderNo} · {new Date(lastReceipt.paidAt).toLocaleString('th-TH')}</div>
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Printer: {lastReceipt.printerProfile?.name || 'Browser Receipt'}</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {lastReceipt.items.map((item) => (
                      <div key={`${lastReceipt.orderNo}-${item.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                        <span>{item.name} × {item.qty}</span>
                        <span>{money(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                    <span>รวม</span>
                    <span>{money(lastReceipt.total)}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>ชำระด้วย: {lastReceipt.paymentMethod}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีออเดอร์ล่าสุด</div>
              )}
              {escPosPreview && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', background: '#111827', color: '#f9fafb', borderRadius: 10, padding: 10, fontSize: 11, maxHeight: 220, overflow: 'auto' }}>{escPosPreview}</pre>
              )}
              {printerTransportStatus && (
                <div style={{ fontSize: 12, color: printerTransportStatus.ok ? 'var(--ok)' : 'var(--danger)' }}>
                  {printerTransportStatus.capabilities.label}: {printerTransportStatus.capabilities.notes} · {printerTransportStatus.bytesEstimated} bytes
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 900 }}>
                <span>รวม</span>
                <span>{money(total)}</span>
              </div>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอนเงิน</option>
                <option value="qr">QR Payment</option>
              </select>
              <button className="btn btn-primary" disabled={busy || !cart.length} onClick={checkout} style={{ padding: 14 }}>
                {busy ? 'กำลังบันทึก...' : 'ชำระเงิน / บันทึกลงเครื่อง'}
              </button>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{message}</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
