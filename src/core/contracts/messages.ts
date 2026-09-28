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
/** ردٌّ نصّيّ — معلَّقٌ بآخر عملٍ شورك (D-051) */
export type MsgReplyEvent = { kind: "reply"; id: string; mine: boolean; body: string; created_at: string };
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
};

/** `GET /api/v1/me/badges` — شارتا الظرف والجرس وحدَهما (M4-fix2) */
export type BadgesPayload = { messages: number; signals: number };

/** `GET /api/v1/me/messages/seen?with=<id>` — آخرُ ظهورِ صاحب الخيط (D-765)، `null` صامتة */
export type LastSeenPayload = { last_seen: string | null };

/** `POST /api/v1/me/messages/reply` */
export type MsgReplyBody = { share_id: string; body: string };
/** `POST /api/v1/me/messages/{read,hide,block}` */
export type MsgPeerBody = { person_id: string };

/** `GET /api/v1/me/signals` — أسطرُ الجرس كما تعيدها `mySignals`، والجملةُ والوجهةُ من `core/signals.ts` في الطرفين */
export type SignalsPayload = { me_id: string; rows: SignalRow[] };

/** أقصى طول الردّ — حدُّ `replyToShare` نفسُه */
export const MSG_REPLY_MAX = 500;

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

export function parseMsgPeerBody(raw: unknown): MsgPeerBody | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as Record<string, unknown>).person_id;
  return typeof id === "string" && UUID.test(id) ? { person_id: id } : null;
}
