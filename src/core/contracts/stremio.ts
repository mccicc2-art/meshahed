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
}

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
