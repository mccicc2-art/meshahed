import "server-only";

import { shareFooter } from "@/lib/shareFooter";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import opentype from "opentype.js";
import { OG_FAMILY } from "@/lib/og";

/**
 * ====== 🆕 T530 — بطاقةُ مشاركة المراجعة في X (أحمد ٢٣ نوفمبر: «١أ» الصورتان والسيناريوهاتُ الستّة) ======
 *
 * **لماذا**: لقطةُ أحمد من X — بطاقةُ المراجعة القديمة (`threadOgCard`) «شكلها سيء»: الجملةُ العربيّةُ متقطّعةُ الفراغات والكلماتُ
 * اللاتينيّةُ داخلها مقلوبةُ الترتيب. السببُ في `satori` نفسِه: يقيس العربيّةَ حروفاً منفصلةً قبل وصلها، فيخطئ العرضَ والترتيب.
 * **العلاجُ**: النصُّ العربيُّ يُشكَّل هنا بـ`opentype.js` (الوصلُ والأشكالُ من الخطّ نفسِه) ويُرسم مساراتٍ في صورة SVG — فما في
 * البطاقة هو ما في الخطّ حرفاً. واللاتينيُّ وحدَه نصٌّ عاديّ.
 *
 * **التصميمُ المعتمد** (١٢٠٠×٦٣٠):
 * - شريطٌ أسودُ أسفلَها (٩٦): ذيلُ صور المشاركة الواحد (`shareFooter` — أحمد ٢٧ نوفمبر): الأيقونةُ والشعار · loopztv.com · «Review» («مراجعة» للعمل العربيّ) ونجمة.
 * - فوقه الملصقُ بارتفاعه كلِّه (٣٥٦) ولوحٌ داكن: اسمُ العمل كبيراً وتحته «Movie · 2026».
 * - **المراجعةُ كاملة**: صاحبُها فوق النصّ مباشرةً، والنصُّ ثلاثةُ أسطرٍ بجانبه خطٌّ أصفر، والتقييمُ تحتها في حبّةٍ بنجمة.
 * - **التقييمُ فقط**: «RATED BY» («قيّمه» للعمل العربيّ) والاسمُ، ثمّ نجمةٌ كبيرةٌ على يسار الرقم («٦ النجمة يسار التقييم»).
 * - **الاتّجاه** («معلومة لك … ١ و٢»): اسمُ العمل إنجليزيٌّ دائماً إلّا العربيَّ الأصل فيبقى عربيّاً، **والعملُ العربيُّ يضع ملصقَه
 *   واسمَه يميناً** (وبطاقةُ التقييم وحده معه). **ومراجعةٌ بالإنجليزيّة** يكون خطُّها الأصفرُ وصاحبُها وبدايةُ سطرها يساراً.
 */

const W = 1200;
const H = 630;
const BAR = 96;
const TOP = H - BAR;
const POSTER_W = 356;
const PANEL = W - POSTER_W;
const INNER = PANEL - 96;
const Y = "#FFD200";
const OLIVE = "#9A8A4A";
const PILL_BG = "rgba(255,210,0,0.12)";
const PILL_BD = "1.5px solid rgba(255,210,0,0.5)";
const STAR = "M12 2.4l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.6l1.2-6.6L2.5 9.4l6.6-.9z";
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export const hasArabic = (s: string): boolean => ARABIC.test(s);

type Font = opentype.Font;
type Fonts = { ar: Font; la: Font };
/**
 * 🆕 **خطّا التطبيق** (أحمد ٢٦ نوفمبر «ق١٠أ»: صورُ المشاركة بـTajawal وPoppins كالتطبيق لا Cairo): نسختا الخطّين من
 * `apps/mobile/assets/fonts` في `public/fonts` — ثقيلٌ للعناوين والأرقام، ومتوسّطٌ للسطور الصغيرة. أوّلُ قارئٍ بطاقةُ «حصاد 2026».
 */
