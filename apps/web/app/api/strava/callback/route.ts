import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/strava/client";

/**
 * Strava redirects here after the user approves the connection. Exchanges
 * the one-time code for access/refresh tokens and stores them - this runs
 * with the user's own session (normal RLS applies, no service role needed
 * here since a real signed-in user is present).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/import?strava_error=1`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { error: dbError } = await supabase.from("strava_connection").upsert(
      {
        user_id: user.id,
        athlete_id: tokens.athleteId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (dbError) throw new Error(dbError.message);
  } catch {
    return NextResponse.redirect(`${origin}/import?strava_error=1`);
  }

  return NextResponse.redirect(`${origin}/import?strava_connected=1`);
}
