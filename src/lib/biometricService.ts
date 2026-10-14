import { supabase } from "./supabase";

export type BiometricCredential = {
  id: string;
  occupantId: string;
  biometricType: string;
  credentialId: string | null;
  isActive: boolean;
};

export async function getBiometricCredentials(): Promise<
  BiometricCredential[]
> {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình.");
  }

  const { data, error } = await supabase
    .from("biometric_credentials")
    .select(
      "id,occupant_id,biometric_type,credential_id,is_active"
    )
    .eq("is_active", true);

  if (error) {
    throw new Error(
      "Không đọc được danh sách sinh trắc học: " + error.message
    );
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    occupantId: item.occupant_id,
    biometricType: item.biometric_type,
    credentialId: item.credential_id,
    isActive: item.is_active,
  }));
}

export async function deleteBiometricCredential(
  biometricId: string
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình.");
  }

  const { data: biometric, error: biometricError } =
    await supabase
      .from("biometric_credentials")
      .select("id,credential_id")
      .eq("id", biometricId)
      .single();

  if (biometricError) {
    throw new Error(
      "Không tìm thấy thông tin vân tay: " +
        biometricError.message
    );
  }

  if (biometric?.credential_id) {
    const { error: webauthnError } = await supabase
      .from("webauthn_credentials")
      .delete()
      .eq("credential_id", biometric.credential_id);

    if (webauthnError) {
      throw new Error(
        "Không thể xóa WebAuthn credential: " +
          webauthnError.message
      );
    }
  }

  const { error } = await supabase
    .from("biometric_credentials")
    .delete()
    .eq("id", biometricId);

  if (error) {
    throw new Error(
      "Không thể xóa vân tay: " + error.message
    );
  }
}
