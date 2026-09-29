/**
 * ====== عقدُ «ملفّ الشخص» في التطبيق — `GET /api/v1/profile/{username}` (Phase 11-N · N0) ======
 *
 * 🔑 **الحمولةُ ما تقرؤه صفحةُ `/u/{username}` حرفاً** (`lib/profileCore.ts`): الرأسُ والأرقامُ والعلاقةُ، **والتبويباتُ الخمسة
 * بترتيب صاحبها وما أخفاه** (`orderedProfileTabs` · `hiddenTabs`)، وأقسامُ «نظرة عامّة» بترتيبه (`prefs.order` · D-581).
 * **والتطبيقُ يرسم ولا يصوغ**: القسمةُ (الأنمي خارج «مسلسلات» — D-941) والترتيبُ والترجمةُ (D-048) محسوبةٌ هنا.
 *
 * ⚖️ **ردٌّ واحدٌ بالتبويبات كلِّها لا ردٌّ لكلِّ تبويب** (تعديلٌ على مسودّة الخطّة §٣): الصفحةُ نفسُها تقرأ كلَّ شيءٍ في موجةٍ واحدة
 * (عدّاداتُ التبويبات منها — D-374)، فنداءٌ ثانٍ لتبويبٍ كان سيعيد الموجةَ كلَّها على الخادم. وسحبُ التبويبات يجد جارَه حاضراً.
 *
 * ⚖️ **بلا كثافة صاحب الملفّ** (قرارُ أحمد ٢٩ سبتمبر: «بحجمك انت»): حجمُ الملصق في التطبيق حجمُ القارئ — `prefs.density` لا تخرج.
 * 🔒 **الحسابُ الخاصّ**: الحارسُ في SQL (`can_view_profile`)؛ و`locked` هنا للرسم وحدَه (قفلٌ صريحٌ لا أصفارٌ تبدو عطلاً)، والمحتوى فارغ.
 */
import type { PersonLite } from "../people.ts";
import type { Density } from "../density.ts";

export const PROFILE_TAB_KEYS = ["favorites", "overview", "activity", "reviews", "lists"] as const;
export type ProfileTabKey = (typeof PROFILE_TAB_KEYS)[number];
export type ProfileSectionKey = "shows" | "movies" | "anime" | "artists" | "lists" | "ratings";

/** عملٌ في شبكةٍ أو صفّ — `genres` لتجميع شبكة «نظرة عامّة» بالتصنيف (D-645) */
export type ProfileTitle = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  genres: number[] | null;
};
/** مسلسلٌ بتقدّم صاحب الملفّ (نسبةٌ مئويّة من المعروض) */
export type ProfileShow = ProfileTitle & { progress: number };
export type ProfileArtist = { person_id: number; name: string | null; profile_path: string | null };
export type ProfileList = {
  id: string;
  name: string;
  kind: string | null;
  item_count: number;
  posters: string[];
  owner: string | null;
  owner_avatar: string | null;
  saves: number;
  reviews: number;
  rating: number | null;
};
/** تقييمٌ أو مراجعة — بقلوبها (D-583) وحالِ العمل عند **القارئ** لا صاحبِ الملفّ (D-850) */
export type ProfileReview = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  rating: number | null;
  review: string | null;
  has_spoiler: boolean;
  updated_at: string;
  likes: number;
  liked_by_me: boolean;
  mine: { added: boolean; watched: boolean; progress: number; dropped: boolean };
};
/** صفُّ «النشاط» بلبوس `/activity` (D-586) — الملصقُ رابطٌ جاهز */
export type ProfileActivity = {
  id: string;
  kind: "watch" | "rate" | "review" | "list";
  at: string;
  media_type: "tv" | "movie";
  tmdb_id: number;
  title: string;
  poster: string | null;
  season: number | null;
  episode: number | null;
  rating: number | null;
  list_name: string | null;
};

