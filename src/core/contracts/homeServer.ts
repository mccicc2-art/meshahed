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
  /** 🆕 هجرة ٢٣٦ — Kodi برابطه الخاصّ. ⚠️ اختياريٌّ لأجل ترتيب النشر: خادمٌ أقدمُ لا يرسله */
  kodi?: KodiState;
}

export interface KodiState {
  linked: boolean;
  /** اسمُ جهاز Kodi كما أرسلته الإضافة («Living room») */
  device: string | null;
  linked_at: string | null;
  used_at: string | null;
  /** رمزُ ربطٍ حيٌّ ينتظر — التطبيقُ يسأل وهو يعرضه، فيعرف أنه استُعمل حين يصير `linked` */
  pairing: boolean;
}

export interface KodiBody {
  action: "code" | "revoke";
}

export interface KodiResult {
  linked: boolean;
  /** ستّةُ أرقام — يُعاد مرّةً عند الطلب */
  code?: string;
  expires_at?: string;
}

export interface HomeServerLinkBody {
  action: "issue" | "revoke";
}

export interface HomeServerLinkResult {
  linked: boolean;
  /** يُعاد مرّةً واحدةً عند الإصدار */
  webhook_url?: string;
}
