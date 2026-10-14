import { alignFace } from "./faceAlignment";
import { embeddingFromCanvas } from "./mobileFaceNet";
import type { YuNetFace } from "./yunet";

export async function createFaceEmbedding(
  source: HTMLCanvasElement,
  face: YuNetFace
) {
  const aligned = alignFace(source, face);
  return embeddingFromCanvas(aligned);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  const denominator = Math.sqrt(aa) * Math.sqrt(bb);
  return denominator > 0 ? dot / denominator : 0;
}

export function bestTemplateMatch(
  current: number[],
  templates: number[][]
) {
  let best = 0;
  for (const template of templates) {
    best = Math.max(best, cosineSimilarity(current, template));
  }
  return best;
}
