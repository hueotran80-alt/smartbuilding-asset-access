import { createFaceEmbedding, bestTemplateMatch } from "./faceEmbedding";
import { captureSquareFrame, detectFacesFromCanvas, type YuNetFace } from "./yunet";

const FRAME_SIZE = 640;

export type FacePose = "STRAIGHT" | "LEFT" | "RIGHT" | "UNKNOWN";

export type FaceQuality = {
  detectionScore: number;
  faceAreaRatio: number;
  eyeDistance: number;
  rollDegrees: number;
  yawScore: number;
  pose: FacePose;
  acceptable: boolean;
};

export type FaceFrameResult = {
  faces: YuNetFace[];
  embedding: number[] | null;
  similarity: number | null;
  quality: FaceQuality | null;
};

function distance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function evaluateFaceQuality(face: YuNetFace): FaceQuality {
  const [rightEye, leftEye, nose] = face.landmarks;
  const eyeDistance = distance(rightEye, leftEye);
  const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
  const yawScore = eyeDistance > 1 ? (nose[0] - eyeMidX) / eyeDistance : 0;
  const rollDegrees =
    (Math.atan2(leftEye[1] - rightEye[1], leftEye[0] - rightEye[0]) * 180) / Math.PI;
  const faceAreaRatio =
    Math.max(0, face.w) * Math.max(0, face.h) / (FRAME_SIZE * FRAME_SIZE);

  let pose: FacePose = "UNKNOWN";
  if (Math.abs(yawScore) <= 0.08) pose = "STRAIGHT";
  else if (yawScore >= 0.14) pose = "LEFT";
  else if (yawScore <= -0.14) pose = "RIGHT";

  const acceptable =
    Number.isFinite(face.score) &&
    face.score >= 0.70 &&
    faceAreaRatio >= 0.04 &&
    faceAreaRatio <= 0.70 &&
    eyeDistance >= 24 &&
    Math.abs(rollDegrees) <= 25;

  return {
    detectionScore: face.score,
    faceAreaRatio,
    eyeDistance,
    rollDegrees,
    yawScore,
    pose,
    acceptable,
  };
}

export function isFacePoseValidForEnrollment(
  quality: FaceQuality,
  expected: "STRAIGHT" | "LEFT" | "RIGHT",
) {
  if (!quality.acceptable) return false;
  if (expected === "STRAIGHT") return quality.pose === "STRAIGHT";
  return quality.pose === expected;
}

export async function analyzeFaceFrame(
  video: HTMLVideoElement,
  templates: number[][] = []
): Promise<FaceFrameResult> {
  const source = captureSquareFrame(video);
  const faces = await detectFacesFromCanvas(source);

  if (faces.length !== 1) {
    return { faces, embedding: null, similarity: null, quality: null };
  }

  const quality = evaluateFaceQuality(faces[0]);
  if (!quality.acceptable) {
    return { faces, embedding: null, similarity: null, quality };
  }

  const embedding = await createFaceEmbedding(source, faces[0]);
  const similarity = templates.length
    ? bestTemplateMatch(embedding, templates)
    : null;

  return { faces, embedding, similarity, quality };
}
