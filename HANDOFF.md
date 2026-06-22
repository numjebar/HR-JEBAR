# HR JEBAR Handoff

## Update 2026-06-22 (POS printer transport preview — v105)

### สิ่งที่ทีมbk สร้างต่อจาก v104

**Printer transport adapter foundation**

- เพิ่ม `app/src/lib/posPrinterTransport.js` เพื่อสรุป capability ของ browser print, WebUSB, WebBluetooth และ LAN bridge
- เพิ่ม `runPrinterTransportPreview()` สำหรับตรวจแบบ simulated ว่า profile/transport พร้อมแค่ไหนและ estimate bytes จาก ESC/POS preview
- ปรับ `PosLite` ให้แสดง transport capability ในแผง Printer Profile
- เพิ่มปุ่ม “Transport Check” เพื่อเช็ค transport จาก ESC/POS preview ล่าสุดก่อนต่อ actual adapter จริง
- อัปเดต build badge เป็น `Build 2026.06.22-pos-transport-preview-v105`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ request permission จาก WebUSB/WebBluetooth จริง
- ยังไม่ได้ส่ง raw ESC/POS bytes จริง
- ยังไม่ได้ทำ LAN bridge/server
- ยังไม่ได้เปิด cash drawer จริง

### งานถัดไปที่แนะนำ

1. เพิ่ม actual browser print transport hook สำหรับ profile browser
2. เพิ่ม WebUSB permission/device selection foundation
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม encryption/rotation policy สำหรับ device token

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posPrinterTransport.js` — เพิ่ม transport capability/preview foundation
- `app/src/pages/pos/PosLite.jsx` — เพิ่ม transport capability UI และ Transport Check
- `app/src/lib/version.js` — bump build badge
- `HANDOFF.md` — บันทึกงาน v105 และ next steps

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (POS printer test print preview — v104)

### สิ่งที่ทีมbk สร้างต่อจาก v103

**Printer test print flow แบบ preview**

- เพิ่ม test receipt sample ใน `PosLite` เพื่อใช้ทดสอบ layout เครื่องพิมพ์โดยไม่ต้องสร้างออเดอร์จริง
- เพิ่มปุ่ม “Test Print Preview” ในแผง Printer Profile เพื่อสร้าง ESC/POS preview จาก profile ที่เลือกทันที
- ปรับ `buildEscPosPreview()` ให้รับ receipt override และ mode เพื่อใช้ร่วมกันทั้งสลิปล่าสุดและ test print
- เมื่อกด test print ระบบจะแสดง receipt preview + ESC/POS command/text preview โดยยังไม่ส่ง bytes ไปเครื่องพิมพ์จริง
- อัปเดต build badge เป็น `Build 2026.06.22-pos-test-print-v104`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ส่ง test print ไปเครื่องพิมพ์จริง
- ยังไม่ได้ทำ transport adapter สำหรับ USB/Bluetooth/LAN
- ยังไม่ได้เปิด cash drawer จริง
- ยังไม่ได้บันทึก test print log

### งานถัดไปที่แนะนำ

1. เพิ่ม transport adapter interface สำหรับ browser print / USB / Bluetooth / LAN
2. เพิ่ม actual test print hook แยกตาม transport
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม encryption/rotation policy สำหรับ device token

### ไฟล์ที่เปลี่ยน

- `app/src/pages/pos/PosLite.jsx` — เพิ่ม test print preview flow จาก printer profile ที่เลือก
- `app/src/lib/version.js` — bump build badge
- `HANDOFF.md` — บันทึกงาน v104 และ next steps

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (POS ESC/POS command preview — v103)

### สิ่งที่ทีมbk สร้างต่อจาก v102

**ESC/POS command builder foundation**

- เพิ่ม `app/src/lib/posEscPosCommands.js` สำหรับสร้าง receipt text แบบ fixed-width ตาม `charsPerLine` ของ printer profile
- เพิ่ม command plan ตั้งต้น เช่น init, align, bold, cut และ open cash drawer command placeholder
- ปรับ `PosLite` เพิ่มปุ่ม “ESC/POS” ในสลิปล่าสุด เพื่อสร้าง preview ของ command/text ก่อนส่งไปเครื่องพิมพ์จริง
- preview แสดง transport, init, cut, cash drawer และ receipt text เพื่อใช้ตรวจ layout ก่อนต่อ Bluetooth/USB/LAN จริง
- อัปเดต build badge เป็น `Build 2026.06.22-pos-escpos-preview-v103`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ส่ง bytes ไป printer จริง
- ยังไม่ได้ทำ WebUSB/WebBluetooth/LAN bridge
- ยังไม่ได้เปิด cash drawer จริง
- ยังไม่ได้ทำ printer test print flow แยกจากสลิปล่าสุด

### งานถัดไปที่แนะนำ

1. เพิ่ม printer test print flow จาก profile ที่เลือก
2. เพิ่ม transport adapter interface สำหรับ browser print / USB / Bluetooth / LAN
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม encryption/rotation policy สำหรับ device token

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posEscPosCommands.js` — เพิ่ม ESC/POS receipt text และ command plan foundation
- `app/src/pages/pos/PosLite.jsx` — เพิ่มปุ่ม/preview ESC/POS จากสลิปล่าสุด
- `app/src/lib/version.js` — bump build badge
- `HANDOFF.md` — บันทึกงาน v103 และ next steps

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (POS printer profile persistence — v102)

### สิ่งที่ทีมbk สร้างต่อจาก v101

**Persist printer profile ต่อ device session**

- ปรับ `PosLite` ให้โหลด `printerProfileId` / `printerProfile` จาก local device session เมื่อกรอก tenant แล้วพบ session เดิม
- เพิ่มปุ่ม “บันทึก Profile เครื่องนี้” เพื่อ save printer profile ที่เลือกลง IndexedDB device session
- แนบ `printerProfile` เข้า `registerPosDevice()` เพื่อให้ RPC ได้รับ profile ตั้งแต่ตอนลงทะเบียนเครื่อง
- ปรับ `posDevice.js` ให้เก็บ `printerProfileId` และ `printerProfile` กลับลง local session หลังลงทะเบียนเครื่องสำเร็จ
- อัปเดต build badge เป็น `Build 2026.06.22-pos-printer-session-v102`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ส่งคำสั่ง ESC/POS จริง
- ยังไม่ได้ทำ printer test print / pairing flow
- ยังไม่ได้เปิด cash drawer จริง
- ยังไม่ได้ encrypt `deviceToken` ใน IndexedDB

### งานถัดไปที่แนะนำ

1. เพิ่ม ESC/POS command builder สำหรับ receipt text/cut/open drawer
2. เพิ่ม printer test print flow จาก profile ที่เลือก
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม encryption/rotation policy สำหรับ device token

### ไฟล์ที่เปลี่ยน

- `app/src/pages/pos/PosLite.jsx` — persist/load printer profile ต่อ device session และส่ง profile ตอน register device
- `app/src/lib/posDevice.js` — เก็บ printer profile ลง local session หลัง register
- `app/src/lib/version.js` — bump build badge
- `HANDOFF.md` — บันทึกงาน v102 และ next steps

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (POS printer profile foundation — v101)

### สิ่งที่ทีมbk สร้างต่อจาก v100

**Printer profile foundation สำหรับ POS Lite**

- เพิ่ม `app/src/lib/posPrinterProfiles.js` เพื่อเก็บ profile เครื่องพิมพ์ตั้งต้น เช่น Browser 80mm, Epson 80mm, XPrinter 58mm และ Sunmi 58mm
- เพิ่มข้อมูล connection, paper width, chars per line, cash drawer support และคำอธิบายสำหรับใช้ต่อยอด ESC/POS
- ปรับ `PosLite` ให้เลือก Printer Profile ได้จากหน้า POS และแสดงรายละเอียดกระดาษ/ลิ้นชักเงิน
- บันทึก `printerProfileId` ลง metadata ของ order local และแสดงชื่อ printer profile ใน receipt preview
- อัปเดต build badge เป็น `Build 2026.06.22-pos-printer-profile-v101`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ส่งคำสั่ง ESC/POS จริงไปยัง Bluetooth/USB/LAN
- ยังไม่ได้เปิด cash drawer จริงผ่าน printer command
- ยังไม่ได้ persist printer profile แยกต่อ device session
- ยังไม่ได้เพิ่ม printer test print / device pairing flow

### งานถัดไปที่แนะนำ

1. เพิ่ม printer profile persistence ต่อ device session
2. เพิ่ม ESC/POS command builder สำหรับ receipt text/cut/open drawer
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม encryption/rotation policy สำหรับ device token

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posPrinterProfiles.js` — เพิ่ม printer profile constants/helper
- `app/src/pages/pos/PosLite.jsx` — เพิ่ม UI เลือก printer profile และแนบ profile ใน receipt/order metadata
- `app/src/lib/version.js` — bump build badge
- `HANDOFF.md` — บันทึกงาน v101 และ next steps

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (POS receipt print CSS — v100)

### สิ่งที่ทีมbk สร้างต่อจาก v99

**CSS print-only สำหรับ receipt preview**

- เพิ่ม `@media print` ใน `app/src/index.css` เพื่อพิมพ์เฉพาะ `#pos-receipt-preview`
- ซ่อน element อื่นทั้งหมดระหว่าง print ด้วย `visibility: hidden`
- ตั้ง receipt preview เป็น layout กว้าง `80mm` สำหรับเครื่องพิมพ์ใบเสร็จทั่วไป
- ล้าง border/radius/shadow และใช้พื้นขาวตัวหนังสือดำสำหรับงานพิมพ์

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ต่อ ESC/POS printer / cash drawer จริง
- ยังไม่ได้เพิ่ม printer profile UI
- ยังไม่ได้เพิ่มรายละเอียด error/retry ต่อ sync event
- ยังไม่ได้ encrypt `deviceToken` ใน IndexedDB

### งานถัดไปที่แนะนำ

