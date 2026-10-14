import type * as Ort from "onnxruntime-web/wasm";
import wasmMjsUrl from "./ort/ort-wasm-simd-threaded.mjs?url";
const wasmBinaryUrl = "/ort/ort-wasm-simd-threaded.wasm";

type OrtModule = typeof import("onnxruntime-web/wasm");
let ortModulePromise: Promise<OrtModule> | null = null;

function getOrtModule(): Promise<OrtModule> {
  if (!ortModulePromise) {
    ortModulePromise = import("onnxruntime-web/wasm").then((ort) => {
      ort.env.wasm.wasmPaths = { mjs: wasmMjsUrl, wasm: wasmBinaryUrl };
      return ort;
    });
  }
  return ortModulePromise;
}

export type FaceLandmark = [number, number];
export type YuNetFace = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  landmarks: FaceLandmark[];
};

const SIZE = 640;
const CONF = 0.6;
const NMS = 0.3;

let sessionPromise: Promise<Ort.InferenceSession> | null = null;

export async function loadYuNet() {
  if (!sessionPromise) {
    sessionPromise = getOrtModule().then((ort) =>
      ort.InferenceSession.create(
        "/models/yunet/face_detection_yunet_2023mar.onnx",
        { executionProviders: ["wasm"] }
      )
    );
  }
  return sessionPromise;
}

function iou(a: YuNetFace, b: YuNetFace) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return inter / (union + 1e-6);
}

function nms(faces: YuNetFace[]) {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const result: YuNetFace[] = [];
  while (sorted.length) {
    const current = sorted.shift()!;
    result.push(current);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(current, sorted[i]) >= NMS) sorted.splice(i, 1);
    }
  }
  return result;
}

function decode(results: Record<string, Ort.Tensor>) {
  const faces: YuNetFace[] = [];
  for (const stride of [8, 16, 32]) {
    const cls = results[`cls_${stride}`]?.data;
    const obj = results[`obj_${stride}`]?.data;
    const bbox = results[`bbox_${stride}`]?.data;
    const kps = results[`kps_${stride}`]?.data;
    if (!cls || !obj || !bbox || !kps) continue;
    const cols = SIZE / stride;
    const rows = SIZE / stride;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const i = r * cols + col;
        const score = Math.sqrt(
          Math.min(1, Math.max(0, Number(cls[i]))) *
          Math.min(1, Math.max(0, Number(obj[i])))
        );
        if (score < CONF) continue;
        const cx = (col + Number(bbox[i * 4])) * stride;
        const cy = (r + Number(bbox[i * 4 + 1])) * stride;
        const w = Math.exp(Number(bbox[i * 4 + 2])) * stride;
        const h = Math.exp(Number(bbox[i * 4 + 3])) * stride;
        const landmarks: FaceLandmark[] = [];
        for (let k = 0; k < 5; k++) {
          landmarks.push([
            (Number(kps[i * 10 + k * 2]) + col) * stride,
            (Number(kps[i * 10 + k * 2 + 1]) + r) * stride
          ]);
        }
        faces.push({ x: cx - w / 2, y: cy - h / 2, w, h, score, landmarks });
      }
    }
  }
  return nms(faces);
}

export function captureSquareFrame(video: HTMLVideoElement): HTMLCanvasElement {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error("Camera chưa có kích thước khung hình hợp lệ");
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Không tạo được canvas YuNet");

  // Giữ nguyên tỉ lệ 4:3 của camera, không kéo méo khuôn mặt thành 1:1.
  const scale = Math.min(SIZE / video.videoWidth, SIZE / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  const offsetX = (SIZE - drawWidth) / 2;
  const offsetY = (SIZE - drawHeight) / 2;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

  return canvas;
}

export async function detectFacesFromCanvas(canvas: HTMLCanvasElement): Promise<YuNetFace[]> {
  const [session, ort] = await Promise.all([loadYuNet(), getOrtModule()]);
  if (canvas.width !== SIZE || canvas.height !== SIZE) {
    throw new Error("Canvas YuNet phải có kích thước 640x640");
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Không đọc được canvas YuNet");

  const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const plane = SIZE * SIZE;
  const input = new Float32Array(plane * 3);

  for (let i = 0; i < plane; i++) {
    input[i] = pixels[i * 4 + 2];
    input[plane + i] = pixels[i * 4 + 1];
    input[plane * 2 + i] = pixels[i * 4];
  }

  const tensor = new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  return decode(results as Record<string, Ort.Tensor>);
}

export async function detectFaces(video: HTMLVideoElement): Promise<YuNetFace[]> {
  return detectFacesFromCanvas(captureSquareFrame(video));
}
