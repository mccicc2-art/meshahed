/**
 * ====== أفعالُ «المجتمع» في التطبيق — أجسامُ `/api/v1/community/*` (Phase 11-M · M2) ======
 *
 * 🔑 **الأفعالُ أفعالُ الويب نفسُها** (`lib/actions`): الإعجابُ بأربعة جداوله · الردُّ على الرأي والنشرة ·
 * متابعةُ شخص · تثبيتُ الغرفة بدرجتيه · عدُّ المشاهدات. **هنا قراءةُ الجسم وحدَها** — قارئٌ متسامحٌ
 * يُسقط المجهولَ ويعيد `null` فيُردّ `invalid_input`؛ **والتعقيمُ الحقيقيّ (uuid · intId · الطول) في
 * الفعل نفسِه** كما في `trackRoute` (D-947): لا تعقيمَ ثانٍ يفترق عن الأوّل يوماً.
 *
 * ⚠️ **`on` حالةٌ مقصودةٌ لا «اعكس»** (D-241/D-305): طلبان متسابقان ينتهيان إلى ما ضُغط آخراً. وأفعالُ
 * الويب تأخذ `liked` = «كان معجَباً» (تحذف إن صدقت) — فالترجمةُ `liked = !on` في المسار لا هنا.
 */

export type LikeBody =
  /** رأيٌ في عمل — `review_likes` */
  | { target: "review"; user_id: string; tmdb_id: number; media_type: "tv" | "movie"; on: boolean }
  /** خبرُ لوبز — `post_reactions` (D-224) */
  | { target: "post"; tmdb_id: number; media_type: "tv" | "movie"; on: boolean }
  /** رأيٌ في قائمة — `list_review_likes` (D-370) */
  | { target: "list_review"; user_id: string; list_id: string; on: boolean };

export type ReplyBody =
  | { target: "review"; user_id: string; tmdb_id: number; media_type: "tv" | "movie"; body: string }
  | { target: "news"; post_key: string; body: string };

/** `on: false` يسحب المتابعةَ وطلبَها معاً؛ والجوابُ حالةٌ (`FollowUserResult`) لأن الحسابَ الخاصَّ يجعلها «طلبتَ» */
export type FollowUserBody = { user_id: string; on: boolean };
export type FollowUserResult = { state: "following" | "requested" | "none" };

/** `global` = تثبيتُ الإدارة للجميع (D-314) — والحارسُ في دالّة القاعدة لا هنا */
export type RoomPinBody = { tmdb_id: number; media_type: "tv" | "movie"; on: boolean; global?: boolean };

export type PostViewsBody = { keys: string[] };

/** سقفُ الردّ — `addReviewReply`/`addNewsReply` تقصّ عنده؛ والتطبيقُ يمنع ما فوقه في الحقل */
export const REPLY_MAX = 1000;
/** سقفُ دفعة المشاهدات — `recordPostViews` تقصّ عنده */
export const VIEWS_BATCH_MAX = 60;

const obj = (b: unknown): Record<string, unknown> | null =>
  b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const id = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const media = (v: unknown): v is "tv" | "movie" => v === "tv" || v === "movie";

export function parseLikeBody(b: unknown): LikeBody | null {
  const o = obj(b);
  if (!o || typeof o.on !== "boolean") return null;
  if (o.target === "review" && str(o.user_id) && id(o.tmdb_id) && media(o.media_type))
    return { target: "review", user_id: o.user_id, tmdb_id: o.tmdb_id, media_type: o.media_type, on: o.on };
  if (o.target === "post" && id(o.tmdb_id) && media(o.media_type))
    return { target: "post", tmdb_id: o.tmdb_id, media_type: o.media_type, on: o.on };
  if (o.target === "list_review" && str(o.user_id) && str(o.list_id))
    return { target: "list_review", user_id: o.user_id, list_id: o.list_id, on: o.on };
  return null;
}

export function parseReplyBody(b: unknown): ReplyBody | null {
  const o = obj(b);
  if (!o || typeof o.body !== "string") return null;
  /* الفراغُ يُرفض هنا لا بعد رحلة: الفعلُ يعيد `null` صامتاً لنصٍّ فارغ، والتطبيقُ كان سيقول «أُرسل» */
  const body = o.body.trim().slice(0, REPLY_MAX);
  if (!body) return null;
  if (o.target === "review" && str(o.user_id) && id(o.tmdb_id) && media(o.media_type))
    return { target: "review", user_id: o.user_id, tmdb_id: o.tmdb_id, media_type: o.media_type, body };
  if (o.target === "news" && str(o.post_key)) return { target: "news", post_key: o.post_key, body };
  return null;
}

export function parseFollowUserBody(b: unknown): FollowUserBody | null {
  const o = obj(b);
  return o && str(o.user_id) && typeof o.on === "boolean" ? { user_id: o.user_id, on: o.on } : null;
}

export function parseRoomPinBody(b: unknown): RoomPinBody | null {
  const o = obj(b);
  if (!o || !id(o.tmdb_id) || !media(o.media_type) || typeof o.on !== "boolean") return null;
  return { tmdb_id: o.tmdb_id, media_type: o.media_type, on: o.on, ...(o.global === true ? { global: true } : {}) };
}

export function parsePostViewsBody(b: unknown): PostViewsBody | null {
  const o = obj(b);
  if (!o || !Array.isArray(o.keys)) return null;
  const keys = [...new Set(o.keys.filter(str))].slice(0, VIEWS_BATCH_MAX);
  return keys.length ? { keys } : null;
}
