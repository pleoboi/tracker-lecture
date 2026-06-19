import { NextResponse } from "next/server";

/**
 * Proxy d'images : récupère une image externe côté serveur et la renvoie
 * en same-origin, pour que l'export PNG (html-to-image) puisse la lire
 * sans être bloqué par CORS.
 */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  try {
    const res = await fetch(target);
    if (!res.ok) return NextResponse.json({ error: "Image inaccessible" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Ce n'est pas une image" }, { status: 400 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image inaccessible" }, { status: 502 });
  }
}
