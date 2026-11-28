/**
 * 🆕 **عقدُ مدار الأجهزة** — `GET /api/v1/me/links` و`POST /api/v1/me/links` (هجرة ٢٣٧، أحمد ٥ نوفمبر).
 *
 * 🔑 **صفحةُ «الربط» تقرأ من هنا وحده**: كم خانة، وما في كلٍّ منها، وأيُّها موقوفٌ بعد النزول، و«سجّل بلا سؤال».
 * والإصدارُ نفسُه يبقى في أبوابه (`me/stremio/link` · `me/home-server/link` بنوعه · `me/home-server/kodi`) لأنّ لكلٍّ منها ردَّه.
 * ⚠️ **الحالةُ أسماءٌ وأرقامٌ لا جمل**: التطبيقُ يكتب «١ من ١ · مع بلس ٥» بقاموسه.
 */
import type { DeviceKind, HomeKind, LinkTier, PlatformKind } from "../deviceLinks.ts";

export interface DeviceLinkInfo {
  kind: DeviceKind;
  /** في المدار (شغّالٌ أو موقوف) */
  linked: boolean;
  /** موقوفٌ: زاد على الخانات بعد النزول — يعود باختياره في «اختر ما يبقى» أو باشتراك */
  stopped: boolean;
  /** يمرّ في الرابط القديم المشترك (قبل ٢٣٧) لا في رابطه الخاصّ — فكُّه يفكّ ما يشاركه */
  shared: boolean;
  linked_at: string | null;
  used_at: string | null;
  /** كم عملاً سجّله هذا الجهاز في مكتبة العضو (شارةُ المصدر) — لتأكيد الفكّ «الـN عملاً تبقى في مكتبتك» */
  works: number;
  /** 🆕 آخرُ ما وصل من هذا الجهاز — اسمُ العمل وحلقتُه («آخر ما وصل قبل ساعتين · The Bear S3 E4»). `null` قبل أوّل حدث */
  last?: { title: string; season: number | null; episode: number | null } | null;
}

/**
 * 🆕 **منصّةُ بثٍّ مربوطة** (هجرة ٢٦٥، نتفليكس أوّلاً) — تأخذ خانةً كأيِّ جهاز. الدخولُ نفسُه في متصفّح التطبيق على الجهاز،
 * فما هنا ما يعرفه الخادم: الملفُّ الشخصيّ، ومتى زامن، وأحدثُ مشاهدةٍ قُرئت، و«من الآن فقط».
 */
export interface PlatformLinkInfo {
  platform: PlatformKind;
  stopped: boolean;
  profile_label: string | null;
  linked_at: string;
  /** آخرُ مزامنة */
  synced_at: string | null;
  /** أحدثُ مشاهدةٍ قُرئت — المزامنةُ التالية تقرأ ما بعدها */
  last_item_at: string | null;
  /** «من الآن فقط»: ما شوهد قبله لا يدخل المكتبة. `null` = «استيراد الكل» */
  since_at: string | null;
  /** أعمالٌ في المكتبة جاءت منها (شارةُ المصدر) — لتأكيد الفكّ «الـN عملاً تبقى في مكتبتك» */
  works: number;
  /** 🆕 الأرقامُ الثلاثة في صفحة نتفليكس (الفكرة «ب»): مسلسلاتٌ وحلقاتٌ وأفلامٌ في المكتبة بمصدرها. اختياريّةٌ: خادمٌ أقدمُ لا يرسلها */
  counts?: { shows: number; episodes: number; movies: number };
  /** 🆕 T579 (هجرة ٢٧٢) — «إضافة مشاهداتي تلقائياً». `false`: ما يظهر في السجلّ يصير سؤالاً «شاهدتها؟». غائبٌ (خادمٌ أقدم) = نعم */
  auto_add?: boolean;
}

