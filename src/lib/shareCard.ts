/**
 * Canvas-based share card generator.
 * Produces PNG blobs that can be passed to navigator.share({ files }).
 */

export const APP_URL = "https://bookie-seven-pi.vercel.app";

const C = {
  cream: "#FAF6EF",
  card: "#FFFDF8",
  green: "#3B6E52",
  greenLight: "#EAF2EC",
  amber: "#D4622A",
  brown: "#1C110A",
  muted: "#9C8B7B",
  border: "#E8DDD0",
  blue: "#2D6B9F",
  rose: "#C4556A",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadow(ctx: CanvasRenderingContext2D, blur = 24, opacity = 0.1, dy = 6) {
  ctx.shadowColor = `rgba(28,17,10,${opacity})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  ctx.shadowOffsetX = 0;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Waits for Fraunces & Nunito to be ready in the document font cache */
async function ensureFonts() {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load("bold 48px Fraunces"),
      document.fonts.load("600 24px Nunito"),
    ]);
  } catch { /* best effort */ }
}

// ─── Floating card helpers ────────────────────────────────────────────────────

function drawFloatingCard(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  rotateDeg: number,
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  const x = -w / 2;
  const y = -h / 2;

  shadow(ctx, 32, 0.12, 8);
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = C.card;
  ctx.fill();
  clearShadow(ctx);

  roundRect(ctx, x, y, w, h, 20);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  draw(ctx, x, y, w, h);
  ctx.restore();
}

// ─── App share card ───────────────────────────────────────────────────────────

export async function generateAppShareCard(): Promise<Blob> {
  await ensureFonts();

  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, S, S);

  // Radial warm glow in centre
  const grd = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7);
  grd.addColorStop(0, "rgba(212,98,42,0.06)");
  grd.addColorStop(1, "rgba(250,246,239,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, S, S);

  // Subtle dot grid
  ctx.fillStyle = "rgba(59,110,82,0.05)";
  for (let i = 0; i < S; i += 44) {
    for (let j = 0; j < S; j += 44) {
      ctx.beginPath();
      ctx.arc(i, j, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Logo mark (top left) ──
  const logoX = 72, logoY = 72, logoSize = 88;
  shadow(ctx, 20, 0.15, 6);
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 22);
  ctx.fillStyle = C.green;
  ctx.fill();
  clearShadow(ctx);

  ctx.save();
  ctx.translate(logoX + logoSize / 2, logoY + logoSize / 2);
  ctx.rotate(-0.26); // -15°
  ctx.fillStyle = C.cream;
  ctx.font = `bold 68px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", 0, 4);
  ctx.restore();

  // "Bookie" wordmark
  ctx.fillStyle = C.brown;
  ctx.font = `bold 64px Fraunces, Georgia, serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Bookie", logoX + logoSize + 24, logoY + logoSize / 2);

  // Tagline under logo
  ctx.fillStyle = C.muted;
  ctx.font = `600 28px Nunito, sans-serif`;
  ctx.fillText("Family Reading Tracker", logoX + logoSize + 24, logoY + logoSize / 2 + 40);

  // ── Hero text (centre) ──
  const textY = 320;
  ctx.textAlign = "center";
  ctx.fillStyle = C.brown;
  ctx.font = `bold 96px Fraunces, Georgia, serif`;
  ctx.fillText("Your family's", S / 2, textY);

  ctx.fillStyle = C.green;
  ctx.fillText("reading", S / 2, textY + 108);

  ctx.fillStyle = C.brown;
  ctx.fillText("adventure", S / 2, textY + 216);

  // ── Floating book cards ──

  // Card 1: Charlotte's Web (top-left, tilted left)
  drawFloatingCard(ctx, 210, 640, 300, 110, -5, (ctx, x, y) => {
    // Spine
    roundRect(ctx, x + 16, y + 16, 44, 62, 8);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📗", x + 16 + 22, y + 16 + 31);

    // Text
    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Charlotte's Web", x + 74, y + 18);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("E.B. White", x + 74, y + 43);
    // Stars
    ctx.font = "18px sans-serif";
    ctx.fillText("⭐⭐⭐⭐⭐", x + 74, y + 68);
  });

  // Card 2: Harry Potter (top-right, tilted right)
  drawFloatingCard(ctx, 810, 620, 310, 120, 4, (ctx, x, y) => {
    roundRect(ctx, x + 16, y + 16, 44, 72, 8);
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧙", x + 16 + 22, y + 16 + 36);

    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Harry Potter", x + 74, y + 14);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("J.K. Rowling", x + 74, y + 39);

    // Avatar dots "3 reading"
    const colours = [C.green, C.rose, C.blue];
    const emojis = ["👩", "🧒", "👨"];
    colours.forEach((col, i) => {
      ctx.beginPath();
      ctx.arc(x + 74 + i * 22, y + 78, 12, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emojis[i], x + 74 + i * 22, y + 78);
    });
    ctx.fillStyle = C.muted;
    ctx.font = `400 15px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("reading", x + 74 + 74, y + 78);
  });

  // Card 3: Progress (bottom-centre)
  drawFloatingCard(ctx, S / 2, 830, 340, 96, 1.5, (ctx, x, y) => {
    ctx.font = "30px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🦁", x + 16, y + 32);

    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText("Timmy", x + 60, y + 14);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("Reading · p.142 of 320", x + 60, y + 38);

    // Progress bar
    const barX = x + 16, barY = y + 68, barW = 308 - 16, barH = 10;
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fillStyle = C.border;
    ctx.fill();
    roundRect(ctx, barX, barY, barW * 0.44, barH, 5);
    ctx.fillStyle = C.green;
    ctx.fill();
  });

  // ── Central circle ──
  shadow(ctx, 40, 0.08, 4);
  ctx.beginPath();
  ctx.arc(S / 2, 590, 72, 0, Math.PI * 2);
  ctx.fillStyle = "#F0E4CB";
  ctx.fill();
  clearShadow(ctx);
  ctx.beginPath();
  ctx.arc(S / 2, 590, 72, 0, Math.PI * 2);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📚", S / 2, 594);

  // ── Bottom URL strip ──
  ctx.fillStyle = C.green;
  ctx.fillRect(0, S - 80, S, 80);
  ctx.fillStyle = "#fff";
  ctx.font = `700 28px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Join your family's reading adventure →", S / 2, S - 56);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `400 22px "DM Mono", monospace`;
  ctx.fillText(APP_URL, S / 2, S - 26);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png"
    );
  });
}

// ─── Book share card ──────────────────────────────────────────────────────────

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface BookShareData {
  title: string;
  author?: string | null;
  cover_url?: string | null;
  readerRating?: number | null;
  review?: string | null;
  familyName?: string;
}

export async function generateBookShareCard(book: BookShareData): Promise<Blob> {
  await ensureFonts();

  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  const grd = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.8);
  grd.addColorStop(0, "rgba(59,110,82,0.06)");
  grd.addColorStop(1, "rgba(250,246,239,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = "rgba(59,110,82,0.04)";
  for (let i = 0; i < W; i += 44) {
    for (let j = 0; j < H; j += 44) {
      ctx.beginPath();
      ctx.arc(i, j, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Cover image (left side) ──
  const coverX = 80, coverY = 130, coverW = 320, coverH = 460;
  let coverLoaded = false;

  if (book.cover_url) {
    const img = await loadImage(book.cover_url);
    if (img) {
      shadow(ctx, 40, 0.2, 12);
      roundRect(ctx, coverX, coverY, coverW, coverH, 16);
      ctx.fillStyle = C.border;
      ctx.fill();
      clearShadow(ctx);

      ctx.save();
      roundRect(ctx, coverX, coverY, coverW, coverH, 16);
      ctx.clip();
      ctx.drawImage(img, coverX, coverY, coverW, coverH);
      ctx.restore();
      coverLoaded = true;
    }
  }

  if (!coverLoaded) {
    // Stylised placeholder
    shadow(ctx, 40, 0.12, 8);
    roundRect(ctx, coverX, coverY, coverW, coverH, 16);
    ctx.fillStyle = C.greenLight;
    ctx.fill();
    clearShadow(ctx);

    ctx.font = "96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📚", coverX + coverW / 2, coverY + coverH / 2);
  }

  // ── Book info (right side) ──
  const infoX = 456, infoY = 130;
  const maxW = W - infoX - 60;

  // Title (word-wrap to ~2 lines)
  ctx.fillStyle = C.brown;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const titleSize = book.title.length > 20 ? 56 : 68;
  ctx.font = `bold ${titleSize}px Fraunces, Georgia, serif`;

  // Simple word-wrap
  const words = book.title.split(" ");
  let line = "";
  let lineY = infoY;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, infoX, lineY);
      line = word;
      lineY += titleSize + 8;
      if (lineY > infoY + titleSize * 3) { line = "…"; break; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, infoX, lineY);
  lineY += titleSize + 16;

  // Author
  if (book.author) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 32px Nunito, sans-serif`;
    ctx.fillText(`by ${book.author}`, infoX, lineY);
    lineY += 52;
  }

  // Stars
  if (book.readerRating) {
    ctx.font = "36px sans-serif";
    const stars = "⭐".repeat(book.readerRating);
    ctx.fillText(stars, infoX, lineY);
    lineY += 56;
  }

  // Review excerpt
  if (book.review) {
    lineY += 8;
    ctx.fillStyle = C.brown;
    ctx.font = `italic 28px Nunito, sans-serif`;
    const reviewWords = book.review.split(" ");
    let rLine = '"';
    let rY = lineY;
    for (const w of reviewWords) {
      const test = rLine + (rLine === '"' ? "" : " ") + w;
      if (ctx.measureText(test + '"').width > maxW && rLine !== '"') {
        ctx.fillText(rLine, infoX, rY);
        rLine = w;
        rY += 38;
        if (rY > lineY + 115) { ctx.fillText(rLine + '…"', infoX, rY); break; }
      } else {
        rLine = test === '"' ? `"${w}` : `${test}`;
      }
    }
    if (ctx.measureText(rLine + '"').width <= maxW) {
      ctx.fillText(rLine + '"', infoX, rY);
    }
    lineY = rY + 50;
  }

  // ── Bookie branding (bottom of right column) ──
  const brandY = coverY + coverH - 60;
  // Logo mark
  const lsz = 52;
  shadow(ctx, 12, 0.12, 4);
  roundRect(ctx, infoX, brandY, lsz, lsz, 12);
  ctx.fillStyle = C.green;
  ctx.fill();
  clearShadow(ctx);

  ctx.save();
  ctx.translate(infoX + lsz / 2, brandY + lsz / 2);
  ctx.rotate(-0.26);
  ctx.fillStyle = C.cream;
  ctx.font = `bold 38px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", 0, 2);
  ctx.restore();

  ctx.fillStyle = C.brown;
  ctx.font = `bold 36px Fraunces, Georgia, serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Bookie", infoX + lsz + 14, brandY + lsz / 2 - 5);
  ctx.fillStyle = C.muted;
  ctx.font = `400 20px Nunito, sans-serif`;
  ctx.fillText("Family Reading Tracker", infoX + lsz + 14, brandY + lsz / 2 + 20);

  // ── Divider ──
  ctx.fillStyle = C.border;
  ctx.fillRect(60, 640, W - 120, 2);

  // ── Bottom: "Reading on Bookie" + family name + URL ──
  const btmY = 680;
  ctx.fillStyle = C.brown;
  ctx.font = `bold 40px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const familyLine = book.familyName
    ? `${book.familyName} is reading on Bookie`
    : "Reading on Bookie";
  ctx.fillText(familyLine, W / 2, btmY);

  ctx.fillStyle = C.muted;
  ctx.font = `400 28px Nunito, sans-serif`;
  ctx.fillText("Track your family's reading adventures together 📚", W / 2, btmY + 56);

  // ── Green bottom strip ──
  ctx.fillStyle = C.green;
  ctx.fillRect(0, H - 80, W, 80);
  ctx.fillStyle = "#fff";
  ctx.font = `700 26px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Join us →  " + APP_URL, W / 2, H - 40);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png"
    );
  });
}

