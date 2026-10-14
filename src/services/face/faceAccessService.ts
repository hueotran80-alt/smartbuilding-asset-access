import { supabase } from "../../lib/supabase";

export type FaceRecognitionResponse = {
  matched: boolean;
  user_id?: string | null;
  occupant_id?: string;
  matched_name?: string | null;
  room_id?: string;
  angle?: string;
  similarity?: number;
  threshold?: number;
  command_id?: string | null;
  error?: string;
};

export async function recognizeFace(
  cameraId: string,
  embedding: number[],
  openDoor = false,
): Promise<FaceRecognitionResponse> {
  if (embedding.length !== 128) {
    throw new Error("Embedding khuôn mặt phải có đúng 128 chiều.");
  }

  const { data, error } = await supabase.functions.invoke(
    "face-recognition",
    {
      body: {
        camera_id: cameraId,
        embedding,
        open_door: openDoor,
      },
    },
  );

  if (error) {
    const response = data as FaceRecognitionResponse | null;
    throw new Error(
      response?.error ??
        error.message ??
        "Không thể gọi dịch vụ nhận diện khuôn mặt.",
    );
  }

  if (!data) {
    throw new Error("Dịch vụ nhận diện không trả dữ liệu.");
  }

  return data as FaceRecognitionResponse;
}
