import { useState, useRef, useEffect, useCallback } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVELS = ['N5','N4','N3','N2','N1'];
const LEVEL_COLOR = { N5:'#059669', N4:'#0284c7', N3:'#7c3aed', N2:'#d97706', N1:'#ae2826' };
const LEVEL_BG    = { N5:'#d1fae5', N4:'#dbeafe', N3:'#ede9fe', N2:'#fef3c7', N1:'#fde8e8' };

function speak(text, rate = 0.85, onEnd) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = rate;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

function charSim(a, b) {
  const norm = s => s.replace(/[。、！？\s「」『』・]/g, '');
  const na = norm(a), nb = norm(b);
  if (!nb) return 0;
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return Math.max(0, Math.round((1 - dp[na.length][nb.length] / Math.max(na.length, nb.length)) * 100));
}

function scoreColor(s) { return s >= 80 ? '#16a34a' : s >= 55 ? '#d97706' : '#ae2826'; }
function fmt(s) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

// ─── Reusable components ──────────────────────────────────────────────────────
function RubyText({ text, show }) {
  if (!show) return <span>{text.replace(/\{([^|]+)\|[^}]+\}/g, '$1')}</span>;
  const parts = []; const re = /\{([^|]+)\|([^}]+)\}/g; let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<ruby key={m.index}>{m[1]}<rt style={{fontSize:'0.6em',color:'#666'}}>{m[2]}</rt></ruby>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span>{parts}</span>;
}

const SPEAKER_COLOR = ['#0284c7','#059669','#7c3aed','#d97706','#ae2826','#0891b2'];
function SpeakerBadge({ name }) {
  const idx = (name?.charCodeAt(0) || 0) % SPEAKER_COLOR.length;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0"
    style={{ background: SPEAKER_COLOR[idx] }}>{name?.slice(0,1)}</span>;
}

