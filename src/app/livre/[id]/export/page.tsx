"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { supabase } from "../../../../lib/supabase";
import type { Book, ReadingLog } from "../../../../lib/types";

const W = 1080;
const H = 1350;
const SCALE = 0.3;

const dateLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [book, setBook] = useState<Book | null>(null);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [accent, setAccent] = useState("#4F9FD6");
  const [summary, setSummary] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null]); // slides 1,2,3
  const [busy, setBusy] = useState<number | null>(null);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("books").select("*").eq("id", id).single(),
      supabase.from("reading_logs").select("*").eq("book_id", id),
    ]).then(([{ data: b }, { data: l }]) => {
      setBook(b as Book);
      setLogs((l as ReadingLog[]) || []);
      setSummary((b as Book)?.summary || "");
      setLoading(false);
    });
  }, [id]);

  const setImage = (idx: number, src: string | null) =>
    setImages((prev) => prev.map((v, i) => (i === idx ? src : v)));

  const download = useCallback(
    async (idx: number) => {
      const node = slideRefs.current[idx];
      if (!node) return;
      setBusy(idx);
      try {
        await (document as any).fonts?.ready;
        const dataUrl = await toPng(node, { width: W, height: H, pixelRatio: 1, cacheBust: true });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `oboireads-${slug(book?.title)}-${idx + 1}.png`;
        a.click();
      } catch (e) {
        alert("Export impossible : " + (e instanceof Error ? e.message : "erreur"));
      } finally {
        setBusy(null);
      }
    },
    [book]
  );

  if (loading) {
    return <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>;
  }
  if (!book) {
    return <div className="py-24 text-center font-serif text-lg text-ink">Livre introuvable.</div>;
  }

  // Stats
  const dayMap = new Map<string, number>();
  logs.forEach((l) => {
    const d = l.date.split("T")[0];
    dayMap.set(d, (dayMap.get(d) || 0) + (l.pages_read || 0));
  });
  const days = [...dayMap.keys()].sort();
  let durationDays = 1;
  if (days.length) {
    const diff = (new Date(days[days.length - 1]).getTime() - new Date(days[0]).getTime()) / 86400000;
    durationDays = Math.max(1, Math.round(diff) + 1);
  }
  const totalRead = [...dayMap.values()].reduce((a, b) => a + b, 0);
  const perDay = Math.round((totalRead || book.pages) / durationDays);
  let recDate = "";
  let recPages = 0;
  dayMap.forEach((p, d) => {
    if (p > recPages) { recPages = p; recDate = d; }
  });

  const data = {
    title: book.title.toUpperCase(),
    author: book.author.toUpperCase(),
    year: book.published_year ? String(book.published_year) : null,
    genre: book.genre ? book.genre.toUpperCase() : null,
    pages: book.pages,
    summary: summary,
    review: book.notes || "",
    durationLabel: `${durationDays} jour${durationDays > 1 ? "s" : ""}`,
    perDay,
    recDate: recDate ? dateLong.format(new Date(recDate)) : "—",
    recPages,
  };

  const slides = [
    <Slide1 key="1" d={data} accent={accent} image={images[0]} />,
    <Slide2 key="2" d={data} accent={accent} image={images[1]} />,
    <Slide3 key="3" d={data} accent={accent} image={images[2]} />,
    <Slide4 key="4" d={data} accent={accent} />,
  ];

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header className="flex items-center gap-3">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-lg text-ink">‹</button>
        <div>
          <h1 className="font-serif text-2xl font-black text-ink">Exporter pour Instagram</h1>
          <p className="text-xs text-muted">{book.title}</p>
        </div>
      </header>

      {/* Réglages */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Couleur d&apos;accent</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white" />
          <div className="flex gap-1.5">
            {["#4F9FD6", "#C98A3B", "#7C9E5A", "#B5546E", "#8E7BC4", "#D9534F"].map((c) => (
              <button key={c} onClick={() => setAccent(c)} className="h-7 w-7 rounded-full border border-line" style={{ backgroundColor: c }} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ImageInput label="Image — slide Review" onChange={(s) => setImage(0, s)} />
          <ImageInput label="Image — slide Couverture" onChange={(s) => setImage(1, s)} />
          <ImageInput label="Image — slide Infos" onChange={(s) => setImage(2, s)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            Synopsis (slide Infos) — ajuste-le, il se redimensionne pour rester centré et lisible
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
          />
        </div>
      </div>

      {/* Aperçus */}
      <div className="grid gap-6 sm:grid-cols-2">
        {slides.map((slide, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div style={{ width: W * SCALE, height: H * SCALE, overflow: "hidden", borderRadius: 12 }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: W, height: H }}>
                <div ref={(el) => { slideRefs.current[i] = el; }}>{slide}</div>
              </div>
            </div>
            <button
              onClick={() => download(i)}
              disabled={busy !== null}
              className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-cream disabled:opacity-50"
            >
              {busy === i ? "Export…" : `Télécharger slide ${i + 1}`}
            </button>
          </div>
        ))}
      </div>

      <p className="pb-4 text-center text-[11px] leading-4 text-muted">
        Titre, auteur, année, genre, pages, synopsis, review et stats sont remplis automatiquement.
        Ajoute tes images d&apos;ambiance, choisis la couleur, télécharge en 1080×1350.
      </p>
    </div>
  );
}

function slug(s?: string) {
  return (s || "livre").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

/* ---------------- Contrôle image (upload ou URL) ---------------- */
function ImageInput({ label, onChange }: { label: string; onChange: (src: string | null) => void }) {
  const [url, setUrl] = useState("");
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-paper p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <input type="file" accept="image/*" onChange={onFile} className="text-[11px] text-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-violet file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-cream" />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => url.trim() && onChange(`/api/image-proxy?url=${encodeURIComponent(url.trim())}`)}
        placeholder="…ou colle une URL d'image"
        className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none focus:border-violet"
      />
    </div>
  );
}

/* ---------------- Gabarits de slides (1080×1350) ---------------- */
interface SlideData {
  title: string; author: string; year: string | null; genre: string | null;
  pages: number; summary: string; review: string; durationLabel: string;
  perDay: number; recDate: string; recPages: number;
}

const FONT = "Haskoy, system-ui, sans-serif";

/* Réduit la taille de police jusqu'à ce que le texte tienne dans son parent. */
function AutoFitText({
  text, maxSize, minSize, align = "center", weight = 400,
}: { text: string; maxSize: number; minSize: number; align?: "center" | "justify"; weight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    let s = maxSize;
    el.style.fontSize = s + "px";
    while (s > minSize && el.scrollHeight > parent.clientHeight) {
      s -= 1;
      el.style.fontSize = s + "px";
    }
  });
  return (
    <div ref={ref} style={{ fontWeight: weight, lineHeight: 1.42, textAlign: align, width: "100%", whiteSpace: "pre-wrap" }}>
      {text}
    </div>
  );
}