export type ShapeFace = "app" | "app-regular";
const faceP = new Map<ShapeFace, Promise<Fonts>>();
function facesOf(face: ShapeFace): Promise<Fonts> {
  let p = faceP.get(face);
  if (!p) {
    const [ar, la] = face === "app" ? ["Tajawal-800.ttf", "Poppins-700.ttf"] : ["Tajawal-500.ttf", "Poppins-500.ttf"];
    const load = (f: string) =>
      readFile(join(process.cwd(), "public/fonts", f)).then((b) => opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
    p = Promise.all([load(ar), load(la)]).then(([a, l]) => ({ ar: a, la: l }));
    faceP.set(face, p);
  }
  return p;
}

const SHAPE = { kerning: true, features: { liga: true, rlig: true } } as unknown as opentype.RenderOptions;
const isLatinWord = (w: string) => /[A-Za-z0-9]/.test(w) && !ARABIC.test(w);
type Piece = { t: string; f: Font };
type Unit = { latin: boolean; p: Piece[]; w: number };

/**
 * أزواجُ الأقواس: داخل كلمةٍ عربيّةٍ تُرسم من اليمين، فيُقلب القوسُ كما يقلبه محرّكُ النصّ (مراجعةُ الوكيل ٢، البند ٣) — ما علّمه
 * Unicode `Bidi_Mirrored` وحدَه. ⚠️ «» ليست منها: في المتصفّح «رائع» تُرسم وقوسُها «» كما هو، فقلبُه هنا يخالف ما يراه في الصفحة.
 */
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };
const mirrored = (t: string) => Array.from(t, (ch) => MIRROR[ch] ?? ch).join("");

/** كلمةٌ عربيّة: علاماتُ الترقيم التي لا يحملها الخطُّ العربيُّ تُفصل وتُرسم باللاتينيّ — مقلوبةَ الأقواس */
function pieces(w: string, F: Fonts): Piece[] {
  if (isLatinWord(w)) return [{ t: w, f: F.la }];
  const has = (ch: string) => F.ar.charToGlyphIndex(ch) > 0;
  let i = 0;
  let j = w.length;
  while (i < j && !has(w[i])) i++;
  while (j > i && !has(w[j - 1])) j--;
  const out: Piece[] = [];
  if (i > 0) out.push({ t: mirrored(w.slice(0, i)), f: F.la });
  if (j > i) out.push({ t: w.slice(i, j), f: F.ar });
  if (j < w.length) out.push({ t: mirrored(w.slice(j)), f: F.la });
  return out;
}

/**
 * **نصٌّ مُشكَّلٌ صورةً**: يلفّ الكلماتِ على العرض، ويقصّ بعد `maxLines` بثلاث نقاط، ويرسم كلَّ سطرٍ مجموعاتٍ: اللاتينيُّ من
 * اليسار والعربيُّ من اليمين — فالجملةُ المختلطةُ تُقرأ بترتيبها. يعيد صورةَ SVG وارتفاعَها.
 */
