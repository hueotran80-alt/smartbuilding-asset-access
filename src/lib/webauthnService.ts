import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import { supabase } from "./supabase";

async function getAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình.");
  }

  const { data, error } =
    await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error(
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    );
  }

  return data.session.access_token;
}

/**
 * ĐĂNG KÝ SINH TRẮC HỌC ĐIỆN THOẠI
 * Face ID / Touch ID / vân tay / Passkey
 */
export async function registerPhoneBiometric(memberId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!supabase) {
      return {
        success: false,
        error: "Supabase chưa được cấu hình.",
      };
    }

    // WebAuthn bắt buộc phải chạy trong Secure Context.
    // Vercel HTTPS được hỗ trợ.
    if (!window.isSecureContext) {
      return {
        success: false,
        error:
          "Đăng ký sinh trắc học cần kết nối HTTPS. Hãy mở ứng dụng bằng địa chỉ Vercel.",
      };
    }

    // Kiểm tra trình duyệt có hỗ trợ WebAuthn hay không.
    if (
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential !== "function"
    ) {
      return {
        success: false,
        error:
          "Thiết bị hoặc trình duyệt này không hỗ trợ Face ID, vân tay hoặc Passkey.",
      };
    }

    const token = await getAccessToken();

    /**
     * BƯỚC 1:
     * Xin registration options từ Supabase Edge Function.
     */
    const {
      data: options,
      error: optionsError,
    } =
      await supabase.functions.invoke(
  "webauthn-register-options",
  {
    body: {
      member_id: memberId,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

    if (optionsError) {
      console.error(
        "webauthn-register-options error:",
        optionsError
      );

      return {
        success: false,
        error:
          optionsError.message ??
          "Không thể tạo yêu cầu đăng ký sinh trắc học.",
      };
    }

    if (!options) {
      return {
        success: false,
        error:
          "Máy chủ không trả về dữ liệu đăng ký sinh trắc học.",
      };
    }

    /**
     * BƯỚC 2:
     * Gọi Face ID / Touch ID / vân tay / Passkey
     * của điện thoại.
     */
    let registrationResponse;

    try {
      registrationResponse =
        await startRegistration({
          optionsJSON: options,
        });
    } catch (error: any) {
      console.error(
        "startRegistration error:",
        error
      );

      if (error?.name === "NotAllowedError") {
        return {
          success: false,
          error:
            "Bạn đã hủy đăng ký hoặc quá thời gian xác thực.",
        };
      }

      if (error?.name === "InvalidStateError") {
        return {
          success: false,
          error:
            "Thiết bị này đã có Face ID/vân tay/Passkey được đăng ký cho tài khoản này.",
        };
      }

      if (error?.name === "SecurityError") {
        return {
          success: false,
          error:
            "Trình duyệt từ chối WebAuthn. Hãy mở ứng dụng bằng địa chỉ HTTPS chính thức của Vercel.",
        };
      }

      if (error?.name === "AbortError") {
        return {
          success: false,
          error:
            "Quá trình đăng ký sinh trắc học đã bị hủy.",
        };
      }

      return {
        success: false,
        error:
          error?.message ??
          "Không thể thực hiện đăng ký Face ID/vân tay.",
      };
    }

    /**
     * BƯỚC 3:
     * Gửi credential vừa tạo lên Supabase
     * để server xác minh và lưu vào database.
     */
    const {
      data: verifyData,
      error: verifyError,
    } =
      await supabase.functions.invoke(
        "webauthn-register-verify",
        {
          body: { ...registrationResponse, member_id: memberId },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

    if (verifyError) {
      console.error(
        "webauthn-register-verify error:",
        verifyError
      );

      return {
        success: false,
        error:
          verifyError.message ??
          "Máy chủ không thể xác nhận đăng ký sinh trắc học.",
      };
    }

    if (!verifyData?.verified) {
      return {
        success: false,
        error:
          verifyData?.error ??
          "Máy chủ từ chối đăng ký sinh trắc học.",
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error(
      "WebAuthn registration error:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Không thể đăng ký Face ID/vân tay.",
    };
  }
}

/**
 * XÁC THỰC SINH TRẮC HỌC ĐIỆN THOẠI
 */
export async function authenticatePhoneBiometric(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!supabase) {
      return {
        success: false,
        error: "Supabase chưa được cấu hình.",
      };
    }

    if (!window.isSecureContext) {
      return {
        success: false,
        error:
          "Xác thực sinh trắc học cần kết nối HTTPS. Hãy mở ứng dụng bằng địa chỉ Vercel.",
      };
    }

    if (
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential !== "function"
    ) {
      return {
        success: false,
        error:
          "Thiết bị hoặc trình duyệt này không hỗ trợ Face ID, vân tay hoặc Passkey.",
      };
    }

    const token = await getAccessToken();

    /**
     * BƯỚC 1:
     * Lấy authentication options từ server.
     */
    const {
      data: options,
      error: optionsError,
    } =
      await supabase.functions.invoke(
        "webauthn-auth-options",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

    if (optionsError) {
      console.error(
        "webauthn-auth-options error:",
        optionsError
      );

      return {
        success: false,
        error:
          optionsError.message ??
          "Không thể tạo yêu cầu xác thực sinh trắc học.",
      };
    }

    if (!options) {
      return {
        success: false,
        error:
          "Máy chủ không trả về dữ liệu xác thực sinh trắc học.",
      };
    }

    /**
     * BƯỚC 2:
     * Hiện Face ID / vân tay / Passkey.
     */
    let authenticationResponse;

    try {
      authenticationResponse =
        await startAuthentication({
          optionsJSON: options,
        });
    } catch (error: any) {
      console.error(
        "startAuthentication error:",
        error
      );

      if (error?.name === "NotAllowedError") {
        return {
          success: false,
          error:
            "Bạn đã hủy xác thực hoặc quá thời gian xác thực.",
        };
      }

      if (error?.name === "InvalidStateError") {
        return {
          success: false,
          error:
            "Không tìm thấy sinh trắc học/Passkey đã đăng ký trên thiết bị này.",
        };
      }

      if (error?.name === "SecurityError") {
        return {
          success: false,
          error:
            "Trình duyệt từ chối WebAuthn. Hãy mở ứng dụng bằng HTTPS chính thức của Vercel.",
        };
      }

      if (error?.name === "AbortError") {
        return {
          success: false,
          error:
            "Quá trình xác thực sinh trắc học đã bị hủy.",
        };
      }

      return {
        success: false,
        error:
          error?.message ??
          "Không thể thực hiện xác thực Face ID/vân tay.",
      };
    }

    /**
     * BƯỚC 3:
     * Gửi kết quả xác thực về server.
     */
    const {
      data: verifyData,
      error: verifyError,
    } =
      await supabase.functions.invoke(
        "webauthn-auth-verify",
        {
          body: authenticationResponse,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

    if (verifyError) {
      console.error(
        "webauthn-auth-verify error:",
        verifyError
      );

      return {
        success: false,
        error:
          verifyError.message ??
          "Máy chủ không thể xác nhận sinh trắc học.",
      };
    }

    if (!verifyData?.verified) {
      return {
        success: false,
        error:
          verifyData?.error ??
          "Xác thực sinh trắc học thất bại.",
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error(
      "WebAuthn authentication error:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Xác thực Face ID/vân tay thất bại.",
    };
  }
}