1. เพิ่ม ESC/POS printer profile foundation
2. เพิ่มรายละเอียด error/retry ต่อ sync event
3. เพิ่ม encryption/rotation policy สำหรับ device token
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/index.css` — เพิ่ม print-only CSS สำหรับ POS receipt preview
- `HANDOFF.md` — บันทึกงาน v100 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS receipt preview foundation — v99)

### สิ่งที่ทีมbk สร้างต่อจาก v98

**Receipt preview/print foundation สำหรับ POS Lite**

- ปรับ `PosLite` ให้เก็บ `lastReceipt` หลัง checkout สำเร็จ
- เพิ่ม panel “สลิปล่าสุด” ในตะกร้า แสดงเลขออเดอร์, เวลา, รายการสินค้า, ยอดรวม และวิธีชำระเงิน
- เพิ่มปุ่ม “พิมพ์” ที่เรียก `window.print()` เป็น foundation ก่อนต่อ ESC/POS จริง
- receipt preview ใช้ข้อมูลจาก order ที่บันทึกลง IndexedDB ผ่าน `createOrderLocal()`

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ทำ CSS print-only สำหรับพิมพ์เฉพาะสลิป
- ยังไม่ได้ต่อ ESC/POS printer / cash drawer จริง
- ยังไม่ได้เพิ่มรายละเอียด error/retry ต่อ sync event
- ยังไม่ได้ encrypt `deviceToken` ใน IndexedDB

### งานถัดไปที่แนะนำ

1. เพิ่ม CSS print-only สำหรับ receipt preview
2. เพิ่มรายละเอียด error/retry ต่อ sync event
3. เพิ่ม ESC/POS printer profile foundation
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/pages/pos/PosLite.jsx` — เพิ่ม receipt preview/print foundation
- `HANDOFF.md` — บันทึกงาน v99 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS renew device license — v98)

### สิ่งที่ทีมbk สร้างต่อจาก v97

**Renew device license สำหรับ POS Lite**

- เพิ่ม `renewPosDeviceLicense({ tenantId, licenseDays })` ใน `app/src/lib/posDevice.js`
- helper อ่าน local device session จาก IndexedDB ผ่าน `getDeviceSession()` เพื่อใช้ `deviceId` + `deviceToken`
- เรียก Supabase RPC `lucid_renew_device_license()` แล้ว save `licenseExpiresAt` / `deviceStatus` กลับลง local session
- ปรับ `PosLite` เพิ่มปุ่ม “ต่ออายุ License” เพื่อ renew license จากหน้า POS
- เมื่อ renew สำเร็จจะแสดงวันหมดอายุ license ล่าสุดและ set `deviceId` จาก session

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ encrypt `deviceToken` ใน IndexedDB
- ยังไม่ได้เพิ่ม detail drawer สำหรับดู error payload ราย sync event
- ยังไม่ได้เพิ่ม receipt preview/print foundation
- ยังไม่ได้พิมพ์สลิป / เปิดลิ้นชัก / ESC/POS

### งานถัดไปที่แนะนำ

1. เพิ่ม receipt preview/print foundation
2. เพิ่มรายละเอียด error/retry ต่อ sync event
3. เพิ่ม encryption/rotation policy สำหรับ device token
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posDevice.js` — เพิ่ม renew device license helper
- `app/src/pages/pos/PosLite.jsx` — เพิ่มปุ่มต่ออายุ License
- `HANDOFF.md` — บันทึกงาน v98 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS sync status panel — v97)

### สิ่งที่ทีมbk สร้างต่อจาก v96

**Sync status panel สำหรับ POS Lite**

- เพิ่ม `listSyncEvents(tenantId, limit)` ใน `posLocalStore.js` เพื่ออ่าน local `sync_queue` ล่าสุดตาม tenant
- เพิ่ม `getSyncQueueStats(tenantId)` เพื่อสรุปจำนวน `pending`, `synced`, `failed`, `processing`, `conflict`, `total`
- ปรับ `PosLite` ให้มี sync status panel ในตะกร้า แสดงจำนวนรอ sync/สำเร็จ/พลาด/รวม
- แสดงรายการ sync events ล่าสุด 8 รายการ พร้อม status และท้าย `localEventId`
- เพิ่มปุ่ม refresh sync status และ refresh หลัง checkout/background sync result

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้เพิ่ม detail drawer สำหรับดู error payload ราย event
- ยังไม่ได้เพิ่มปุ่ม retry เฉพาะ event
- ยังไม่ได้ต่ออายุ license ด้วย `lucid_renew_device_license()` จาก UI
- ยังไม่ได้พิมพ์สลิป / เปิดลิ้นชัก / ESC/POS

### งานถัดไปที่แนะนำ

1. เพิ่ม helper/ปุ่ม renew device license ด้วย `lucid_renew_device_license()`
2. เพิ่ม receipt preview/print foundation
3. เพิ่มรายละเอียด error/retry ต่อ sync event
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posLocalStore.js` — เพิ่ม sync queue list/stats helpers
- `app/src/pages/pos/PosLite.jsx` — เพิ่ม sync status panel
- `HANDOFF.md` — บันทึกงาน v97 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS device registration helper — v96)

### สิ่งที่ทีมbk สร้างต่อจาก v95

**Device registration UI/helper สำหรับ POS Lite**

- เพิ่ม `app/src/lib/posDevice.js` สำหรับเรียก Supabase RPC `lucid_register_device()`
- helper `registerPosDevice()` รับ `tenantId`, `storeId`, `deviceName`, `platform`, `licenseDays`, `printerProfile` แล้ว save device session ลง IndexedDB อัตโนมัติ
- ปรับ `app/src/pages/pos/PosLite.jsx` เพิ่มช่อง `Device Name` และปุ่ม “ลงทะเบียนเครื่อง”
- เมื่อ RPC สำเร็จ จะ set `deviceId`, เก็บ `deviceToken`, `licenseExpiresAt` ลง local `device_session` และแสดงข้อความ license
- ยังมีปุ่ม “บันทึกเครื่องนี้” สำหรับกรณีมี `deviceId` อยู่แล้วและต้องการ save local session เอง

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ encrypt `deviceToken` ใน IndexedDB
- ยังไม่ได้ต่ออายุ license ด้วย `lucid_renew_device_license()` จาก UI
- ยังไม่ได้เพิ่ม sync status panel รายการ pending/synced/failed แบบละเอียด
- ยังไม่ได้พิมพ์สลิป / เปิดลิ้นชัก / ESC/POS

### งานถัดไปที่แนะนำ

1. เพิ่ม sync status panel แสดงจำนวน pending/synced/failed จาก local queue
2. เพิ่ม helper/ปุ่ม renew device license ด้วย `lucid_renew_device_license()`
3. เพิ่ม receipt preview/print foundation
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posDevice.js` — NEW device registration helper
- `app/src/pages/pos/PosLite.jsx` — เพิ่ม device registration UI
- `HANDOFF.md` — บันทึกงาน v96 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS Lite device session + background sync — v95)

### สิ่งที่ทีมbk สร้างต่อจาก v94

**ผูก device session และ background sync เข้ากับ POS Lite**

- ปรับ `app/src/pages/pos/PosLite.jsx` ให้โหลด device session จาก IndexedDB ด้วย `getDeviceSession(tenantId)` เมื่อกรอก tenant
- เพิ่มปุ่ม “บันทึกเครื่องนี้” เพื่อ save `tenantId`, `storeId`, `deviceId` ลง local `device_session` ผ่าน `saveDeviceSession()`
- ผูก `startPosBackgroundSync()` เข้ากับ POS Lite lifecycle เมื่อมี `tenantId` และ `deviceId`
- แสดง sync status บนหน้า POS Lite เช่นพร้อมทำงาน, offline/manual mode, synced count หรือ error
- cleanup background sync ด้วย `controller.stop()` เมื่อ dependency เปลี่ยนหรือออกจากหน้า

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้เรียก `lucid_register_device()` จาก UI เพื่อสร้าง device token จริง
- ยังไม่ได้ encrypt device token/local session
- ยังไม่ได้เพิ่มรายการ pending/synced/failed แบบละเอียด
- ยังไม่ได้พิมพ์สลิป / เปิดลิ้นชัก / ESC/POS

### งานถัดไปที่แนะนำ

1. เพิ่ม device registration UI/helper ที่เรียก `lucid_register_device()` แล้ว save session อัตโนมัติ
2. เพิ่ม sync status panel แสดงจำนวน pending/synced/failed จาก local queue
3. เพิ่ม receipt preview/print foundation
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/pages/pos/PosLite.jsx` — ผูก device session + background sync helper
- `HANDOFF.md` — บันทึกงาน v95 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS Lite selling screen foundation — v94)

### สิ่งที่ทีมbk สร้างต่อจาก v93

**POS Lite selling screen จาก local catalog/cart/order flow**

- เพิ่มหน้า `app/src/pages/pos/PosLite.jsx` เป็น POS Lite screen รุ่นแรก
- เพิ่ม route `/pos` ใน `app/src/App.jsx` เพื่อเปิด POS Lite แยกจาก admin/employee auth flow เดิม
- เพิ่มปุ่ม “เปิด POS Lite Offline” ใน `RolePicker` เพื่อเข้า POS ได้ง่าย
- POS Lite รองรับกรอก `tenantId`, `storeId`, `deviceId`, โหลดเมนูจาก IndexedDB ผ่าน `getProductsLocal()` และเพิ่มเมนูตัวอย่างผ่าน `saveProductsLocal()`
- รองรับ cart, เพิ่ม/ลดจำนวน, เลือก payment method (`cash`, `transfer`, `qr`) และ checkout ด้วย `createOrderLocal()`
- หลัง checkout ถ้า online จะลองเรียก `syncPendingPosEvents()` เพื่อ sync queue ขึ้น cloud ทันที

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ผูก device session จริงจาก `lucid_register_device()`
- ยังไม่ได้เริ่ม `startPosBackgroundSync()` ใน POS screen lifecycle
- ยังไม่ได้ทำ responsive layout เฉพาะ mobile POS อย่างละเอียด
- ยังไม่ได้พิมพ์สลิป / เปิดลิ้นชัก / ESC/POS
- ยังไม่ได้เพิ่ม sync status dashboard หรือรายการ pending queue

### งานถัดไปที่แนะนำ

1. ผูก device session/local license เข้ากับ POS Lite แทนการกรอก ID เอง
2. เรียก `startPosBackgroundSync()` เมื่อ POS Lite mount และ stop เมื่อ unmount
3. เพิ่ม sync status panel แสดง pending/synced/failed
4. เพิ่ม receipt preview/print foundation

### ไฟล์ที่เปลี่ยน

- `app/src/pages/pos/PosLite.jsx` — NEW POS Lite selling screen foundation
- `app/src/App.jsx` — เพิ่ม route `/pos`
- `app/src/pages/RolePicker.jsx` — เพิ่มปุ่มเข้า POS Lite
- `HANDOFF.md` — บันทึกงาน v94 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS background sync helper — v93)

