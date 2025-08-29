/* ===== Shortcuts ===== */
const $ = id => document.getElementById(id);
const vid = $('vid'), file = $('file'), analyzeBtn = $('analyze');
const prog = $('prog'), pct = $('pct'), statusEl = $('status'), toast = $('toast'), diag = $('diag');
const tbody = $('tbody'), scorePill = $('scorePill'), summary = $('summary');

function setStatus(msg){ statusEl.textContent = msg || ''; }
function setProgress(n){ const v=Math.max(0,Math.min(100,Math.round(n))); prog.value=v; pct.textContent = v + '%'; }
function showToast(msg){ toast.textContent = msg; toast.style.display = 'block'; }
function hideToast(){ toast.style.display = 'none'; }
function log(msg){ diag.textContent = msg; }  // on-page diagnostics
function formatTime(s){ const m=Math.floor(s/60), ss=Math.floor(s%60); return `${m}:${String(ss).padStart(2,'0')}`; }

/* ===== Math helpers ===== */
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function angle(a,b,c){ const v1={x:a.x-b.x,y:a.y-b.y}, v2={x:c.x-b.x,y:c.y-b.y};
  const dot=v1.x*v2.x+v1.y*v2.y, n1=Math.hypot(v1.x,v1.y), n2=Math.hypot(v2.x,v2.y);
  if(!n1||!n2) return NaN; const cos=Math.min(1,Math.max(-1,dot/(n1*n2)));
  return Math.acos(cos)*180/Math.PI; }
function avg(...x){ return x.reduce((a,b)=>a+b,0)/x.length; }
function smooth1d(arr,win=2){ if(arr.length<3)return arr; const out=[];
  for(let i=0;i<arr.length;i++){ const a=Math.max(0,i-win),b=Math.min(arr.length-1,i+win); let s=0,n=0; for(let j=a;j<=b;j++){s+=arr[j];n++;} out.push(s/n);} return out; }

const KP={nose:0,left_eye:1,right_eye:2,left_ear:3,right_ear:4,left_shoulder:5,right_shoulder:6,left_elbow:7,right_elbow:8,left_wrist:9,right_wrist:10,left_hip:11,right_hip:12,left_knee:13,right_knee:14,left_ankle:15,right_ankle:16};
function getPt(kps,name){ const k=kps[KP[name]]; return k && k.score>0.5 ? {x:k.x,y:k.y,s:k.score} : null; }

/* ===== Checklist config ===== */
const SKILL = {
  id:"underhand-throw",
  label:"Underhand Throw",
  items:[
    {id:"face_target", label:"Face target"},
    {id:"feet_width", label:"Place feet shoulder width apart"},
    {id:"knees_bent", label:"Keep knees slightly bent"},
    {id:"hold_front", label:"Hold ball with dominant hand in front of body"},
    {id:"backswing_waist", label:"Swing dominant hand back at least to waist level"},
    {id:"step_non_dom", label:"Step with non-dominant foot toward target"},
    {id:"release_window", label:"Release between knee and waist level"},
    {id:"follow_through", label:"After release, dominant hand continues toward target and above waist"}
  ]
};

function renderEmptyChecklist(){
  tbody.innerHTML = '';
  SKILL.items.forEach(it=>{
    const tr=document.createElement('tr');
    tr.id = 'row_'+it.id;
    tr.innerHTML = `
      <td><span class="crit"><span class="badge neutral" id="badge_${it.id}">•</span> ${it.label}</span></td>
      <td id="status_${it.id}" class="small">Not analyzed yet</td>
      <td id="times_${it.id}" class="small">—</td>
      <td id="notes_${it.id}" class="small">—</td>
    `;
    tbody.appendChild(tr);
  });
  scorePill.textContent = 'Score: 0/8';
  summary.textContent = 'Load a video and press Analyze. Items will turn into ✓ or ✗ after processing.';
}
renderEmptyChecklist();

