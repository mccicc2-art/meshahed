/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import type React from "react";

import { OG_FAMILY } from "@/lib/og";
import { hasArabic, shapedText } from "@/lib/reviewCard";
import { shareFooter, type ShareFooterIcon } from "@/lib/shareFooter";

/**
 * ====== 🆕 صورُ معاينة الروابط — ١٢٠٠×٦٣٠ (ن٨، أحمد ٢٧ نوفمبر «اكمل المتبقي ونفذها») ======
 *
 * **لماذا**: رابطُ العمل كان يظهر في واتساب ببوسترٍ صغيرٍ في الزاوية، ورابطُ الملفّ والدعوة بصورة لوبز العامّة — لا يعرف المستلمُ
 * ما في الرابط قبل أن يفتحه. الآن صورةٌ عريضةٌ واحدةٌ في واتساب وX وتيليجرام تقول ما في الرابط، **وذيلُ صور المشاركة الواحد**
 * (`shareFooter`) في الزاوية نفسِها من كلِّ معاينة.
 * ⚖️ **المحتوى في الوسط**: واتساب يقصّ المعاينةَ مربّعاً في المحادثات الضيّقة، فالاسمُ والرقمُ لا يسكنان الطرفين.
 * ⚖️ **الكلامُ مسارٌ مُشكَّلٌ** (`shapedText`) لا نصُّ satori: لا انقلابَ في الأسماء المختلطة («AHMED» داخل جملةٍ عربيّة).
 */
export const PREVIEW = { width: 1200, height: 630 };
const W = PREVIEW.width;
const H = PREVIEW.height;
const SIDE = 64;
const BAR = 92;
const FG = "#F7F7F7";
const MUTED = "#A3A3A3";
const Y = "#FFD400";

type Lang = "ar" | "en";

async function line(text: string, o: { width: number; size: number; color?: string; lines?: number; regular?: boolean; rtl?: boolean; center?: boolean }) {
  const rtl = o.rtl ?? hasArabic(text);
  const t = await shapedText(text, {
    width: o.width,
    size: o.size,
    lineHeight: 1.22,
    maxLines: o.lines ?? 1,
    color: o.color ?? FG,
    dir: rtl ? "rtl" : "ltr",
    face: o.regular ? "app-regular" : "app",
    align: o.center ? "center" : "start",
  });
  if (o.center) return <img src={t.src} width={t.width} height={t.height} />;
  /* مقصوصٌ إلى عرضه الحقيقيّ: السطرُ يلتصق بجهة الكتلة لا بجهة لغته («2008 · 5 مواسم» تحت «Breaking Bad» من اليسار) */
  const used = Math.min(t.width, t.used + Math.round(o.size * 0.4));
  return (
    <div style={{ display: "flex", width: used, overflow: "hidden" }}>
      <img src={t.src} width={t.width} height={t.height} style={rtl ? { marginLeft: used - t.width } : {}} />
    </div>
  );
}

/** الإطار: خلفيّةٌ داكنةٌ (أو فنُّ العمل تحت تعتيم)، والمحتوى، والذيلُ الواحد في شريطٍ أسود */
async function frame(o: { art?: string | null; artSide?: "left" | "right" | "full"; cta: string; icon: ShareFooterIcon; lang: Lang; children: React.ReactNode }) {
  const footer = await shareFooter({ width: W - SIDE * 2, height: BAR, cta: o.cta, icon: o.icon, scale: 0.78, rtl: o.lang === "ar" });
  const artW = o.artSide === "full" ? W : 660;
  const artLeft = o.artSide === "left" ? 0 : W - artW;
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#050505", fontFamily: OG_FAMILY, position: "relative" }}>
      {o.art ? (
        <div style={{ position: "absolute", left: artLeft, top: 0, width: artW, height: H - BAR, display: "flex" }}>
          <img src={o.art} width={artW} height={H - BAR} style={{ objectFit: "cover" }} />
          {/* تعتيمٌ يذوب نحو جهة الكلام — الكلامُ يُقرأ على أرضٍ صلبة لا فوق الصورة */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              backgroundImage:
                o.artSide === "full"
                  ? "linear-gradient(180deg, rgba(5,5,5,0.80), rgba(5,5,5,0.90))"
                  : `linear-gradient(${o.artSide === "left" ? "270deg" : "90deg"}, #050505 0%, rgba(5,5,5,0.55) 38%, rgba(5,5,5,0.05) 100%)`,
            }}
          />
        </div>
      ) : null}
      <div style={{ display: "flex", flex: 1, position: "relative", padding: `40px ${SIDE}px 28px` }}>{o.children}</div>
      <div style={{ display: "flex", height: BAR, padding: `0 ${SIDE}px`, background: "#000", borderTop: "1px solid #1C1C1C", position: "relative" }}>{footer}</div>
    </div>
  );
}

