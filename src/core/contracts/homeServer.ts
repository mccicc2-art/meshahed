/**
 * 🆕 **عقدُ سيرفرات البيت** — `GET /api/v1/me/home-server` و`POST …/link` (هجرة ٢٣٥).
 * 🔑 **رابطٌ واحدٌ للسيرفرات الثلاثة، يُعاد مرّةً واحدة** (الرمزُ لا يُحفظ عندنا — بصمتُه فقط)، ولـLoopz+ وحده.
 * والأسئلةُ نفسُها («شفتها؟») تصل في `GET /api/v1/me/stremio` مع إشارات Stremio بحقل `source`.
 */

export interface HomeServerState {
  /** Loopz+ — الميزةُ له وحدَه («ونعم فقط للمشتركين»)؛ `false` ⇒ الشاشةُ تعرض الترقية ولا تُصدر رابطاً */
  plus: boolean;
  linked: boolean;
  linked_at: string | null;
  /** آخرُ ما وصل من سيرفرٍ بهذا الرابط — «يعمل» يُرى قبل أن يُسأل العضوُ عن شيء */
  used_at: string | null;
}

export interface HomeServerLinkBody {
  action: "issue" | "revoke";
}

export interface HomeServerLinkResult {
  linked: boolean;
  /** يُعاد مرّةً واحدةً عند الإصدار */
  webhook_url?: string;
}
