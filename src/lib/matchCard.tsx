/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import { OG_FAMILY } from "@/lib/og";
import { shapedText } from "@/lib/reviewCard";
import { shareFooter } from "@/lib/shareFooter";
import type { Locale } from "@/core/i18n";

/**
 * ====== 🆕 بطاقةُ تطابق الذوق للقصص — ١٠٨٠×١٩٢٠ (ن٧ «ص٨» · س٩ «أ»، أحمد ٢٧ نوفمبر) ======
 *
 * **لماذا**: النسبةُ وحدَها رقم؛ **الحكمُ** («ذوقٌ واحدٌ تقريباً») هو ما يُشارَك — ثمّ النسبةُ كبيرةً، والمعرّفان، وسطرٌ للمستلم
 * «كم يشبه ذوقُك ذوقي؟» يدعوه ليقيس نفسه، **وما شاهدتماه معاً** دليلاً.
 * - **اسمُ الصديق وصورتُه بإذنه فقط** (`profiles.allow_match_card`، الهجرة ٢٧٣): بلا إذنٍ يُكتب «صديق» وتُرسم دائرةٌ فارغة — والبطاقةُ
 *   تُشارَك على حالها.
 * - **الصورتان بترتيب المعرّفين** تحتهما: الصديقُ يساراً وصاحبُ البطاقة يميناً بحلقةٍ صفراء — والسطرُ «@khld × @ahmed» يُقرأ كما تُرى.
 * - **الحكمُ من النسبة** (`matchVerdict`): الجدولُ نفسُه الذي اعتُمد في الاستوديو.
 */
export const MATCH_CARD = { width: 1080, height: 1920 };
const W = 1080;
const SIDE = 72;
const INNER = W - SIDE * 2;
const Y = "#FFD400";
const FG = "#F7F7F7";
const MUTED = "#A3A3A3";

/** الحكمُ من النسبة — ٩٠ فأكثر توأم، ٧٠–٨٩ ذوقٌ واحدٌ تقريباً، ٥٠–٦٩ نلتقي في الأهمّ، وما دونها «نختلف… إلّا» أكثرَ عملٍ مشترك */
export function matchVerdict(pct: number, locale: Locale, except: string | null): string {
  const en = locale === "en";
  if (pct >= 90) return en ? "Taste twins" : "توأم ذوق";
  if (pct >= 70) return en ? "Almost one taste" : "ذوقٌ واحدٌ تقريباً";
  if (pct >= 50) return en ? "We meet on what matters" : "نلتقي في الأهمّ";
  if (except) return en ? `Different on everything… except ${except}` : `نختلف في كلّ شيء… إلّا ${except}`;
  return en ? "Different on almost everything" : "نختلف في كلّ شيءٍ تقريباً";
}

export type MatchCardInput = {
  locale: Locale;
  pct: number;
  verdict: string;
  me: { handle: string; avatar: string | null; initial: string };
  /** `null` ⇒ لم يأذن الصديق: «صديق» ودائرةٌ بلا صورة */
  friend: { handle: string; avatar: string | null; initial: string } | null;
  together: (string | null)[];
};

function face(src: string | null, initial: string, ring: string, size: number) {
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, border: `6px solid ${ring}`, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#141414" }}>
      {src ? <img src={src} width={size} height={size} style={{ objectFit: "cover" }} /> : <div style={{ display: "flex", fontSize: size * 0.42, color: ring }}>{initial}</div>}
    </div>
  );
}

/** سطرٌ مقصوصٌ إلى عرضه الحقيقيّ (بهامشٍ لذيل الحرف الأخير) — فيلتصق بعلامة × بينهما */
function crop(t: { src: string; width: number; height: number; used: number }, rtl: boolean) {
  const used = Math.min(t.width, t.used + 14);
  return (
    <div style={{ display: "flex", width: used, overflow: "hidden" }}>
      <img src={t.src} width={t.width} height={t.height} style={rtl ? { marginLeft: used - t.width } : {}} />
    </div>
  );
}

