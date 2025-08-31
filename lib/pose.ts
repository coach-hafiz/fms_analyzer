import * as poseDetection from '@tensorflow-models/pose-detection';

export type FramePose = poseDetection.Pose;

let detector: poseDetection.PoseDetector | null = null;

export async function loadDetector(){
  if(detector) return;
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    modelUrl: '/models/movenet/model.json'
  });
}

export async function samplePosesFromVideo(video:HTMLVideoElement, fps:number){
  const duration = video.duration;
  const totalFrames = Math.floor(duration * fps);
  const poses:poseDetection.Pose[] = [];

  for(let i=0; i<totalFrames; i++){
    const t = i/fps;
    video.currentTime = Math.min(t, Math.max(0, duration-0.05));
    await new Promise(r => { const onSeek=()=>{ video.removeEventListener('seeked', onSeek); r(null); }; video.addEventListener('seeked', onSeek); });
    const result = await detector!.estimatePoses(video, {maxPoses:1, flipHorizontal:false});
    if(result.length > 0) poses.push(result[0]);
  }
  return poses;
}
