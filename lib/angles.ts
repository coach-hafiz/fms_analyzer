// Basic vector/angle utilities for 2D keypoints
export type Pt = {x:number,y:number,score?:number};

export const angle = (a:Pt,b:Pt,c:Pt) => {
  // angle ABC in degrees at point B
  const v1 = {x:a.x-b.x, y:a.y-b.y};
  const v2 = {x:c.x-b.x, y:c.y-b.y};
  const dot = v1.x*v2.x + v1.y*v2.y;
  const m1 = Math.hypot(v1.x,v1.y), m2 = Math.hypot(v2.x,v2.y);
  if (!m1 || !m2) return 0;
  const cos = Math.min(1, Math.max(-1, dot/(m1*m2)));
  return Math.abs((Math.acos(cos)*180)/Math.PI);
};

export const dist = (p:Pt,q:Pt)=>Math.hypot(p.x-q.x,p.y-q.y);

export const isBent = (deg:number, min:number=150)=>deg < min; // e.g., knees bent if knee angle < 150°
export const isStraight = (deg:number, max:number=170)=>deg > max;
export const rel = (p:Pt,q:Pt)=>({dx:q.x-p.x, dy:q.y-p.y}); // signs tell forward/back/left/right in image coords