### สิ่งที่ทีมbk สร้างต่อจาก v92

**Background sync loop สำหรับ POS Offline First**

- เพิ่ม `app/src/lib/posBackgroundSync.js` สำหรับเริ่ม/หยุด background sync loop ฝั่ง POS client
- เพิ่ม `startPosBackgroundSync({ tenantId, batchSize, intervalMs, runImmediately, onResult, onError })`
- helper จะเรียก `syncPendingPosEvents()` ตอนเริ่ม, ตาม interval และเมื่อ browser ยิง event `online`
- มี guard กัน sync ซ้อนด้วยสถานะ `syncing` และคืน reason `already_syncing` ถ้ามีงาน sync ค้างอยู่
- มี `stop()` สำหรับ clear interval/remove listener และ `syncNow(trigger)` สำหรับ manual sync
- รองรับ non-browser environment โดยไม่ผูก window listener แต่ยังคืน `syncNow()` ให้เรียก manual ได้

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ติดตั้ง helper นี้เข้ากับ React app lifecycle หรือ POS screen จริง
- ยังไม่ได้สร้าง POS selling screen
- ยังไม่ได้เพิ่ม sync status/toast UI
- ยังไม่ได้ทำ inventory deduction หลัง order sync
- ยังไม่ได้รัน SQL migrations บน production Supabase

### งานถัดไปที่แนะนำ

1. เริ่ม POS Lite selling screen จาก local catalog/cart/order flow
2. ผูก `startPosBackgroundSync()` เข้ากับ POS shell/device session เมื่อมี tenant/device พร้อม
3. เพิ่ม sync status UI สำหรับ pending/synced/failed
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posBackgroundSync.js` — NEW background sync loop helper
- `HANDOFF.md` — บันทึกงาน v93 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS client sync helper — v92)

### สิ่งที่ทีมbk สร้างต่อจาก v91

**Client helper สำหรับ sync local POS queue → Supabase RPC**

- เพิ่ม `app/src/lib/posSync.js` สำหรับเชื่อม `posLocalStore.js` กับ RPC `lucid_sync_pos_events()`
- เพิ่ม `syncPendingPosEvents({ tenantId, batchSize })` ที่อ่าน `listPendingSyncEvents()` แล้วส่ง batch เข้า Supabase RPC
- ถ้า browser offline จะ skip อย่างปลอดภัยและคืน reason `offline` โดยไม่แตะ queue
- ถ้า RPC error จะ mark local events เป็น failed/pending retry ด้วย `markSyncEventFailed()`
- ถ้า RPC คืนผล `synced` จะ mark local event เป็น synced ด้วย `markSyncEventSynced()` และเก็บ `cloud_ref`
- เพิ่ม `createOnlineSyncHandler(options)` สำหรับนำไปผูกกับ event `online` หรือ background sync loop รอบถัดไป

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ติดตั้ง background sync loop ใน UI/app lifecycle
- ยังไม่ได้สร้าง POS selling screen
- ยังไม่ได้เพิ่ม toast/status UI สำหรับ sync result
- ยังไม่ได้ทำ inventory deduction หลัง order sync
- ยังไม่ได้รัน SQL migrations บน production Supabase

### งานถัดไปที่แนะนำ

1. เพิ่ม background sync loop/hook ที่เรียก `syncPendingPosEvents()` เมื่อ `navigator.onLine` กลับมา true
2. เริ่ม POS Lite selling screen จาก local catalog/cart/order flow
3. เพิ่ม sync status UI สำหรับ pending/synced/failed ใน POS
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posSync.js` — NEW client helper สำหรับ sync local POS queue ไป Supabase RPC
- `HANDOFF.md` — บันทึกงาน v92 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (POS sync batch RPC — v91)

### สิ่งที่ทีมbk สร้างต่อจาก v90

**Cloud sync endpoint/RPC สำหรับ local POS queue**

- เพิ่ม `supabase/35_lucid_pos_sync_rpc.sql` สำหรับรับ event batch จาก local IndexedDB `sync_queue`
- เพิ่ม RPC `lucid_sync_pos_events(p_tenant_id, p_events)` เพื่อ sync offline order payload ขึ้น cloud
- RPC ตรวจ tenant access, active store/device ownership และ required ids (`localEventId`, `deviceId`, `order.localOrderId`)
- รองรับ idempotency ด้วย unique order/payment key เดิม `(tenant_id, device_id, local_order_id)` และ `(tenant_id, device_id, local_payment_id)`
- RPC upsert `sync_queue`, upsert `customers`, upsert `orders`, replace `order_items`, upsert `payments`, update `devices.last_seen_at` และบันทึก `business_events`
- RPC คืนผลต่อ event เป็น `local_event_id`, `status`, `cloud_ref`, `error` เพื่อให้ POS client mark local sync event ได้

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้ต่อ `posLocalStore.js` ให้เรียก RPC นี้จริง
- ยังไม่ได้สร้าง client helper `syncPendingPosEvents()`
- ยังไม่ได้สร้าง background sync loop
- ยังไม่ได้สร้าง POS selling screen
- ยังไม่ได้รัน SQL นี้บน production Supabase
- ยังไม่ได้ทำ inventory deduction หลัง order sync

### งานถัดไปที่แนะนำ

1. เพิ่ม client helper `syncPendingPosEvents()` ที่อ่าน `listPendingSyncEvents()` แล้วเรียก `lucid_sync_pos_events()`
2. เพิ่ม background sync loop เมื่อออนไลน์กลับมา
3. เริ่มสร้าง POS Lite selling screen จาก local catalog/cart/order flow
4. เพิ่ม inventory deduction หลัง order sync

### ไฟล์ที่เปลี่ยน

- `supabase/35_lucid_pos_sync_rpc.sql` — NEW cloud sync batch RPC สำหรับ offline POS orders
- `HANDOFF.md` — บันทึกงาน v91 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (Team BK alias — v90)

### สิ่งที่ปรับ

**ตั้งชื่อเรียกรวม agent เป็น `ทีมbk`**

- เพิ่มชื่อเรียกรวม `ทีมbk` ใน `AUTO_AGENT_COMMANDS.md`
- `ทีมbk` = agent ทั้ง 4 ตัว: ลิซ่า, เจนนี่, จีซู, โรเซ่
- เพิ่มตัวอย่างคำสั่งรวมทีม: “ทีมbk ทำต่อจาก HANDOFF.md 1 รอบ โดยให้ลิซ่าเป็นตัวหลัก เจนนี่คุม scope จีซูตรวจ checks และโรเซ่อัปเดต handoff”

### ขอบเขตที่ยังไม่ทำในรอบนี้

- เป็น alias/prompt nickname ในเอกสารเท่านั้น ยังไม่ได้สร้าง background bot จริง

### งานถัดไปที่แนะนำ

1. ใช้ `ทีมbk` เป็นคำสั่งรวมทีม agent
2. ทำงานถัดไป: เพิ่ม Supabase RPC สำหรับรับ batch จาก local `sync_queue`

### ไฟล์ที่เปลี่ยน

- `AUTO_AGENT_COMMANDS.md` — เพิ่ม Team BK alias
- `HANDOFF.md` — บันทึกงาน v90

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (BLACKPINK agent nicknames — v89)

### สิ่งที่ปรับ

**เปลี่ยนชื่อเรียก agent เป็น BLACKPINK theme**

- อัปเดต `AUTO_AGENT_COMMANDS.md` ตามคำขอ owner: ไม่ใช้ชื่อเดิมแล้ว เปลี่ยนเป็น BLACKPINK names
- `ลิซ่า` = Main Autonomous Coding Agent ตัวหลัก ลงมือเขียนโค้ด/แก้ไฟล์/test/commit/PR
- `เจนนี่` = Supervisor Agent ตัวคุม roadmap เลือกงาน และคุม scope ต่อรอบ
- `จีซู` = QA / Reviewer Agent ตัวช่วยตรวจ Definition of Done, checks, edge cases และความครบของ PR
- `โรเซ่` = Product / Handoff Agent ตัวช่วยจัด handoff, roadmap, product vision และ next steps
- เพิ่มตัวอย่างคำสั่ง: “ให้ลิซ่าทำต่อจาก HANDOFF.md 1 รอบ เจนนี่คุม scope จีซูตรวจ checks และโรเซ่อัปเดต handoff/next steps”

### ขอบเขตที่ยังไม่ทำในรอบนี้

- เป็นการเปลี่ยน nickname/prompt ในเอกสารเท่านั้น ยังไม่ได้สร้าง background bot จริง

### งานถัดไปที่แนะนำ

1. ใช้ `ลิซ่า` เป็นชื่อหลักเวลาสั่ง agent ทำงานต่อ
2. ใช้ `เจนนี่`, `จีซู`, `โรเซ่` เป็น role เสริมสำหรับคุม scope, ตรวจงาน และจัด handoff
3. ทำงานถัดไป: เพิ่ม Supabase RPC สำหรับรับ batch จาก local `sync_queue`

### ไฟล์ที่เปลี่ยน

- `AUTO_AGENT_COMMANDS.md` — เปลี่ยน agent nicknames เป็น BLACKPINK theme
- `HANDOFF.md` — บันทึกงาน v89

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (agent nicknames — v88)

### สิ่งที่ปรับ

**ตั้งชื่อเรียก agent ให้จำง่าย**

- เพิ่มชื่อเล่นใน `AUTO_AGENT_COMMANDS.md`
- ชื่อเดิมใน v88 ถูกยกเลิกและ superseded โดย BLACKPINK agent nicknames ใน v89

### ขอบเขตที่ยังไม่ทำในรอบนี้

- เป็นการตั้งชื่อ/prompt nickname ในเอกสารเท่านั้น ยังไม่ได้สร้าง background bot จริง

### งานถัดไปที่แนะนำ

1. ใช้ BLACKPINK agent nicknames จาก v89 แทนชื่อเดิม
2. ทำงานถัดไปจาก v87: เพิ่ม Supabase RPC สำหรับรับ batch จาก local `sync_queue`

### ไฟล์ที่เปลี่ยน

- `AUTO_AGENT_COMMANDS.md` — เพิ่ม agent nicknames
- `HANDOFF.md` — บันทึกงาน v88

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (autonomous agent command guide — v87)

### สิ่งที่สร้างต่อจาก v86

**Autonomous Agent Commands สำหรับลดการกด “ต่อ” ซ้ำ**

