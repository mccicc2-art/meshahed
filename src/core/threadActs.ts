/**
 * ====== أجسامُ أفعال «النقاش» — `/api/v1/thread/*` (Phase 11-M · M3) ======
 *
 * قارئٌ متسامحٌ مع الزائد صارمٌ مع الناقص (نهجُ `communityActs.ts`): الهدفُ بمفتاحه كاملاً أو `null` ⇒ `invalid_input`.
 * **والتعقيمُ الحقيقيُّ في الفعل** (uuid · intId · الطول · بادئةُ المخزن D-298 · شكلُ معرّف Giphy D-362) — لا تعقيمَ ثانٍ.
 */
import type { ThreadLikeBody, ThreadReplyBody, ThreadReportBody, ThreadRowBody, ThreadTarget, ThreadVoteBody } from "./contracts/thread.ts";
import { REPLY_MAX } from "./communityActs.ts";

const obj = (b: unknown): Record<string, unknown> | null =>
  b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
const str = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const id = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const media = (v: unknown): v is "tv" | "movie" => v === "tv" || v === "movie";

export function parseThreadTarget(v: unknown): ThreadTarget | null {
  const o = obj(v);
  if (!o) return null;
  if (o.kind === "talk" && id(o.tmdb_id) && media(o.media_type)) return { kind: "talk", tmdb_id: o.tmdb_id, media_type: o.media_type };
  if (o.kind === "post" && str(o.key, 120)) return { kind: "post", key: o.key };
  if (o.kind === "review" && str(o.user_id) && id(o.tmdb_id) && media(o.media_type))
    return { kind: "review", user_id: o.user_id, tmdb_id: o.tmdb_id, media_type: o.media_type };
  return null;
}

export function parseThreadReplyBody(b: unknown): ThreadReplyBody | null {
  const o = obj(b);
  if (!o) return null;
  const target = parseThreadTarget(o.target);
  if (!target) return null;
  const body = typeof o.body === "string" ? o.body.trim().slice(0, REPLY_MAX) : "";
  const talk = target.kind === "talk";
  /* الصورةُ والـGIF و«فيها حرق» للغرفة وحدَها (`allowImage`/`allowGif`/`allowSpoiler = nested` في الويب) */
  const image_url = talk && str(o.image_url, 500) ? o.image_url : null;
  const gif_id = talk && str(o.gif_id, 64) ? o.gif_id : null;
  /* نصٌّ أو صورةٌ أو GIF — **الردُّ الفارغُ يُرفض قبل الرحلة** (`ready` في `Composer`) */
  if (!body && !image_url && !gif_id) return null;
  const parent_id = str(o.parent_id) ? o.parent_id : null;
  return { target, body, parent_id, has_spoiler: talk && o.has_spoiler === true, image_url, gif_id };
}

export function parseThreadRowBody(b: unknown): ThreadRowBody | null {
  const o = obj(b);
  const target = o ? parseThreadTarget(o.target) : null;
  return o && target && str(o.reply_id) ? { target, reply_id: o.reply_id } : null;
}

export function parseThreadReportBody(b: unknown): ThreadReportBody | null {
  const o = obj(b);
  const target = o ? parseThreadTarget(o.target) : null;
  if (!o || !target) return null;
  /* البلاغُ على الرأي نفسِه (`ReportButton` في صفحة الرأي) — لا ردَّ فيه */
  if (o.what === "review") return target.kind === "review" ? { target, what: "review" } : null;
  return str(o.reply_id) ? { target, reply_id: o.reply_id, what: "reply" } : null;
}

export function parseThreadLikeBody(b: unknown): ThreadLikeBody | null {
  const o = obj(b);
  return o && str(o.post_id) && typeof o.on === "boolean" ? { post_id: o.post_id, on: o.on } : null;
}

export function parseThreadVoteBody(b: unknown): ThreadVoteBody | null {
  const o = obj(b);
  if (!o || !str(o.post_id) || !id(o.tmdb_id) || !media(o.media_type)) return null;
  if (o.vote !== -1 && o.vote !== 0 && o.vote !== 1) return null;
  return { post_id: o.post_id, vote: o.vote, tmdb_id: o.tmdb_id, media_type: o.media_type };
}

/** مسارُ الصفحة التي يُبطلها الصوت (D-361) — من الهدف لا من العميل */
export function talkPath(t: { tmdb_id: number; media_type: "tv" | "movie" }): string {
  return `/talk/${t.media_type}/${t.tmdb_id}`;
}
