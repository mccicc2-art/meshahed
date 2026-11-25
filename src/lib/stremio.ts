import "server-only";
import { issueLinkToken, linkOwner, linkStateOf, recordSignal, revokeLinkToken, type IssueOutcome, type LinkOwner } from "@/lib/linkTokens";
import { NUVIO_TOKEN_RE, STREMIO_TOKEN_RE, addonClientOf, type AddonClient, type StremioVideo } from "@/core/stremioId";

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
 * 🆕 **Nuvio — الإضافةُ نفسُها برابطٍ لحاله** (هجرة ٢٦٧، أحمد ٢٦ نوفمبر «ربط ستريميو لحال ونوفيو لحال»): Nuvio يثبّت إضافاتِ
 * Stremio، والمساراتُ واحدة؛ والفرقُ جدولُ الرابط (`nuvio_links`) وبادئةُ رمزه (`ln_`) — فالإشارةُ تقول «Nuvio» بلا تخمين،
 * وخانتُه غيرُ خانة Stremio.
 *
 * ⚠️ **الفشلُ صمت**: قبل هجرة ٢٢٢ (أو ٢٦٧ لـNuvio) يغيب الجدول — فلا رابطَ يُصدر، والإضافةُ لا تجد صاحباً فلا تسجّل شيئاً.
 */

/* ⚖️ **الرموزُ في `linkTokens.ts`** منذ صار لها جدولٌ ثانٍ (سيرفراتُ البيت، هجرة ٢٣٥) — القواعدُ نفسُها، وهنا أسماءُ الإضافة وحدها */
const TABLE = { stremio: "stremio_links", nuvio: "nuvio_links" } as const;
const PREFIX = { stremio: "ls_", nuvio: "ln_" } as const;
const SHAPE = { stremio: STREMIO_TOKEN_RE, nuvio: NUVIO_TOKEN_RE } as const;

/** يُصدر رابطاً جديداً (ويُسقط القديم لهذا التطبيق وحده) ويعيد الرمزَ **مرّةً واحدة** — أو «لا خانة» (هجرة ٢٣٧) أو فشلاً */
export async function issueStremioToken(userId: string, client: AddonClient = "stremio"): Promise<IssueOutcome> {
  return issueLinkToken(TABLE[client], PREFIX[client], userId);
}

export async function revokeStremioToken(userId: string, client: AddonClient = "stremio"): Promise<boolean> {
  return revokeLinkToken(TABLE[client], userId);
}

/** هل للعضو رابطٌ حيّ؟ ومتى صدر — لشاشة «اربط Stremio» القديمة (Stremio وحده) */
export async function stremioLinkOf(userId: string): Promise<{ linked_at: string } | null> {
  const st = await linkStateOf("stremio_links", userId);
  return st ? { linked_at: st.linked_at } : null;
}

/**
 * صاحبُ الرمز وهل رابطُه داخل خاناته (`active`، هجرة ٢٣٧) ومن أيِّ تطبيق (`client`) — `null` لرمزٍ لا شكلَ له أو لا وجودَ له
 * أو نام ٩٠ يوماً. 🆕 **البادئةُ تختار الجدول**: رمزُ Nuvio لا يُبحث عنه في روابط Stremio، والعكس.
 */
export async function stremioOwner(token: string): Promise<(LinkOwner & { client: AddonClient }) | null> {
  const client = addonClientOf(token);
  if (!client) return null;
  const owner = await linkOwner(TABLE[client], token, SHAPE[client]);
  return owner ? { ...owner, client } : null;
}

/**
 * يسجّل «فتحها» (طلبُ المصادر) أو «شغّلها» (`played` — طلبُ الترجمة عند بدء التشغيل) باسم التطبيق — صامتٌ إن فشل
 * (ردُّ Stremio أو Nuvio لا ينتظر قاعدتنا ولا يسقط بها).
 */
export async function recordStremioSignal(userId: string, video: StremioVideo, tmdbId: number, played = false, client: AddonClient = "stremio"): Promise<void> {
  await recordSignal(userId, client, video.kind, tmdbId, video.kind === "tv" ? video.season : null, video.kind === "tv" ? video.episode : null, played);
}