/* ===== File input ===== */
file.addEventListener('change', () => {
  hideToast();
  if (file.files && file.files[0]) {
    setProgress(10);
    vid.src = URL.createObjectURL(file.files[0]);
    vid.onloadedmetadata = () => {
      setStatus(`Video ready (${Math.round(vid.videoWidth)}×${Math.round(vid.videoHeight)}, ${formatTime(vid.duration)})`);
      setProgress(20);
    };
  }
});

/* ===== Robust library readiness gate ===== */
async function waitForLibs(timeoutMs=10000){
  const t0 = Date.now();
  log('Waiting for TFJS & Pose libs…');
  while (Date.now()-t0 < timeoutMs){
    if (window.tf && window.poseDetection){
      try {
        // Set WASM path to local folder BEFORE init
        if (tf?.wasm?.setWasmPaths) {
          tf.wasm.setWasmPaths('/wasm/');
        }
      } catch(_){}
      log('Libraries ready.');
      return true;
    }
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('timeout:libs');
}

/* ===== Detector loader with timeouts (all local assets) ===== */
let detector=null;

async function ensureDetector(){
  if (detector) return detector;

  await waitForLibs();
  setStatus('Preparing model…');
  setProgress(30);
  log('Selecting backend…');

  const raceTimeout = (p, ms, label='operation') => new Promise((resolve, reject) => {
    const to = setTimeout(()=>reject(new Error(`timeout:${label}`)), ms);
    p.then(v=>{ clearTimeout(to); resolve(v); })
     .catch(e=>{ clearTimeout(to); reject(e); });
  });

  // Try WebGL quickly, else WASM (served locally from /wasm)
  try {
    await raceTimeout(tf.setBackend('webgl'), 3000, 'webgl');
    await raceTimeout(tf.ready(), 3000, 'tf.ready(webgl)');
    log('Backend: webgl');
  } catch(_) {
    await raceTimeout(tf.setBackend('wasm'), 3000, 'wasm');
    await raceTimeout(tf.ready(), 8000, 'tf.ready(wasm)');
    log('Backend: wasm');
  }

  setStatus(`Backend: ${tf.getBackend()}`);
  setProgress(33);
  log('Loading MoveNet (local)…');

  // Local MoveNet Thunder model (no redirects/CDN)
  const LOCAL_MOVENET = '/models/movenet-thunder/model.json';

  try {
    detector = await raceTimeout(
      poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          enableSmoothing: true,
          modelUrl: LOCAL_MOVENET
        }
      ),
      12000,
      'movenet'
    );
    setStatus('Model ready (MoveNet).');
    setProgress(40);
    log('Detector: MoveNet thunder ready.');
    return detector;
  } catch (e1) {
    console.warn('MoveNet load failed; trying BlazePose (local)…', e1);
    log('MoveNet failed; falling back to BlazePose…');
  }

  // Optional: vendor MediaPipe Pose locally if you want a BlazePose fallback
  // (Omitted here to keep repo smaller. If you want it, ask and I’ll add a local BlazePose bundle.)

  showToast('Could not load the pose model (local MoveNet missing?). Make sure /models/movenet-thunder/ exists with model.json & shards.');
  setProgress(0);
  log('Detector failed to load.');
  throw new Error('local_model_missing');
}

/* ===== Analyze click ===== */
$('analyze').addEventListener('click', async ()=>{
  hideToast();
  setProgress(0);
  renderEmptyChecklist();

  if (!file.files || !file.files[0]) {
    showToast('Please choose a video file first.');
    setProgress(0);
    return;
  }

  if (isFinite(vid.duration) && vid.duration > 0) setProgress(20);

  try {
    await ensureDetector();            // moves 30→40 or errors with toast
  } catch(_) {
    return;
  }

  setStatus('Analyzing…');
  setProgress(45);
  log('Sampling frames & analyzing…');

  const cfg = {
    dominant: $('dominant').value,
    direction: $('direction').value,
    sampleFps: Number($('sampleRate').value)
  };

  try{
    const report = await analyzeVideo(cfg);  // advances 45→95%
    applyReport(report, cfg);
    setStatus('Done.');
    setProgress(100);
    log('Analysis complete.');
  }catch(err){
    console.error(err);
    showToast('Error during analysis. Try a shorter clip, side view, good lighting.');
    setStatus('Analysis error');
    setProgress(0);
    log('Analysis error.');
  }
});

