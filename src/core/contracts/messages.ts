/**
 * ====== عقدُ «الرسائل والإشعارات» في التطبيق — `/api/v1/me/messages*` و`/api/v1/me/signals*` (Phase 11-M · M4) ======
 *
 * 🔑 **سطحٌ واحدٌ بتبويبين** (D-463) كالصفحة `/messages`: الرسائلُ (محادثةٌ واحدةٌ لكلِّ شخص من المشاركات وردودها،
 * D-051/D-066) · الإشعارات (`mySignals`). **الحمولةُ ما تقرؤه الصفحةُ حرفاً** (`lib/messagesCore.ts`)، وأحداثُ المشاركة
 * مترجمةٌ بلغة القارئ (D-048) — **والتطبيقُ يرسم ولا يصوغ**.
 *
 * 🔑 **الفوريّةُ إشارةُ إيقاظٍ لا ناقل** (D-069): التطبيقُ يشترك في تغييرات الجداول الثلاثة (Realtime برمز جلسته)
 * ويعيد طلبَ هذه الحمولة — **فلا مسارَ قراءةٍ ثانٍ ولا سياسةَ تُلتفّ**. **والعدّادُ من الخادم وحدَه** (خطّة §٧).
 */
import type { PersonLite } from "../people.ts";
import type { SignalRow } from "../signals.ts";

/** عملٌ مُشارَك — بطاقةٌ بملصقه واسمه بلغة القارئ */
export type MsgShareEvent = {
  kind: "share";
  id: string;
  mine: boolean;
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  note: string | null;
  created_at: string;
};
/** ردٌّ نصّيّ — ردٌّ قديمٌ في خيط عمل، أو 🆕 رسالةٌ مباشرةٌ بلا عمل (D-1380).
 *  🆕 D-1387 — والمباشرةُ قد تحمل **GIF** (معرّفُه وحدَه، D-362) أو **صورة** (`image`، ومعها تعليقٌ اختياريّ في `body`) */
export type MsgReplyEvent = {
  kind: "reply";
  id: string;
  mine: boolean;
  body: string;
  created_at: string;
  gif_id?: string | null;
  image?: MsgImage | null;
};
/** 🆕 D-1387 — صورةُ رسالةٍ في المخزن الخاصّ `dm-media`: `url` رابطٌ مؤقّتٌ يصنعه الخادمُ بجلسة القارئ (لا رابطَ عامّ)،
 *  و`key` مسارُها الثابت — مفتاحُ الكاش في التطبيق فلا تُنزَّل الصورةُ ثانيةً كلّما تجدّد الرابط */
export type MsgImage = { url: string; key: string };
/** قائمةٌ مُشارَكة — الاسمُ والعدّةُ لحظةَ الإرسال */
export type MsgListEvent = {
  kind: "list";
  id: string;
  mine: boolean;
  list_id: string;
  list_name: string | null;
  item_count: number | null;
  note: string | null;
  created_at: string;
};
export type MsgEvent = MsgShareEvent | MsgReplyEvent | MsgListEvent;

export type MsgConversation = {
  person_id: string;
  person: PersonLite | null;
  /** تصاعديّاً — مشاركاتٌ وردود */
  events: MsgEvent[];
  last_at: string;
  unread: number;
  /** آخرُ عملٍ شورك — وجهةُ الردّ الجديد؛ `""` = محادثةٌ بدأت بقائمةٍ وحدها فلا ردَّ لها بعد */
  latest_share_id: string;
};

/** `GET /api/v1/me/messages` */
export type MessagesPayload = {
  me_id: string;
  conversations: MsgConversation[];
  /** متابَعون متبادلون لا خيطَ معهم بعد — «ابدأ محادثة» */
  startable: PersonLite[];
  /** شارتا التبويبين — من الخادم وحدَه (`unread_shares` · `unread_signals`) */
  unread: { messages: number; signals: number };
  /** 🆕 D-1380 — `?with=<id>`: هويّةُ صاحب خيطٍ لم يبدأ بعد (`null` إن كانت له محادثةٌ أو لم يُطلب) */
  peer?: PersonLite | null;
  /** 🆕 D-1380 — هل أقدر أن أراسل `with` الآن؟ `null` = لم يُطلب أو تعذّر الحكم */
  can_message?: boolean | null;
};

/** `GET /api/v1/me/badges` — شارتا الظرف والجرس وحدَهما (M4-fix2) */
export type BadgesPayload = { messages: number; signals: number };

/** `GET /api/v1/me/messages/seen?with=<id>` — آخرُ ظهورِ صاحب الخيط (D-765)، `null` صامتة */
export type LastSeenPayload = { last_seen: string | null };

/** `POST /api/v1/me/messages/reply` */
export type MsgReplyBody = { share_id: string; body: string };
/** 🆕 D-1380 — `POST /api/v1/me/messages/text`: رسالةٌ نصّيّةٌ مباشرة (`sendDirectMessage`).
 *  🆕 D-1387 — أو GIF وحدَه (`body` فارغ)، أو صورةٌ رُفعت قبلُ (`image_path` من `/api/v1/me/messages/image`) بتعليقٍ اختياريّ */
