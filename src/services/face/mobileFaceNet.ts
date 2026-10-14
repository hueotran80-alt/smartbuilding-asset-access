import type * as Ort from "onnxruntime-web/wasm";
import wasmMjsUrl from "./ort/ort-wasm-simd-threaded.mjs?url";
const wasmBinaryUrl = "/ort/ort-wasm-simd-threaded.wasm";

const SIZE = 112;
type OrtModule = typeof import("onnxruntime-web/wasm");
let ortModulePromise: Promise<OrtModule> | null = null;

// Load the heavy ONNX runtime only when face matching is actually requested.
// This keeps the login/app shell compatible with older Android WebViews that
// cannot parse BigInt syntax shipped by ONNX Runtime.
function getOrtModule(): Promise<OrtModule> {
  if (!ortModulePromise) {
    ortModulePromise = import("onnxruntime-web/wasm").then((ort) => {
      ort.env.wasm.wasmPaths = { mjs: wasmMjsUrl, wasm: wasmBinaryUrl };
      return ort;
    });
  }
  return ortModulePromise;
}

let sessionPromise: Promise<Ort.InferenceSession> | null = null;

export async function loadMobileFaceNet() {
  if (!sessionPromise) {
    sessionPromise = getOrtModule().then((ort) =>
      ort.InferenceSession.create(
        "/models/mobilefacenet/mobile_facenet.onnx",
        {
          executionProviders: ["wasm"],
          externalData: [{
            path: "./mobile_facenet.data",
            data: "/models/mobilefacenet/mobile_facenet.data"
          }]
        }
      )
    );
  }
  return sessionPromise;
}

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

function l2Normalize(values: number[]) {
  let norm = 0;
  for (const value of values) norm += value * value;
  norm = Math.sqrt(norm);

  if (!Number.isFinite(norm) || norm <= 1e-12) {
    throw new Error("Embedding MobileFaceNet có norm không hợp lệ");
  }

  return values.map((value) => value / norm);
}

export async function embeddingFromCanvas(canvas: HTMLCanvasElement) {
  const [session, ort] = await Promise.all([loadMobileFaceNet(), getOrtModule()]);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Không đọc được face canvas");

  if (canvas.width !== SIZE || canvas.height !== SIZE) {
    throw new Error("MobileFaceNet yêu cầu face crop 112x112");
  }

  const image = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const plane = SIZE * SIZE;
  const input = new Float32Array(plane * 3);

  // Model Qualcomm AI Hub này dùng chuẩn ImageNet RGB:
  // (pixel - mean) / std, với pixel trước đó nằm trong [0,1].
  for (let i = 0; i < plane; i++) {
    const r = image[i * 4] / 255;
    const g = image[i * 4 + 1] / 255;
    const b = image[i * 4 + 2] / 255;

    input[i] = (r - MEAN[0]) / STD[0];
    input[plane + i] = (g - MEAN[1]) / STD[1];
    input[plane * 2 + i] = (b - MEAN[2]) / STD[2];
  }

  const tensor = new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]);
  const feeds: Record<string, Ort.Tensor> = {};

  if (session.inputNames.length !== 2) {
    throw new Error(
      "MobileFaceNet phiên bản hiện tại cần 2 input, nhận được " +
        session.inputNames.length,
    );
  }

  // Model tự thực hiện test-time augmentation (ảnh gốc + lật ngang)
  // và trả 2 embedding 128D; lấy embedding của input đầu tiên.
  feeds[session.inputNames[0]] = tensor;
  feeds[session.inputNames[1]] = tensor;

  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];
  const raw = Array.from(output.data as Float32Array);

  if (raw.length < 128) {
    throw new Error("MobileFaceNet không trả embedding 128D");
  }

  return l2Normalize(raw.slice(0, 128));
}