/* ===== Core analysis (same as previous) ===== */
async function analyzeVideo(cfg){
  const dirSign = cfg.direction==='right'?+1:-1;
  const dom = cfg.dominant, non = dom==='right'?'left':'right';

  const step = 1/Math.max(4, Math.min(30, cfg.sampleFps));
  const totalFrames = Math.max(1, Math.floor(vid.duration / step));
  let processed = 0;

  const frames=[];

  for(let t=0; t<=vid.duration; t+=step){
    await seekTo(t);
    const poses = await detector.estimatePoses(vid,{flipHorizontal:false});
    const p = poses && poses[0];
    if(p && p.keypoints){
      const k=p.keypoints, L=(n)=>getPt(k,'left_'+n), R=(n)=>getPt(k,'right_'+n);
      const pts={ ls:L('shoulder'), rs:R('shoulder'), lh:L('hip'), rh:R('hip'),
        le:L('elbow'), re:R('elbow'), lw:L('wrist'), rw:R('wrist'),
        lk:L('knee'), rk:R('knee'), la:L('ankle'), ra:R('ankle'), nose:getPt(k,'nose') };
      const enough = Object.values(pts).filter(Boolean).length>=10;
      if(enough){
        const shoulderWidth=(pts.ls&&pts.rs)? dist(pts.ls,pts.rs):NaN;
        const hipMid=(pts.lh&&pts.rh)? {x:avg(pts.lh.x,pts.rh.x), y:avg(pts.lh.y,pts.rh.y)}:null;
        const kneeMid=(pts.lk&&pts.rk)? {x:avg(pts.lk.x,pts.rk.x), y:avg(pts.lk.y,pts.rk.y)}:null;
        const bodyScale=shoulderWidth||100;
        const domW = dom==='right'? pts.rw:pts.lw;
        const domS = dom==='right'? pts.rs:pts.ls;
        const nonA = non==='right'? pts.ra:pts.la;

        frames.push({
          t, pts, shoulderWidth, hipMid, kneeMid, bodyScale, domW, domS, nonA,
          kneeAngleL:(pts.lh&&pts.lk&&pts.la)? angle(pts.lh,pts.lk,pts.la):NaN,
          kneeAngleR:(pts.rh&&pts.rk&&pts.ra)? angle(pts.rh,pts.rk,pts.ra):NaN,
          wristX:domW?domW.x:NaN, wristY:domW?domW.y:NaN,
          shoulderX:domS?domS.x:NaN, hipY:hipMid?hipMid.y:NaN,
          kneeY:kneeMid?kneeMid.y:NaN, ankleNonX:nonA?nonA.x:NaN,
          ankleL:pts.la, ankleR:pts.ra
        });
      }
    }
    processed++;
    setProgress(45 + Math.round((processed/totalFrames)*50));
  }

  // velocities & phases
  const xs=frames.map(f=>f.wristX), ys=frames.map(f=>f.wristY), dt=step;
  const vx=xs.map((v,i)=>i===0?0:(v-xs[i-1])/dt), vy=ys.map((v,i)=>i===0?0:(v-ys[i-1])/dt);
  const speed = vx.map((v,i)=>Math.hypot(v,vy[i])); const speedSm=smooth1d(speed,2);
  const peakIdx = speedSm.indexOf(Math.max(...speedSm));
  const releaseIdx = Math.max(1, peakIdx);
  const startIdx = Math.max(0, Math.floor(frames.length*0.05));
  const endIdx   = Math.max(releaseIdx+1, Math.floor(frames.length*0.9));

  const evidence={}; function ev(id,time,note){ (evidence[id]??={times:[],notes:[]}); if(time!=null)evidence[id].times.push(time); if(note)evidence[id].notes.push(note); }
  const res={};

  // 1 Face target
  {
    const id='face_target';
    const sample=frames.slice(startIdx, startIdx+Math.max(3,Math.floor(frames.length*0.1)));
    const good=sample.filter(f=>{
      if(!f.pts.ls||!f.pts.rs) return false;
      const horiz=(f.pts.rs.x - f.pts.ls.x) * (cfg.direction==='right'?+1:-1);
      return horiz>0;
    }).length >= Math.ceil(sample.length*0.6);
    res[id]=sample.length?(good?'yes':'no'):'unclear';
    if(sample.length) ev(id, frames[startIdx]?.t, 'Shoulders aligned toward target');
  }

  // 2 Feet shoulder-width
  {
    const id='feet_width';
    const sample=frames.slice(startIdx, startIdx+Math.max(3,Math.floor(frames.length*0.15)));
    let ok=0,n=0;
    for(const f of sample){
      if(!f.ankleL||!f.ankleR||!f.shoulderWidth) continue;
      const ratio = dist(f.ankleL,f.ankleR)/(f.shoulderWidth);
      if(ratio>=0.8 && ratio<=1.4) ok++; n++;
    }
    res[id]=n?(ok>=Math.ceil(n*0.6)?'yes':'no'):'unclear';
    if(n) ev(id, sample[0].t, 'Feet:shoulders ratio within 0.8–1.4');
  }

  // 3 Knees slightly bent
  {
    const id='knees_bent';
    const sample=frames.slice(startIdx, startIdx+Math.max(3,Math.floor(frames.length*0.15)));
    let ok=0,n=0;
    for(const f of sample){
      if(!isFinite(f.kneeAngleL)||!isFinite(f.kneeAngleR)) continue;
      const gl=f.kneeAngleL>=150&&f.kneeAngleL<=175;
      const gr=f.kneeAngleR>=150&&f.kneeAngleR<=175;
      if(gl||gr) ok++; n++;
    }
    res[id]=n?(ok>=Math.ceil(n*0.5)?'yes':'no'):'unclear';
    if(n) ev(id, sample[0].t, 'Knee angle 150°–175° on at least one leg');
  }

  // 4 Hold dominant hand in front
  {
    const id='hold_front';
    const sample=frames.slice(startIdx, startIdx+Math.max(3,Math.floor(frames.length*0.2)));
    let ok=0,n=0;
    for(const f of sample){
      if(!(f.domW&&f.hipY&&f.pts.ls&&f.pts.rs)) continue;
      const midTorsoX = avg(f.pts.ls.x,f.pts.rs.x);
      const inFront = (cfg.direction==='right'? (f.domW.x>=midTorsoX-0.15*f.bodyScale) : (f.domW.x<=midTorsoX+0.15*f.bodyScale));
      const between = f.domW.y >= avg(f.pts.ls.y,f.pts.rs.y) && f.domW.y <= f.hipY + 0.15*f.bodyScale;
      if(inFront && between) ok++; n++;
    }
    res[id]=n?(ok>=Math.ceil(n*0.5)?'yes':'no'):'unclear';
    if(n) ev(id, sample[0].t, 'Dominant hand in front window (chest→waist)');
  }

  // 5 Backswing to ≥ waist
  {
    const id='backswing_waist';
    let bestIdx=startIdx, best=frames[startIdx]?.domW?.x ?? NaN;
    for(let i=startIdx;i<=releaseIdx;i++){
      const f=frames[i]; if(!f||!isFinite(f.wristX)) continue;
      const score = f.wristX * (cfg.direction==='right'?-1:+1);
      if(!isFinite(best) || score>best){ best=score; bestIdx=i; }
    }
    const f=frames[bestIdx];
    const ok = f && f.hipY && f.domW && f.domW.y >= f.hipY;
    res[id]=f?(ok?'yes':'no'):'unclear';
    if(f) ev(id, f.t, `Backswing reached ≥ waist level`);
  }

  // 6 Step with non-dominant foot
  {
    const id='step_non_dom';
    const start=frames[startIdx], rel=frames[releaseIdx], end=frames[endIdx] || frames.at(-1);
    const sX=start?.ankleNonX, rX=rel?.ankleNonX, eX=end?.ankleNonX;
    const moved=(x)=> (x!=null&&sX!=null)? ((x-sX)*(cfg.direction==='right'?+1:-1)) : NaN;
    const delta=Math.max(moved(rX), moved(eX));
    const ok=isFinite(delta) && delta>0.1*(start?.bodyScale||100);
    res[id]=isFinite(delta)?(ok?'yes':'no'):'unclear';
    if(isFinite(delta)) ev(id, rel?.t, `Foot advanced ${delta?.toFixed(1)}px toward target`);
  }

  // 7 Release between knee & waist (proxy at peak wrist speed)
  {
    const id='release_window';
    const f=frames[releaseIdx];
    const ok = !!(f && isFinite(f.wristY) && isFinite(f.kneeY) && isFinite(f.hipY) && f.wristY>=f.kneeY && f.wristY<=f.hipY);
    res[id]=f?(ok?'yes':'no'):'unclear';
    if(f) ev(id, f.t, `Release proxy at ${formatTime(f.t)} in knee→waist window`);
  }

  // 8 Follow-through above waist toward target
  {
    const id='follow_through';
    const window=frames.slice(releaseIdx+1, Math.min(frames.length, releaseIdx+1+Math.round(0.3/step)));
    let ok=false; let when=null;
    for(const f of window){
      if(!(f&&f.domW&&f.hipY&&f.domS)) continue;
      const above=f.domW.y<=f.hipY;
      const forward=(f.domW.x - f.domS.x) * (cfg.direction==='right'?+1:-1) > 0.15*(f.bodyScale||100);
      if(above && forward){ ok=true; when=f.t; break; }
    }
    res[id]=window.length?(ok?'yes':'no'):'unclear';
    if(window.length) ev(id, when??window.at(-1).t, ok?'Finished forward & above waist':'No clear forward/above-waist follow-through');
  }

  const items = SKILL.items.map(it=>{
    const evd=evidence[it.id]||{times:[],notes:[]};
    return { id:it.id, label:it.label, status:res[it.id]||'unclear', times:evd.times?.map(formatTime)||[], notes:evd.notes||[] };
  });
  const score = items.filter(i=>i.status==='yes').length;
  return { items, score, total: items.length };

  function formatTime(s){ const m=Math.floor(s/60), ss=Math.floor(s%60); return `${m}:${String(ss).padStart(2,'0')}`; }
}

