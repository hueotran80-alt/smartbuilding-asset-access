import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Thiếu Authorization." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Phiên đăng nhập không hợp lệ." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || adminProfile?.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ success: false, error: "Bạn không có quyền Admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();

    const roomId = String(body.roomId ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!roomId || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Thiếu roomId hoặc mật khẩu mới." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: roomAccount, error: roomAccountError } = await adminClient
      .from("room_accounts")
      .select("user_id, active, password_change_required")
      .eq("room_id", roomId)
      .single();

    if (roomAccountError || !roomAccount) {
      return new Response(
        JSON.stringify({ success: false, error: "Không tìm thấy tài khoản của phòng." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("room_number, status")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ success: false, error: "Không tìm thấy phòng." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (room.status !== "RENTED") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Phòng ${room.room_number} hiện đang EMPTY.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updatePasswordError } =
      await adminClient.auth.admin.updateUserById(
        roomAccount.user_id,
        { password: newPassword },
      );

    if (updatePasswordError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: updatePasswordError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: accountUpdateError } = await adminClient
      .from("room_accounts")
      .update({
        active: true,
        password_change_required: false,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);

    if (accountUpdateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: accountUpdateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        roomNumber: room.room_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Lỗi máy chủ.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});