export interface DeviceLinksState {
  tier: LinkTier;
  /** `null` = بلا حدّ (الذهبيّ) */
  limit: number | null;
  /** الخاناتُ المستعملةُ الآن (الشغّالُ وحده) */
  used: number;
  /** خمسةُ أجهزةٍ بترتيب «من أجهزتك» الثابت */
  devices: DeviceLinkInfo[];
  /** الرابطُ القديمُ المشترك قبل أن يصل منه شيء — خانةٌ محسوبةٌ لا يُعرف سيرفرُها بعد */
  pending_legacy: { linked_at: string; stopped: boolean } | null;
  /** «سجّل بلا سؤال» كما اختاره العضو (الافتراضيُّ نعم) — يعمل لـLoopz+ وحده، ولا يمسّ Stremio */
  auto_mark: boolean;
  /** Kodi: اسمُ الجهاز، ورمزُ ربطٍ ينتظر */
  kodi_device: string | null;
  kodi_pairing: boolean;
  /** `false` قبل الهجرة — التطبيقُ يعرض الشاشات القديمة */
  ready: boolean;
  /** 🆕 منصّاتُ البثّ المربوطة (هجرة ٢٦٥). اختياريّةٌ: خادمٌ أقدمُ لا يرسلها ⇐ لا منصّات */
  platforms?: PlatformLinkInfo[];
}

export type DeviceLinksBody =
  /** «اختر ما يبقى»: الأجهزةُ التي تبقى، بحدود الخانات */
  | { action: "keep"; kinds: DeviceKind[]; platforms?: PlatformKind[] }
  /** «سجّل بلا سؤال» */
  | { action: "auto_mark"; value: boolean }
  /** فكُّ جهازٍ واحد (والرابطِ القديمِ إن كان يمرّ فيه) */
  | { action: "revoke"; kind: DeviceKind }
  /** فكُّ الرابط القديم المشترك قبل أن يصل منه شيء (`pending_legacy`) */
  | { action: "revoke_legacy" };

/**
 * 🆕 `POST /api/v1/me/links/netflix` (هجرة ٢٦٥):
 * - `link`: بعد الدخول واختيار الملفّ الشخصيّ وسؤال الاستيراد — `import_all`: «استيراد الكل» (`true`) أو «من الآن فقط» (`false`).
 * - `sync`: مزامنةٌ تمّت على الجهاز — `last_item_at` أحدثُ مشاهدةٍ قُرئت (ISO) أو `null` إن لم يُقرأ جديد.
 * - `revoke`: «فك الربط» — ما دخل المكتبة يبقى.
 */
export type NetflixLinkBody =
  | { action: "link"; profile_label?: string | null; import_all: boolean }
  | { action: "sync"; last_item_at: string | null; added?: PlatformAdded }
  | { action: "revoke" }
  /** 🆕 T579 — مفتاحُ «إضافة مشاهداتي تلقائياً» */
  | { action: "auto_add"; value: boolean }
  /** 🆕 T579 — ما ظهر في السجلّ والمفتاحُ مطفأ: أسئلةُ «شاهدتها؟» (`auto`: مزامنةُ الفتح ⇒ إشعارُ جوال) */
  | { action: "ask"; items: PlatformAskItem[]; auto?: boolean };

/** 🆕 T579 — سؤالٌ واحد: حلقةٌ أو فيلمٌ طابقه الخادمُ في TMDB، ويومُ مشاهدته على المنصّة (ISO) */
export interface PlatformAskItem {
  kind: "tv" | "movie";
  tmdb_id: number;
  season: number | null;
  episode: number | null;
  at: string;
  /** اسمُ العمل كما يُقرأ — لإشعار الجوال وحده */
  title?: string | null;
}
/** 🆕 T579 — بابُ كلِّ منصّة (`platformRoute`) — مكتوبةً حرفاً: فاحصُ المسارات (`appRoutes.test`) لا يقرأ مساراً مركّباً */
export const PLATFORM_ROUTE = {
  netflix: "/api/v1/me/links/netflix",
  osn: "/api/v1/me/links/osn",
  shahid: "/api/v1/me/links/shahid",
  prime: "/api/v1/me/links/prime",
} as const satisfies Record<PlatformKind, string>;
/** أقصى ما يُسأل عنه في المزامنة الواحدة — ما زاد يبقى في سجلّ المنصّة لا في الرئيسيّة */
export const ASK_MAX = 200;