function poster(src: string | null, w: number, h: number, badge?: string, tilt = 0) {
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 14, overflow: "hidden", border: "2px solid #262626", background: "#141414", ...(tilt ? { transform: `rotate(${tilt}deg)` } : {}) }}>
      {src ? <img src={src} width={w} height={h} style={{ objectFit: "cover" }} /> : null}
      {badge ? (
        <div style={{ position: "absolute", left: 8, bottom: 4, display: "flex", fontSize: 40, color: Y, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{badge}</div>
      ) : null}
    </div>
  );
}

function avatar(src: string | null, initial: string, size: number) {
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, border: `4px solid ${Y}`, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#141414" }}>
      {src ? <img src={src} width={size} height={size} style={{ objectFit: "cover" }} /> : <div style={{ display: "flex", fontSize: size * 0.46, color: Y }}>{initial}</div>}
    </div>
  );
}

/* ================= ص٤ صفحةُ العمل ================= */
export async function workPreview(c: {
  lang: Lang;
  kind: "tv" | "movie";
  /** الاسمُ بقاعدة لوبز: إنجليزيٌّ إلّا العربيَّ الأصل */
  title: string;
  facts: string;
  /** تقييمُ أعضاء لوبز — يُرسم إن بلغ عددُه ما يُعتدّ به */
  rating: { avg: number; count: number } | null;
  art: string | null;
}) {
  const ar = c.lang === "ar";
  /* العملُ العربيُّ يضع اسمَه يميناً والصورةَ يساراً — كبطاقة المراجعة */
  const right = hasArabic(c.title);
  const TW = 500;
  const cta = c.kind === "tv" ? (ar ? "مسلسل" : "Series") : ar ? "فيلم" : "Movie";
  const rate = c.rating && c.rating.count >= 3 ? c.rating : null;
  const [title, facts, rateWord] = await Promise.all([
    line(c.title, { width: TW, size: 64, lines: 2 }),
    c.facts ? line(c.facts, { width: TW, size: 26, color: MUTED, regular: true, rtl: ar }) : Promise.resolve(null),
    rate ? line(ar ? "تقييم أعضاء لوبز" : "Loopz members", { width: 320, size: 24, color: MUTED, regular: true, rtl: ar }) : Promise.resolve(null),
  ]);
  /* الكتلةُ تتبع اسمَ العمل: اسمٌ لاتينيٌّ يساراً وسطورُه تحته من اليسار، والعربيُّ يميناً */
  const align = right ? "flex-end" : "flex-start";
  return frame({
    art: c.art,
    artSide: right ? "left" : "right",
    cta,
    icon: "film",
    lang: c.lang,
    children: (
      <div style={{ display: "flex", width: W - SIDE * 2, justifyContent: right ? "flex-end" : "flex-start", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", width: TW, gap: 18, alignItems: align }}>
          {title}
          {facts}
          {rate ? (
            <div style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 14 }}>
              <svg width={34} height={34} viewBox="0 0 24 24">
                <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" fill={Y} />
              </svg>
              <div style={{ display: "flex", fontSize: 44, color: Y }}>{rate.avg.toFixed(1)}</div>
              {rateWord}
            </div>
          ) : null}
        </div>
      </div>
    ),
  });
}

/* ================= ص٥ الملفّ الشخصيّ ================= */
export async function profilePreview(c: { lang: Lang; name: string; initial: string; avatar: string | null; persona: string | null; stats: string | null }) {
  const ar = c.lang === "ar";
  const TW = W - SIDE * 2;
  const [name, persona, stats] = await Promise.all([
    line(c.name, { width: TW, size: 50, center: true }),
    c.persona ? line(c.persona, { width: TW, size: 44, color: Y, center: true, rtl: ar }) : Promise.resolve(null),
    c.stats ? line(c.stats, { width: TW, size: 26, color: MUTED, regular: true, center: true, rtl: ar }) : Promise.resolve(null),
  ]);
  /* 🗑️ بلا إضاءةٍ صفراء خلف الصورة (أحمد ٢٧ نوفمبر: «لا تحط اضاءة صفراء خلف الصورة») — أرضٌ سوداءُ صافية */
  return frame({
    cta: ar ? "الملفّ الشخصي" : "Profile",
    icon: "user",
    lang: c.lang,
    children: (
      <div style={{ display: "flex", flexDirection: "column", width: TW, alignItems: "center", justifyContent: "center", gap: 16 }}>
        {avatar(c.avatar, c.initial, 148)}
        {name}
        {persona}
        {stats}
      </div>
    ),
  });
}

