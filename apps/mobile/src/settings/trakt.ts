import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { api, write } from "../api";
import type { TraktPending } from "./TraktPendingSheet";

/**
 * ====== 🆕 R281 — استيرادُ Trakt من التطبيق ======
 *
 * **لماذا هكذا**: Trakt لا يقبل عنوانَ عودةٍ إلّا https مسجّلاً، فالرحلةُ تعود إلى عودة الموقع (`/api/trakt/callback`) وهي
 * تحوّلها إلى `com.loopztv.app://trakt` حين تبدأ الحالةُ بـ`app.` — دون أن تصرف الشِفرة. **المُتحقِّقُ (PKCE) يولد هنا ولا
 * يغادر إلّا مع الشِفرة إلى خادمنا** برمز العضو؛ فشِفرةٌ يلتقطها تطبيقٌ آخر يدّعي المخطّطَ نفسَه لا تساوي شيئاً.
 * والوصفةُ وصفةُ ربط Google (`linkGoogle.ts`): `expo-crypto` و`openAuthSessionAsync` — في البناء منذ زمن، فلا ثنائيَّ جديد.
 *
 * ⚖️ الاستيرادُ نفسُه على الخادم (`runTraktImport`، قارئُه الأوّل عودةُ الموقع): ما في المكتبة لا يُكتب فوقه، وتقييمُ Loopz
 * يغلب، والإذنُ يُلغى بعد الجلب. والطلبُ قد يطول بمكتبةٍ كبيرة — الشاشةُ تقول «خلّ التطبيق مفتوح».
 */
export type TraktOutcome =
  /* 🆕 T507 — `reviews`: تعليقاتُه على الأفلام والمسلسلات صارت مراجعات (خادمٌ قبل T507 لا يعيده ⇐ صفر) */
  /* 🆕 T516 — `pending`: تعليقاتُه بلا تقييم بنصوصها (خادمٌ قبل T516 لا يعيدها ⇐ لا ورقة) */
  | { kind: "done"; shows: number; episodes: number; movies: number; reviews: number; unmatched: string[]; pending: TraktPending[] }
  | { kind: "cancel" }
  | { kind: "failed" };

/** يطابق `TRAKT_APP_RETURN` في الخادم — مخطّطُ `app.json` */
const RETURN = "com.loopztv.app://trakt";
const HEX = "0123456789abcdef";

function hex(n: number): string {
  let out = "";
  for (const b of Crypto.getRandomBytes(n)) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

function param(url: string, name: string): string | null {
  const m = new RegExp(`[?&#]${name}=([^&#]*)`).exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1];
  }
}

export async function importFromTrakt(): Promise<TraktOutcome> {
  try {
    /* ٩٦ حرفاً ستّ عشريّاً: ضمن ٤٣–١٢٨ وحروفُها من أبجديّة PKCE */
    const verifier = hex(48);
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const state = `app.${hex(16)}`;

    const { data } = await api<{ url: string }>(`/api/v1/me/import/trakt?challenge=${challenge}&state=${state}`);
    if (typeof data?.url !== "string" || !data.url.startsWith("https://")) return { kind: "failed" };

    const back = await WebBrowser.openAuthSessionAsync(data.url, RETURN);
    if (back.type !== "success") return back.type === "cancel" || back.type === "dismiss" ? { kind: "cancel" } : { kind: "failed" };
    const error = param(back.url, "error");
    if (error) return error === "access_denied" ? { kind: "cancel" } : { kind: "failed" };
    const code = param(back.url, "code");
    // حالةٌ لا تطابق ما أرسلناه ليست رحلتَنا — لا تُصرف شِفرتُها
    if (!code || param(back.url, "state") !== state) return { kind: "failed" };

    const done = await write<{ shows: number; episodes: number; movies: number; reviews?: number; unmatched: string[]; pending?: TraktPending[] }>(
      "/api/v1/me/import/trakt",
      { code, verifier },
    );
    return {
      kind: "done",
      ...done,
      reviews: Number(done.reviews) || 0,
      unmatched: Array.isArray(done.unmatched) ? done.unmatched : [],
      pending: Array.isArray(done.pending) ? done.pending : [],
    };
  } catch {
    return { kind: "failed" };
  }
}
