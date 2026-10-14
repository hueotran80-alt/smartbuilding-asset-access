import {
  generateAuthenticationOptions,
} from "@simplewebauthn/server";

import { createClient } from "@supabase/supabase-js";

import {
  RP_ID,
  CHALLENGE_EXPIRE_MINUTES,
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

    const { data: credentials, error: credentialError } =
      await supabaseAdmin
        .from("webauthn_credentials")
        .select(
          "credential_id, transports",
        )
        .eq("user_id", user.id);

    if (credentialError) {
      throw new Error(
        `Không thể lấy Passkey: ${credentialError.message}`,
      );
    }

    if (!credentials || credentials.length === 0) {
      throw new Error(
        "Tài khoản chưa đăng ký sinh trắc học trên điện thoại",
      );
    }

    const allowCredentials = credentials.map(
      (credential) => ({
        id: credential.credential_id,
        type: "public-key" as const,
        transports:
          credential.transports ?? undefined,
      }),
    );

    const options =
      await generateAuthenticationOptions({
        rpID: RP_ID,

        allowCredentials,

        userVerification: "required",

        timeout:
          CHALLENGE_EXPIRE_MINUTES * 60 * 1000,
      });

    // Xóa challenge xác thực cũ
    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("challenge_type", "AUTHENTICATION");

    // Lưu challenge mới
    const { error: challengeError } =
      await supabaseAdmin
        .from("webauthn_challenges")
        .insert({
          user_id: user.id,
          challenge: options.challenge,
          challenge_type: "AUTHENTICATION",
          expires_at: new Date(
            Date.now() +
              CHALLENGE_EXPIRE_MINUTES * 60 * 1000,
          ).toISOString(),
        });

    if (challengeError) {
      throw new Error(
        `Không thể lưu authentication challenge: ${challengeError.message}`,
      );
    }

    return new Response(
      JSON.stringify(options),
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