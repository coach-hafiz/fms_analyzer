export type Pt = {x:number, y:number, score?:number};

export function angle(p1:Pt, p2:Pt, p3:Pt){
  const a = Math.sqrt((p2.x-p3.x)**2 + (p2.y-p3.y)**2);
  const b = Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2);
  const c = Math.sqrt((p1.x-p3.x)**2 + (p1.y-p3.y)**2);
  return Math.acos((a**2 + b**2 - c**2)/(2*a*b)) * 180/Math.PI;
}

export function isBent(angle:number, threshold=160){
  return angle < threshold;
}

export function isStraight(angle:number, threshold=160){
  return angle >= threshold;
}
