import React from 'react';

type Item = { id:string, label:string, pass?:boolean, evidence?:number[] };

export default function Checklist({items}:{items:Item[]}){
  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr><th>Performance Criteria / Critical Features</th><th>Result</th><th>Frames</th></tr>
        </thead>
        <tbody>
          {items.map(it=>(
            <tr key={it.id}>
              <td>{it.label}</td>
              <td>{it.pass===undefined? <span className="badge">pending</span> : it.pass ? '✅' : '❌'}</td>
              <td>{(it.evidence?.slice(0,6) ?? []).join(', ')}{(it?.evidence && it.evidence.length>6)?'…':''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
