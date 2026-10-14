import {
  verifyRegistrationResponse,
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

    const { data: challengeRecord, error: challengeError } =
      await supabaseAdmin
        .from("webauthn_challenges")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_type", "REGISTRATION")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (challengeError || !challengeRecord) {
      throw new Error(
        "Khong tim thay registration challenge",
      );
    }

    if (
      new Date(challengeRecord.expires_at).getTime() <
      Date.now()
    ) {
      throw new Error(
        "Challenge da het han. Vui long thu lai.",
      );
    }

    const registrationResponse = body;

    if (!registrationResponse.id) {
      throw new Error(
        "Khong tim thay credential ID",
      );
    }

    const credentialId = registrationResponse.id;

    const { data: existingCredential, error: existingError } =
      await supabaseAdmin
        .from("webauthn_credentials")
        .select("id")
        .eq("credential_id", credentialId)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        "Khong the kiem tra WebAuthn credential: " +
          existingError.message,
      );
    }

    if (existingCredential) {
      throw new Error(
        "Credential nay da duoc dang ky.",
      );
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error(
        "Xac thuc dang ky sinh trac hoc that bai",
      );
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    const publicKeyBytes = credential.publicKey;

    let publicKey = "";
    for (const byte of publicKeyBytes) {
      publicKey += String.fromCharCode(byte);
    }

    const publicKeyBase64 = btoa(publicKey);

    const { data: savedCredential, error: credentialError } =
      await supabaseAdmin
        .from("webauthn_credentials")
        .insert({
          user_id: user.id,
          credential_id: credential.id,
          public_key: publicKeyBase64,
          counter: credential.counter,
          device_type: credentialDeviceType,
          transports:
            registrationResponse.response?.transports ??
            null,
        })
        .select("id")
        .single();

    if (credentialError || !savedCredential) {
      throw new Error(
        "Khong the luu WebAuthn credential: " +
          (credentialError?.message ??
            "Unknown error"),
      );
    }

    const { error: biometricError } =
      await supabaseAdmin
        .from("biometric_credentials")
        .insert({
          occupant_id: memberId,
          biometric_type: "WEBAUTHN",
          credential_id: credential.id,
          device_id: null,
          template_id: null,
          credential_data: {
            device_type: credentialDeviceType,
            backed_up: credentialBackedUp,
          },
          is_active: true,
        });

    if (biometricError) {
      await supabaseAdmin
        .from("webauthn_credentials")
        .delete()
        .eq("id", savedCredential.id);

      throw new Error(
        "Khong the lien ket sinh trac hoc voi thanh vien phong: " +
          biometricError.message,
      );
    }

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("id", challengeRecord.id);

    return new Response(
      JSON.stringify({
        verified: true,
        member_id: memberId,
        message:
          "Dang ky sinh trac hoc thanh cong",
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
