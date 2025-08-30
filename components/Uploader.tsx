import React from 'react';

export default function Uploader({onVideo}:{onVideo:(file:File)=>void}){
  return (
    <div className="card vstack">
      <div className="hstack">
        <input id="file" type="file" accept="video/*" onChange={e=>{
          const f=e.target.files?.[0]; if (f) onVideo(f);
        }}/>
      </div>
      <div className="muted">Upload a short clip (10–20s works best).</div>
    </div>
  );
}
