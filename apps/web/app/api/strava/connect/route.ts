import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the Strava OAuth flow. The user is already required to be signed
 * in to reach this route (proxy.ts's auth guard covers /api routes too),
 * but the explicit check keeps this route self-contained.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { origin } = new URL(request.url);
  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/strava/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", "activity:read_all");

  return NextResponse.redirect(authorizeUrl);
}
