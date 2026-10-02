import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const confirmationTypes: EmailOtpType[] = ["email", "signup"];

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let verified = false;

  if (code || (tokenHash && type && confirmationTypes.includes(type as EmailOtpType))) {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      verified = !error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      verified = !error;
    }
  }

  const destination = request.nextUrl.clone();
  destination.pathname = verified ? "/onboarding" : "/signup";
  destination.search = "";
  destination.hash = "";

  return NextResponse.redirect(destination);
}
