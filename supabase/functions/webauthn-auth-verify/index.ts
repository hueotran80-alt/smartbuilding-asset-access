import {
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { createClient } from "@supabase/supabase-js";

import {
  RP_ID,
  ORIGIN,
} from "../_shared/webauthn.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
    );

    // Lấy challenge
    const { data: challengeRecord, error: challengeError } =
      await supabaseAdmin
        .from("webauthn_challenges")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_type", "AUTHENTICATION")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (challengeError || !challengeRecord) {
      throw new Error(
        "Không tìm thấy authentication challenge",
      );
    }

    if (
      new Date(challengeRecord.expires_at).getTime() <
      Date.now()
    ) {
      throw new Error(
        "Challenge đã hết hạn. Vui lòng thử lại.",
      );
    }

    const body = await req.json();

    // Credential ID mà điện thoại vừa sử dụng
    const credentialId = body.id;

    if (!credentialId) {
      throw new Error(
        "Không tìm thấy credential ID",
      );
    }

    // Lấy credential tương ứng
    const { data: storedCredential, error: storedError } =
      await supabaseAdmin
        .from("webauthn_credentials")
        .select("*")
        .eq("user_id", user.id)
        .eq("credential_id", credentialId)
        .maybeSingle();

    if (storedError || !storedCredential) {
      throw new Error(
        "Passkey không tồn tại hoặc không thuộc tài khoản này",
      );
    }

    // Public key lưu dạng Base64
    const publicKeyBytes = Uint8Array.from(
      atob(storedCredential.public_key),
      (char) => char.charCodeAt(0),
    );

    const verification =
      await verifyAuthenticationResponse({
        response: body,

        expectedChallenge:
          challengeRecord.challenge,

        expectedOrigin: ORIGIN,

        expectedRPID: RP_ID,

        credential: {
          id: storedCredential.credential_id,

          publicKey: publicKeyBytes,

          counter: Number(
            storedCredential.counter,
          ),

          transports:
            storedCredential.transports ?? undefined,
        },

        requireUserVerification: true,
      });

    if (!verification.verified) {
      throw new Error(
        "Xác thực sinh trắc học thất bại",
      );
    }

    // Cập nhật counter chống replay
    await supabaseAdmin
      .from("webauthn_credentials")
      .update({
        counter:
          verification.authenticationInfo.newCounter,

        last_used_at: new Date().toISOString(),
      })
      .eq("id", storedCredential.id);

    // Challenge chỉ được dùng một lần
    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("id", challengeRecord.id);

    return new Response(
      JSON.stringify({
        verified: true,
        message:
          "Xác thực sinh trắc học thành công",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        verified: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});