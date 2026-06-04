// ─────────────────────────────────────────────────────────────
// HR JEBAR — Employee mobile app
// ─────────────────────────────────────────────────────────────

// ---- PIN pad -----------------------------------------------------
function PinPad({ emp, onSuccess, onBack }) {
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(false);
  const press = (d) => {
    if (pin.length >= 4) return;
    const np = pin + d;
    setPin(np); setErr(false);
    if (np.length === 4) {
      setTimeout(() => {
        if (np === emp.pin) onSuccess();
        else { setErr(true); setPin(''); }
      }, 150);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px 40px', height: '100%', justifyContent: 'center' }}>
      <Avatar emp={emp} size={76} />
      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 14 }}>{emp.name}</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>ใส่รหัส PIN 4 หลัก</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 16,
            background: i < pin.length ? 'var(--accent)' : 'transparent',
            border: '2px solid ' + (err ? '#DC2626' : (i < pin.length ? 'var(--accent)' : 'var(--line)')),
            transition: 'all .15s',
          }} />
        ))}
      </div>
      <div style={{ height: 20, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>{err ? 'PIN ไม่ถูกต้อง' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,72px)', gap: 16, marginTop: 6 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => press(String(d))} style={pinKey}>{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} style={pinKey}>0</button>
        <button onClick={() => setPin(pin.slice(0, -1))} style={{ ...pinKey, fontSize: 20 }}>⌫</button>
      </div>
      <button onClick={onBack} style={{ marginTop: 26, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← เปลี่ยนบัญชี</button>
      <div style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', padding: '6px 12px', borderRadius: 8 }}>เดโม: PIN คือ {emp.pin}</div>
    </div>
  );
}
const pinKey = {
  width: 72, height: 72, borderRadius: 72, border: '1.5px solid var(--line)', background: 'var(--surface)',
  fontSize: 28, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
};

// ---- Check-in flow (geofence + selfie) ---------------------------
function CheckInSheet({ emp, rules, branch, closingTasks = [], mode, onClose, onConfirm }) {
  // mode: 'in' | 'out'
  const geo = branch || { lat: rules.geoLat, lng: rules.geoLng, radius: rules.geoRadius || 20, label: rules.geoLabel || 'ร้าน' };
  const hasClosing = mode === 'out' && closingTasks.length > 0;
  // where to go once location is confirmed
  const afterGeo = () => {
    if (mode === 'in') return rules.requireSelfie ? 'selfie' : 'ready';
    return hasClosing ? 'closing' : 'ready';
  };
  const [step, setStep] = React.useState('locating'); // locating | denied | selfie | closing | ready | success
  const [simIn, setSimIn] = React.useState(true);
  const [dist, setDist] = React.useState(8);
  const [selfie, setSelfie] = React.useState(null);
  const [doneTime, setDoneTime] = React.useState(null);
  const [checked, setChecked] = React.useState({});
  const videoRef = React.useRef(null);
  const [camOn, setCamOn] = React.useState(false);

  // simulate / attempt real geolocation
  React.useEffect(() => {
    if (!rules.geoEnabled) { setStep(afterGeo()); return; }
    setStep('locating');
    const sim = () => {
      const d = simIn ? Math.floor(Math.random() * 15) + 3 : Math.floor(Math.random() * 200) + 60;
      setDist(d);
      const ok = d <= geo.radius;
      setStep(ok ? afterGeo() : 'denied');
    };
    const t = setTimeout(sim, 900);
    return () => clearTimeout(t);
  }, [simIn, mode]);

  // try real camera for selfie step
  React.useEffect(() => {
    if (step !== 'selfie' || selfie) return;
    let stream;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => { stream = s; if (videoRef.current) { videoRef.current.srcObject = s; setCamOn(true); } })
      .catch(() => setCamOn(false));
    return () => { stream && stream.getTracks().forEach((t) => t.stop()); };
  }, [step]);

  const capture = () => {
    const v = videoRef.current;
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 240;
    const ctx = cv.getContext('2d');
    if (camOn && v && v.videoWidth) {
      const s = Math.min(v.videoWidth, v.videoHeight);
      ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 240, 240);
    } else {
      // fallback placeholder selfie
      ctx.fillStyle = emp.color || '#0E7C66'; ctx.fillRect(0, 0, 240, 240);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = 'bold 90px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emp.nickname || emp.name.slice(0, 1), 120, 120);
    }
    setSelfie(cv.toDataURL('image/jpeg', 0.7));
    setStep('ready');
  };

  const inZone = dist <= geo.radius;
  return (
    <Sheet open onClose={onClose} title={mode === 'in' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน'}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {step === 'locating' && (
          <>
            <div style={{ width: 200, height: 200, borderRadius: 18, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spin"><Icon name="pin" size={40} color="var(--accent)" /></div>
            </div>
            <div style={{ fontWeight: 600 }}>กำลังตรวจสอบตำแหน่ง…</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>ต้องอยู่ในรัศมี {geo.radius} ม. จาก{geo.label}</div>
          </>
        )}

        {(step === 'denied' || step === 'selfie' || step === 'closing' || step === 'ready') && rules.geoEnabled && (
          <>
            <GeoMap inZone={inZone} distance={dist} radius={geo.radius} label={geo.label} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: inZone ? 'var(--accent)' : '#DC2626' }}>
                {inZone ? `✓ อยู่ในพื้นที่ร้าน (ห่าง ${dist} ม.)` : `✕ อยู่นอกพื้นที่ (ห่าง ${dist} ม.)`}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{geo.label} · รัศมี {geo.radius} ม.</div>
            </div>
          </>
        )}

        {step === 'denied' && (
          <>
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: 14, borderRadius: 12, fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
              ลงเวลาไม่ได้ — คุณอยู่นอกพื้นที่ร้าน<br />กรุณาเข้ามาในรัศมี {geo.radius} เมตรก่อน
            </div>
          </>
        )}

        {step === 'selfie' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 200, height: 200, borderRadius: 18, overflow: 'hidden', background: '#000', position: 'relative' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              {!camOn && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 8 }}>
                  <Icon name="camera" size={40} color="#fff" />
                  <span style={{ fontSize: 13, opacity: 0.8 }}>ไม่พบกล้อง (โหมดเดโม)</span>
                </div>
              )}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>ถ่ายเซลฟี่เพื่อยืนยันตัวตน</div>
            <Button icon="camera" full onClick={capture}>ถ่ายรูปยืนยัน</Button>
          </div>
        )}

        {step === 'closing' && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name="clipboard" size={20} color="var(--accent)" />
              <div style={{ fontWeight: 700, fontSize: 16 }}>เช็กลิสต์ก่อนเลิกงาน</div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}>ทำให้ครบทุกข้อแล้วติ๊กยืนยัน จึงจะลงเวลาออกได้</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {closingTasks.map((task, i) => {
                const on = !!checked[i];
                return (
                  <div key={i} onClick={() => setChecked({ ...checked, [i]: !on })} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 14, cursor: 'pointer',
                    border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-soft)' : 'var(--surface)',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: on ? 'var(--accent)' : 'transparent', border: '2px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                    }}>{on && <Icon name="check" size={16} color="#fff" stroke={3} />}</div>
                    <span style={{ fontSize: 15, fontWeight: 500, textDecoration: on ? 'line-through' : 'none', color: on ? 'var(--muted)' : 'var(--ink)' }}>{task}</span>
                  </div>
                );
              })}
            </div>
            {(() => {
              const allDone = closingTasks.every((_, i) => checked[i]);
              const cnt = closingTasks.filter((_, i) => checked[i]).length;
              return (
                <Button variant="dark" full size="lg" disabled={!allDone} onClick={() => setStep('ready')}>
                  {allDone ? 'ทำครบแล้ว — ไปลงเวลาออก' : `ติ๊กให้ครบก่อน (${cnt}/${closingTasks.length})`}
                </Button>
              );
            })()}
          </div>
        )}

        {step === 'ready' && (
          <div style={{ width: '100%' }}>
            {selfie && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <img src={selfie} style={{ width: 90, height: 90, borderRadius: 14, objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
            )}
            {hasClosing && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--accent)', fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>
                <Icon name="check" size={16} color="var(--accent)" /> ทำเช็กลิสต์ปิดร้านครบ {closingTasks.length} ข้อแล้ว
              </div>
            )}
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>เวลา{mode === 'in' ? 'เข้างาน' : 'ออกงาน'}</div>
              <div style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{nowHM()}</div>
              {mode === 'in' && parseHM(nowHM()) > parseHM(rules.workStart) + rules.graceMin && (
                <div style={{ color: '#B45309', fontWeight: 600, fontSize: 14, marginTop: 4 }}>⚠ สายกว่ากำหนด ({rules.workStart})</div>
              )}
            </div>
            <Button variant={mode === 'in' ? 'primary' : 'dark'} full size="lg"
              onClick={() => { const t = nowHM(); setDoneTime(t); onConfirm({ dist, selfie, lat: geo.lat, lng: geo.lng, closingDone: hasClosing ? closingTasks : null }); fireNotification({ sound: true, vibrate: true }); setStep('success'); }}>
              ยืนยันลงเวลา{mode === 'in' ? 'เข้างาน' : 'ออกงาน'}
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0 4px' }}>
            <div style={{ width: 84, height: 84, borderRadius: 84, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'popIn .35s cubic-bezier(.2,1.2,.4,1)' }}>
              <Icon name="check" size={44} color="var(--accent)" stroke={3} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--accent)' }}>ลงเวลา{mode === 'in' ? 'เข้างาน' : 'ออกงาน'}สำเร็จ</div>
            <div style={{ fontSize: 15, color: 'var(--muted)', textAlign: 'center' }}>
              {emp.name} · เวลา <b style={{ color: 'var(--ink)' }}>{doneTime}</b> น.<br />{fmtDateFull(ymd(new Date()))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 999, padding: '8px 16px', fontSize: 13 }}>
              <Icon name="pin" size={16} color="var(--accent)" />{geo.label} · ห่าง {dist} ม.
              {selfie && <img src={selfie} style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover', transform: 'scaleX(-1)', marginLeft: 4 }} />}
            </div>
            {mode === 'in' && parseHM(doneTime) > parseHM(rules.workStart) + rules.graceMin && (
              <div style={{ color: '#B45309', fontWeight: 600, fontSize: 14 }}>⚠ บันทึกเป็นมาสาย (เข้างาน {rules.workStart})</div>
            )}
            <Button full size="lg" onClick={onClose} style={{ marginTop: 4 }}>เสร็จสิ้น</Button>
          </div>
        )}

        {/* demo location toggle */}
        {rules.geoEnabled && step !== 'success' && step !== 'closing' && (
          <div style={{ width: '100%', borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>🧪 จำลองตำแหน่ง (สำหรับทดสอบ)</div>
            <Segmented options={[{ value: true, label: 'อยู่ในพื้นที่' }, { value: false, label: 'นอกพื้นที่' }]} value={simIn} onChange={(v) => { setSelfie(null); setSimIn(v); }} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

Object.assign(window, { PinPad, CheckInSheet });