const ISO_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** الأسئلةُ بعد التنقية — ما لا يصحّ يسقط وحدَه */
export function parseAskItems(raw: unknown): PlatformAskItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PlatformAskItem[] = [];
  for (const v of raw.slice(0, ASK_MAX)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const kind = o.kind === "tv" || o.kind === "movie" ? o.kind : null;
    const id = typeof o.tmdb_id === "number" && Number.isInteger(o.tmdb_id) && o.tmdb_id > 0 ? o.tmdb_id : null;
    const at = typeof o.at === "string" && ISO_AT.test(o.at) && !Number.isNaN(Date.parse(o.at)) ? o.at : null;
    if (!kind || !id || !at) continue;
    const season = kind === "tv" ? count(o.season, 1000) : null;
    const episode = kind === "tv" ? count(o.episode, 20_000) : null;
    if (kind === "tv" && (season == null || episode == null || episode < 1)) continue;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : null;
    out.push({ kind, tmdb_id: id, season, episode, at, title });
  }
  return out;
}

/**
 * 🆕 المهمّة ٥٦١ — **ما وصل في هذه المزامنة**: سطرٌ في الجرس لكلِّ دفعة، وإشعارُ جوالٍ للمزامنة التلقائيّة وحدَها (أحمد «٢ب»: الإشعارُ
 * لا الشريط). الاسمُ كما جاء من المنصّة (أوّلُ عملٍ في الدفعة)، والحلقةُ حين تكون الدفعةُ حلقةً واحدة. غائبٌ = لا جديد (أو نسخةٌ أقدم).
 */
export interface PlatformAdded {
  episodes: number;
  movies: number;
  works: number;
  title: string | null;
  season: number | null;
  episode: number | null;
  /** `true` = مزامنةُ الفتح الصامتة ⇒ إشعارُ الجوال؛ «زامن الآن» يراها صاحبُها أمامه */
  auto: boolean;
}

const count = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** جسمُ `added` بعد التنقية — `null` لما لا يصحّ (فيُتجاهل ولا تفشل المزامنة) */
export function parsePlatformAdded(raw: unknown): PlatformAdded | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const episodes = count(o.episodes, 100_000);
  const movies = count(o.movies, 100_000);
  const works = count(o.works, 100_000);
  if (episodes == null || movies == null || works == null || episodes + movies === 0) return null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : null;
  const season = o.season == null ? null : count(o.season, 1000);
  const episode = o.episode == null ? null : count(o.episode, 20_000);
  return { episodes, movies, works: Math.max(1, works), title, season, episode, auto: o.auto === true };
}

export interface PlatformLinkResult {
  linked: boolean;
  /** 🆕 T579 — أسئلةٌ جديدةٌ كُتبت (`ask`) */
  asked?: number;
}

/** 🆕 T552 — `GET /api/v1/me/links/netflix`: «ما دخل» من المكتبة نفسِها (كلُّ ما عليه وسمُ `netflix`)، الأحدثُ أوّلاً —
 *  فتطابق الأرقامَ الثلاثة دائماً، وتظهر على أيِّ جهاز، ولا تُمسح بإعادة الربط */
export interface NetflixAddedItem {
  title: string;
  season: number | null;
  episode: number | null;
  at: string;
}
export interface NetflixAddedList {
  items: NetflixAddedItem[];
}

export type { DeviceKind, HomeKind, LinkTier, PlatformKind };