- เพิ่ม `AUTO_AGENT_COMMANDS.md` เป็นชุด prompt/คำสั่งสำหรับให้ agent ทำงานต่อจาก `HANDOFF.md` แบบอัตโนมัติเป็นรอบ
- เพิ่มคำสั่งสั้นที่สุดสำหรับ owner ใช้แทนคำว่า “ต่อ” โดยกำหนดให้ agent เลือกงานถัดไป, run checks, update handoff, commit และสร้าง PR
- เพิ่ม `Autonomous Coding Agent Prompt` ที่บังคับ workflow อ่าน handoff → เลือก scope เล็ก → แก้ไฟล์ → test/check → update handoff → commit → PR
- เพิ่ม `Supervisor Agent Prompt` สำหรับ agent ตัวคุม roadmap ที่สั่ง Coding Agent ทีละ milestone
- เพิ่ม `Current LUCID Auto Roadmap Loop` สำหรับลำดับ POS/SaaS/Pricing ปัจจุบัน
- เพิ่ม Definition of Done และคำสั่งพร้อมใช้สำหรับงานถัดไปหลัง v86

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้สร้าง background service จริงที่ทำงานเองโดยไม่มีข้อความจากผู้ใช้ เพราะระบบ chat/API ต้องมี trigger จาก user หรือ automation ภายนอกก่อน
- ยังไม่ได้ต่อ GitHub Actions / scheduler / bot ภายนอกให้เปิดงานเองอัตโนมัติ
- ยังไม่ได้ทำงาน sync RPC รอบถัดไปใน commit นี้ เพื่อไม่ให้ปนกับงานเอกสาร agent

### งานถัดไปที่แนะนำ

1. ใช้คำสั่งใน `AUTO_AGENT_COMMANDS.md` เพื่อให้ agent ทำงานต่อจาก handoff โดยไม่ต้องพิมพ์ “ต่อ” หลายครั้ง
2. เพิ่ม Supabase RPC สำหรับรับ batch จาก local `sync_queue` และ upsert `orders`, `order_items`, `payments`
3. เพิ่ม client helper `syncPendingPosEvents()` ที่อ่าน queue แล้วเรียก RPC
4. เริ่ม POS Lite selling screen หลัง sync foundation พร้อม

### ไฟล์ที่เปลี่ยน

- `AUTO_AGENT_COMMANDS.md` — NEW prompt/command guide สำหรับ autonomous agent workflow
- `HANDOFF.md` — บันทึกงาน v87 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (offline POS local store foundation — v86)

### สิ่งที่สร้างต่อจาก v85

**IndexedDB foundation สำหรับ POS Offline First**

- เพิ่ม `app/src/lib/posLocalStore.js` เป็น local database layer ฝั่ง browser POS
- สร้าง IndexedDB database `lucid_pos_local` พร้อม object stores: `products`, `orders`, `payments`, `customers`, `sync_queue`, `device_session`
- เพิ่ม helper `openPosLocalDb()` สำหรับ initialize database/indexes
- เพิ่ม `saveDeviceSession()` / `getDeviceSession()` เพื่อเตรียมเก็บ device token/license หลังเรียก `lucid_register_device()`
- เพิ่ม `saveProductsLocal()` / `getProductsLocal()` สำหรับ cache catalog ลงเครื่อง POS ให้ขายได้ตอน offline
- เพิ่ม `createOrderLocal()` เพื่อบันทึก order/payment/customer ลง local ก่อน และสร้าง event เข้า `sync_queue` ทันที
- เพิ่ม `listPendingSyncEvents()`, `markSyncEventSynced()`, `markSyncEventFailed()` สำหรับ lifecycle ของ background sync รอบถัดไป

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้สร้าง POS selling screen ที่เรียก `createOrderLocal()`
- ยังไม่ได้เชื่อม `sync_queue` กับ Supabase RPC จริง
- ยังไม่ได้สร้าง background sync worker/loop เมื่อ `navigator.onLine` กลับมา true
- ยังไม่ได้ encrypt device token ใน local storage/IndexedDB
- ยังไม่ได้ทำ receipt printer / cash drawer integration

### งานถัดไปที่แนะนำ

1. เพิ่ม Supabase RPC สำหรับรับ batch จาก local `sync_queue` และ upsert `orders`, `order_items`, `payments`
2. เพิ่ม client helper `syncPendingPosEvents()` ที่อ่าน queue แล้วเรียก RPC
3. เริ่ม POS Lite selling screen ด้วย local product catalog + cart + cash/transfer/QR payment
4. เพิ่ม device token encryption/rotation policy สำหรับ production hardening

### ไฟล์ที่เปลี่ยน

- `app/src/lib/posLocalStore.js` — NEW IndexedDB local POS foundation
- `HANDOFF.md` — บันทึกงาน v86 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (LUCID onboarding and device RPC — v85)

### สิ่งที่สร้างต่อจาก v84

**Onboarding + Device License RPC foundation**

- เพิ่ม `supabase/34_lucid_onboarding_device_rpc.sql` ต่อจาก POS/SaaS schema foundation
- เพิ่ม RPC `lucid_register_tenant()` สำหรับหลัง OTP/auth สำเร็จ เพื่อสร้าง `orgs`, `admin_roles`, `tenants`, default `stores`, `tenant_users`, `subscriptions`, `credit_wallets` และ `business_events` ใน flow เดียว
- เพิ่ม RPC `lucid_register_device()` สำหรับสร้าง POS device token, เก็บเฉพาะ SHA-256 hash ใน cloud, bind กับ tenant/store และกำหนด license อายุ 1–30 วัน
- เพิ่ม RPC `lucid_renew_device_license()` สำหรับต่ออายุ device license เมื่อเครื่อง POS กลับมา online โดยตรวจ device token hash และไม่ต่ออายุ device ที่ถูก block
- ทุก RPC เป็น `security definer`, ใช้ `auth.uid()` / `lucid_can_access_tenant()` และบันทึก `business_events` เพื่อ audit

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้สร้าง Register/OTP UI ฝั่ง React
- ยังไม่ได้เชื่อม RPC เหล่านี้เข้ากับ auth flow จริง
- ยังไม่ได้ persist device token/license ลง IndexedDB/local storage
- ยังไม่ได้สร้าง POS selling screen
- ยังไม่ได้ทำ background sync engine
- ยังไม่ได้รัน SQL นี้บน production Supabase

### งานถัดไปที่แนะนำ

1. เพิ่ม IndexedDB local POS store ใน `app/src/lib/posLocalStore.js` สำหรับ `products`, `orders`, `payments`, `customers`, `sync_queue`
2. เพิ่ม helper ฝั่ง client สำหรับเรียก `lucid_register_device()` และเก็บ device token ในเครื่อง
3. เพิ่ม sync RPC สำหรับรับ local `sync_queue` จาก POS ขึ้น cloud
4. เริ่มหน้า POS Lite selling screen ที่ขายได้โดยไม่ต้องรอ cloud

### ไฟล์ที่เปลี่ยน

- `supabase/34_lucid_onboarding_device_rpc.sql` — NEW onboarding + device license RPC
- `HANDOFF.md` — บันทึกงาน v85 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (LUCID POS + SaaS foundation — v84)

### สิ่งที่สร้างต่อ

**LUCID POS + SaaS Architecture Handoff v1 → เริ่มลงฐานข้อมูลจริง**

- รับผิดชอบงานใหม่ตาม vision: LUCID เป็น Business Operating System สำหรับร้านค้าขนาดเล็กถึงกลาง ไม่ใช่แค่ HR/Cost calculator
- เพิ่ม schema foundation `supabase/33_lucid_pos_saas_foundation.sql` สำหรับ Multi-Tenant, POS offline sync, subscription, device licensing, catalog/recipe/inventory, orders/payments, AI credits และ audit events
- เพิ่ม tenant model: `tenants`, `stores`, `tenant_users` โดยทุกข้อมูลธุรกิจใหม่ผูก `tenant_id`
- เพิ่ม subscription/billing model: `plans`, `subscriptions`, `invoices`, `billing_payments` พร้อม seed plan POS Lite / Business / AI ตาม handoff
- เพิ่ม offline POS cloud model: `devices`, `orders`, `order_items`, `payments`, `sync_queue` เพื่อรองรับ workflow ขายลงเครื่องก่อน แล้วค่อย sync ขึ้น cloud
- เพิ่ม recipe/inventory foundation: `categories`, `products`, `ingredients`, `recipes`, `recipe_items`, `inventory`, `inventory_transactions`
- เพิ่ม AI credit foundation: `credit_wallets`, `credit_transactions`
- เพิ่ม helper `lucid_can_access_tenant(p_tenant_id)` และ RLS policy pattern สำหรับ tenant member / HR admin mapping

### ขอบเขตที่ยังไม่ทำในรอบนี้

- ยังไม่ได้สร้าง Register/OTP UI
- ยังไม่ได้สร้าง RPC สำหรับ onboarding tenant/device token
- ยังไม่ได้สร้าง IndexedDB ฝั่ง POS
- ยังไม่ได้สร้าง POS selling screen
- ยังไม่ได้ทำ sync engine ฝั่ง client
- ยังไม่ได้รัน SQL นี้บน production Supabase
- ยังไม่ได้ seed ข้อมูลกลาง 150 เมนู / pricing simulation engine ในรอบนี้

### งานถัดไปที่แนะนำ

1. เพิ่ม RPC `lucid_register_tenant()` หลัง OTP เพื่อสร้าง tenant/store/user/subscription/wallet อัตโนมัติ
2. เพิ่ม RPC `lucid_register_device()` และ `lucid_renew_device_license()` สำหรับ offline POS license 7–30 วัน
3. เพิ่ม IndexedDB local POS store ใน `app/src/lib/posLocalStore.js`
4. เพิ่ม sync RPC สำหรับรับ `sync_queue` จากเครื่อง POS ขึ้น cloud
5. เริ่ม Pricing Simulation Engine หลัง foundation POS/SaaS มี schema รองรับ product/cost/channel แล้ว

### ไฟล์ที่เปลี่ยน

- `supabase/33_lucid_pos_saas_foundation.sql` — NEW foundation schema สำหรับ LUCID POS + SaaS
- `HANDOFF.md` — บันทึกงาน v84 และ next steps

### Commit

- (commit hash ใส่หลัง push)


## Update 2026-06-22 (payroll loader stale guard — v83)

### สิ่งที่ปรับหลัง review รอบต่อมา

**AdminPayroll — ทำ loader guard ให้ตรงและไม่ hacky**

