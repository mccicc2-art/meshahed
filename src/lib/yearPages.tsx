/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import type { ReactNode } from "react";

import { shapedText } from "@/lib/reviewCard";
import { YEAR_CARD, YEAR_FRAME, img, yearFrame, type YearFrameInput } from "@/lib/yearCard";
import { countedUnit } from "@/core/yearPersona";

/**
 * ====== 🆕 حصاد 2026 — صورُ صفحات القصّة (استوديو المشاركة «ن٦ · ق٧»: «كلُّ صفحةٍ تُشارَك، لا الأخيرةُ وحدها») ======
 *
 * **لماذا**: من يرى «412 ساعة» أو «مسلسل سنتك» في قصّته يريد أن يشاركها هي لا البطاقةَ الأخيرة. الصفحةُ في التطبيق ترسم بثيمه؛
 * وصورتُها هنا ١٠٨٠×١٩٢٠ بإطار بطاقة الحصاد نفسِه (`yearFrame`: الرأسُ والذيلُ والضوء) — فالصورُ الخمسُ عائلةٌ واحدة، ومنطقةُ
 * الأمان محفوظة (لا شيءَ فوق ٢٦٠ ولا تحت ١٥٧٠). **كلُّ نصٍّ مسارٌ مُشكَّل** (`shapedText`) كأخواتها.
 * الصفحاتُ الأربع: وقتُك · مسلسلُ سنتك · بصمةُ ذائقتك · أكثرُ ما أحببت. المدخلُ والبطاقةُ يشاركان البطاقةَ نفسَها.
 */
export type YearPage =
  | { kind: "time"; minutes: number; months: { label: string; minutes: number }[] }
  | { kind: "top"; title: string; poster: string | null; episodes: number; minutes: number; movie: boolean; next?: { title: string; poster: string | null; minutes: number }[] }
  | { kind: "taste"; persona: string; genres: { name: string; pct: number }[] }
  | { kind: "loved"; items: { title: string; poster: string | null; rating: number }[] };

const { W, SIDE, INNER, Y, FG, MUTED } = YEAR_FRAME;
const TOP = 440;