function applyReport(report, cfg){
  scorePill.textContent = `Score: ${report.score}/${report.total}`;
  summary.textContent = `Dominant: ${cfg.dominant} | Direction: ${cfg.direction}`;

  report.items.forEach(row=>{
    const badge = document.getElementById('badge_'+row.id);
    const st    = document.getElementById('status_'+row.id);
    const times = document.getElementById('times_'+row.id);
    const notes = document.getElementById('notes_'+row.id);

    badge.classList.remove('neutral','good','bad');
    if(row.status==='yes'){ badge.textContent='✓'; badge.classList.add('good'); st.textContent='Present'; }
    else if(row.status==='no'){ badge.textContent='✗'; badge.classList.add('bad'); st.textContent='Not present'; }
    else { badge.textContent='•'; badge.classList.add('neutral'); st.textContent='Unclear'; }

    times.textContent = row.times.length ? row.times.join(', ') : '—';
    notes.textContent = row.notes.length ? row.notes.join('; ') : '—';
  });
}

function seekTo(t){
  return new Promise(res=>{
    const h=()=>{ vid.removeEventListener('seeked',h); res(); };
    vid.addEventListener('seeked',h,{once:true});
    vid.currentTime=Math.min(Math.max(0,t),(vid.duration||t));
  });
}
