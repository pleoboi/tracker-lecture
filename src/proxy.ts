import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const reqPath = request.nextUrl.pathname;

  // PWA / Safari — ces routes doivent être accessibles sans session
  if (
    reqPath === "/icon" ||
    reqPath === "/apple-icon" ||
    reqPath === "/manifest.json" ||
    reqPath === "/apple-touch-icon.png" ||
    reqPath === "/apple-touch-icon-precomposed.png"
  ) {
    return NextResponse.next();
  }

  // Routes API push : elles s'authentifient elles-mêmes via token Bearer.
  // Le contrôle par cookie du proxy est redondant et bloque le push quand le
  // cookie de session est désynchronisé du token (ex. envoi de notification
  // depuis un appareil dont le cookie a expiré mais le token localStorage est valide).
  if (reqPath.startsWith("/api/push/")) {
    return NextResponse.next();
  }

  // Routes cron : invoquées par Vercel avec le CRON_SECRET (pas de cookie de
  // session). Elles valident elles-mêmes ce secret. Sans cette exclusion, le
  // proxy les redirige vers /login et les notifications programmées ne partent jamais.
  if (reqPath.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // Endpoint de stats en lecture seule, appelé serveur à serveur (ex: mon app
  // Bingo Perso) avec STATS_API_SECRET, pas de cookie de session. Même
  // raisonnement que /api/cron/.
  if (reqPath.startsWith("/api/stats")) {
    return NextResponse.next();
  }

  // Attribution de parrainage : appelée juste après l'inscription, avec token
  // Bearer, avant que le cookie de session ne soit forcément stabilisé. Même
  // raisonnement que /api/push/ — la route valide déjà son propre token.
  if (reqPath.startsWith("/api/referral/")) {
    return NextResponse.next();
  }

  // Pages légales : doivent rester consultables sans compte (obligation LCEN/RGPD).
  if (
    reqPath === "/mentions-legales" ||
    reqPath === "/confidentialite" ||
    reqPath === "/conditions"
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isLanding = pathname === "/";

  // Landing page : accessible à tous
  if (isLanding) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Pages auth : accessibles seulement si déconnecté
  if (isAuthPage) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Toutes les autres pages : requièrent une session
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
