// Compression / redimensionnement d'image côté client avant upload.
// Objectif : chargement rapide sur PWA mobile sans altérer la netteté perçue.

export interface CompressOptions {
  /** Plus grande dimension (px) conservée. Au-delà, l'image est réduite. */
  maxDimension?: number;
  /** Qualité 0..1 pour les formats avec perte. */
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
};

function canEncodeWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  // createImageBitmap gère l'orientation EXIF et est plus rapide quand dispo.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      };
    } catch {
      /* fallback ci-dessous */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compresse et redimensionne une image. Retourne un nouveau File (WebP si
 * supporté, sinon JPEG). En cas d'échec, renvoie le fichier d'origine.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality } = { ...DEFAULTS, ...opts };
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // Les GIF (animés) et SVG ne se re-encodent pas proprement — on les laisse.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const src = await loadBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      src.close();
      return file;
    }
    ctx.imageSmoothingQuality = "high";
    src.draw(ctx, w, h);
    src.close();

    const useWebp = canEncodeWebp();
    const mime = useWebp ? "image/webp" : "image/jpeg";
    const ext = useWebp ? "webp" : "jpg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, quality),
    );
    if (!blob) return file;

    // Si la compression n'a rien gagné (petite image déjà optimisée), garder l'original.
    if (blob.size >= file.size && scale === 1) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${ext}`, { type: mime });
  } catch {
    return file;
  }
}
