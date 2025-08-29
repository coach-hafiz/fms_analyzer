#!/usr/bin/env bash
set -euo pipefail

TFJS_VER="v4.16.0"
POSE_VER="3.6.1"

mkdir -p libs wasm models/movenet-thunder

echo "Downloading TensorFlow.js core + backends (local libs)…"
curl -L "https://www.gstatic.com/tfjs/${TFJS_VER}/tf.min.js" -o libs/tf.min.js
curl -L "https://www.gstatic.com/tfjs-backend-webgl/${TFJS_VER}/tf-backend-webgl.js" -o libs/tf-backend-webgl.js
curl -L "https://www.gstatic.com/tfjs-backend-wasm/${TFJS_VER}/tf-backend-wasm.js" -o libs/tf-backend-wasm.js

echo "Downloading Pose Detection wrapper…"
curl -L "https://www.gstatic.com/tfjs-models/pose-detection/${POSE_VER}/pose-detection.min.js" -o libs/pose-detection.min.js

echo "Downloading TFJS WASM binaries…"
curl -L "https://www.gstatic.com/tfjs-backend-wasm/${TFJS_VER}/tfjs-backend-wasm.wasm" -o wasm/tfjs-backend-wasm.wasm
curl -L "https://www.gstatic.com/tfjs-backend-wasm/${TFJS_VER}/tfjs-backend-wasm-simd.wasm" -o wasm/tfjs-backend-wasm-simd.wasm
curl -L "https://www.gstatic.com/tfjs-backend-wasm/${TFJS_VER}/tfjs-backend-wasm-threaded-simd.wasm" -o wasm/tfjs-backend-wasm-threaded-simd.wasm

echo "Downloading MoveNet Thunder model (model.json + shards)…"
BASE="https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/movenet/singlepose/thunder/4"
curl -L "${BASE}/model.json" -o models/movenet-thunder/model.json
curl -L "${BASE}/group1-shard1of2.bin" -o models/movenet-thunder/group1-shard1of2.bin
curl -L "${BASE}/group1-shard2of2.bin" -o models/movenet-thunder/group1-shard2of2.bin

echo "All assets fetched. Commit these folders to your repo:"
echo "  libs/  wasm/  models/movenet-thunder/"
