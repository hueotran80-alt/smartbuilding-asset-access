import type { FaceLandmark, YuNetFace } from "./yunet";

const SIZE = 112;

// Chuẩn 5 điểm thường dùng cho face embedding 112x112.
// YuNet: mắt phải, mắt trái, mũi, khóe miệng phải, khóe miệng trái.
const TARGET: FaceLandmark[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

function similarityTransform(
  src: FaceLandmark[],
  dst: FaceLandmark[],
) {
  if (src.length !== 5 || dst.length !== 5) {
    throw new Error("Cần đúng 5 landmarks để căn chỉnh khuôn mặt");
  }

  let srcX = 0;
  let srcY = 0;
  let dstX = 0;
  let dstY = 0;

  for (let i = 0; i < 5; i++) {
    srcX += src[i][0];
    srcY += src[i][1];
    dstX += dst[i][0];
    dstY += dst[i][1];
  }

  srcX /= 5;
  srcY /= 5;
  dstX /= 5;
  dstY /= 5;

  let denom = 0;
  let a = 0;
  let b = 0;

  for (let i = 0; i < 5; i++) {
    const x = src[i][0] - srcX;
    const y = src[i][1] - srcY;
    const X = dst[i][0] - dstX;
    const Y = dst[i][1] - dstY;

    denom += x * x + y * y;
    a += x * X + y * Y;
    b += x * Y - y * X;
  }

  if (denom < 1e-6) {
    throw new Error("Landmark geometry không hợp lệ");
  }

  a /= denom;
  b /= denom;

  return {
    a,
    b,
    c: -b,
    d: a,
    e: dstX - (a * srcX - b * srcY),
    f: dstY - (b * srcX + a * srcY),
  };
}

export function alignFace(source: HTMLCanvasElement, face: YuNetFace) {
  if (face.landmarks.length < 5) {
    throw new Error("Thiếu 5 landmarks để căn chỉnh");
  }

  const out = document.createElement("canvas");
  out.width = SIZE;
  out.height = SIZE;

  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Không tạo được canvas alignment");

  const m = similarityTransform(face.landmarks.slice(0, 5), TARGET);

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return out;
}