export async function matchCardElement(c: MatchCardInput) {
  const en = c.locale === "en";
  const friendHandle = c.friend ? c.friend.handle : en ? "a friend" : "صديق";
  const [footer, verdict, friendLine, meLine, ask, label] = await Promise.all([
    shareFooter({ width: INNER, height: 96, cta: en ? "Taste match" : "تطابق الذوق", icon: "match", rtl: !en }),
    /* الحكمُ الطويل («إلّا Breaking Bad») يصغر ليبقى سطراً واحداً: الاسمُ اللاتينيُّ لا ينكسر بين سطرين */
    shapedText(c.verdict, { width: INNER, size: c.verdict.length > 22 ? 50 : 76, lineHeight: 1.25, maxLines: 2, color: Y, dir: en ? "ltr" : "rtl", align: "center" }),
    /* المعرّفان بترتيب الصورتين فوقهما: الصديقُ يساراً وصاحبُ البطاقة يميناً — كلٌّ صورةٌ وحدَه فلا يقلب «صديق» السطر */
    shapedText(friendHandle, { width: 420, size: 36, lineHeight: 1.2, maxLines: 1, color: FG, dir: c.friend ? "ltr" : en ? "ltr" : "rtl", face: "app-regular" }),
    shapedText(c.me.handle, { width: 420, size: 36, lineHeight: 1.2, maxLines: 1, color: FG, dir: c.me.handle.startsWith("@") || en ? "ltr" : "rtl", face: "app-regular" }),
    shapedText(en ? "How close is your taste to mine?" : "كم يشبه ذوقُك ذوقي؟", { width: INNER, size: 34, lineHeight: 1.2, maxLines: 1, color: MUTED, dir: en ? "ltr" : "rtl", face: "app-regular", align: "center" }),
    c.together.length
      ? shapedText(en ? "Watched by both of us" : "شاهدناها معاً", { width: INNER, size: 28, lineHeight: 1.2, maxLines: 1, color: MUTED, dir: en ? "ltr" : "rtl", face: "app-regular", align: "center" })
      : Promise.resolve(null),
  ]);
  const posters = c.together.slice(0, 4);
  const PW = 196;
  const PH = 294;
  return (
    <div style={{ width: W, height: 1920, display: "flex", flexDirection: "column", alignItems: "center", background: "#050505", fontFamily: OG_FAMILY, position: "relative" }}>
      <div style={{ position: "absolute", left: SIDE, top: 270, width: INNER, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ display: "flex", flexDirection: "row" }}>
          {face(c.friend?.avatar ?? null, c.friend ? c.friend.initial : "?", "#F7F7F7", 176)}
          <div style={{ display: "flex", marginLeft: -36 }}>{face(c.me.avatar, c.me.initial, Y, 176)}</div>
        </div>
        <img src={verdict.src} width={verdict.width} height={verdict.height} />
        <div style={{ display: "flex", fontSize: 220, lineHeight: 1, color: FG, letterSpacing: -6 }}>{`${c.pct}%`}</div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16 }}>
          {crop(friendLine, !c.friend && !en)}
          <div style={{ display: "flex", fontSize: 34, color: MUTED }}>×</div>
          {crop(meLine, !c.me.handle.startsWith("@") && !en)}
        </div>
        <img src={ask.src} width={ask.width} height={ask.height} />
        {posters.length && label ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: 24 }}>
            <img src={label.src} width={label.width} height={label.height} />
            {/* بترتيب القراءة: الأوّلُ يميناً في العربيّة */}
            <div style={{ display: "flex", flexDirection: en ? "row" : "row-reverse", gap: 20 }}>
              {posters.map((p, i) => (
                <div key={i} style={{ display: "flex", width: PW, height: PH, borderRadius: 18, overflow: "hidden", border: "2px solid #262626", background: "#141414" }}>
                  {p ? <img src={p} width={PW} height={PH} style={{ objectFit: "cover" }} /> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: SIDE, top: 1470, display: "flex" }}>{footer}</div>
    </div>
  );
}