const WORDS = {
  hour: { one: "ساعة واحدة", two: "ساعتان", few: "ساعات", many: "ساعةً", hundred: "ساعة", en1: "hour", enN: "hours" },
  day: { one: "يوم", two: "يومان", few: "أيام", many: "يوماً", hundred: "يوم", en1: "day", enN: "days" },
  ep: { one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقةً", hundred: "حلقة", en1: "episode", enN: "episodes" },
  minute: { one: "دقيقة واحدة", two: "دقيقتان", few: "دقائق", many: "دقيقةً", hundred: "دقيقة", en1: "minute", enN: "minutes" },
};

export async function yearPageElement(c: YearFrameInput, page: YearPage) {
  const ar = c.locale !== "en";
  const dir = ar ? "rtl" : "ltr";
  const row = ar ? "row-reverse" : "row";
  const t = (s: string, size: number, o: { color?: string; face?: "app" | "app-regular"; width?: number; lines?: number; ltr?: boolean } = {}) =>
    shapedText(s, { width: o.width ?? INNER, size, lineHeight: 1.2, maxLines: o.lines ?? 1, color: o.color ?? FG, dir: o.ltr ? "ltr" : dir, face: o.face ?? "app", align: "center" });
  const frame = await yearFrame(c);
  let body: ReactNode = null;

  if (page.kind === "time") {
    const hours = Math.round(page.minutes / 60);
    const days = Math.floor(page.minutes / 1440);
    const h = countedUnit(hours, WORDS.hour, c.locale);
    const d = countedUnit(days, WORDS.day, c.locale);
    const best = page.months.reduce((b, m, i) => (m.minutes > (page.months[b]?.minutes ?? -1) ? i : b), 0);
    const peak = Math.max(1, ...page.months.map((m) => m.minutes));
    const [kick, big, unit, line, bestT] = await Promise.all([
      t(ar ? "قضيت مع الشاشة" : "You spent with the screen", 40, { color: MUTED, face: "app-regular" }),
      h.value ? t(h.value, 240, { color: Y, ltr: true }) : null,
      t(h.unit, h.value ? 64 : 120, { color: h.value ? FG : Y }),
      /* «أي 17 يوماً كاملة» — والواحدُ والاثنان بلا رقمٍ وبوصفٍ يطابقهما */
      days > 0
        ? t(ar ? (days === 1 ? "أي يومٌ كامل" : days === 2 ? "أي يومان كاملان" : `أي ${d.value} ${d.unit} كاملة`) : `That's ${days} full ${d.unit}`, 38, { color: MUTED, face: "app-regular" })
        : null,
      page.months[best]?.minutes ? t(ar ? `${page.months[best].label} شهرك الأعلى` : `${page.months[best].label} was your peak`, 34, { color: MUTED, face: "app-regular" }) : null,
    ]);
    const barW = Math.floor((INNER - 11 * 16) / 12);
    body = (
      <>
        <div style={{ position: "absolute", top: TOP, left: SIDE, width: INNER, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {img(kick)}
          {img(big)}
          {img(unit)}
          {img(line)}
        </div>
        <div style={{ position: "absolute", top: 1080, left: SIDE, width: INNER, height: 300, display: "flex", flexDirection: row, alignItems: "flex-end", gap: 16 }}>
          {page.months.map((m, i) => (
            <div key={i} style={{ width: barW, height: Math.max(10, Math.round((m.minutes / peak) * 300)), borderRadius: 10, backgroundColor: i === best ? Y : "#2A2A2A", display: "flex" }} />
          ))}
        </div>
        <div style={{ position: "absolute", top: 1400, left: SIDE, width: INNER, display: "flex", justifyContent: "center" }}>{img(bestT)}</div>
      </>
    );
  } else if (page.kind === "top") {
    const e = countedUnit(page.episodes, WORDS.ep, c.locale);
    const sub = page.movie ? (ar ? "فيلم سنتك" : "Your movie of the year") : ar ? "مسلسل سنتك" : "Your show of the year";
    /* 🆕 T602 (q30 «ب») — **المنصّةُ في الصورة كما في الشاشة**: الثاني والثالث ملصقان متجاوران تحت الأوّل برقم ترتيبهما وساعاتهما.
       الملصقُ الأوّل يصغر (٢٦٠ بدل ٤٤٠) كي تبقى المنصّةُ داخل منطقة الأمان (٤٤٠–١٥٧٠)؛ وبلا ثانٍ يبقى كما كان */
    const next = (page.next ?? []).slice(0, 2);
    const podium = next.length > 0;
    /* تحت الساعة دقائق (كـ`hm` في الشاشة) لا «ساعة واحدة» مقرّبة */
    const hoursOf = (m: number) => {
      const h = m < 60 ? countedUnit(Math.max(1, Math.round(m)), WORDS.minute, c.locale) : countedUnit(Math.round(m / 60), WORDS.hour, c.locale);
      return h.value ? `${h.value} ${h.unit}` : h.unit;
    };
    const SW = 130;
    const CW = SW + 110;
    const tdir = (x: string) => (/[\u0600-\u06FF]/.test(x) ? "rtl" : "ltr");
    const [kick, title, eps, ...side] = await Promise.all([
      t(sub, 40, { color: MUTED, face: "app-regular" }),
      t(page.title, podium ? 56 : 64, { lines: podium ? 1 : 2 }),
      !page.movie && page.episodes > 0 ? t(e.value ? `${e.value} ${e.unit}` : e.unit, podium ? 38 : 44, { color: Y }) : null,
      ...next.flatMap((x, i) => [
        shapedText(String(i + 2), { width: SW, size: 44, lineHeight: 1.1, maxLines: 1, color: Y, dir: "ltr", face: "app", align: "center" }),
        shapedText(x.title, { width: CW, size: 26, lineHeight: 1.2, maxLines: 1, color: FG, dir: tdir(x.title), face: "app", align: "center" }),
        shapedText(hoursOf(x.minutes), { width: CW, size: 24, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular", align: "center" }),
      ]),
    ]);
    const PW = podium ? 260 : 440;
    body = (
      <div style={{ position: "absolute", top: TOP, left: SIDE, width: INNER, display: "flex", flexDirection: "column", alignItems: "center", gap: podium ? 22 : 28 }}>
        {img(kick)}
        <div style={{ width: PW, height: PW * 1.5, borderRadius: 28, overflow: "hidden", display: "flex", border: "3px solid rgba(255,255,255,0.12)", backgroundColor: "#111111" }}>
          {page.poster ? <img src={page.poster} width={PW} height={PW * 1.5} style={{ objectFit: "cover" }} /> : null}
        </div>
        {img(title)}
        {img(eps)}
        {podium ? (
          <div style={{ display: "flex", flexDirection: row, justifyContent: "center", gap: 30, marginTop: 4 }}>
            {next.map((x, i) => (
              <div key={i} style={{ width: CW, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: SW, height: SW * 1.5, borderRadius: 18, overflow: "hidden", display: "flex", backgroundColor: "#111111" }}>
                  {x.poster ? <img src={x.poster} width={SW} height={SW * 1.5} style={{ objectFit: "cover" }} /> : null}
                </div>
                {img(side[i * 3] ?? null)}
                {img(side[i * 3 + 1] ?? null)}
                {img(side[i * 3 + 2] ?? null)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  } else if (page.kind === "taste") {
    const g = page.genres.slice(0, 3);
    const top = Math.max(1, g[0]?.pct ?? 1);
    const [kick, persona, ...rows] = await Promise.all([
      t(ar ? "بصمة ذائقتك" : "Your taste fingerprint", 40, { color: MUTED, face: "app-regular" }),
      t(page.persona, 104, { color: Y, lines: 2 }),
      ...g.flatMap((x) => [
        shapedText(x.name, { width: INNER - 200, size: 44, lineHeight: 1.2, maxLines: 1, color: FG, dir, face: "app" }),
        shapedText(`${x.pct}%`, { width: 180, size: 44, lineHeight: 1.2, maxLines: 1, color: Y, dir: "ltr", face: "app" }),
      ]),
    ]);
    body = (
      <>
        <div style={{ position: "absolute", top: TOP, left: SIDE, width: INNER, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {img(kick)}
          {img(persona)}
        </div>
        <div style={{ position: "absolute", top: 860, left: SIDE, width: INNER, display: "flex", flexDirection: "column", gap: 44 }}>
          {g.map((x, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: row, justifyContent: "space-between", alignItems: "center" }}>
                {img(rows[i * 2] ?? null)}
                {img(rows[i * 2 + 1] ?? null)}
              </div>
              <div style={{ width: INNER, height: 22, borderRadius: 11, backgroundColor: "#232323", display: "flex", flexDirection: row }}>
                <div style={{ width: Math.round((x.pct / top) * INNER), height: 22, borderRadius: 11, backgroundColor: Y, display: "flex" }} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else {
    const items = page.items.slice(0, 4);
    const [kick, ...rows] = await Promise.all([
      t(ar ? "أكثر ما أحببت" : "What you loved most", 40, { color: MUTED, face: "app-regular" }),
      ...items.flatMap((x, i) => [
        shapedText(String(i + 1), { width: 60, size: 64, lineHeight: 1.1, maxLines: 1, color: Y, dir: "ltr", face: "app", align: "center" }),
        shapedText(x.title, { width: INNER - 360, size: 46, lineHeight: 1.2, maxLines: 2, color: FG, dir, face: "app" }),
        shapedText(`${x.rating}/10`, { width: INNER - 360, size: 38, lineHeight: 1.2, maxLines: 1, color: Y, dir: "ltr", face: "app" }),
      ]),
    ]);
    body = (
      <>
        <div style={{ position: "absolute", top: TOP, left: SIDE, width: INNER, display: "flex", justifyContent: "center" }}>{img(kick)}</div>
        <div style={{ position: "absolute", top: 530, left: SIDE, width: INNER, display: "flex", flexDirection: "column", gap: 28 }}>
          {items.map((x, i) => (
            <div key={i} style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 28 }}>
              {img(rows[i * 3] ?? null)}
              <div style={{ width: 120, height: 180, borderRadius: 14, overflow: "hidden", display: "flex", backgroundColor: "#111111", border: "2px solid rgba(255,255,255,0.10)" }}>
                {x.poster ? <img src={x.poster} width={120} height={180} style={{ objectFit: "cover" }} /> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: ar ? "flex-end" : "flex-start" }}>
                {img(rows[i * 3 + 1] ?? null)}
                {/* التقييمُ لاتينيٌّ يُرسم من اليسار — يُقصّ صندوقُه إلى عرضه الحقيقيّ فيلتصق بحافّة الاسم في اللغتين */}
                {rows[i * 3 + 2] ? <div style={{ width: rows[i * 3 + 2]!.used, overflow: "hidden", display: "flex" }}>{img(rows[i * 3 + 2]!)}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div style={{ width: W, height: YEAR_CARD.height, display: "flex", flexDirection: "column", backgroundColor: "#050505", position: "relative" }}>
      {frame.glow}
      {frame.header}
      {body}
      {frame.footer}
    </div>
  );
}
