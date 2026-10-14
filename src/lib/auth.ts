import { isSupabaseConfigured, supabase } from "./supabase";

export type UserRole = "ADMIN" | "TENANT" | "CAMERA";

export interface AuthProfile {
  id: string;
  email: string;
  username?: string | null;
  full_name: string;
  role: UserRole;
  room_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type UserProfile = AuthProfile;

function getSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase chưa được cấu hình. Hãy kiểm tra file .env."
    );
  }

  return supabase;
}

/**
 * Lấy profile của user hiện tại.
 */
export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const client = getSupabase();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await client
    .from("profiles")
    .select(
      "id,email,username,full_name,role,room_id,phone,is_active,created_at,updated_at"
    )
    .eq("id", user.id)
    .single();

  if (error || !data) {
    console.error("Không thể lấy profile:", error);
    return null;
  }

  return {
    id: data.id,
    email: user.email ?? data.email ?? "",
    username: data.username,
    full_name: data.full_name,
    role: data.role as UserRole,
    room_id: data.room_id,
    phone: data.phone,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Alias tương thích với code cũ.
 */
export async function getCurrentUserProfile(): Promise<AuthProfile | null> {
  return getCurrentProfile();
}

/**
 * Đăng nhập bằng EMAIL + PASSWORD.
 */
export async function login(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: AuthProfile;
  error?: string;
}> {
  const client = getSupabase();

  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      error: "Vui lòng nhập email.",
    };
  }

  if (!password) {
    return {
      success: false,
      error: "Vui lòng nhập mật khẩu.",
    };
  }

  /**
   * Bước 1:
   * Xác thực tài khoản bằng Supabase Auth.
   */
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error || !data.user) {
    console.error("========== LOGIN ERROR ==========");
    console.error("message:", error?.message);
    console.error("status:", error?.status);
    console.error("name:", error?.name);
    console.error("email:", cleanEmail);
    console.error("=================================");

    return {
      success: false,
      error: error?.message || "Supabase không trả về user.",
    };
  }

  /**
   * Bước 2:
   * Lấy profile tương ứng với Auth user.
   */
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select(
      "id,email,username,full_name,role,room_id,phone,is_active,created_at,updated_at"
    )
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile error:", profileError);

    await client.auth.signOut();

    return {
      success: false,
      error:
        "Đăng nhập Auth thành công nhưng tài khoản chưa có profile.",
    };
  }

  /**
   * Bước 3:
   * Kiểm tra profile còn hoạt động hay không.
   */
  if (!profile.is_active) {
    await client.auth.signOut();

    return {
      success: false,
      error: "Tài khoản hiện đang bị vô hiệu hóa.",
    };
  }

  /**
   * Bước 4:
   * Kiểm tra quyền.
   *
   * ADMIN:
   *   Có thể đăng nhập độc lập với phòng.
   *
   * CAMERA:
   *   Là tài khoản của máy camera, không thuộc phòng.
   *
   * TENANT:
   *   Phải được gắn với một phòng.
   */
  if (
    profile.role !== "ADMIN" &&
    profile.role !== "TENANT" &&
    profile.role !== "CAMERA"
  ) {
    await client.auth.signOut();

    return {
      success: false,
      error: "Tài khoản chưa được cấp quyền.",
    };
  }

  /**
   * Bước 5:
   * Tenant phải thuộc một phòng.
   */
  if (profile.role === "TENANT") {
    if (!profile.room_id) {
      await client.auth.signOut();

      return {
        success: false,
        error: "Tài khoản chưa được gán phòng.",
      };
    }

    /**
     * Kiểm tra phòng có ít nhất một occupant đang active.
     *
     * Tài khoản tenant cố định với phòng.
     * Occupant là người thực tế đang ở trong phòng.
     */
    const { count, error: occupantError } = await client
      .from("room_occupants")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("room_id", profile.room_id)
      .eq("is_active", true);

    if (occupantError) {
      console.error("Occupant check error:", occupantError);

      await client.auth.signOut();

      return {
        success: false,
        error: "Không thể kiểm tra trạng thái người ở của phòng.",
      };
    }

    if (!count || count < 1) {
      await client.auth.signOut();

      return {
        success: false,
        error:
          "Phòng hiện không có người ở. Tài khoản tenant chưa được phép đăng nhập.",
      };
    }
  }

  /**
   * Bước 6:
   * Trả profile đã xác thực.
   */
  const authProfile: AuthProfile = {
    id: profile.id,
    email: data.user.email ?? profile.email ?? "",
    username: profile.username,
    full_name: profile.full_name,
    role: profile.role as UserRole,
    room_id: profile.room_id,
    phone: profile.phone,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  return {
    success: true,
    user: authProfile,
  };
}

/**
 * Đăng xuất.
 */
export async function logout(): Promise<void> {
  const client = getSupabase();

  const { error } = await client.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

/**
 * Lấy session hiện tại.
 */
export async function getCurrentSession() {
  const client = getSupabase();

  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    return null;
  }

  return session;
}

/**
 * Kiểm tra đã đăng nhập chưa.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getCurrentSession();
    return !!session;
  } catch (error) {
    console.error("Authentication check error:", error);
    return false;
  }
}

/**
 * Theo dõi thay đổi authentication.
 */
export function subscribeAuth(
  callback: (profile: AuthProfile | null) => void
): () => void {
  if (!isSupabaseConfigured) {
    callback(null);
    return () => {};
  }

  const client = getSupabase();

  let active = true;

  const loadProfile = async () => {
    try {
      const profile = await getCurrentProfile();

      if (active) {
        callback(profile);
      }
    } catch (error) {
      console.error("Auth profile error:", error);

      if (active) {
        callback(null);
      }
    }
  };

  void loadProfile();

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(() => {
    void loadProfile();
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}

/**
 * API cũ tương thích với code hiện tại.
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const client = getSupabase();

  return client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

/**
 * Khôi phục mật khẩu bằng email.
 */
export async function resetPassword(
  email: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const client = getSupabase();

  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      error: "Vui lòng nhập email.",
    };
  }

  const { error } = await client.auth.resetPasswordForEmail(
    cleanEmail,
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  );

  if (error) {
    console.error("Password recovery error:", error);

    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}