import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { geoDistance, nowHM, ymd, parseHM } from '../../lib/payroll';

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

function makeSelfiePlaceholder(employee) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  const color = employee.color || '#0E7C66';
  const name = employee.nickname || employee.name || 'EMP';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath();
  ctx.arc(590, 80, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 12), canvas.width / 2, canvas.height / 2);
  ctx.font = '500 28px sans-serif';
  ctx.fillText('ยืนยันด้วย placeholder', canvas.width / 2, canvas.height / 2 + 78);
  return canvas;
}

function playClockTone(mode) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
  master.connect(ctx.destination);

  const notes = mode === 'in' ? [880, 1175, 1568] : [1175, 880];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.22);
    osc.connect(gain);
    gain.connect(master);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.25);
  });
}

export default function CheckInFlow({ employee, branch, rules, mode, employeeSessionToken, onClose }) {
  const [step, setStep] = useState('geo'); // geo → selfie → checklist → confirm → success
  const [geoStatus, setGeoStatus] = useState('checking'); // checking | ok | denied
  const [dist, setDist] = useState(null);
  const [coords, setCoords] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState(null);
  const [closingDone, setClosingDone] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ---- geolocation ----
  useEffect(() => {
    if (!rules.geoEnabled || !branch) { setGeoStatus('ok'); setStep(nextStep('geo')); return; }
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const d = geoDistance(pos.coords.latitude, pos.coords.longitude, branch.lat, branch.lng);
        setDist(d);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus(d <= branch.radius ? 'ok' : 'denied');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (geoStatus === 'ok') setStep(nextStep('geo'));
  }, [geoStatus]);

  function nextStep(cur) {
    if (cur === 'geo') {
      if (mode === 'in' && rules.requireSelfie) return 'selfie';
      if (mode === 'out' && (employee.closing_tasks || []).length > 0) return 'checklist';
      return 'confirm';
    }
    if (cur === 'selfie') {
      if (mode === 'out' && (employee.closing_tasks || []).length > 0) return 'checklist';
      return 'confirm';
    }
    if (cur === 'checklist') return 'confirm';
    return 'success';
  }

  // ---- selfie ----
  useEffect(() => {
    if (step !== 'selfie') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      usePlaceholderSelfie();
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).then((s) => {
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch(() => usePlaceholderSelfie());
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [step]);

  async function uploadSelfieCanvas(canvas) {
    const blob = await canvasToBlob(canvas);
    const path = `selfies/${employee.id}/${ymd(new Date())}_${mode}.jpg`;
    const { error } = await supabase.storage.from('selfies').upload(path, blob, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('selfies').getPublicUrl(path);
      setSelfieUrl(data.publicUrl);
      return;
    }
    setSelfieUrl(canvas.toDataURL('image/jpeg', 0.82));
  }

  async function usePlaceholderSelfie() {
    const canvas = makeSelfiePlaceholder(employee);
    await uploadSelfieCanvas(canvas);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStep(nextStep('selfie'));
  }

  async function takeSelfie() {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    try {
      if (!video || !video.videoWidth || !video.videoHeight) {
        await usePlaceholderSelfie();
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      await uploadSelfieCanvas(canvas);
    } catch {
      await usePlaceholderSelfie();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStep(nextStep('selfie'));
  }

  // ---- confirm & save ----
  async function confirm() {
    setBusy(true);
    setErr('');
    try {
      const t = nowHM();

      if (mode === 'in') {
        const workStart = rules.workStart.split(':').map(Number);
        const now = new Date();
        const workMin = workStart[0] * 60 + workStart[1] + rules.graceMin;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const status = nowMin > workMin ? 'late' : 'present';
        const { error } = await supabase.rpc('employee_clock_in_v2', {
          p_session_token: employeeSessionToken,
          p_time: t,
          p_status: status,
          p_selfie_url: selfieUrl,
          p_dist: dist,
          p_lat: coords?.lat,
          p_lng: coords?.lng,
        });
        if (error) throw error;
      } else {
        const endMin = parseHM(rules.workEnd);
        const nowMin = parseHM(t);
        const otMin = Math.max(0, nowMin - endMin - Number(rules.otGraceMin || 0));
        const closingTasks = employee.closing_tasks || [];
        const closingDoneTasks = closingDone.map((idx) => closingTasks[idx]).filter(Boolean);
        const { error } = await supabase.rpc('employee_clock_out_v2', {
          p_session_token: employeeSessionToken,
          p_time: t,
          p_ot_min: otMin,
          p_closing_done: closingDoneTasks,
        });
        if (error) throw error;
      }
      playClockTone(mode);
      setStep('success');
    } catch (ex) {
      setErr(ex.message || 'บันทึกเวลาไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // ---- UI ----
  return (
    <div className="sheet-overlay">
      <div className="sheet" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
        {step === 'geo' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
            {geoStatus === 'checking' && <div style={{ color: 'var(--muted)' }}>🔍 กำลังตรวจสอบตำแหน่ง...</div>}
            {geoStatus === 'denied' && (
              <>
                <div style={{ fontSize: 48 }}>📍</div>
                <div style={{ color: 'var(--danger-fg)', fontWeight: 700, textAlign: 'center' }}>อยู่นอกพื้นที่</div>
                <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>
                  ระยะห่าง {dist} เมตร (ต้องอยู่ภายใน {branch?.radius} เมตร)
                </div>
                <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
              </>
            )}
            {geoStatus === 'error' && (
              <>
                <div style={{ color: 'var(--danger-fg)' }}>ไม่สามารถรับตำแหน่งได้</div>
                <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
              </>
            )}
          </div>
        )}

        {step === 'selfie' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>📸 ถ่ายเซลฟี่เพื่อยืนยัน</div>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000', aspectRatio: '4/3', objectFit: 'cover' }} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={takeSelfie}>ถ่ายภาพ</button>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>ยกเลิก</button>
          </div>
        )}

        {step === 'checklist' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>✅ เช็กลิสต์ปิดงาน</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>ต้องทำครบทุกข้อก่อนลงเวลาออก</div>
            {(employee.closing_tasks || []).map((task, index) => (
              <label key={`${index}-${task}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={closingDone.includes(index)} onChange={(e) => {
                  setClosingDone((prev) => e.target.checked ? [...prev, index] : prev.filter((i) => i !== index));
                }} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 14 }}>{task}</span>
              </label>
            ))}
            <button
              className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
              disabled={closingDone.length < (employee.closing_tasks || []).length}
              onClick={() => setStep('confirm')}
            >
              ต่อไป
            </button>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>ยกเลิก</button>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{mode === 'in' ? 'ยืนยันลงเวลาเข้า' : 'ยืนยันลงเวลาออก'}</div>
            {selfieUrl && <img src={selfieUrl} alt="selfie" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />}
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              <div>เวลา: <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{nowHM()}</span></div>
              {dist != null && <div>ระยะห่าง: <span className="num">{dist}</span> เมตร</div>}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirm} disabled={busy}>
              {busy ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
            {err && <div style={{ color: 'var(--danger-fg)', fontSize: 13, textAlign: 'center' }}>{err}</div>}
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>ยกเลิก</button>
          </div>
        )}

        {step === 'success' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>บันทึกสำเร็จ!</div>
            <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>
              ลงเวลา{mode === 'in' ? 'เข้า' : 'ออก'} เวลา <span className="num">{nowHM()}</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>ปิด</button>
          </div>
        )}
      </div>
    </div>
  );
}