- เปลี่ยน logic กัน stale async load จาก `Promise.resolve().then(...)` เป็น sequence guard ด้วย `useRef`
- ถ้า filter/period เปลี่ยนระหว่างกำลังโหลด หรือ component unmount ระหว่าง request เก่า response เก่าจะไม่ set state ทับข้อมูลรอบใหม่
- ยังรักษา targeted ESLint ของไฟล์ `AdminPayroll.jsx` ให้ผ่าน
- ไม่เปลี่ยนสูตร payroll และไม่เปลี่ยนข้อมูลที่บันทึกใน backend

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminPayroll.jsx` — stale-load sequence guard
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.22-payroll-loader-stale-v83`

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (payroll cycle UX review fixes — v82)

### สิ่งที่ปรับหลัง review

**AdminPayroll — เก็บงานจาก v81 ให้สะอาดขึ้น**

- ย้ายข้อความประกอบกล่อง payroll cycle/formula ออกจาก inline ternary ใน JSX ไปเป็น helper functions เพื่ออ่านและดูแลต่อได้ง่ายขึ้น
- เปลี่ยนกล่องไฮไลต์ให้ใช้ theme tokens (`var(--accent-soft)`, `var(--line)`, `var(--ink)`, `var(--muted)`) แทน hard-coded orange colors เพื่อให้เข้ากับธีมแอป
- สูตรค่าแรงใช้ `effectiveDayRate` ในข้อความแสดงผล เพื่อให้ตรงกับค่าที่ payroll engine ใช้จริงในการคำนวณ `base`

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminPayroll.jsx` — helper functions + theme-based payroll cycle panel
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.22-payroll-cycle-ux-v82`

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-22 (payroll cycle UX clarity — v81)

### สิ่งที่ทำต่อจาก handoff

**AdminPayroll — ทำให้รอบจ่ายและสูตรค่าแรงอ่านชัดขึ้น**

- เพิ่มกล่องไฮไลต์สีอ่อนในการ์ดเงินเดือนแต่ละพนักงาน
- แสดง **รอบจ่ายที่ใช้คำนวณ** แบบเด่น: วันที่เริ่ม–สิ้นสุด, ประเภทรอบจ่าย, และจุดเริ่มรอบของคนนั้น
- แสดง **สูตรค่าแรงงวดนี้** แบบอ่านได้ทันที:
  - `ค่าจ้างต่อวัน × จำนวนวันที่คิดจ่าย = ค่าแรงงวดนี้`
- เพิ่มคำอธิบายประกอบ:
  - รายวัน: ทำงานจริงกี่วัน และลาจ่ายกี่วัน (ถ้ามี)
  - รายสัปดาห์/รายเดือน: จำนวนวันในรอบ, วันหยุดประจำ, และวันทำงานตามรอบ
- ไม่เปลี่ยนสูตรคำนวณเงินเดือนเดิม — เป็นการปรับ UX/ข้อความเพื่อให้แอดมินตรวจยอดง่ายขึ้น

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminPayroll.jsx` — payroll card cycle/formula highlight
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.22-payroll-cycle-ux-v81`

### Commit

- (commit hash ใส่หลัง push)

## Update 2026-06-20 (monthly attendance summary — v60)

### สิ่งที่เพิ่มใน v60

**AdminAttendance — แท็บ "สรุปรายเดือน"**

- เพิ่มปุ่มสลับแท็บ **"รายวัน"** / **"สรุปรายเดือน"** ในหน้าการลงเวลา
- แท็บรายวัน = เหมือนเดิมทุกอย่าง (เลือกวัน → เห็นใคร check-in/out)
- แท็บสรุปรายเดือน:
  - **Month picker** เลือกเดือนที่ต้องการ (default: เดือนปัจจุบัน)
  - **Summary tiles**: วันทำงานรวม / ครั้งสาย / วันลา / วันขาด / OT รวม (รวมทุกคน)
  - **ตารางสรุปต่อพนักงาน**: Name | สาขา | ทำงาน | สาย | ลา | ขาด | OT (น.)
  - **Export CSV** ส่งออกข้อมูลเดือนนั้น
- ไม่ต้องรัน SQL ใหม่ — ดึงจากตาราง `attendance` ที่มีอยู่แล้ว

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminAttendance.jsx` — tab switcher + `MonthlyReportView` component
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-attendance-monthly-v60`

### Commit

- `4951338`

---

## Update 2026-06-20 (admin edit attendance per day — v59)

### สิ่งที่เพิ่มใน v59

**AdminPayroll DayBreakdown — แอดมินแก้ไขการลงเวลารายวันได้**

- ต่อยอดจาก v56 (ตารางรายวัน) — เดิมเป็น read-only ตอนนี้แก้ไขได้
- ทุกแถวในตารางรายวันมีปุ่ม **"แก้ไข"** (คอลัมน์ "จัดการ")
- กดแล้วเปิด `DayEditModal` ให้แอดมินตั้งค่าวันนั้น:
  - **สถานะ**: ทำงาน / ลา / ขาด
  - ถ้า "ทำงาน" → กรอกเวลาเข้า / ออก (สาย+OT คำนวณอัตโนมัติ)
  - ถ้า "ลา" → toggle "ลาแบบได้รับค่าจ้าง"
  - ปุ่ม **"ลบรายการวันนี้"** ถ้ามีข้อมูลอยู่แล้ว
- บันทึกผ่าน `attendance` upsert (`onConflict: emp_id,date`) — ใช้ admin RLS เดิม
- หลังบันทึก หน้า payroll reload → ยอดเงินคำนวณใหม่ทันที

### ปิด Open Concern ครบ

จาก AGENT_WORKFLOW.md "Current Open Concern" — payroll per-day:
- ✅ Show each date in the cycle (v56)
- ✅ work / late / leave / absent / off day (v56)
- ✅ advances & deductions per date (v56)
- ✅ **Allow admin to edit a day by date (v59 — ใหม่)**
- ✅ persistent "paid already" marker (v57/v58)

→ Open Concern ปิดครบทุกข้อแล้ว

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminPayroll.jsx` — `DayEditModal` + `dayEditModal` state + คอลัมน์ "จัดการ" + ปุ่มแก้ไข
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-payroll-editday-v59`

### ไม่มี SQL ใหม่

ใช้ตาราง `attendance` + RLS `admin full attendance` ที่มีอยู่แล้ว — ไม่ต้องรัน migration

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (employee sees "paid" status — v58)

### สิ่งที่เพิ่มใน v58

**EmpPay — พนักงานเห็นสถานะ "จ่ายเงินงวดนี้แล้ว"**

- ต่อยอดจาก v57 (แอดมินทำเครื่องหมายจ่ายแล้ว)
- เมื่อแอดมินกด "จ่ายแล้ว" รอบไหน พนักงานเปิดหน้า "รายได้" จะเห็น banner เขียว:
  - ✓ **"จ่ายเงินงวดนี้แล้ว"**
  - บรรทัด "จ่ายเมื่อ [วันที่ไทย] · ยอด [จำนวน]"
- Banner แสดงใต้การ์ดเงินสุทธิ — เห็นชัดทันที
- ถ้ายังไม่จ่าย → ไม่มี banner (เหมือนเดิม)

### กลไก (สำคัญ)

- `payroll_payments` มี RLS เฉพาะแอดมิน — พนักงานอ่านตรงไม่ได้
- จึงขยาย RPC `employee_pay_data` (security definer) ให้คืน field `payment`
  ของรอบที่ตรงกัน (cycle_from = p_from, cycle_to = p_to) เฉพาะของพนักงานคนนั้น
- พนักงานเรียกผ่าน `employee_pay_data_v2` (session token) เหมือนเดิม ไม่ต้องแก้ session layer

### SQL ที่ต้องรัน (1 ครั้ง)

```
supabase/30_payroll_payments.sql
```

> ไฟล์เดียวกับ v57 — มีการ `create or replace` employee_pay_data เพิ่มเข้าไปด้านล่าง
> ถ้ารัน v57 ไปแล้ว ให้รันไฟล์นี้ซ้ำอีกครั้ง (idempotent — ปลอดภัย)

### ไฟล์ที่เปลี่ยน

- `supabase/30_payroll_payments.sql` — เพิ่ม `create or replace employee_pay_data` คืน `payment`
- `app/src/pages/employee/EmpPay.jsx` — `payment` state + paid banner
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-emp-paidstatus-v58`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (payroll "paid already" marker — v57)

### สิ่งที่เพิ่มใน v57

**AdminPayroll — ทำเครื่องหมาย "จ่ายแล้ว" ต่อรอบจ่ายเงิน**

- ปุ่ม **"✓ ทำเครื่องหมายจ่ายแล้ว"** ในการ์ดเงินเดือนแต่ละพนักงาน
- เมื่อกด → บันทึกลงตาราง `payroll_payments` (เก็บ emp_id, รอบ from–to, ยอดสุทธิ, เวลาจ่าย)
- การ์ดที่จ่ายแล้วจะมี:
  - badge เขียว **"✓ จ่ายแล้ว"** ข้างชื่อ
  - ขอบการ์ดเป็นสีเขียว
  - บรรทัด "จ่ายเมื่อ [วันที่] · ยอด [จำนวน]"
- ปุ่มเปลี่ยนเป็น **"↩ ยกเลิกจ่าย"** เพื่อ undo ได้
- การ์ดยอดรวมด้านบนแสดง "จ่ายแล้ว N/M คน"
- สถานะคงอยู่ถาวร (persistent) — ผูกกับรอบจ่ายจริงของพนักงาน ไม่หายเมื่อ refresh

### SQL ที่ต้องรัน (1 ครั้ง)

```
supabase/30_payroll_payments.sql
```

รันใน Supabase SQL Editor — สร้างตาราง `payroll_payments` + RLS (admin เท่านั้น)
+ RPC `payroll_mark_paid()` / `payroll_unmark_paid()`

> หมายเหตุ: ถ้ายังไม่รัน SQL หน้าจะไม่พัง — แค่ยังกดจ่ายไม่ได้ (จะขึ้น alert บอก) และไม่เห็น badge

### ไฟล์ที่เปลี่ยน

- `supabase/30_payroll_payments.sql` — NEW
- `app/src/pages/admin/AdminPayroll.jsx` — load payments + `togglePaid()` + paid badge/border + summary count
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-payroll-paidmarker-v57`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (payroll day breakdown view — v56)

### สิ่งที่เพิ่มใน v56

**AdminPayroll — ปุ่ม "ดูรายวัน" และ DayBreakdown table**

