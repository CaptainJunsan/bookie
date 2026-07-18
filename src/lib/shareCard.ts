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

  const grd = ctx.createRadialGradient(S / 2, S * 0.35, 0, S / 2, S * 0.35, S * 0.75);
  grd.addColorStop(0, "rgba(212,98,42,0.07)");
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
  ctx.rotate(-0.26);
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

  ctx.fillStyle = C.muted;
  ctx.font = `600 28px Nunito, sans-serif`;
  ctx.fillText("Family Reading Tracker", logoX + logoSize + 24, logoY + logoSize / 2 + 40);

  // ── Hero text (centre) — kept in the upper third, well above the cards ──
  // Font is 96px; fillText draws at baseline. Lines spaced 110px apart.
  // "adventure" baseline at y=460 → descenders end ~480, leaving clear space to cards at y=680+.
  const textY = 244;
  ctx.textAlign = "center";
  ctx.fillStyle = C.brown;
  ctx.font = `bold 96px Fraunces, Georgia, serif`;
  ctx.fillText("Your family's", S / 2, textY);

  ctx.fillStyle = C.green;
  ctx.fillText("reading", S / 2, textY + 110);

  ctx.fillStyle = C.brown;
  ctx.fillText("adventure", S / 2, textY + 220);

  // ── Large 📚 emoji badge — sits between hero text and the floating cards ──
  // Centered at y=565, radius=58. Hero text ends ~480, cards start at y=625.
  const circleY = 565;
  shadow(ctx, 40, 0.08, 4);
  ctx.beginPath();
  ctx.arc(S / 2, circleY, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#F0E4CB";
  ctx.fill();
  clearShadow(ctx);
  ctx.beginPath();
  ctx.arc(S / 2, circleY, 58, 0, Math.PI * 2);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "52px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📚", S / 2, circleY + 2);

  // ── Floating book cards — positioned in the lower half, no overlap with circle ──
  // Circle bottom edge: 565+58 = 623. Cards start: cy - h/2 ≥ 680.

  // Card 1: Charlotte's Web (left, tilted)
  drawFloatingCard(ctx, 210, 730, 300, 108, -5, (ctx, x, y) => {
    roundRect(ctx, x + 16, y + 14, 44, 62, 8);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📗", x + 16 + 22, y + 14 + 31);

    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Charlotte's Web", x + 74, y + 14);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("E.B. White", x + 74, y + 38);
    ctx.font = "18px sans-serif";
    ctx.fillText("⭐⭐⭐⭐⭐", x + 74, y + 62);
  });

  // Card 2: Harry Potter (right, tilted)
  drawFloatingCard(ctx, 830, 710, 310, 118, 4, (ctx, x, y) => {
    roundRect(ctx, x + 16, y + 14, 44, 70, 8);
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧙", x + 16 + 22, y + 14 + 35);

    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Harry Potter", x + 74, y + 12);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("J.K. Rowling", x + 74, y + 36);

    const colours = [C.green, C.rose, C.blue];
    const emojis = ["👩", "🧒", "👨"];
    colours.forEach((col, i) => {
      ctx.beginPath();
      ctx.arc(x + 74 + i * 22, y + 76, 12, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emojis[i], x + 74 + i * 22, y + 76);
    });
    ctx.fillStyle = C.muted;
    ctx.font = `400 15px Nunito, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("reading", x + 74 + 74, y + 76);
  });

  // Card 3: Progress bar (bottom centre)
  drawFloatingCard(ctx, S / 2, 880, 360, 92, 1.5, (ctx, x, y) => {
    ctx.font = "28px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🦁", x + 16, y + 28);

    ctx.fillStyle = C.brown;
    ctx.font = `700 20px Nunito, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText("Timmy", x + 58, y + 12);
    ctx.fillStyle = C.muted;
    ctx.font = `400 16px Nunito, sans-serif`;
    ctx.fillText("Reading · p.142 of 320", x + 58, y + 35);

    const barX = x + 16, barY = y + 64, barW = 328, barH = 10;
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fillStyle = C.border;
    ctx.fill();
    roundRect(ctx, barX, barY, barW * 0.44, barH, 5);
    ctx.fillStyle = C.green;
    ctx.fill();
  });

  // ── Bottom URL strip ──
  ctx.fillStyle = C.green;
  ctx.fillRect(0, S - 80, S, 80);
  ctx.fillStyle = "#fff";
  ctx.font = `700 28px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Join your family's reading adventure →", S / 2, S - 54);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `400 22px "DM Mono", monospace`;
  ctx.fillText(APP_URL, S / 2, S - 24);

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

  ctx.fillStyle = "rgba(59,110,82,0.04)";
  for (let i = 0; i < W; i += 44) {
    for (let j = 0; j < H; j += 44) {
      ctx.beginPath();
      ctx.arc(i, j, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Cover image (left column) ──
  const coverX = 72, coverY = 120, coverW = 300, coverH = 440;
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

  // ── Book info (right column) ──
  // Right column spans infoX to W-60. Hard cap at y=540 to protect the branding row.
  const infoX = 420, infoY = 120;
  const maxInfoW = W - infoX - 60;
  const maxInfoBottom = 530; // nothing in the right column goes below this

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Title — word-wrap, 2 lines max
  const titleFontSize = book.title.length > 22 ? 52 : 64;
  ctx.fillStyle = C.brown;
  ctx.font = `bold ${titleFontSize}px Fraunces, Georgia, serif`;
  const titleWords = book.title.split(" ");
  let titleLine = "";
  let lineY = infoY;
  for (const word of titleWords) {
    const test = titleLine ? `${titleLine} ${word}` : word;
    if (ctx.measureText(test).width > maxInfoW && titleLine) {
      if (lineY < maxInfoBottom) ctx.fillText(titleLine, infoX, lineY);
      titleLine = word;
      lineY += titleFontSize + 10;
      if (lineY > infoY + titleFontSize * 2 + 10) { titleLine = "…"; break; }
    } else {
      titleLine = test;
    }
  }
  if (titleLine && lineY < maxInfoBottom) ctx.fillText(titleLine, infoX, lineY);
  lineY += titleFontSize + 18;

  // Author
  if (book.author && lineY < maxInfoBottom) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 30px Nunito, sans-serif`;
    ctx.fillText(`by ${book.author}`, infoX, lineY);
    lineY += 50;
  }

  // Stars
  if (book.readerRating && lineY < maxInfoBottom) {
    ctx.font = "34px sans-serif";
    ctx.fillText("⭐".repeat(book.readerRating), infoX, lineY);
    lineY += 54;
  }

  // Review — 3 lines max, capped at maxInfoBottom
  if (book.review && lineY < maxInfoBottom - 40) {
    lineY += 8;
    ctx.fillStyle = C.brown;
    ctx.font = `italic 26px Nunito, sans-serif`;
    const reviewWords = book.review.split(" ");
    let rLine = '"';
    let rY = lineY;
    for (const w of reviewWords) {
      const test = rLine === '"' ? `"${w}` : `${rLine} ${w}`;
      if (ctx.measureText(test + '"').width > maxInfoW && rLine !== '"') {
        if (rY < maxInfoBottom) ctx.fillText(rLine, infoX, rY);
        rLine = w;
        rY += 36;
        if (rY > lineY + 108 || rY > maxInfoBottom) {
          if (rY <= maxInfoBottom) ctx.fillText(rLine + '…"', infoX, rY);
          break;
        }
      } else {
        rLine = test;
      }
    }
    if (rY <= maxInfoBottom && ctx.measureText(rLine + '"').width <= maxInfoW) {
      ctx.fillText(rLine + '"', infoX, rY);
    }
  }

  // ── Bookie branding (anchored to bottom of cover, right column) ──
  const brandY = coverY + coverH - 48; // = 512
  const lsz = 48;
  shadow(ctx, 12, 0.12, 4);
  roundRect(ctx, infoX, brandY, lsz, lsz, 11);
  ctx.fillStyle = C.green;
  ctx.fill();
  clearShadow(ctx);

  ctx.save();
  ctx.translate(infoX + lsz / 2, brandY + lsz / 2);
  ctx.rotate(-0.26);
  ctx.fillStyle = C.cream;
  ctx.font = `bold 34px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", 0, 2);
  ctx.restore();

  ctx.fillStyle = C.brown;
  ctx.font = `bold 32px Fraunces, Georgia, serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Bookie", infoX + lsz + 12, brandY + lsz / 2 - 6);
  ctx.fillStyle = C.muted;
  ctx.font = `400 18px Nunito, sans-serif`;
  ctx.fillText("Family Reading Tracker", infoX + lsz + 12, brandY + lsz / 2 + 16);

  // ── Divider ──
  ctx.fillStyle = C.border;
  ctx.fillRect(60, 612, W - 120, 2);

  // ── Bottom section ──
  const btmY = 648;
  ctx.fillStyle = C.brown;
  ctx.font = `bold 40px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const familyLine = book.familyName
    ? `${book.familyName} reads on Bookie`
    : "Reading on Bookie";
  ctx.fillText(familyLine, W / 2, btmY);

  ctx.fillStyle = C.muted;
  ctx.font = `400 27px Nunito, sans-serif`;
  ctx.fillText("Track your family's reading adventures together 📚", W / 2, btmY + 54);

  // ── Green bottom strip ──
  ctx.fillStyle = C.green;
  ctx.fillRect(0, H - 80, W, 80);
  ctx.fillStyle = "#fff";
  ctx.font = `700 26px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Join us → ${APP_URL}`, W / 2, H - 40);

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
      // When sharing a file, don't also pass url — iOS appends it after the text,
      // causing a double-link since the text already contains the URL.
      await navigator.share({
        files: [new File([blob], fileName ?? "share.png", { type: "image/png" })],
        title,
        text,
      });
    } else {
      await navigator.share({ title, text, url });
    }
    return "shared";
  } catch (e: unknown) {
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
