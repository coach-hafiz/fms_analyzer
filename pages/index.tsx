import React, { useState } from 'react';
import '../styles.css';
import Uploader from '../components/Uploader';
import Checklist from '../components/Checklist';
import VideoAnalyzer from '../components/VideoAnalyzer';
import { SKILLS } from '../lib/criteria';

type SkillKey = keyof typeof SKILLS;
type Result = {id:string,label:string,pass?:boolean,evidence?:number[]};

export default function Home(){
  const [file, setFile] = useState<File|null>(null);
  const [skill, setSkill] = useState<SkillKey>('bounce_stationary');
  const [items, setItems] = useState<Result[]>(SKILLS[skill].criteria.map(c=>({id:c.id,label:c.label})));

  const exportCSV = ()=>{
    const rows = [['Criterion','Pass']];
    items.forEach(r=>rows.push([r.label, r.pass?'YES':'NO']));
    const csv = rows.map(r=>r.map(s=>`"${s}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'analysis.csv'; a.click();
  };

  return (
    <main className="main">
      <h1>Fundamental Movement Skills Analyzer</h1>
      <div className="card vstack">
        <div className="hstack">
          <label>Skill:&nbsp;</label>
          <select value={skill} onChange={(e)=>{
            const k = e.target.value as SkillKey;
            setSkill(k);
            setItems(SKILLS[k].criteria.map(c=>({id:c.id,label:c.label})));
          }}>
            {(Object.keys(SKILLS) as SkillKey[]).map(k=>
              <option key={k} value={k}>{SKILLS[k].title}</option>
            )}
          </select>
        </div>
        <Uploader onVideo={setFile}/>
      </div>

      {file && (
        <>
          <VideoAnalyzer file={file} skillKey={skill} onComplete={setItems}/>
          <Checklist items={items}/>
          <div className="card hstack" style={{justifyContent:'flex-end'}}>
            <button onClick={exportCSV} disabled={items.every(r=>r.pass===undefined)}>Export CSV</button>
          </div>
        </>
      )}

      {!file && <div className="card">Upload a clip to get started. The checklist will stay visible and update to ✅/❌ after analysis.</div>}
    </main>
  );
}