- เพิ่มปุ่ม **"ดูรายวัน"** ในการ์ดเงินเดือนแต่ละพนักงาน
- กดแล้วเปิดตาราง `DayBreakdown` ที่แสดงทุกวันในรอบจ่ายเงิน
- แต่ละแถวในตารางแสดง:
  - **วันที่** — วัน เดือน ปีไทย (พร้อมวันในสัปดาห์)
  - **สถานะ** — ทำงาน / ลา / ขาด / หยุดประจำ
  - **เข้างาน / ออกงาน** — เวลา clock_in / clock_out
  - **สาย** — นาทีที่มาสาย (ถ้ามี)
  - **OT** — นาที OT (ถ้ามี)
  - **ปรับ/หัก** — รายการ adjustments ของวันนั้น (โบนัส/เบิก/หัก)
- วันหยุดประจำ (day_off) แสดงจางลงเพื่อแยกออกจากวันทำงาน
- ปุ่ม "ดูรายวัน" กด toggle ซ่อน/แสดงได้

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminPayroll.jsx` — เพิ่ม `DayBreakdown` component + `dayView` state + `toggleDayView()`
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-payroll-dayview-v56`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (inventory → purchase-list quick-add CTA — v10)

### สิ่งที่เพิ่มใน v10

**EmpOps — Quick-add shortcut after inventory submit**
- หลังส่ง inventory ที่มี status != ปกติ สำเร็จ จะมี banner เหลือง:
  `"⚡ [ชื่อวัตถุดิบ] [status] — เพิ่มในใบสั่งซื้อ?" [+ ใบสั่งซื้อ]`
- กดปุ่ม → navigate ไป `/emp/ops/purchase-list?suggest=ไข่ไก่&unit=ฟอง&urgent=1`
- URL params ถูกอ่านทันทีที่เปิดฟอร์ม purchase-list → pre-fill itemName, unit, priority
- ล้าง URL params ออกหลังอ่าน (ไม่ให้ re-trigger)

**Flow ปิดวงจรสมบูรณ์:**
1. เช็กสต๊อก → "ไข่ไก่ เหลือ 3 ฟอง ใกล้หมด" → บันทึก
2. Banner: "เพิ่มในใบสั่งซื้อ?" → กด "+ ใบสั่งซื้อ"
3. เปิดฟอร์มใบสั่งซื้อ → ไข่ไก่ ถูกเลือกแล้ว priority = พรุ่งนี้
4. ใส่จำนวน → "+ เพิ่มรายการ" → ส่ง
5. แอดมินเห็น + ตอบกลับ + เห็น low-stock alert บน Dashboard

### ไฟล์ที่เปลี่ยน

- `app/src/pages/employee/EmpOps.jsx` — quick-add banner + `useNavigate` in OpsFormCard + URL param reader in PurchaseListForm
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v10`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (purchase-list smart suggestions from inventory — v9)

### สิ่งที่เพิ่มใน v9

**EmpOps PurchaseListForm — แนะนำสินค้าจากสต๊อกล่าสุด**
- เมื่อเปิดฟอร์มใบสั่งซื้อ ระบบโหลด inventory entries ล่าสุด (20 รายการ)
- กรองเฉพาะ `status != ปกติ` แล้ว deduplicate ตามชื่อ (เก็บล่าสุดต่อรายการ)
- แสดง card สีเหลือง "⚡ แนะนำจากสต๊อกล่าสุด" ที่ด้านบนของฟอร์ม (สูงสุด 5 รายการ)
- กด "+ เลือก" → pre-fill itemName, unit, priority (วันนี้ถ้า ต้องสั่งเพิ่ม/มีปัญหา, พรุ่งนี้ถ้า ใกล้หมด)
- ถ้าเพิ่มรายการนั้นลงรายการแล้ว แสดง "✓ เพิ่มแล้ว" แทน

**Flow ที่ปิดวงจรได้สมบูรณ์:**
1. พนักงาน A เช็กสต๊อก → บันทึก "ไข่ไก่ เหลือ 5 ฟอง — ใกล้หมด"
2. พนักงาน B เปิดใบสั่งซื้อ → เห็น "ไข่ไก่ ใกล้หมด" ในแนะนำ → กด "+ เลือก" → ใส่จำนวน → ส่ง
3. แอดมินเห็นใบสั่งซื้อใน AdminOpsInbox → กด "↩ ตอบ" ยืนยัน

### ไฟล์ที่เปลี่ยน

- `app/src/pages/employee/EmpOps.jsx` — `suggestions` state + useEffect + `applySuggestion()` + suggestions UI in PurchaseListForm
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v9`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (low-stock alert on admin dashboard — v8)

### สิ่งที่เพิ่มใน v8

**AdminDashboard — สต๊อกวัตถุดิบต้องติดตาม**
- โหลด inventory entries ล่าสุด (40 รายการ) จาก `employee_ops_entries`
- กรองเฉพาะที่ `status != ปกติ` (คือ ใกล้หมด, ต้องสั่งเพิ่ม, มีปัญหา)
- Deduplicate ตาม `itemName` เก็บแค่รายการล่าสุดของแต่ละชื่อ
- แสดง warning card สีส้มอ่อนใต้ stat tiles ถ้ามีรายการต้องติดตาม
- คลิก "ดูรายการวัตถุดิบทั้งหมด →" ไปที่ AdminOpsInbox filter=inventory

**ข้อมูลที่แสดง:**
- ชื่อวัตถุดิบ, คงเหลือ (stockLeft + unit), ชื่อพนักงานที่รายงาน
- สถานะแดง (ต้องสั่งเพิ่ม / มีปัญหา) หรือเหลือง (ใกล้หมด)
- สูงสุด 6 รายการในหน้า Dashboard

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminDashboard.jsx` — query low-stock inventory + `lowStockItems` state + alert card
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v8`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (admin quick-reply from OPS entry — v7)

### สิ่งที่เพิ่มใน v7

**AdminOpsInbox — "↩ ตอบ" button per entry**
- ทุก OPS entry มีปุ่ม "↩ ตอบ" ที่มุมขวาบน
- คลิกแล้วได้ bottom sheet สำหรับส่งข้อความหรือมอบงานให้พนักงานคนนั้นทันที
- ใช้ตาราง `messages` เดิม (ไม่เพิ่ม schema ใหม่)
- พนักงานรับข้อความใน tab ข้อความ (EmpMessages) เหมือนเดิม
- หลังส่งแล้ว sheet ปิดอัตโนมัติใน 1.2 วินาที

**Flow:**
1. แอดมินเปิด AdminOpsInbox → เห็นรายการที่พนักงานส่งมา
2. กด "↩ ตอบ" → เลือก 💬 ข้อความ หรือ 📋 มอบงาน → พิมพ์ → ส่ง
3. พนักงานรับข้อความใน EmpMessages พร้อม badge แจ้งเตือน

### ไฟล์ที่เปลี่ยน

- `app/src/pages/admin/AdminOpsInbox.jsx` — `replyEntry` state + reply button + `ReplyModal` component
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v7`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (OPS home badges + admin search — v6)

### สิ่งที่เพิ่มใน v6

**Employee OpsHome — today's submission badges**
- โหลดจำนวนรายการที่ส่งวันนี้จาก backend (6 task พร้อมกัน)
- แสดง badge สีเขียว "✓ N" บน task card ที่ส่งแล้ววันนี้
- แสดง badge สีเหลือง "• ร่างค้าง" บน task card ที่มี draft ค้างอยู่ใน localStorage
- พนักงานเห็นได้ทันทีว่าทำงานไหนไปแล้วในวันนี้

**AdminOpsInbox — search bar**
- เพิ่มช่องค้นหาใน filter bar
- ค้นหาได้จาก: ชื่อพนักงาน, ร้านค้า (vendor), เมนู (product), ชื่อวัตถุดิบ, ชื่อเค้ก, หมายเหตุ, รายการในใบสั่งซื้อ
- ค้นหา realtime ไม่ต้องกดปุ่ม

### ไฟล์ที่เปลี่ยน

- `app/src/pages/employee/EmpOps.jsx` — `OpsHome` + `hasDraftData()` ใหม่
- `app/src/pages/admin/AdminOpsInbox.jsx` — `searchText` state + filter + input UI
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v6`

### Commit

- (commit hash ใส่หลัง push)

---

## Update 2026-06-20 (bills image upload to Storage + admin CSV export — v5)

### สิ่งที่เพิ่มใน v5

**Bills form — อัปโหลดรูปบิลไป Supabase Storage**
- `uploadSingleBase64()` จาก `opsStorage.js` ส่ง `imageBase64` ไป bucket `ops-photos`
- ได้ public URL กลับมา เก็บเป็น `payload.billImageUrl`
- แอดมินเห็นรูปบิลเป็น thumbnail และ lightbox เหมือน OPS form อื่น

**AdminOpsInbox — CSV export**
- ปุ่ม 📥 CSV ใน header
- `exportCSV(items, employees, branches)` ส่งออกเป็น UTF-8 CSV พร้อม BOM (Excel อ่านได้)
- คอลัมน์: วันที่บันทึก, ประเภทงาน, พนักงาน, สาขา, รายละเอียด, รูปแนบ

**AdminOpsInbox — `PhotosRow` label prop**
- รูปบิลแสดงหัวข้อ "รูปบิล" แทน "รูปแนบ"

### ไฟล์ที่เปลี่ยน

- `app/src/pages/employee/EmpOps.jsx` — bills upload via `uploadSingleBase64`
- `app/src/pages/admin/AdminOpsInbox.jsx` — CSV export + `PhotosRow` label + bill image display
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v5`

### Commit

- `3025969` feat: bill image upload to Storage + admin CSV export (v5)

---

## Update 2026-06-20 (OPS photo upload to Supabase Storage — v4)

### สิ่งที่เพิ่มใน v4

รูปที่พนักงานถ่ายจาก OPS forms ตอนนี้ **อัปโหลดไปยัง Supabase Storage จริง** และแอดมินดูได้ทันที

**Flow:**
1. พนักงานถ่ายรูปใน OPS form → รูปเก็บใน session state (blob URL + base64)
2. กด "บันทึกเข้า backend" → `uploadOpsPhotos()` อัปโหลดรูปไป bucket `ops-photos`
3. ได้ public URL กลับมา → เก็บใน payload เป็น `photoUrls: [...]`
4. แอดมินเปิด AdminOpsInbox → เห็น thumbnail รูปจริง คลิกดูเต็มได้

**Bucket path:** `ops-photos/{orgId}/{taskKey}/{timestamp}_{rand}.{ext}`

### ไฟล์ที่เปลี่ยน

- `app/src/lib/opsStorage.js` — NEW: `uploadOpsPhotos(photos, orgId, taskKey)` → public URLs
- `app/src/pages/employee/EmpOps.jsx` — upload ก่อน RPC, แสดง progress msg
- `app/src/pages/admin/AdminOpsInbox.jsx` — `PhotosRow` component + lightbox
- `supabase/28_ops_photos_bucket.sql` — **ต้องรัน 1 ครั้งใน Supabase SQL Editor**
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v4`

