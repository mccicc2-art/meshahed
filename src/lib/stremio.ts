import "server-only";
import { issueLinkToken, linkOwner, linkStateOf, recordSignal, revokeLinkToken } from "@/lib/linkTokens";
import { STREMIO_TOKEN_RE, type StremioVideo } from "@/core/stremioId";

/**
 * ====== 🆕 ربطُ Stremio — رمزُ الإضافة وإشاراتُها (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * 🔑 **الرمزُ يسكن في رابط الإضافة** (`/api/v1/stremio/<token>/manifest.json`) — Stremio يحفظ روابطَ إضافاته في حساب
 * العضو ويزامنها. فقدرتُه الوحيدةُ «سجّل أنّه فتح هذا»: لا يقرأ المكتبة ولا يعلّم شيئاً. والجدولُ يحفظ بصمتَه (sha-256)
 * لا هو، ولا يصله إلّا مفتاحُ الخدمة (هجرة ٢٢٢) — والوصولُ إليه في `linkTokens.ts` (سياجُ عميل الخدمة في `eslint.config.mjs`).
 *
 * ⚖️ **رمزٌ واحدٌ لكلِّ عضو**: «أصدر» يستبدل القديم (رابطٌ نُسخ في مكانٍ خطأ يموت بإصدار غيره)، و«ألغِ» يحذفه.
 * ويموت إن نام ٩٠ يوماً كرمز الودجت (A-05).
 *
 * ⚠️ **الفشلُ صمت**: قبل هجرة ٢٢٢ يغيب الجدول — فلا رابطَ يُصدر، والإضافةُ لا تجد صاحباً فلا تسجّل شيئاً.
 */

/* ⚖️ **الرموزُ في `linkTokens.ts`** منذ صار لها جدولٌ ثانٍ (سيرفراتُ البيت، هجرة ٢٣٥) — القواعدُ نفسُها، وهنا أسماءُ Stremio وحدها */

/** يُصدر رابطاً جديداً (ويُسقط القديم) ويعيد الرمزَ **مرّةً واحدة** — `null` إن غاب المفتاحُ أو الجدول */
export async function issueStremioToken(userId: string): Promise<string | null> {
  return issueLinkToken("stremio_links", "ls_", userId);
}

export async function revokeStremioToken(userId: string): Promise<boolean> {
  return revokeLinkToken("stremio_links", userId);
}

/** هل للعضو رابطٌ حيّ؟ ومتى صدر — لشاشة «اربط Stremio» */
export async function stremioLinkOf(userId: string): Promise<{ linked_at: string } | null> {
  const st = await linkStateOf("stremio_links", userId);
  return st ? { linked_at: st.linked_at } : null;
}

/** صاحبُ الرمز وهل هو Loopz+ — `null` لرمزٍ لا شكلَ له أو لا وجودَ له أو نام ٩٠ يوماً */
export async function stremioOwner(token: string): Promise<{ userId: string; plus: boolean } | null> {
  return linkOwner("stremio_links", token, STREMIO_TOKEN_RE);
}

/**
 * يسجّل «فتحها» (طلبُ المصادر) أو «شغّلها» (`played` — طلبُ الترجمة عند بدء التشغيل) — صامتٌ إن فشل
 * (ردُّ Stremio لا ينتظر قاعدتنا ولا يسقط بها).
 */
export async function recordStremioSignal(userId: string, video: StremioVideo, tmdbId: number, played = false): Promise<void> {
  await recordSignal(userId, "stremio", video.kind, tmdbId, video.kind === "tv" ? video.season : null, video.kind === "tv" ? video.episode : null, played);
}
