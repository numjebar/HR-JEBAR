import { useState, useRef } from 'react';

export function useVoiceInput(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  function toggle() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง ลอง Chrome บนมือถือ');
      return;
    }
    if (listening) { recRef.current?.stop(); return; }

    const rec = new SpeechRec();
    rec.lang = 'th-TH';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => { onResult(e.results[0][0].transcript); };
    rec.onerror  = () => setListening(false);
    rec.onend    = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return { listening, toggle };
}

export default function VoiceBtn({ onResult, size = 40, style = {} }) {
  const { listening, toggle } = useVoiceInput(onResult);
  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'กำลังฟัง... กดหยุด' : 'พูดใส่ข้อมูล (ภาษาไทย)'}
      style={{
        flexShrink: 0,
        width: size, height: size,
        borderRadius: Math.round(size * 0.3),
        background: listening ? '#fee2e2' : '#f0fdf4',
        border: `1.5px solid ${listening ? '#fca5a5' : '#bbf7d0'}`,
        cursor: 'pointer', fontSize: size * 0.45,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: listening ? 'pulse 1s infinite' : 'none',
        transition: 'background .2s, border-color .2s',
        ...style,
      }}
    >
      {listening ? '⏹' : '🎤'}
    </button>
  );
}