### SQL ที่ต้องรัน (1 ครั้ง)

```
supabase/28_ops_photos_bucket.sql
```

รันใน Supabase SQL Editor ของ project `eoinzxqpqbybwcrmsgww`
สร้าง bucket `ops-photos` + RLS policy ให้อัปโหลด/อ่านได้

### Commit

- `7f78a9c` feat: upload OPS photos to Supabase Storage + admin lightbox viewer (v4)

---

## Update 2026-06-20 (OPS photo + voice ครบทั้ง 6 ฟอร์ม — v3)

### สิ่งที่เพิ่มใน v3

| ฟอร์ม | SearchSelect | VoiceBtn | PhotoSection |
|---|---|---|---|
| ถ่ายบิล (bills) | — | ✅ vendor, note | ✅ (BillImageSection เดิม) |
| ผลิตขนม (production) | ✅ เมนู | ✅ quantity, batch, note | ✅ รูปการผลิต |
| วัตถุดิบ (inventory) | ✅ รายการ | ✅ stockLeft, note | ✅ รูปวัตถุดิบ |
| สต๊อกเค้ก (cake-stock) | ✅ ชื่อเค้ก | ✅ available, reserved, damaged, note | ✅ รูปสต๊อกเค้ก |
| ของใช้ (supplies-count) | ✅ รายการ | ✅ count, note | ✅ รูปสต๊อกของใช้ |
| ใบสั่งซื้อ (purchase-list) | ✅ รายการ | ✅ quantity, note | ✅ รูปประกอบ |

### ไฟล์ที่เปลี่ยน

- `app/src/components/PhotoSection.jsx` — NEW: reusable component (camera, album, lightbox, delete)
- `app/src/components/SearchSelect.jsx` — เพิ่มปุ่ม ▼/▲ toggle dropdown
- `app/src/pages/employee/EmpOps.jsx` — ครบทั้ง 6 ฟอร์ม
- `app/src/pages/admin/AdminOpsInbox.jsx` — แสดง photoCount/photoNames, เพิ่ม humanizeKey สำหรับ cake-stock fields
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v3`

### Payload sanitization (EmpOps → Supabase)

- blob URLs และ base64 ถูก strip ออกก่อนส่ง
- photos array ถูกแปลงเป็น `{ photoNames: [...], photoCount: N }`
- localStorage ไม่เก็บ photos array (blob URLs ใช้ได้แค่ session เดียว)

### Commit

- `bffe31d` feat: complete photo + voice + dropdown for all 6 OPS forms (v3)
- `28c135b` feat(AdminOpsInbox): show photo count + names for all OPS form types

### Deploy

ต้อง build+deploy จากเครื่อง Windows พร้อม `.env.local` หรือตั้ง GitHub Actions secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## Update 2026-06-19 (employee Operate handoff)

- HR employee home now opens the live Operate app directly:
  `https://je-bar-operate.pages.dev/`
- The employee button sends Operate these URL params:
  - `mode=employee`
  - `emp_id`
  - `emp_name`
  - `branch`
  - `from_hr=1`
- This follows the Operate contract from:
  `https://github.com/numjebar/je-bar-operate/blob/claude/continuation-7d4rf1/INTEGRATE_HR_CONTRACT.md`
- Employee flow no longer opens the old internal `/emp/ops` page from the main employee button.
- Admin/owner OPS link remains separate and opens the plain owner URL:
  `https://je-bar-operate.pages.dev/`
- Version badge updated to:
  `Build 2026.06.19-hr-operate-employee1`
- Build passed locally:
  `npm.cmd run build`
- Commit pushed to main:
  `843ecca Connect employee OPS button to Operate app`

### Deploy status

- GitHub Actions auto deploy for commit `843ecca` failed before build.
- Failure point:
  `Check required app env`
- Required GitHub Actions secrets before auto deploy can pass:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Production is still serving the previous bundle until the missing secrets are added and the workflow is rerun, or until a manual Cloudflare Pages deploy is performed from local `app/dist`.

### Branch note

- Remote branch `claude/continuation-7d4rf1` currently contains documentation-only changes:
  - `CATALOG_CAKE_FIX_NOTES.md`
  - `INTEGRATE_OPERATE_CONTRACT.md`
- It is diverged from `main`, so do not merge blindly into production.

## Update 2026-06-19 (weekly/monthly payroll screen alignment)

- Fixed employee payroll screens so they no longer let a weekly-paid employee drift into a monthly payroll view.
- Fixed admin employee payroll detail so the displayed cycle always matches the employee pay type:
  - `daily` -> day view allowed
  - `weekly` -> week cycle only
  - `monthly` -> month cycle only
- Added clearer labels on both employee/admin screens:
  - current payroll cycle date range
  - weekly employees = current weekly cycle only
  - monthly employees = current monthly cycle only
  - day wage is always shown as `บาท/วัน`
- Build checked successfully after patch:
  - `npm.cmd run build`

### Files touched in this update

- `app/src/pages/employee/EmpPay.jsx`
- `app/src/pages/admin/AdminEmployees.jsx`

อัปเดตล่าสุด: 2026-06-18

## Update 2026-06-18 (payroll cycle clarification)

- ปรับ logic ใหม่ให้ `pay_type` หมายถึง "รอบจ่ายเงิน" เท่านั้น
  - `daily` = จ่ายรายวัน
  - `weekly` = จ่ายรายสัปดาห์
  - `monthly` = จ่ายรายเดือน
- ปรับให้ `rate` ถูกใช้เป็น `ค่าจ้างต่อวัน` เสมอ
- ผลคือ:
  - ถ้าพนักงานตั้ง `rate = 345`
  - และรอบนี้ทำงาน 3 วัน
  - `ค่าแรงงวดนี้ = 345 x 3 = 1,035`
- หน้าแอดมินและหน้าพนักงานถูกแก้ข้อความใหม่ให้แสดง "ค่าจ้างต่อวัน" แทนการสื่อว่าเป็นบาท/สัปดาห์หรือบาท/เดือน
- ฟอร์มแก้ไขพนักงานถูกแก้ label จาก `ประเภทค่าจ้าง` เป็น `รอบจ่ายเงิน`

## Update 2026-06-18 (urgent leave deduction)

- แก้หน้า `EmpHistory.jsx` ให้ "ลาด่วนเช้าวันงานโดยไม่มีเหตุผล" ดูจากเงื่อนไข:
  - วันที่ลา = วันนี้
  - เหตุผลว่าง
- ไม่บังคับว่าต้องยื่นหลังเวลาเข้างานแล้วค่อยถือเป็นลาด่วน
- ตอนพนักงานกดยื่นลา ระบบจะยัง **ไม่** สร้างรายการหักเงินทันที
- ย้าย logic การหักเงินไปอยู่ตอนแอดมินกดอนุมัติใน `AdminDashboard.jsx`
- ถ้าแอดมินปฏิเสธ ระบบจะลบรายการหักอัตโนมัติของลาด่วนวันนั้นออก
- เพิ่ม SQL migration:
  - `supabase/23_urgent_leave_deduct_on_approval.sql`
  - ใช้ override `public.employee_request_leave(...)` เพื่อไม่ให้ฝั่ง database สร้าง adjustment ตอน submit leave

## โฟลเดอร์ที่ใช้ทำงานตอนนี้

- Working copy:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy`

## งานที่ทำเสร็จรอบนี้

### Payroll / คำนวณเงิน

- แก้ bug การคิดค่าแรงพนักงาน "รายสัปดาห์" ที่เดิมเอาเรทรายสัปดาห์ไปหารด้วยจำนวนวันในรอบที่เปิดดู (เช่น 26 วัน) ทำให้ค่าแรงต่อวันต่ำผิดจริง
- ปรับ payroll engine ให้:
  - รายวัน = คิดตามวันทำงานจริง
  - รายสัปดาห์ = เฉลี่ยตามจำนวนวันทำงานต่อสัปดาห์ของพนักงานจริง
  - รายเดือน = เฉลี่ยตามจำนวนวันทำงานในรอบเดือนของพนักงานจริง
- เพิ่ม `scheduledDaysPerWeek()` และ `scheduledDaysLabel` ใน `payroll.js`
- ปรับข้อความในหน้าแอดมินและหน้าพนักงานให้บอกชัดว่าโปรแกรมกำลังเฉลี่ยจาก "กี่วันต่อสัปดาห์/กี่วันต่อรอบ"
- ปรับหน้า `AdminPayroll.jsx` ให้ดูง่ายขึ้น
- เพิ่ม filter ตามประเภทค่าจ้าง:
  - ทุกประเภทค่าจ้าง
  - รายวัน
  - รายสัปดาห์
  - รายเดือน
- เปลี่ยนจากตารางกว้าง เป็น card รายพนักงาน
- แยกความหมายชัดเจน:
  - `ค่าจ้างที่ตั้งไว้`
  - `ค่าแรงงวดนี้`
  - `รอบจ่ายของคนนี้`
- แสดงรอบคำนวณจริงของแต่ละพนักงานตาม:
  - `weekly_cycle_start_day`
  - `monthly_cycle_start_day`

### Employee detail / ข้อมูลพนักงาน

- หน้า `AdminEmployees.jsx` รองรับและแสดง:
  - ประเภทค่าจ้าง
  - วันเริ่มรอบสัปดาห์
  - วันที่เริ่มรอบเดือน
- เปลี่ยนคำจาก `ค่าแรงฐาน` เป็น `ค่าแรงงวดนี้` ในจุดที่เกี่ยวข้อง

### Employee app / หน้ารายได้พนักงาน

- เขียน `EmpPay.jsx` ใหม่เพื่อแก้ข้อความไทยเพี้ยนจาก encoding เดิม
- ทำข้อความให้ตรงกับฝั่งแอดมิน:
  - `อัตราค่าจ้างที่ตั้งไว้`
  - `ค่าแรงงวดนี้`
  - `รอบคำนวณ`
  - `เงินสุทธิ`
- ยังคง logic เดิมของ payroll engine ไว้

## ไฟล์ที่แก้ล่าสุด

- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`
- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`
- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\employee\EmpPay.jsx`