export async function shapedText(
  text: string,
  o: { width: number; size: number; lineHeight: number; maxLines: number; color: string; dir?: "rtl" | "ltr"; face?: ShapeFace; align?: "start" | "center" },
): Promise<{ src: string; width: number; height: number; used: number }> {
  const F = await facesOf(o.face ?? "app");
  const dir = o.dir ?? "rtl";
  /* 🔴 البند ٤: ما لا يحمله الخطّان (الإيموجي ومحدِّداتُه) يسقط — وإلّا رُسم مربّعاً فارغاً في الصورة */
  const drawable = Array.from(text)
    .filter((ch) => /\s/.test(ch) || F.ar.charToGlyphIndex(ch) > 0 || F.la.charToGlyphIndex(ch) > 0)
    .join("");
  const units: Unit[] = drawable
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const p = pieces(w, F);
      return { latin: isLatinWord(w), p, w: p.reduce((s, x) => s + x.f.getAdvanceWidth(x.t, o.size, SHAPE), 0) };
    });
  const space = F.la.getAdvanceWidth(" ", o.size) * 1.1;
  const lines: Unit[][] = [];
  let cur: Unit[] = [];
  let cw = 0;
  for (const u of units) {
    const add = cur.length ? space + u.w : u.w;
    if (cw + add > o.width && cur.length) {
      lines.push(cur);
      cur = [u];
      cw = u.w;
    } else {
      cur.push(u);
      cw += add;
    }
  }
  if (cur.length) lines.push(cur);
  const shown = lines.slice(0, o.maxLines);
  if (lines.length > o.maxLines && shown.length) {
    const last = shown[shown.length - 1];
    const dots: Unit = { latin: dir === "ltr", p: [{ t: "...", f: F.la }], w: F.la.getAdvanceWidth("...", o.size) };
    while (last.length > 1 && last.reduce((s, u) => s + u.w + space, 0) + dots.w > o.width) last.pop();
    last.push(dots);
  }
  let d = "";
  const groupW = (g: Unit[]) => g.reduce((s, u) => s + u.w, 0) + space * (g.length - 1);
  const draw = (g: Unit[], latin: boolean, left: number, y: number) => {
    if (latin) {
      let x = left;
      for (const u of g) {
        for (const p of u.p) {
          d += p.f.getPath(p.t, x, y, o.size, SHAPE).toPathData(2);
          x += p.f.getAdvanceWidth(p.t, o.size, SHAPE);
        }
        x += space;
      }
    } else {
      let x = left + groupW(g);
      for (const u of g) {
        for (const p of u.p) {
          x -= p.f.getAdvanceWidth(p.t, o.size, SHAPE);
          d += p.f.getPath(p.t, x, y, o.size, SHAPE).toPathData(2);
        }
        x -= space;
      }
    }
  };
  /** 🆕 عرضُ أطول سطرٍ فعلاً — لمن يضع شيئاً بعد النصّ مباشرةً (نجمةُ التقييم بعد اسم العمل) */
  let used = 0;
  shown.forEach((line, li) => {
    const y = o.size + li * o.size * o.lineHeight;
    const groups: { latin: boolean; items: Unit[] }[] = [];
    for (const u of line) {
      const g = groups[groups.length - 1];
      if (g && g.latin === u.latin) g.items.push(u);
      else groups.push({ latin: u.latin, items: [u] });
    }
    /* 🆕 التوسيط: السطرُ يبدأ من نصف ما يفضل عنه — والترتيبُ داخله كما هو */
    const lineW = groups.reduce((a, g) => a + groupW(g.items), 0) + space * (groups.length - 1);
    used = Math.max(used, Math.min(o.width, lineW));
    const pad = o.align === "center" ? Math.max(0, (o.width - lineW) / 2) : 0;
    if (dir === "rtl") {
      let x = o.width - pad;
      for (const g of groups) {
        x -= groupW(g.items);
        draw(g.items, g.latin, x, y);
        x -= space;
      }
    } else {
      let x = pad;
      for (const g of groups) {
        draw(g.items, g.latin, x, y);
        x += groupW(g.items) + space;
      }
    }
  });
  const height = Math.max(1, Math.ceil(o.size + (shown.length - 1) * o.size * o.lineHeight + o.size * 0.5));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${height}" viewBox="0 0 ${o.width} ${height}"><path d="${d}" fill="${o.color}"/></svg>`;
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: o.width, height, used: Math.ceil(used) };
}


const star = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={Y}>
    <path d={STAR} />
  </svg>
);