/* ================= ص٦ القائمة ================= */
export async function listPreview(c: { lang: Lang; owner: string | null; count: number; name: string; subtitle: string | null; posters: (string | null)[]; ranked: boolean; art: string | null }) {
  const ar = c.lang === "ar";
  const TW = 560;
  const head = c.owner
    ? ar
      ? `قائمة ${c.owner} · ${c.count === 1 ? "عمل واحد" : c.count === 2 ? "عملان" : c.count <= 10 ? `${c.count} أعمال` : `${c.count} عملاً`}`
      : `${c.owner}'s list · ${c.count} ${c.count === 1 ? "title" : "titles"}`
    : null;
  const [h, name, sub] = await Promise.all([
    head ? line(head, { width: TW, size: 24, color: MUTED, regular: true, rtl: ar }) : Promise.resolve(null),
    line(c.name, { width: TW, size: 58, lines: 2, rtl: ar && hasArabic(c.name) }),
    c.subtitle ? line(c.subtitle, { width: TW, size: 26, color: MUTED, regular: true, lines: 2, rtl: ar }) : Promise.resolve(null),
  ]);
  /* أوّلُ أربعة أعمال بترتيبها: الأوّلُ في جهة القراءة (يميناً في العربيّة) */
  const four = c.posters.slice(0, 4).map((p, i) => poster(p, 112, 168, c.ranked ? String(i + 1) : undefined));
  return frame({
    art: c.art,
    artSide: "full",
    cta: ar ? "قائمة" : "List",
    icon: "list",
    lang: c.lang,
    children: (
      <div style={{ display: "flex", width: W - SIDE * 2, flexDirection: ar ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", width: TW, gap: 14, alignItems: ar ? "flex-end" : "flex-start" }}>
          {h}
          {name}
          {sub}
        </div>
        <div style={{ display: "flex", flexDirection: ar ? "row-reverse" : "row", gap: 12, alignItems: "flex-end" }}>{four}</div>
      </div>
    ),
  });
}

/* ================= ص١١ الدعوة ================= */
export async function invitePreview(c: { lang: Lang; name: string | null; posters: (string | null)[] }) {
  const ar = c.lang === "ar";
  const TW = W - SIDE * 2;
  const headText = c.name
    ? ar
      ? `${c.name} يريد أن يقارن ذوقه بذوقك`
      : `${c.name} wants to compare tastes with you`
    : ar
      ? "قارن ذوقك على لوبز"
      : "Compare tastes on Loopz";
  const subText = c.name ? (ar ? "حمّل لوبز، واعرف كم يشبه ذوقُك ذوقَه" : "Get Loopz and see how close your taste is") : ar ? "تابع مسلسلاتك وأفلامك في مكانٍ واحد" : "Track your shows and movies in one place";
  const [head, sub] = await Promise.all([
    line(headText, { width: TW, size: 48, center: true, rtl: ar }),
    line(subText, { width: TW, size: 26, color: MUTED, regular: true, center: true, rtl: ar }),
  ]);
  const tilts = [-8, -3, 3, 8];
  const fan = c.posters.slice(0, 4);
  /* 🗑️ بلا إضاءةٍ صفراء خلف الصورة (أحمد ٢٧ نوفمبر: «لا تحط اضاءة صفراء خلف الصورة») — أرضٌ سوداءُ صافية */
  return frame({
    cta: ar ? "دعوة" : "Invite",
    icon: "invite",
    lang: c.lang,
    children: (
      <div style={{ display: "flex", flexDirection: "column", width: TW, alignItems: "center", justifyContent: "center", gap: 18 }}>
        {head}
        {sub}
        {fan.length ? <div style={{ display: "flex", gap: 14, marginTop: 18 }}>{fan.map((p, i) => poster(p, 104, 156, undefined, tilts[i + Math.floor((4 - fan.length) / 2)] ?? 0))}</div> : null}
      </div>
    ),
  });
}