## Build status

- รัน build ผ่านแล้ว
- คำสั่ง:
  `npm.cmd run build`
- ตำแหน่งที่รัน:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app`

## ประเด็นที่ต้องระวัง

- แอปพนักงานใช้งานลงเวลาอยู่จริง
- ห้ามทำให้พนักงานหลุดไปหน้าฝั่งแอดมินหรือเจ้าของร้าน
- งานรอบนี้ยังไม่ได้ deploy
- เป็นการแก้ใน working copy เท่านั้น ยังไม่ sync กลับ repo หลัก HR

## งานค้างแนะนำต่อ

1. เก็บ UX หน้า `AdminPayroll.jsx` เพิ่มอีกนิด
   - ทำให้ส่วนรอบจ่ายเด่นขึ้น
   - ทำให้การแยกค่าจ้างตั้งต้น vs ค่าแรงงวดนี้ ชัดขึ้นอีก
2. ทดสอบหน้า `EmpPay.jsx` ใน browser จริงหลัง deploy
3. ถ้าจะเอาขึ้นระบบจริง ให้ย้าย patch จาก working copy กลับเข้า repo HR หลักก่อน build/deploy

## สถานะพร้อมส่งต่อ

- พร้อมให้ทีมต่อยอดเรื่อง payroll ได้ทันที
- พร้อมให้ทีม deploy ต่อเมื่อยืนยันว่าจะใช้ชุดแก้จาก working copy นี้

## Update 2026-06-19 (cycle explanation and payroll clarity)

- Added cycle math helpers in:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\lib\payroll.js`
  - `countDaysInRange(range)`
  - `offDaysInRange(range, dayOff)`
- `computePay()` now also returns:
  - `cycleDaysTotal`
  - `cycleDaysElapsed`
  - `offDaysTotal`
  - `offDaysElapsed`
  - `scheduledDaysElapsed`
- This does **not** change the base pay formula itself.
- It makes the UI explain the cycle more clearly:
  - total calendar days in this cycle
  - regular off days in this cycle
  - scheduled work days in this cycle
  - how many days in the cycle have passed up to today
  - how many scheduled work days have passed up to today

### UI updates

- Employee pay page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\employee\EmpPay.jsx`
  - now shows full cycle day count vs off days vs scheduled work days
  - now shows elapsed cycle days up to today

- Admin payroll page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`
  - cards now explain cycle totals, off days, scheduled work days, and elapsed days

- Employee detail / admin employee page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`
  - summary card now shows cycle totals and elapsed cycle values for weekly/monthly staff

### Build

- Build passed:
  `npm.cmd run build`

## Update 2026-06-19 (agent workflow and auto deploy prep)

Added a dedicated agent rulebook:

- `AGENT_WORKFLOW.md`

Purpose:

- Defines the HR JEBAR project paths.
- Defines the safe work loop for the coding agent.
- Defines payroll rules so `rate` is always treated as daily wage.
- Defines deploy and version rules.
- Records that employee pages must never route employees to admin/owner pages.

Added GitHub Actions workflow:

- `.github/workflows/deploy-cloudflare-pages.yml`

Purpose:

- On push to `main`, GitHub Actions can build `app` and deploy `app/dist` to Cloudflare Pages project `hr-jebar`.
- Also supports manual run from GitHub Actions via `workflow_dispatch`.

Required GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Updated Cloudflare config:

- `wrangler.jsonc`

Changes:

- Added `pages_build_output_dir = "app/dist"`.
- Changed static asset directory to `app/dist`.

Build check:

- `npm.cmd run build` passed after these changes.

## Update 2026-06-19 (visible build version)

- Updated file:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\lib\version.js`

### Version

- Current visible app badge:
  `Build 2026.06.19-hr-payroll-daily1`

### Build

- Build passed after version update:
  `npm.cmd run build`

## Test 2026-06-19 (payroll daily build verification)

- `src/lib/payroll.js` lint check passed:
  `npx.cmd eslint src/lib/payroll.js`
- Production build passed:
  `npm.cmd run build`
- Build output JS changed after latest payroll/version fix:
  `dist/assets/index-lODRoa23.js`
- Full project lint still reports older React hook / unused / irregular whitespace issues across several existing pages. These do not block Vite build, but should be cleaned separately if the team wants a fully green lint run.
- Build location:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app`

## Update 2026-06-19 (admin payroll now follows each employee cycle)

- Root issue found:
  `AdminPayroll.jsx` was still using the page-level selected period for everyone.
  That caused weekly employees to sometimes be calculated on a monthly window in the admin payroll screen.

- Fixed in:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`

### What changed

- Added local helper:
  - `payrollPeriodForEmployee(emp, requestedPeriod)`
- Weekly employees now always use `week`
- Monthly employees now always use `month`
- Daily employees still follow the requested page period as before

### Also fixed

- Payroll rows now store `effectivePeriod`
- Manual net adjustment note prefix now uses the employee's real cycle instead of the page-level period
- Advance / deduction modal now opens with the employee's actual cycle
- Payroll summary text sent to employees now uses the employee's real cycle label

### Expected result

- Weekly employee cards in admin payroll should stop showing monthly-style ranges
- The admin payroll page should now match the employee detail page logic
- This should remove the confusing "9 days in a weekly cycle" behavior caused by wrong range selection

### Build

- Build passed after this fix:
  `npm.cmd run build`

## Update 2026-06-19 (daily payroll timeline on admin employee page)

- Updated file:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`

### What changed

- Added daily timeline helpers:
  - `groupAdjustmentsByDate(adjustments)`
  - `summarizeTimeline(items)`
  - `toSyntheticAttendance(items)`
- Employee detail page now builds payroll summary from the full daily timeline, not only raw attendance rows.
- Added a new admin section:
  - `ตารางสรุปรายวัน`
  - shows worked days
  - leave days
  - off days
  - payable days
- Added explicit `รายการวันหยุดในรอบนี้`
  - off-day dates are now visible as date badges
- Daily history rows now show:
  - date
  - current status
  - clock in/out
  - any bonus / advance / deduction on that date
- Added per-day edit button:
  - `แก้วัน`
  - opens `AttendanceDayModal`
  - admin can set day status to:
    - present
    - late
    - leave
    - absent
  - admin can set paid leave
  - admin can edit clock-in / clock-out / OT minutes
  - admin can also reset one day back to automatic state by deleting that attendance override

### Adjustment quality-of-life

- `AddAdjModal` now includes a date field
- bonuses / advances / deductions can be attached to the actual date they happened
- those items now appear directly under the matching day in the timeline

### Important limitation still remaining

- There is still no dedicated persistent `paid already` daily flag/table in Supabase.
- Right now daily rows can clearly show:
  - work / late / leave / absent
  - off day
  - bonus
  - advance
  - deduction
- If the team wants an explicit `วันนี้จ่ายเงินแล้ว` marker per date, that should be added as a new table or field in a later migration.

### Build

- Build passed:
  `npm.cmd run build`

## Update 2026-06-20 (Employee OPS system fully live)

### SQL migrations run in Supabase project `eoinzxqpqbybwcrmsgww`

- `25_employee_ops_entries.sql` — สร้างตาราง `employee_ops_entries` + RLS policies + RPCs:
  - `employee_submit_ops_entry(uuid, text, jsonb)`
  - `employee_get_ops_entries(uuid, text, int)`
  - `employee_submit_ops_entry_v2(session_token, task_key, payload)`
  - `employee_get_ops_entries_v2(session_token, task_key, limit)`
- `27_ops_entries_cake_stock.sql` — เพิ่ม `cake-stock` ใน allowed task keys
- `26_payroll_sync_rpc.sql` — สร้าง `get_payroll_month_summary(year, month)` สำหรับ JE-BAR-Operate ดึงข้อมูล payroll

### EmpOps.jsx — 6 แท็บครบและส่งข้อมูลเข้า Supabase ได้จริง

| Task key        | หน้าที่                             |
|-----------------|-------------------------------------|
| `bills`         | ถ่ายบิล + AI อ่านรายการ (Gemini)   |
| `production`    | บันทึกการผลิตขนม + SearchSelect     |
| `inventory`     | เช็กวัตถุดิบคงเหลือ + SearchSelect |
| `cake-stock`    | นับเค้กหน้าตู้ แยกสาขา             |
| `supplies-count`| นับของใช้สิ้นเปลือง               |
| `purchase-list` | ใบสั่งซื้อ multi-item + ความด่วน   |

### AdminOpsInbox.jsx — admin เห็นรายการทุกประเภทครบ

- ตาราง summary count 6 ประเภท
- filter ตาม task_key + วันที่
- `PurchaseListPreview` แสดงตารางพร้อมคอลัมน์ ความด่วน + ปุ่ม copy เป็น text
- `PayloadPreview` แสดง generic key-value สำหรับ bills / production / inventory / cake-stock / supplies-count

### Version

- `Build 2026.06.20-hr-ops-v2`

### Deploy status

- โค้ดถูก push ไปที่ `main` และ `claude/continuation-7d4rf1` แล้ว
- ยังต้องรัน build บนเครื่องที่มี `.env.local` (Supabase URL + anon key) แล้ว deploy ขึ้น Cloudflare Pages
- หรือเพิ่ม secrets ใน GitHub Actions ให้ครบ:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

## Hotfix 2026-06-19 (production blank page recovery)

- Production `https://hr-jebar.pages.dev` was blank after GitHub auto deploy.
- Root cause: GitHub Actions built the Vite app without Supabase env values, so the generated JS bundle did not contain `VITE_SUPABASE_URL`.
- Immediate recovery:
  - Built locally from `app/.env.local`
  - Deployed `app/dist` directly to Cloudflare Pages project `hr-jebar`
  - Verified production JS contains the Supabase project URL again
- Cloudflare preview created by the recovery deploy:
  - `https://c061ebaf.hr-jebar.pages.dev`
- Production URL to use:
  - `https://hr-jebar.pages.dev`

### Auto deploy guardrail

- Updated `.github/workflows/deploy-cloudflare-pages.yml`
- Build step now receives:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- The workflow now checks these values before build.
- Required GitHub Actions secrets before using auto deploy again:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

If the two Vite Supabase secrets are missing, GitHub Actions should fail before deploy instead of publishing a blank app.
