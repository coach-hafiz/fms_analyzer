import { angle, isBent, isStraight, Pt } from './angles';
import { FramePose } from './pose';

type K = 'nose'|'left_eye'|'right_eye'|'left_ear'|'right_ear'|'left_shoulder'|'right_shoulder'|'left_elbow'|'right_elbow'|'left_wrist'|'right_wrist'|'left_hip'|'right_hip'|'left_knee'|'right_knee'|'left_ankle'|'right_ankle';

const kp = (f:FramePose,k:K) => {
  const map:Record<K, number> = {
    nose:0,left_eye:1,right_eye:2,left_ear:3,right_ear:4,
    left_shoulder:5,right_shoulder:6,left_elbow:7,right_elbow:8,
    left_wrist:9,right_wrist:10,left_hip:11,right_hip:12,
    left_knee:13,right_knee:14,left_ankle:15,right_ankle:16
  };
  // @ts-ignore
  return f.keypoints[map[k]] as Pt;
};

export type Criterion = {
  id: string;
  label: string;
  evaluate: (frames: FramePose[]) => { pass:boolean, evidence:number[] }; // evidence = indices of passing frames
};

function majority(frames:boolean[], thresh=0.6){
  const trues = frames.filter(Boolean).length;
  return trues/frames.length >= thresh;
}

/** ----------- Reusable micro-checks ------------ */
const kneesSlightlyBent:Criterion = {
  id:'knees_bent',
  label:'Keep knees slightly bent',
  evaluate(frames){
    const marks = frames.map(f=>{
      const L = angle(kp(f,'hip','left_hip' as any as K), kp(f,'left_knee'), kp(f,'left_ankle'));
      const R = angle(kp(f,'right_hip'), kp(f,'right_knee'), kp(f,'right_ankle'));
      return isBent(L, 165) || isBent(R, 165);
    });
    const idx = frames.map((_,i)=>marks[i] ? i : -1).filter(i=>i>=0);
    return { pass: majority(marks), evidence: idx };
  }
};

const feetShoulderWidth:Criterion = {
  id:'feet_sw',
  label:'Place feet shoulder width apart',
  evaluate(frames){
    const marks = frames.map(f=>{
      const hipW = Math.abs(kp(f,'right_hip').x - kp(f,'left_hip').x);
      const ankleW = Math.abs(kp(f,'right_ankle').x - kp(f,'left_ankle').x);
      return ankleW > 0.6*hipW && ankleW < 1.8*hipW;
    });
    const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
    return { pass: majority(marks), evidence: idx };
  }
};

const handsInFront:Criterion = {
  id:'hands_front',
  label:'Keep hands in front of body',
  evaluate(frames){
    const marks = frames.map(f=>{
      const midHipX = (kp(f,'left_hip').x + kp(f,'right_hip').x)/2;
      const lw = kp(f,'left_wrist').x, rw = kp(f,'right_wrist').x;
      // “front” in camera space ≈ between shoulders and ahead of hips (heuristic)
      const lx = Math.abs(lw - midHipX), rx = Math.abs(rw - midHipX);
      return lx < 0.35 && rx < 0.35; // normalized by image width in TFJS keypoints [0..1]
    });
    const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
    return { pass: majority(marks), evidence: idx };
  }
};

const elbowsExtendForward:Criterion = {
  id:'elbow_extend',
  label:'Extend arms forward and release toward target',
  evaluate(frames){
    const marks = frames.map(f=>{
      const le = angle(kp(f,'left_shoulder'), kp(f,'left_elbow'), kp(f,'left_wrist'));
      const re = angle(kp(f,'right_shoulder'), kp(f,'right_elbow'), kp(f,'right_wrist'));
      return isStraight(le, 165) || isStraight(re, 165);
    });
    const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
    return { pass: majority(marks), evidence: idx };
  }
};

/** ------------- Skill definitions (add more over time) ------------ */

export const SKILLS: Record<string, {title:string, criteria:Criterion[]}> = {
  "bounce_stationary": {
    title: "Bounce (stationary)",
    criteria: [
      { id:'nd_foot_fwd', label:'Place non-dominant foot forward', evaluate(frames){
          const marks = frames.map(f=>{
            const lw = kp(f,'left_wrist'), rw = kp(f,'right_wrist');
            const lh = kp(f,'left_hip'), rh = kp(f,'right_hip');
            const leftHandDominant = (lw.x < rw.x) === (lh.x < rh.x) ? false : false; // unknown; fallback heuristic:
            // We’ll approximate “non-dominant foot forward” as any split-stance (one ankle ahead of the other)
            const ya = kp(f,'left_ankle').y - kp(f,'right_ankle').y;
            return Math.abs(ya) > 0.02;
          });
          const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
          return { pass: majority(marks), evidence: idx };
      }},
      kneesSlightlyBent,
      handsInFront,
      { id:'wrist_flex', label:'Flex dominant wrist and extend elbow downward', evaluate(frames){
          const marks = frames.map(f=>{
            const re = angle(kp(f,'right_shoulder'), kp(f,'right_elbow'), kp(f,'right_wrist'));
            const le = angle(kp(f,'left_shoulder'),  kp(f,'left_elbow'),  kp(f,'left_wrist'));
            return isStraight(re,160) || isStraight(le,160);
          });
          const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
          return { pass: majority(marks), evidence: idx };
      }},
      { id:'finger_pads', label:'Contact ball using finger pads at waist level or below', evaluate(frames){
          const marks = frames.map(f=>{
            const midHipY = (kp(f,'left_hip').y + kp(f,'right_hip').y)/2;
            const lw = kp(f,'left_wrist').y, rw = kp(f,'right_wrist').y;
            return (lw > midHipY*0.95) || (rw > midHipY*0.95);
          });
          const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
          return { pass: majority(marks), evidence: idx };
      }}
    ]
  },
  "overhand_throw": {
    title: "Overhand Throw",
    criteria: [
      feetShoulderWidth,
      kneesSlightlyBent,
      { id:'hold_dominant_front', label:'Hold ball with dominant hand in front', evaluate: handsInFront.evaluate },
      { id:'elbow_up', label:'Elbow rises to shoulder height or higher', evaluate(frames){
          const marks = frames.map(f=>{
            const r = kp(f,'right_elbow').y, l = kp(f,'left_elbow').y;
            const rS = kp(f,'right_shoulder').y, lS = kp(f,'left_shoulder').y;
            return (r <= rS*1.02) || (l <= lS*1.02);
          });
          const idx = frames.map((_,i)=>marks[i]?i:-1).filter(i=>i>=0);
          return { pass: majority(marks), evidence: idx };
      }},
      elbowsExtendForward
    ]
  }
};
