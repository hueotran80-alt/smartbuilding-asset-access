import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@supabase/supabase-js";
import {
  RP_NAME,
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

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("room_id,is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      throw new Error("Khong tim thay tai khoan phong");
    }

    if (!profile.is_active) {
      throw new Error(
        "Tai khoan phong hien khong hoat dong",
      );
    }

    if (!profile.room_id) {
      throw new Error(
        "Tai khoan chua duoc gan phong",
      );
    }

    const { data: room, error: roomError } =
      await supabaseAdmin
        .from("rooms")
        .select("id,status,room_number")
        .eq("id", profile.room_id)
        .single();

    if (roomError || !room) {
      throw new Error("Khong tim thay phong");
    }

    const body = await req.json();
    const memberId = body.member_id;

    if (!memberId) {
      throw new Error("Thieu member_id");
    }

    const { data: member, error: memberError } =
      await supabaseAdmin
        .from("room_occupants")
        .select("id,full_name,is_active")
        .eq("id", memberId)
        .eq("room_id", profile.room_id)
        .single();

    if (memberError || !member) {
      throw new Error(
        "Thanh vien khong thuoc phong nay",
      );
    }

    if (!member.is_active) {
      throw new Error(
        "Thanh vien hien khong hoat dong",
      );
    }

    const { data: existingCredentials } =
      await supabaseAdmin
        .from("biometric_credentials")
        .select("credential_id")
        .eq("occupant_id", memberId)
        .eq("is_active", true)
        .not("credential_id", "is", null);

    const excludeCredentials =
      (existingCredentials ?? [])
        .filter(
          (credential) => credential.credential_id,
        )
        .map((credential) => ({
          id: credential.credential_id,
          type: "public-key" as const,
        }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email ?? user.id,
      userDisplayName: member.full_name,
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout:
        CHALLENGE_EXPIRE_MINUTES * 60 * 1000,
    });

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("challenge_type", "REGISTRATION");

    const { error: challengeError } =
      await supabaseAdmin
        .from("webauthn_challenges")
        .insert({
          user_id: user.id,
          challenge: options.challenge,
          challenge_type: "REGISTRATION",
          expires_at: new Date(
            Date.now() +
              CHALLENGE_EXPIRE_MINUTES * 60 * 1000,
          ).toISOString(),
        });

    if (challengeError) {
      throw new Error(
        "Khong the luu WebAuthn challenge: " +
          challengeError.message,
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