function ScoreRing({ score }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6"/>
      <circle cx="36" cy="36" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="6"
        strokeDasharray={`${c*score/100} ${c}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{transition:'stroke-dasharray .7s'}}/>
      <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="bold" fill={scoreColor(score)}>{score}</text>
    </svg>
  );
}

// ─── Recording hook ───────────────────────────────────────────────────────────
function useRecorder(onDone) {
  const [recording, setRecording] = useState(false);
  const [scoring,   setScoring]   = useState(false);
  const [recErr,    setRecErr]     = useState('');
  const mrRef    = useRef(null);
  const timerRef = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    mrRef.current?.stop(); mrRef.current = null;
  }, []);

  useEffect(() => { if (recording) { timerRef.current = setTimeout(stop, 6000); return () => clearTimeout(timerRef.current); }}, [recording, stop]);

  const start = async (target) => {
    setRecErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); setRecording(false);
        const b64 = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result.split(',')[1]); fr.onerror = rej;
          fr.readAsDataURL(new Blob(chunks, { type: mimeType }));
        });
        setScoring(true);
        try { const r = await api.post('/listening/score-pronunciation', { audioBase64: b64, mimeType, target }); onDone(r.data); }
        catch { setRecErr('Lỗi chấm điểm. Thử lại nhé.'); } finally { setScoring(false); }
      };
      mr.start(100); mrRef.current = mr; setRecording(true);
    } catch { setRecErr('Không truy cập được micro. Kiểm tra quyền trình duyệt.'); }
  };

  return { recording, scoring, recErr, start, stop };
}

// ─── Dialogue tabs ────────────────────────────────────────────────────────────
function ListenTab({ lines }) {
  const [furigana, setFurigana] = useState(true);
  const [showJP, setShowJP]     = useState(true);
  const [showVI, setShowVI]     = useState(false);
  const [speed, setSpeed]       = useState(0.85);
  const [playing, setPlaying]   = useState(null);
  const [playingAll, setPlayingAll] = useState(false);
  const cancelRef = useRef(false);

  const playLine = l => { setPlaying(l.line_order); speak(l.text_plain, speed, () => setPlaying(null)); };
  const playAll = useCallback(async () => {
    cancelRef.current = false; setPlayingAll(true);
    for (const l of lines) {
      if (cancelRef.current) break;
      setPlaying(l.line_order);
      await new Promise(res => { const u = new SpeechSynthesisUtterance(l.text_plain); u.lang='ja-JP'; u.rate=speed; u.onend=res; window.speechSynthesis.speak(u); });
    }
    setPlaying(null); setPlayingAll(false);
  }, [lines, speed]);
  const stopAll = () => { cancelRef.current = true; window.speechSynthesis.cancel(); setPlaying(null); setPlayingAll(false); };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-3 flex flex-wrap gap-2 items-center">
        {[['Furigana',furigana,setFurigana],['Sub JP',showJP,setShowJP],['Sub VI',showVI,setShowVI]].map(([l,v,s]) => (
          <button key={l} onClick={() => s(x => !x)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${v?'bg-tsubaki-red text-white border-tsubaki-red':'border-outline text-on-muted hover:border-tsubaki-red/40'}`}>{l}</button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="material-symbols-outlined text-sm text-on-muted">speed</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={speed} onChange={e=>setSpeed(+e.target.value)} className="w-20 accent-tsubaki-red"/>
          <span className="text-xs text-on-muted">{speed.toFixed(2)}×</span>
        </div>
      </div>
      <div className="flex gap-2">
        {!playingAll
          ? <button onClick={playAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tsubaki-red text-white text-sm font-semibold"><span className="material-symbols-outlined text-base">play_circle</span>Phát toàn bộ</button>
          : <button onClick={stopAll} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline text-sm font-semibold"><span className="material-symbols-outlined text-base">stop_circle</span>Dừng</button>}
      </div>
      <div className="space-y-2">
        {lines.map(l => (
          <div key={l.id} className={`glass-card rounded-xl p-3 transition-all ${playing===l.line_order?'ring-2 ring-tsubaki-red/50 bg-tsubaki-red/5':''}`}>
            <div className="flex items-start gap-3">
              <SpeakerBadge name={l.speaker}/>
              <div className="flex-1 min-w-0">
                {showJP && <p className="text-base leading-relaxed" style={{fontFamily:"'Noto Sans JP',sans-serif"}}><RubyText text={l.text_jp} show={furigana}/></p>}
                {showVI && <p className="text-sm text-on-muted mt-0.5">{l.text_vi}</p>}
              </div>
              <button onClick={() => playLine(l)}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${playing===l.line_order?'bg-tsubaki-red text-white':'bg-surface-low text-on-muted hover:bg-tsubaki-red/10 hover:text-tsubaki-red'}`}>
                <span className="material-symbols-outlined text-base">{playing===l.line_order?'volume_up':'play_arrow'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DictationTab({ lines }) {
  const [idx, setIdx]         = useState(0);
  const [input, setInput]     = useState('');
  const [checked, setChecked] = useState(false);
  const [scores, setScores]   = useState([]);
  const [done, setDone]       = useState(false);
  const line = lines[idx];
  const check = () => { setScores(p => [...p, charSim(input.trim(), line.text_plain)]); setChecked(true); };
  const next  = () => { if (idx+1>=lines.length) { setDone(true); return; } setIdx(i=>i+1); setInput(''); setChecked(false); };
  const reset = () => { setIdx(0); setInput(''); setChecked(false); setScores([]); setDone(false); };
  if (done) {
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    return (
      <div className="space-y-4 text-center">
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3">
          <ScoreRing score={avg}/>
          <p className="font-display text-xl font-bold">Kết quả chép chính tả</p>
          <p className="text-on-muted text-sm">{avg>=80?'Xuất sắc!':avg>=60?'Khá tốt!':'Luyện thêm nhé.'}</p>
          <div className="w-full mt-2 space-y-1">
            {lines.map((l,i) => <div key={l.id} className="flex items-center justify-between text-sm px-2">
              <span className="text-on-muted truncate max-w-[70%]">{l.text_plain}</span>
              <span className="font-bold" style={{color:scoreColor(scores[i]||0)}}>{scores[i]||0}%</span>
            </div>)}
          </div>
        </div>
        <Button onClick={reset} variant="secondary"><span className="material-symbols-outlined text-base">replay</span>Làm lại</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-on-muted">Câu {idx+1}/{lines.length}</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-low overflow-hidden">
          <div className="h-full bg-tsubaki-red rounded-full transition-all" style={{width:`${idx/lines.length*100}%`}}/>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SpeakerBadge name={line.speaker}/>
          <button onClick={() => speak(line.text_plain, 0.75)} className="ml-auto flex items-center gap-1.5 text-sm text-tsubaki-red hover:underline">
            <span className="material-symbols-outlined text-base">volume_up</span>Nghe câu này
          </button>
        </div>
        {!checked
          ? <input autoFocus value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&input.trim())check();}}
              placeholder="Chép lại những gì bạn nghe được..."
              className="w-full px-3 py-2.5 border border-outline rounded-xl text-base outline-none focus:border-tsubaki-red"
              style={{fontFamily:"'Noto Sans JP',sans-serif"}}/>
          : <div className="space-y-2">
              <div className="rounded-xl bg-surface-low px-3 py-2 text-sm"><span className="text-xs font-semibold block mb-0.5 text-on-muted">Bạn viết:</span>
                <p style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{input||'(để trống)'}</p></div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm"><span className="text-xs font-semibold text-emerald-700 block mb-0.5">Đáp án đúng:</span>
                <p style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{line.text_plain}</p></div>
              <p className="text-xs text-on-muted">{line.text_vi}</p>
            </div>}
        {!checked
          ? <Button onClick={check} disabled={!input.trim()} className="w-full">Kiểm tra</Button>
          : <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="text-2xl font-bold" style={{color:scoreColor(scores[scores.length-1])}}>{scores[scores.length-1]}%</span><span className="text-sm text-on-muted">khớp</span></div>
              <Button onClick={next}>{idx+1<lines.length?'Câu tiếp':'Xem kết quả'}<span className="material-symbols-outlined text-base">arrow_forward</span></Button>
            </div>}
      </div>
    </div>
  );
}

function ShadowingTab({ lines }) {
  const [idx, setIdx]       = useState(0);
  const [furigana, setFurigana] = useState(true);
  const [scores, setScores] = useState({});
  const line = lines[idx];
  const { recording, scoring, recErr, start, stop } = useRecorder(data => setScores(p => ({ ...p, [idx]: data })));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={()=>setFurigana(v=>!v)} className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${furigana?'bg-tsubaki-red text-white border-tsubaki-red':'border-outline text-on-muted'}`}>Furigana</button>
        <span className="text-sm text-on-muted ml-auto">Câu {idx+1}/{lines.length}</span>
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <SpeakerBadge name={line.speaker}/>
          <p className="text-xl leading-loose flex-1" style={{fontFamily:"'Noto Sans JP',sans-serif"}}><RubyText text={line.text_jp} show={furigana}/></p>
        </div>
        <p className="text-sm text-on-muted">{line.text_vi}</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>speak(line.text_plain,0.8)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low">
            <span className="material-symbols-outlined text-base">volume_up</span>Nghe mẫu
          </button>
          {!recording && !scoring && <button onClick={()=>start(line.text_plain)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tsubaki-red text-white text-sm font-semibold">
            <span className="material-symbols-outlined text-base">mic</span>Ghi âm (6s)
          </button>}
          {recording && <button onClick={stop} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold animate-pulse">
            <span className="material-symbols-outlined text-base">stop</span>Dừng
          </button>}
          {scoring && <div className="flex items-center gap-2 px-4 py-2 text-sm text-on-muted"><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Đang chấm...</div>}
        </div>
        {recErr && <p className="text-sm text-tsubaki-red">{recErr}</p>}
        {scores[idx] && <div className="rounded-xl border border-outline bg-surface-low p-4 flex items-center gap-4">
          <ScoreRing score={scores[idx].score}/>
          <div><p className="font-semibold text-sm">{scores[idx].feedback}</p>
            {scores[idx].transcript && <p className="text-xs text-on-muted mt-1">AI nghe được: <span style={{fontFamily:"'Noto Sans JP',sans-serif"}}>「{scores[idx].transcript}」</span></p>}
          </div>
        </div>}
      </div>
      <div className="flex gap-2">
        <button disabled={idx===0} onClick={()=>setIdx(i=>i-1)} className="flex-1 py-2 rounded-xl border border-outline text-sm font-semibold disabled:opacity-30 hover:bg-surface-low flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-base">arrow_back</span>Câu trước
        </button>
        <button disabled={idx===lines.length-1} onClick={()=>setIdx(i=>i+1)} className="flex-1 py-2 rounded-xl bg-charcoal text-white text-sm font-semibold disabled:opacity-30 flex items-center justify-center gap-1">
          Câu tiếp<span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>
      {Object.keys(scores).length > 0 && <div className="glass-card rounded-xl p-3">
        <p className="text-xs font-semibold text-on-muted mb-2">Điểm đã luyện</p>
        <div className="flex flex-wrap gap-3">
          {lines.map((_,i)=>scores[i]&&<div key={i} className="text-xs flex items-center gap-1">
            <span className="text-on-muted">C{i+1}:</span><span className="font-bold" style={{color:scoreColor(scores[i].score)}}>{scores[i].score}%</span>
          </div>)}
        </div>
      </div>}
    </div>
  );
}

// ─── User audio tabs ──────────────────────────────────────────────────────────
function AudioListenTab({ audioUrl, segments }) {
  const audioRef   = useRef(null);
  const [curSeg, setCurSeg] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    const onTime = () => {
      const t = el.currentTime;
      const i = segments.findIndex(s => t >= s.start && t < s.end);
      setCurSeg(i);
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [segments]);

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} controls className="w-full rounded-xl"
        onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
      {segments.length > 0 ? (
        <div className="space-y-2">
          {segments.map((s, i) => (
            <div key={i} onClick={() => { if (audioRef.current) { audioRef.current.currentTime = s.start; audioRef.current.play(); }}}
              className={`glass-card rounded-xl px-3 py-2 cursor-pointer transition-all ${curSeg===i?'ring-2 ring-tsubaki-red/50 bg-tsubaki-red/5':''}`}>
              <div className="flex items-start gap-2">
                <span className="text-xs text-on-muted mt-0.5 shrink-0">{fmt(s.start)}</span>
                <p className="text-sm" style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-on-muted text-center py-8">Không có transcript. AI có thể không nhận ra được ngôn ngữ.</p>}
    </div>
  );
}

function AudioDictationTab({ audioUrl, segments }) {
  const audioRef = useRef(null);
  const [idx, setIdx]     = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [scores, setScores]   = useState([]);
  const [done, setDone]       = useState(false);

  if (!segments.length) return <p className="text-sm text-on-muted text-center py-12">Cần có transcript để luyện chính tả.</p>;
  const seg = segments[idx];
  const playSegment = () => { if (!audioRef.current) return; audioRef.current.currentTime = seg.start; audioRef.current.play();
    const check = () => { if (audioRef.current.currentTime >= seg.end) { audioRef.current.pause(); audioRef.current.removeEventListener('timeupdate', check); }};
    audioRef.current.addEventListener('timeupdate', check); };
  const checkAnswer = () => { setScores(p => [...p, charSim(input.trim(), seg.text)]); setChecked(true); };
  const next = () => { if (idx+1>=segments.length) { setDone(true); return; } setIdx(i=>i+1); setInput(''); setChecked(false); };
  const reset = () => { setIdx(0); setInput(''); setChecked(false); setScores([]); setDone(false); };

  if (done) {
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    return <div className="text-center space-y-4">
      <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3">
        <ScoreRing score={avg}/><p className="font-bold text-lg">Điểm trung bình: {avg}%</p>
      </div>
      <Button onClick={reset} variant="secondary"><span className="material-symbols-outlined text-base">replay</span>Làm lại</Button>
    </div>;
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} className="hidden"/>
      <div className="flex items-center gap-3"><span className="text-sm text-on-muted">Đoạn {idx+1}/{segments.length}</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-low overflow-hidden">
          <div className="h-full bg-tsubaki-red rounded-full" style={{width:`${idx/segments.length*100}%`}}/></div></div>
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <button onClick={playSegment} className="flex items-center gap-2 text-sm text-tsubaki-red hover:underline">
          <span className="material-symbols-outlined text-base">volume_up</span>Nghe đoạn này ({fmt(seg.start)}–{fmt(seg.end)})
        </button>
        {!checked
          ? <input autoFocus value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&input.trim())checkAnswer();}}
              placeholder="Gõ những gì bạn nghe được..."
              className="w-full px-3 py-2.5 border border-outline rounded-xl outline-none focus:border-tsubaki-red"
              style={{fontFamily:"'Noto Sans JP',sans-serif"}}/>
          : <div className="space-y-2">
              <div className="bg-surface-low rounded-xl px-3 py-2 text-sm"><span className="text-xs text-on-muted block mb-0.5">Bạn viết:</span><p style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{input||'(trống)'}</p></div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm"><span className="text-xs text-emerald-700 block mb-0.5">Đáp án:</span><p style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{seg.text}</p></div>
            </div>}
        {!checked ? <Button onClick={checkAnswer} disabled={!input.trim()} className="w-full">Kiểm tra</Button>
          : <div className="flex items-center justify-between">
              <span className="text-2xl font-bold" style={{color:scoreColor(scores[scores.length-1])}}>{scores[scores.length-1]}%</span>
              <Button onClick={next}>{idx+1<segments.length?'Tiếp theo':'Xem kết quả'}<span className="material-symbols-outlined text-base">arrow_forward</span></Button>
            </div>}
      </div>
    </div>
  );
}

function AudioShadowingTab({ audioUrl, segments }) {
  const audioRef = useRef(null);
  const [idx, setIdx]     = useState(0);
  const [scores, setScores] = useState({});
  const { recording, scoring, recErr, start, stop } = useRecorder(data => setScores(p => ({ ...p, [idx]: data })));

  if (!segments.length) return <p className="text-sm text-on-muted text-center py-12">Cần có transcript để luyện shadowing.</p>;
  const seg = segments[idx];
  const playSegment = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seg.start; audioRef.current.play();
    const check = () => { if (audioRef.current.currentTime >= seg.end) { audioRef.current.pause(); audioRef.current.removeEventListener('timeupdate', check); }};
    audioRef.current.addEventListener('timeupdate', check);
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} className="hidden"/>
      <div className="flex items-center gap-3">
        <span className="text-sm text-on-muted ml-auto">Đoạn {idx+1}/{segments.length}</span>
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <p className="text-lg leading-relaxed" style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{seg.text}</p>
        <p className="text-xs text-on-muted">{fmt(seg.start)} → {fmt(seg.end)}</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={playSegment} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low">
            <span className="material-symbols-outlined text-base">volume_up</span>Nghe đoạn
          </button>
          {!recording && !scoring && <button onClick={()=>start(seg.text)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tsubaki-red text-white text-sm font-semibold">
            <span className="material-symbols-outlined text-base">mic</span>Ghi âm (6s)
          </button>}
          {recording && <button onClick={stop} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold animate-pulse">
            <span className="material-symbols-outlined text-base">stop</span>Dừng
          </button>}
          {scoring && <div className="flex items-center gap-2 px-4 py-2 text-sm text-on-muted"><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Chấm điểm...</div>}
        </div>
        {recErr && <p className="text-sm text-tsubaki-red">{recErr}</p>}
        {scores[idx] && <div className="rounded-xl border border-outline bg-surface-low p-4 flex items-center gap-4">
          <ScoreRing score={scores[idx].score}/>
          <div><p className="font-semibold text-sm">{scores[idx].feedback}</p>
            {scores[idx].transcript && <p className="text-xs text-on-muted mt-1">「{scores[idx].transcript}」</p>}
          </div>
        </div>}
      </div>
      <div className="flex gap-2">
        <button disabled={idx===0} onClick={()=>setIdx(i=>i-1)} className="flex-1 py-2 rounded-xl border border-outline text-sm font-semibold disabled:opacity-30 hover:bg-surface-low flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-base">arrow_back</span>Trước
        </button>
        <button disabled={idx===segments.length-1} onClick={()=>setIdx(i=>i+1)} className="flex-1 py-2 rounded-xl bg-charcoal text-white text-sm font-semibold disabled:opacity-30 flex items-center justify-center gap-1">
          Tiếp<span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

// ─── User audio upload section ────────────────────────────────────────────────
function UserAudioSection({ onOpen }) {
  const [audios, setAudios]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm]       = useState({ title:'', level:'N5', language:'ja' });
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/listening/user-audio').then(r => setAudios(r.data)).finally(() => setLoading(false));
  }, []);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('title', form.title || file.name.replace(/\.[^.]+$/, ''));
      fd.append('level', form.level);
      fd.append('language', form.language);
      const r = await api.post('/listening/user-audio', fd, { headers:{ 'Content-Type':'multipart/form-data' }, timeout: 120000 });
      setAudios(prev => [r.data, ...prev]);
      setShowUpload(false); setForm({ title:'', level:'N5', language:'ja' });
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { alert(e.response?.data?.error || 'Tải lên thất bại.'); }
    finally { setUploading(false); }
  };

  const remove = async (id) => {
    if (!confirm('Xóa bài nghe này?')) return;
    await api.delete(`/listening/user-audio/${id}`);
    setAudios(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-muted">Tải lên file âm thanh của bạn — AI tự động tạo transcript.</p>
        <button onClick={()=>setShowUpload(v=>!v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-tsubaki-red text-white text-sm font-semibold rounded-xl">
          <span className="material-symbols-outlined text-base">{showUpload?'close':'upload'}</span>
          {showUpload?'Hủy':'Tải lên'}
        </button>
      </div>

      {showUpload && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="border-2 border-dashed border-outline rounded-xl p-6 text-center cursor-pointer hover:border-tsubaki-red/40 transition-colors"
            onClick={()=>fileRef.current?.click()}>
            <span className="material-symbols-outlined text-3xl text-on-muted/40 block mb-2">audio_file</span>
            <p className="text-sm text-on-muted">Chọn file âm thanh (MP3, WAV, M4A, WebM)</p>
            <p className="text-xs text-on-muted/60 mt-1">Tối đa 50MB</p>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-on-muted">Tên bài nghe</label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="VD: JLPT N5 Hội thoại 1"
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted">Cấp độ</label>
              <select value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm bg-white outline-none focus:border-tsubaki-red">
                {['N5','N4','N3','N2','N1'].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted">Ngôn ngữ trong file</label>
              <select value={form.language} onChange={e=>setForm(p=>({...p,language:e.target.value}))}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm bg-white outline-none focus:border-tsubaki-red">
                <option value="ja">Tiếng Nhật</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            </div>
          </div>
          <Button onClick={upload} loading={uploading} disabled={uploading} className="w-full">
            {uploading ? 'Đang tải & nhận dạng (có thể mất 30–60s)...' : 'Tải lên & tạo transcript'}
          </Button>
        </div>
      )}

      {loading && <div className="space-y-3">{[1,2].map(i=><div key={i} className="glass-card rounded-xl h-16 animate-pulse"/>)}</div>}
      {!loading && audios.length === 0 && (
        <div className="glass-card rounded-2xl py-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-muted/20 block mb-2">audio_file</span>
          <p className="text-sm text-on-muted">Chưa có bài nghe nào. Tải lên file âm thanh để bắt đầu.</p>
        </div>
      )}
      <div className="space-y-2">
        {audios.map(a => (
          <button key={a.id} onClick={()=>onOpen(a)}
            className="w-full glass-card rounded-xl p-3 text-left hover:shadow-md transition-all flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl text-on-muted">audio_file</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{a.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {a.level && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{background:LEVEL_BG[a.level],color:LEVEL_COLOR[a.level]}}>{a.level}</span>}
                <span className="text-xs text-on-muted">{a.segments?.length || 0} đoạn</span>
                <span className="text-xs text-on-muted">{new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <span className="material-symbols-outlined text-on-muted group-hover:text-tsubaki-red transition-colors">play_circle</span>
              <button onClick={e=>{e.stopPropagation();remove(a.id);}} className="w-7 h-7 rounded-lg hover:bg-red-50 hover:text-tsubaki-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Listening() {
  const [levelFilter, setLevelFilter] = useState('N5');
  const [dialogues, setDialogues]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState(null);
  const [tab, setTab]                 = useState('listen');

  useEffect(() => {
    if (levelFilter === 'user') return;
    setLoading(true);
    api.get(`/listening?level=${levelFilter}`)
      .then(r => setDialogues(r.data)).catch(() => setDialogues([]))
      .finally(() => setLoading(false));
  }, [levelFilter]);

  const openDialogue = async (dlg) => {
    const r = await api.get(`/listening/${dlg.id}`);
    setSelected({ ...r.data, _type: 'dialogue' }); setTab('listen');
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const openUserAudio = (audio) => {
    setSelected({ ...audio, _type:'user_audio' }); setTab('listen');
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const TABS = [
    { key:'listen',    icon:'headphones',   label:'Nghe' },
    { key:'dictation', icon:'edit',         label:'Chép chính tả' },
    { key:'shadowing', icon:'mic',          label:'Shadowing' },
  ];

  const isDialogue = selected?._type === 'dialogue';

  return (
    <StudentLayout title="Luyện nghe">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold">Luyện nghe hội thoại</h1>
          <p className="text-sm text-on-muted">Nghe → Chép chính tả → Shadowing với AI chấm phát âm.</p>
        </div>

        {selected ? (
          <div>
            <button onClick={()=>setSelected(null)} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1 mb-4">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {levelFilter==='user' ? 'Bài của tôi' : 'Danh sách hội thoại'}
            </button>
            <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: LEVEL_BG[selected.level] || '#f3f4f6' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: LEVEL_COLOR[selected.level] || '#6b7280' }}>
                  {isDialogue ? (selected.thumbnail_icon || 'headphones') : 'audio_file'}
                </span>
              </div>
              <div>
                <p className="font-bold text-lg" style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{selected.title}</p>
                <div className="flex items-center gap-2">
                  {selected.level && <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{background:LEVEL_BG[selected.level],color:LEVEL_COLOR[selected.level]}}>{selected.level}</span>}
                  {isDialogue && selected.title_vi && <span className="text-xs text-on-muted">{selected.title_vi}</span>}
                  {!isDialogue && <span className="text-xs text-on-muted">{selected.segments?.length || 0} đoạn</span>}
                </div>
              </div>
            </div>
            <div className="flex rounded-xl border border-outline p-1 mb-5 bg-surface-low gap-1">
              {TABS.map(({key,icon,label}) => (
                <button key={key} onClick={()=>setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${tab===key?'bg-white shadow text-charcoal':'text-on-muted hover:text-charcoal'}`}>
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </div>
            {isDialogue ? (
              <>
                {tab==='listen'    && <ListenTab    lines={selected.lines}/>}
                {tab==='dictation' && <DictationTab lines={selected.lines}/>}
                {tab==='shadowing' && <ShadowingTab lines={selected.lines}/>}
              </>
            ) : (
              <>
                {tab==='listen'    && <AudioListenTab    audioUrl={selected.audio_url} segments={selected.segments||[]}/>}
                {tab==='dictation' && <AudioDictationTab audioUrl={selected.audio_url} segments={selected.segments||[]}/>}
                {tab==='shadowing' && <AudioShadowingTab audioUrl={selected.audio_url} segments={selected.segments||[]}/>}
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {LEVELS.map(lv => (
                <button key={lv} onClick={()=>setLevelFilter(lv)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold shrink-0 border transition-all ${levelFilter===lv?'text-white border-transparent':'border-outline text-on-muted'}`}
                  style={levelFilter===lv?{background:LEVEL_COLOR[lv]}:{}}>
                  {lv}
                </button>
              ))}
              <button onClick={()=>setLevelFilter('user')}
                className={`px-4 py-1.5 rounded-full text-sm font-bold shrink-0 border transition-all ${levelFilter==='user'?'bg-charcoal text-white border-charcoal':'border-outline text-on-muted'}`}>
                Của tôi
              </button>
            </div>

            {levelFilter === 'user' ? (
              <UserAudioSection onOpen={openUserAudio}/>
            ) : (
              <>
                {loading && <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl h-20 animate-pulse"/>)}</div>}
                {!loading && dialogues.length===0 && (
                  <div className="glass-card rounded-2xl py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">headphones</span>
                    <p className="font-semibold">Chưa có hội thoại {levelFilter}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {dialogues.map(dlg => (
                    <button key={dlg.id} onClick={()=>openDialogue(dlg)}
                      className="w-full glass-card rounded-2xl p-4 text-left hover:shadow-md transition-all flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{background:LEVEL_BG[dlg.level]}}>
                        <span className="material-symbols-outlined text-2xl" style={{color:LEVEL_COLOR[dlg.level]}}>
                          {dlg.thumbnail_icon||'headphones'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg leading-tight" style={{fontFamily:"'Noto Sans JP',sans-serif"}}>{dlg.title}</p>
                        <p className="text-sm text-on-muted">{dlg.title_vi}</p>
                        {dlg.topic && <p className="text-xs text-on-muted/60 mt-0.5">{dlg.topic}</p>}
                      </div>
                      <span className="material-symbols-outlined text-on-muted group-hover:text-tsubaki-red transition-colors shrink-0">play_circle</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
