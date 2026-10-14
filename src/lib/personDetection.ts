import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

export interface PersonDetection {
  count: number;
  confidence: number;
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export function loadPersonDetectionModel() {
  if (!modelPromise) {
    modelPromise = cocoSsd.load();
  }

  return modelPromise;
}

export async function detectPersons(
  video: HTMLVideoElement
): Promise<PersonDetection> {
  const model =
    await loadPersonDetectionModel();

  const predictions =
    await model.detect(video);

  const persons = predictions.filter(
    (prediction) =>
      prediction.class === "person" &&
      prediction.score >= 0.5
  );

  return {
    count: persons.length,
    confidence:
      persons.length > 0
        ? Math.max(
            ...persons.map(
              (person) => person.score
            )
          )
        : 0,
    boxes: persons.map(
      (person) => ({
        x: person.bbox[0],
        y: person.bbox[1],
        width: person.bbox[2],
        height: person.bbox[3],
      })
    ),
  };
}
