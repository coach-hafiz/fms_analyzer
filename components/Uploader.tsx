import React from 'react';

export default function Uploader({onVideo}:{onVideo:(f:File)=>void}){
  return (
    <div className="vstack" style={{gap:8}}>
      <label>Video:</label>
      <input type="file" accept="video/*" onChange={e=>onVideo(e.target.files![0])}/>
    </div>
  );
}
