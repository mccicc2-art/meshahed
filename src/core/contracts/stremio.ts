/**
 * 🆕 **عقدُ Stremio** — `GET /api/v1/me/stremio` و`POST …/link` و`POST …/answer` (خطّةُ Stremio، ٢٢ أكتوبر).
 *
 * 🔑 **الإشارةُ سؤالٌ لا تعليم**: «فتحتَ S1 E5 في Stremio — شفتها؟». لا يُعلَّم شيءٌ إلّا بجواب العضو (✓)،
 * و✓ على حلقةٍ = «شاهدتُ حتى هنا» (`markWatchedUpTo`)، وعلى فيلمٍ = مشاهَدٌ ويدخل المكتبة.
 * ⚠️ **والنصوصُ هنا أسماءٌ وأرقامٌ لا جمل**: التطبيقُ يكتب «S1 E5 · شفتها؟» و«قبل ساعة» بقاموسه وساعته.
 */

export interface StremioSignal {
  id: number;
  kind: "tv" | "movie";
  tmdb_id: number;
  title: string;
  /** مسارُ TMDB للصورة 16:9: لقطةُ الحلقة، وإلّا خلفيّةُ العمل، وإلّا الملصق — `null` إن غابت كلُّها */
  image_path: string | null;
  season: number | null;
  episode: number | null;
  /** ISO — متى فتحها آخرَ مرّة */
  seen_at: string;
  /** 🆕 هجرة ٢٣٥ — من أين جاء السؤال: Stremio أو سيرفرٌ في البيت. ⚠️ اختياريٌّ لأجل ترتيب النشر: خادمٌ أقدم لا يرسله (= Stremio) */
  source?: SignalSource;
  /**
   * 🆕 T361 (هجرة ٢٤٢) — **سجّله Loopz بنفسه** («سجّل بلا سؤال») ولم يره صاحبُه بعد: البطاقةُ تقول «أضفناه لمكتبتك» وتعرض نجوماً
   * للفيلم أو «حسناً» للحلقة، لا ✓/✕. يصل لمن طلب `?auto=1` وحدَه.
   */
  auto?: boolean;
  /** 🆕 T361 — ملصقُ الفيلم لتقييمه من البطاقة (`track/rate` يحفظه مع التقييم) — للفيلم المسجَّل تلقائياً وحدَه */
  poster_path?: string | null;
}

/** 🆕 T361 — `POST /api/v1/me/stremio/notice` `{id}`: رأى ما سُجّل تلقائياً (قيّمه أو «حسناً») فيخرج من البطاقة */
export interface StremioNoticeBody {
  id: number;
}

export type SignalSource = "stremio" | "plex" | "jellyfin" | "emby" | "kodi";
export const SIGNAL_SOURCES: readonly SignalSource[] = ["stremio", "plex", "jellyfin", "emby", "kodi"];
/** قيمةٌ معروفةٌ أو Stremio — صفٌّ قبل العمود، أو قيمةٌ لا نعرفها */
export function signalSourceOf(v: unknown): SignalSource {
  return typeof v === "string" && (SIGNAL_SOURCES as readonly string[]).includes(v) ? (v as SignalSource) : "stremio";
}
/** اسمُ المصدر كما يُكتب — أسماءُ منتجاتٍ لا تُترجم */
export const SIGNAL_SOURCE_NAME: Record<SignalSource, string> = { stremio: "Stremio", plex: "Plex", jellyfin: "Jellyfin", emby: "Emby", kodi: "Kodi" };

export interface StremioState {
  /** Loopz+ — الميزةُ له وحدَه (قرار ١)؛ `false` ⇒ الشاشةُ تعرض الترقية ولا تُصدر رابطاً */
  plus: boolean;
  linked: boolean;
  linked_at: string | null;
  /** المنتظرةُ، الأحدثُ أوّلاً — أقصاها ٥٠ */
  items: StremioSignal[];
  /** عددُ المنتظرة كلِّها (قد يزيد على `items`) */
  count: number;
}

export interface StremioLinkBody {
  action: "issue" | "revoke";
}

export interface StremioLinkResult {
  /** يُعاد مرّةً واحدةً عند الإصدار — والرمزُ نفسُه لا يُحفظ عندنا (بصمتُه فقط) */
  manifest_url?: string;
  /** `stremio://…/manifest.json` — يفتح Stremio على شاشة التثبيت */
  install_url?: string;
  /** صفحةُ التثبيت في Stremio Web لمن لا يملك التطبيق */
  web_install_url?: string;
  linked: boolean;
}

export interface StremioAnswerBody {
  id: number;
  watched: boolean;
}