export type ProfilePayload = {
  /** 🆕 N1 — `density` **حجمُ ملصقات القارئ** (تفضيلُ ملفّه هو) لا صاحبِ الملفّ — قرارُ أحمد ٢٩ سبتمبر */
  viewer: { signed_in: boolean; is_me: boolean; density: Density };
  person: PersonLite & {
    cover_url: string | null;
    cover_pos: number | null;
    avatar_pos: number | null;
    bio: string | null;
    is_private: boolean;
    /** قائمتا المتابَعين/المتابِعين مقفلتان لغير صاحبها (الرقمان يبقيان) */
    hide_follow_lists: boolean;
    /** «عضو منذ» — لمشترك Plus وحدَه (كالصفحة) */
    joined_at: string | null;
    /** حسابُ Loopz الرسميّ (D-…: `isLoopz`) */
    system: boolean;
    /** حسابُ X الموثَّق وحدَه (D-839) */
    x: { handle: string; url: string } | null;
  };
  locked: boolean;
  /** 🆕 N2-fix — `requested_me`: طلب متابعتي وطلبُه قائم ⇐ الملفُّ يعرض قبولاً ورفضاً */
  /** 🆕 N2-fix2 — الحظر: `blocked_by_me` حظرتُه (يُعرض رفعُ الحظر) · `blocked_me` حظرني — وأيُّهما ⇒ `locked` والمحتوى فارغ */
  relation: { following: boolean; requested: boolean; follows_me: boolean; requested_me: boolean; blocked_by_me: boolean; blocked_me: boolean };
  counts: { followers: number; following: number; shows: number; movies: number; anime: number };
  weekly_ranks: { week: string; rank: number; total: number }[];
  /** ما يعرضه صاحبُ الملفّ من صفّ الأرقام، وسقفُ البطاقات في الصفوف (D-152) */
  display: { stats: boolean; stats_link: boolean; cards: number | null };
  /** التبويباتُ الظاهرةُ بترتيب صاحبها — فارغةٌ إن أطفأها كلَّها (D-667) */
  tabs: ProfileTabKey[];
  /** أقسامُ «نظرة عامّة» بترتيبه */
  sections: ProfileSectionKey[];
  favorites: { order: ("shows" | "movies")[]; shows: ProfileTitle[]; movies: ProfileTitle[]; anime: ProfileTitle[] };
  overview: {
    shows: ProfileShow[];
    anime: ProfileShow[];
    movies: ProfileTitle[];
    artists: ProfileArtist[];
    lists: ProfileList[];
    ratings: ProfileReview[];
  };
  activity: ProfileActivity[];
  reviews: ProfileReview[];
  lists: { public: ProfileList[]; saved: ProfileList[] };
  /** أدواتُ صاحب الملفّ (N3) — `null` لغيره.
   *  🆕 N3 — `saved_lists` رايةُ قسم «القوائم المحفوظة» (D-594، `profile_prefs.savedLists`) · `plus` لأنّ الرايةَ من البلس (D-791) */
  owner: { fav_list_id: string | null; fav_keys: string[]; section_order: Record<string, string[]>; saved_lists: boolean; plus: boolean } | null;
};

/**
 * 🆕 N3 — كتاباتُ صاحب الملفّ من الشاشة الأصليّة، كلٌّ فوق دالّة الويب نفسِها:
 * ترتيبُ صفوف قسمٍ (`saveProfileSectionOrder` ⇐ `profile_prefs.sectionOrder` — D-581) · رايةُ المحفوظات
 * (`setProfileSavedLists` — D-594). ترتيبُ المفضّلة يمرّ من `POST /api/v1/lists/reorder` القائم (D-567: قائمةٌ حقيقيّة).
 * المفاتيحُ بصيغة `sectionKeyOf` (`tv-1` · `movie-1` · `p-1` · `l-<uuid>`) — والتنقيةُ في الفعل لا هنا.
 */
export type ProfileSectionOrderBody = { section: "shows" | "movies" | "anime" | "artists" | "lists"; keys: string[] };
export type ProfileSavedListsBody = { on: boolean };

/**
 * اسمُ المستخدم من المسار: يُفكّ ترميزُه ويُطوى — ما لا يطابق شكلَ الاسم (أو معرّفاً) يُرفض قبل أيّ قراءة.
 * القاعدةُ نفسُها التي يطبّقها `getProfileByUsername` (حروفٌ صغيرةٌ وأرقامٌ وشرطةٌ سفليّة حتى ٢٤).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseProfileHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    return null;
  }
  v = v.trim().replace(/^@/, "");
  if (UUID.test(v)) return v;
  v = v.toLowerCase();
  return /^[a-z0-9_]{1,24}$/.test(v) ? v : null;
}

/** 🆕 N2 — بلاغٌ عن حساب (`POST /api/v1/profile/report`): المعرّفُ ولماذا (اختياريٌّ، يُطوى ويُقصّ حدَّ الويب ٣٠٠) */
export type ProfileReportBody = { user_id: string; reason: string | null };
export const REPORT_REASON_MAX = 300;
export function parseProfileReportBody(raw: unknown): ProfileReportBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.user_id !== "string" || !UUID.test(o.user_id)) return null;
  const reason = typeof o.reason === "string" ? o.reason.replace(/\s+/g, " ").trim().slice(0, REPORT_REASON_MAX) : "";
  return { user_id: o.user_id, reason: reason || null };
}