function Frame({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div style={{ width: W, height: H, background: "#0a0a0a", position: "relative", fontFamily: FONT, color: "#fff", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 75% at 50% 0%, rgba(255,255,255,0.05), rgba(0,0,0,0) 55%)" }} />
      <div style={{ position: "absolute", inset: 34, border: `2px solid ${accent}`, borderRadius: 46 }} />
      <div style={{ position: "absolute", inset: 34, padding: "62px 58px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}

function Brand() {
  return <div style={{ fontWeight: 400, fontSize: 29, letterSpacing: 1.5, textAlign: "center", textTransform: "uppercase" }}>Review by Oboi Reads</div>;
}

function Title({ text, accent, size = 78 }: { text: string; accent: string; size?: number }) {
  return <div style={{ fontWeight: 700, fontSize: size, lineHeight: 1.0, color: accent, textTransform: "uppercase", letterSpacing: 0 }}>{text}</div>;
}

function Author({ text }: { text: string }) {
  return <div style={{ fontWeight: 300, fontSize: 42, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</div>;
}

function Slide1({ d, accent, image }: { d: SlideData; accent: string; image: string | null }) {
  return (
    <Frame accent={accent}>
      <Brand />
      <div style={{ marginTop: 50, flex: 1, display: "flex", alignItems: "flex-start", overflow: "hidden" }}>
        <AutoFitText text={d.review || "Ta review apparaîtra ici (champ « Mes notes » du livre)."} maxSize={38} minSize={22} align="justify" />
      </div>
      <div style={{ width: "100%", height: 470, borderRadius: 22, overflow: "hidden", background: "#141414", border: `1px solid ${accent}55` }}>
        {image && <img src={image} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
    </Frame>
  );
}

function Slide2({ d, accent, image }: { d: SlideData; accent: string; image: string | null }) {
  return (
    <Frame accent={accent}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 44, overflow: "hidden" }}>
        {image ? (
          <img src={image} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#141414" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.45) 100%)" }} />
      </div>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        <Title text={d.title} accent={accent} size={84} />
        <div style={{ marginTop: 12 }}><Author text={d.author} /></div>
        <div style={{ marginTop: "auto", marginLeft: "auto", fontWeight: 400, fontSize: 29, letterSpacing: 1.5, textTransform: "uppercase" }}>Review by Oboi Reads</div>
      </div>
    </Frame>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 999, padding: "18px 40px", fontWeight: 700, fontSize: 30, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff" }}>
      {children}
    </div>
  );
}

function Slide3({ d, accent, image }: { d: SlideData; accent: string; image: string | null }) {
  return (
    <Frame accent={accent}>
      <Brand />
      <div style={{ marginTop: 26 }}>
        <Title text={d.title} accent={accent} size={64} />
        <div style={{ marginTop: 8 }}><Author text={d.author} /></div>
      </div>
      <div style={{ marginTop: 34, width: "100%", height: 470, borderRadius: 22, overflow: "hidden", background: "#141414", border: `1px solid ${accent}55` }}>
        {image && <img src={image} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      <div style={{ marginTop: 34, display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap" }}>
        {d.year && <Chip>{d.year}</Chip>}
        {d.genre && <Chip>{d.genre}</Chip>}
        <Chip>{d.pages} pages</Chip>
      </div>
      <div style={{ marginTop: 32, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <AutoFitText text={d.summary || "Le synopsis du livre apparaîtra ici."} maxSize={34} minSize={18} align="center" />
      </div>
    </Frame>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 999, padding: "20px 56px", fontWeight: 700, fontSize: 34, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: 400, fontSize: 36, letterSpacing: 1, textTransform: "uppercase" }}>{value}</div>
    </div>
  );
}

function Slide4({ d, accent }: { d: SlideData; accent: string }) {
  return (
    <Frame accent={accent}>
      <Brand />
      <div style={{ marginTop: 26, textAlign: "center" }}>
        <Title text={d.title} accent={accent} size={62} />
        <div style={{ marginTop: 8 }}><Author text={d.author} /></div>
      </div>
      <div style={{ marginTop: "auto", marginBottom: "auto", display: "flex", flexDirection: "column", gap: 48 }}>
        <StatBlock label="Durée" value={d.durationLabel} />
        <StatBlock label="Nombre de pages" value={String(d.pages)} />
        <StatBlock label="Pages / jour" value={String(d.perDay)} />
        <StatBlock label="Plus grosse journée" value={d.recPages > 0 ? `${d.recDate} — ${d.recPages} pages` : "—"} />
      </div>
    </Frame>
  );
}
