import React, {useEffect, useRef, useState} from 'react';
import { loadDetector, samplePosesFromVideo, FramePose } from '../lib/pose';
import { SKILLS, Criterion } from '../lib/criteria';

type Result = {id:string,label:string,pass?:boolean,evidence?:number[]};
type Props = {
  file: File,
  skillKey: keyof typeof SKILLS,
  onComplete: (results: Result[]) => void
};

export default function VideoAnalyzer({file, skillKey, onComplete}:Props){
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [frames, setFrames] = useState<FramePose[]>([]);

  useEffect(()=>{
    const url = URL.createObjectURL(file);
    const v = videoRef.current!;
    v.src = url; v.onloadeddata=()=>setReady(true);
    return ()=>URL.revokeObjectURL(url);
  },[file]);

  const run = async ()=>{
    setProgress(5);
    await loadDetector();
    setProgress(20);

    const v = videoRef.current!;
    const fps = 8;
    const duration = v.duration;
    const total = Math.floor(duration*fps);
    v.pause();

    for(let i=0;i<=total;i++){
      setProgress(20 + Math.round((i/total)*70)); // 20–90%
      const t = i/fps;
      v.currentTime = Math.min(t, Math.max(0, duration-0.05));
      await new Promise(r => { const onSeek=()=>{ v.removeEventListener('seeked', onSeek); r(null); }; v.addEventListener('seeked', onSeek); });
      const chunk = await samplePosesFromVideo(v, fps); // we’ll call our sampler once (fast path)
      setFrames(chunk);
      break; // sampler already did all frames; bail out of loop.
    }
    setProgress(92);
    // Evaluate
    const skill = SKILLS[skillKey];
    const evaluated = skill.criteria.map(c=>c.evaluate(frames));
    const results = skill.criteria.map((c,i)=>({id:c.id,label:c.label,pass:evaluated[i].pass,evidence:evaluated[i].evidence}));
    onComplete(results);
    setProgress(100);
  };

  return (
    <div className="card vstack">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <div className="hstack"><span className="badge">{SKILLS[skillKey].title}</span></div>
        <div className="hstack" style={{gap:8}}>
          <button onClick={run} disabled={!ready}>Analyze</button>
        </div>
      </div>

      <video ref={videoRef} controls style={{width:'100%',borderRadius:12}}/>

      <div className="progress"><div style={{width:`${progress}%`}}/></div>
    </div>
  );
}