export type MsgTextBody = { recipient_id: string; body: string; gif_id?: string | null; image_path?: string | null };
/** 🆕 D-1387 — `POST /api/v1/me/messages/image` (multipart `file`): الصورةُ في مجلّدك من `dm-media`، والمسارُ يعود ليُرسَل مع الرسالة */
export type MsgImagePayload = { path: string };
/** مسارُ صورة الرسالة: `<uid>/<uuid>.<ext>` — قيدُ الهجرة ٢٠٢ نفسُه (والخادمُ يشترط أن يكون المجلّدُ مجلّدَ المرسِل) */
export const DM_IMAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
/** حدُّ صورة الرسالة — حدُّ المخزن `dm-media` في الهجرة ٢٠٢ */
export const DM_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** `POST /api/v1/me/messages/{read,hide,block}` */
export type MsgPeerBody = { person_id: string };

/** `GET /api/v1/me/signals` — أسطرُ الجرس كما تعيدها `mySignals`، والجملةُ والوجهةُ من `core/signals.ts` في الطرفين */
/** 🆕 N2-fix — `pending_requests`: معرّفاتُ من طلبوا متابعتي وما زال طلبُهم قائماً — صفُّ «طلب المتابعة» يُرسم بزرَّي قبولٍ ورفضٍ لهم وحدَهم */
export type SignalsPayload = { me_id: string; rows: SignalRow[]; pending_requests: string[] };

/** 🆕 N2-fix — `POST /api/v1/me/follow-requests`: قبولُ طلب متابعةٍ واردٍ أو رفضُه */
export type FollowRequestBody = { person_id: string; accept: boolean };
export function parseFollowRequestBody(raw: unknown): FollowRequestBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return typeof o.person_id === "string" && UUID.test(o.person_id) && typeof o.accept === "boolean" ? { person_id: o.person_id, accept: o.accept } : null;
}

/**
 * `POST /api/v1/me/messages/share` — «أرسِله لـ…» (M5): عملٌ إلى صديقٍ من المتابعة المتبادلة، ومعه سطرٌ اختياريّ — `sendShare`
 * نفسُه (`SendShareSheet` · `StartConversationSheet` في الويب). الاسمُ والملصقُ لحظةَ الإرسال كما يرسلهما الويب (D-048).
 */
export type MsgShareBody = {
  recipient_id: string;
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  note: string | null;
};

/** أقصى طول الملاحظة — حدُّ `sendShare` نفسُه */
export const MSG_NOTE_MAX = 280;

/** 🆕 D-1380 — أقصى طول الرسالة النصّيّة — قيدُ `direct_messages.body` في الهجرة ٢٠٠ (`core/dmPolicy` يقرؤه من هنا) */
export const MSG_TEXT_MAX = 1000;

/** أقصى طول الردّ — حدُّ `replyToShare` نفسُه */
export const MSG_REPLY_MAX = 500;

/** معرّفُ Giphy — `GIF_ID_RE` في `core/media.ts` (لا يُستورد من هنا: العقدُ يُقرأ في اختباراتٍ بلا أسماء المسارات `@/`) */
const GIF_RE = /^[A-Za-z0-9]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** القارئُ متسامحٌ مع الزائد صارمٌ مع الناقص (نهجُ D-947/`communityActs`): الفراغُ يُرفض قبل الرحلة */
export function parseMsgReplyBody(raw: unknown): MsgReplyBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.share_id !== "string" || !UUID.test(b.share_id)) return null;
  if (typeof b.body !== "string") return null;
  const body = b.body.trim();
  if (!body || body.length > MSG_REPLY_MAX) return null;
  return { share_id: b.share_id, body };
}

export function parseMsgTextBody(raw: unknown): MsgTextBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.recipient_id !== "string" || !UUID.test(b.recipient_id)) return null;
  if (typeof b.body !== "string") return null;
  const body = b.body.trim();
  if (body.length > MSG_TEXT_MAX) return null;
  /* 🆕 D-1387 — GIF وحدَه، أو صورةٌ بتعليقٍ اختياريّ، أو نصّ — لا الاثنان معاً ولا رسالةٌ فارغة (قيدُ الهجرة ٢٠٢) */
  const gif = typeof b.gif_id === "string" && b.gif_id ? b.gif_id : null;
  const image = typeof b.image_path === "string" && b.image_path ? b.image_path : null;
  if (gif && !GIF_RE.test(gif)) return null;
  if (image && !DM_IMAGE_PATH_RE.test(image)) return null;
  if (gif && image) return null;
  if (gif && body) return null;
  if (!body && !gif && !image) return null;
  return { recipient_id: b.recipient_id, body, ...(gif ? { gif_id: gif } : {}), ...(image ? { image_path: image } : {}) };
}

export function parseMsgPeerBody(raw: unknown): MsgPeerBody | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as Record<string, unknown>).person_id;
  return typeof id === "string" && UUID.test(id) ? { person_id: id } : null;
}

export function parseMsgShareBody(raw: unknown): MsgShareBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.recipient_id !== "string" || !UUID.test(b.recipient_id)) return null;
  const id = Number(b.tmdb_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (b.media_type !== "tv" && b.media_type !== "movie") return null;
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 300) : null;
  const poster = typeof b.poster_path === "string" && b.poster_path ? b.poster_path : null;
  const note = typeof b.note === "string" ? b.note.replace(/\s+/g, " ").trim().slice(0, MSG_NOTE_MAX) || null : null;
  return { recipient_id: b.recipient_id, tmdb_id: id, media_type: b.media_type, title, poster_path: poster, note };
}