// ─── Share helpers ────────────────────────────────────────────────────────────

export async function shareWithOS(payload: {
  blob?: Blob;
  fileName?: string;
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "fallback"> {
  const { blob, fileName, title, text, url } = payload;

  if (!navigator.share) return "fallback";

  try {
    if (blob && navigator.canShare?.({ files: [new File([blob], fileName ?? "share.png", { type: "image/png" })] })) {
      await navigator.share({
        files: [new File([blob], fileName ?? "share.png", { type: "image/png" })],
        title,
        text,
        url,
      });
    } else {
      await navigator.share({ title, text, url });
    }
    return "shared";
  } catch (e: unknown) {
    // User cancelled — not an error
    if (e instanceof Error && e.name === "AbortError") return "shared";
    return "fallback";
  }
}

export function whatsappBookMessage(book: BookShareData, url: string): string {
  const stars = book.readerRating ? "⭐".repeat(book.readerRating) : "";
  return [
    `📚 *${book.title}*${book.author ? ` by ${book.author}` : ""}`,
    stars,
    book.review ? `"${book.review}"` : "",
    "",
    book.familyName ? `${book.familyName} tracks their reading on Bookie! 🎉` : "We track our family's reading on Bookie! 🎉",
    url,
  ].filter(Boolean).join("\n");
}

export function whatsappAppMessage(): string {
  return [
    `📚 *Bookie — Family Reading Tracker*`,
    "",
    "Track every book your family reads together. Log progress, rate stories, and celebrate every page turned.",
    "",
    `Join us: ${APP_URL}`,
  ].join("\n");
}