export type ReviewCardInput = {
  mode: "review" | "rating";
  /** اسمُ العمل بقاعدة لوبز: إنجليزيٌّ إلّا العربيَّ الأصل */
  work: string;
  /** العملُ عربيُّ الأصل ⇒ ملصقُه واسمُه يميناً */
  arabicWork: boolean;
  kind: "tv" | "movie";
  year: number | null;
  poster: string | null;
  name: string;
  /** حرفُ الدائرة حين لا صورة — من اسم المستخدم اللاتينيّ إن وُجد: حرفٌ عربيٌّ منفردٌ يُرسم بشكله المعزول فلا يُقرأ */
  initial: string;
  avatar: string | null;
  rating: number;
  review: string | null;
};

/** عنصرُ البطاقة جاهزاً لـ`ImageResponse` — والخطّان من `ogFonts` */
export async function reviewCardElement(c: ReviewCardInput) {
  /* 🆕 الذيلُ الواحد (أحمد ٢٧ نوفمبر): أيقونةُ لوبز وشعارُه · loopztv.com · كلمةُ الحدث.
     🆕 لغةٌ واحدة (أحمد ٢٧ نوفمبر: «وحّد اللغة»): لغةُ البطاقة لغةُ العمل — عملٌ عربيٌّ يقول «مراجعة» و«قيّمه»، وغيرُه يبقى «Review»
     و«RATED BY»؛ كان الذيلُ إنجليزيّاً تحت سطرٍ يقول «مسلسل · 2024» */
  const ar = c.arabicWork;
  const footer = await shareFooter({
    width: W - 112,
    height: BAR,
    cta: ar ? (c.mode === "review" ? "مراجعة" : "تقييم") : c.mode === "review" ? "Review" : "Rating",
    icon: "star",
    scale: 0.82,
    rtl: ar,
  });
  const ratedBy = ar
    ? await shapedText("قيّمه", { width: 200, size: 22, lineHeight: 1.2, maxLines: 1, color: "#8A8A8A", dir: "rtl" }).then((t) => (
        // الكلمةُ مقصوصةٌ إلى عرضها فتلتصق بحافّة العمود اليمنى كالاسم تحتها
        <div style={{ display: "flex", width: t.used, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={t.src} width={t.width} height={t.height} style={{ marginLeft: t.used - t.width }} />
        </div>
      ))
    : <div style={{ display: "flex", fontSize: 20, color: "#8A8A8A", letterSpacing: 2 }}>RATED BY</div>;
  const score = c.rating.toFixed(1);
  const kindWord = c.arabicWork ? (c.kind === "tv" ? "مسلسل" : "فيلم") : c.kind === "tv" ? "Series" : "Movie";
  const sub = c.year ? `${kindWord} · ${c.year}` : kindWord;
  const right = c.arabicWork;

  /* الاسمُ والسطرُ تحته: العربيُّ مُشكَّلاً، واللاتينيُّ نصّاً */
  const titleEl = hasArabic(c.work)
    ? await shapedText(c.work, { width: INNER, size: 42, lineHeight: 1.2, maxLines: 2, color: "#FFFFFF" }).then((t) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={t.src} width={t.width} height={t.height} />
      ))
    : <div style={{ display: "flex", fontSize: 42, lineHeight: 1.15, color: "#FFFFFF" }}>{c.work.length > 70 ? `${c.work.slice(0, 68)}…` : c.work}</div>;
  const subEl = hasArabic(sub)
    ? await shapedText(sub, { width: INNER, size: 22, lineHeight: 1.2, maxLines: 1, color: "#8A8A8A", dir: right ? "rtl" : "ltr" }).then((t) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={t.src} width={t.width} height={t.height} />
      ))
    : <div style={{ display: "flex", fontSize: 22, color: "#8A8A8A" }}>{sub}</div>;
  const titleBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: right ? "flex-end" : "flex-start" }}>
      {titleEl}
      {subEl}
    </div>
  );

  const nameEl = async (size: number, color: string, max: number, rtl: boolean) =>
    hasArabic(c.name)
      ? await shapedText(c.name, { width: max, size, lineHeight: 1.2, maxLines: 1, color, dir: rtl ? "rtl" : "ltr" }).then((t) => (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={t.src} width={t.width} height={t.height} />
        ))
      : <div style={{ display: "flex", fontSize: size, color }}>{c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name}</div>;
  const avatar = (s: number) =>
    c.avatar ? (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img src={c.avatar} width={s} height={s} style={{ borderRadius: s, objectFit: "cover", border: `2px solid ${Y}` }} />
    ) : (
      <div style={{ display: "flex", width: s, height: s, borderRadius: s, background: "#2A2A2A", border: `2px solid ${Y}`, alignItems: "center", justifyContent: "center", fontSize: s * 0.45, color: Y }}>
        {(c.initial || "L").toUpperCase()}
      </div>
    );

  let middle: React.ReactNode;
  let bottom: React.ReactNode;
  if (c.mode === "review" && c.review) {
    const revRtl = hasArabic(c.review);
    const q = await shapedText(c.review, { width: INNER - 21, size: 28, lineHeight: 1.65, maxLines: 3, color: "#EDEDED", dir: revRtl ? "rtl" : "ltr" });
    const nameW = INNER - 60;
    middle = (
      <div style={{ display: "flex", flexDirection: "column", width: INNER, gap: 14 }}>
        <div style={{ display: "flex", width: INNER, justifyContent: "flex-start", alignItems: "center", gap: 12, flexDirection: revRtl ? "row-reverse" : "row" }}>
          {avatar(40)}
          {hasArabic(c.name) ? (
            <div style={{ display: "flex", width: nameW, justifyContent: revRtl ? "flex-end" : "flex-start" }}>{await nameEl(26, "#D0D0D0", nameW, revRtl)}</div>
          ) : (
            await nameEl(26, "#D0D0D0", nameW, revRtl)
          )}
        </div>
        <div style={{ display: "flex", width: INNER, gap: 16, flexDirection: revRtl ? "row-reverse" : "row" }}>
          <div style={{ display: "flex", width: 5, height: q.height, background: Y, borderRadius: 3 }} />
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={q.src} width={INNER - 21} height={q.height} />
        </div>
      </div>
    );
    bottom = (
      <div style={{ display: "flex", width: INNER, justifyContent: right ? "flex-end" : "flex-start", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 22px 4px 18px", borderRadius: 999, background: PILL_BG, border: PILL_BD }}>
          {star(34)}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 40, color: Y }}>{score}</div>
            <div style={{ display: "flex", fontSize: 24, color: OLIVE }}>/10</div>
          </div>
        </div>
      </div>
    );
  } else {
    middle = (
      <div style={{ display: "flex", width: INNER, justifyContent: "flex-start", alignItems: "center", gap: 14, flexDirection: right ? "row-reverse" : "row" }}>
        {avatar(56)}
        <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start" }}>
          {ratedBy}
          {await nameEl(32, "#FFFFFF", INNER - 90, right)}
        </div>
      </div>
    );
    bottom = (
      <div style={{ display: "flex", width: INNER, justifyContent: right ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {star(92)}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ display: "flex", fontSize: 136, lineHeight: 1, color: Y, letterSpacing: -4 }}>{score}</div>
            <div style={{ display: "flex", fontSize: 44, color: OLIVE }}>/10</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: right ? "row-reverse" : "row", background: "#000", fontFamily: OG_FAMILY, position: "relative" }}>
      {c.poster ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={c.poster} width={POSTER_W} height={TOP} style={{ objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", width: POSTER_W, height: TOP, background: "#1A1A1A" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", width: PANEL, height: TOP, background: "#0A0A0A", color: "#fff", padding: "36px 48px", justifyContent: "space-between" }}>
        {titleBlock}
        {middle}
        {bottom}
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: BAR, display: "flex", alignItems: "center", padding: "0 56px", background: "#000000", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {footer}
      </div>
    </div>
  );
}

export const REVIEW_CARD_SIZE = { width: W, height: H };
