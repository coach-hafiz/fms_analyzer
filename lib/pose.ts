import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as posedetection from '@tensorflow-models/pose-detection';

let detector: posedetection.PoseDetector | null = null;

export async function loadDetector() {
  await tf.setBackend('webgl');
  await tf.ready();
  detector = await posedetection.createDetector(
    posedetection.SupportedModels.MoveNet,
    {
      modelType: posedetection.movenet.modelType.SINGLEPOSE_THUNDER,
      enableSmoothing: true,
      modelUrl: '/models/movenet/model.json'   // self-hosted
    }
  );
  return detector;
}

export type FramePose = {
  t: number;           // seconds into video
  keypoints: posedetection.Keypoint[];
  score: number;
};

export async function samplePosesFromVideo(video: HTMLVideoElement, fps=8): Promise<FramePose[]> {
  if (!detector) throw new Error('Detector not loaded');
  const frames: FramePose[] = [];
  const total = Math.floor(video.duration * fps);
  const originalPlayback = video.playbackRate;
  video.pause();
  for (let i=0;i<=total;i++){
    const t = i/fps;
    video.currentTime = Math.min(t, Math.max(0, video.duration-0.05));
    // wait for seek
    await new Promise(r => { const onSeek=()=>{ video.removeEventListener('seeked', onSeek); r(null); }; video.addEventListener('seeked', onSeek); });
    const poses = await detector.estimatePoses(video, {flipHorizontal:false});
    if (poses[0]) {
      frames.push({ t, keypoints: poses[0].keypoints, score: poses[0].score ?? 0 });
    }
  }
  video.playbackRate = originalPlayback;
  return frames;
}
