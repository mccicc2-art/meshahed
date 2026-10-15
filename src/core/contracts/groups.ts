/**
 * ====== عقدُ «القروبات» في الرسائل — `/api/v1/me/groups*` (الهجرة ٢٠٥) ======
 *
 * 🔑 **القروبُ محادثةٌ في الصندوق نفسِه**: يصل مع `GET /api/v1/me/messages` في `groups` (حقلٌ إضافيٌّ يتجاهله التطبيقُ
 * الأقدم)، والشاشةُ تقرأ خيطَه من الكاش نفسِه — فإشارةُ Realtime الواحدةُ تجدّد الصندوقَ والقروبَ معاً كما في الخاص.
 *
 * 🔑 **القاعدةُ هي الحَكَم**: الإنشاءُ للوبز+ (`plus`)، والأعضاءُ ممّن تتابعهم ويقبلهم بوّابُ الخاص (`member`)، والحدُّ
 * ١٢ معك (`full`) — الرفضُ يعود مفتاحاً يُقرأ لا «تعذّر».
 */
import type { PersonLite } from "../people.ts";
import type { MsgImage } from "./messages.ts";

/** الحدُّ: ١٢ شخصاً وأنت منهم (قرارُ أحمد ١٥ أكتوبر) — قيدُ الدالّتين `dm_group_create` و`dm_group_add` */
export const GROUP_MAX_MEMBERS = 12;
/** أقصى طول اسم القروب — قيدُ `dm_groups.name` */
export const GROUP_NAME_MAX = 30;

export type GroupRole = "admin" | "member";
export type GroupSys = "created" | "added" | "left" | "removed" | "renamed" | "photo";

/** مختصرُ الرسالة المقتبَسة في القروب — كالخاص (`MsgReplyRef`) ومعه صاحبُها */
export type GroupReplyRef = {
  id: string;
  sender_id: string | null;
  mine: boolean;
  kind: "text" | "image" | "gif" | "gone";
  body: string;
  image?: MsgImage | null;
  gif_id?: string | null;
};

/** رسالةٌ في القروب */
export type GroupMsgEvent = {
  kind: "msg";
  id: string;
  mine: boolean;
  sender_id: string | null;
  body: string;
  created_at: string;
  gif_id?: string | null;
  image?: MsgImage | null;
  reply?: GroupReplyRef | null;
  /** على رسائلي وحدي: قرأها **كلُّ** من كان في القروب وقتَها (✓✓) */
  read?: boolean;
  /** على رسائلي وحدي: من قرأها (لمسةُ ✓✓ تعرضهم) */
  read_by?: string[];
};

/** سطرُ نظام: أنشأ · أضاف · خرج · حذف · سمّى · غيّر الصورة — الجملةُ تُكتب في التطبيق بلغة القارئ من الأسماء */
export type GroupSysEvent = {
  kind: "sys";
  id: string;
  created_at: string;
  sys: GroupSys;
  actor_id: string | null;
  target_id: string | null;
  /** الاسمُ الجديد في «سمّى» */
  text: string | null;
};

export type GroupEvent = GroupMsgEvent | GroupSysEvent;

export type GroupMember = { id: string; role: GroupRole };

export type MsgGroupConversation = {
  group_id: string;
  name: string;
  /** صورةُ القروب (رابطٌ مؤقّت) — `null` ⇒ صورُ الأعضاء */
  photo: MsgImage | null;
  me_role: GroupRole;
  muted: boolean;
  /** الأعضاءُ الحاليّون، المشرفُ أوّلاً */
  members: GroupMember[];
  /** هويّةُ كلِّ من يُذكر في القروب (الأعضاءُ ومن خرج ومن كتب) */
  people: PersonLite[];
  /** تصاعديّاً */
  events: GroupEvent[];
  last_at: string;
  unread: number;
};

/** `POST /api/v1/me/groups` */
export type GroupCreateBody = { name: string; member_ids: string[]; photo_path?: string | null };
export type GroupCreatePayload = { group_id: string };

/** `POST /api/v1/me/groups/<id>` — رسالةٌ: نصٌّ أو GIF أو صورةٌ بتعليقٍ اختياريّ، وردٌّ على رسالة */
export type GroupSendBody = { body: string; gif_id?: string | null; image_path?: string | null; reply_to?: string | null };

/** `POST /api/v1/me/groups/<id>/manage` */
export type GroupManageBody =
  | { action: "read" }
  | { action: "leave" }
  | { action: "mute"; muted: boolean }
  | { action: "add"; member_ids: string[] }
  | { action: "remove"; person_id: string }
  | { action: "edit"; name?: string | null; photo_path?: string | null; clear_photo?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIF_RE = /^[A-Za-z0-9]{1,64}$/;
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const TEXT_MAX = 1000;

export function isGroupId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

function ids(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  return out.length >= 1 && out.length <= max && out.length === new Set(v).size ? out : null;
}

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length >= 1 && s.length <= GROUP_NAME_MAX ? s : null;
}

export function parseGroupCreateBody(raw: unknown): GroupCreateBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  const members = ids(o.member_ids, GROUP_MAX_MEMBERS - 1);
  const photo = o.photo_path == null ? null : typeof o.photo_path === "string" && PATH_RE.test(o.photo_path) ? o.photo_path : undefined;
  if (!name || !members || photo === undefined) return null;
  return { name, member_ids: members, photo_path: photo };
}

export function parseGroupSendBody(raw: unknown): GroupSendBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const body = typeof o.body === "string" ? o.body.trim() : "";
  const gif = o.gif_id == null ? null : typeof o.gif_id === "string" && GIF_RE.test(o.gif_id) ? o.gif_id : undefined;
  const image = o.image_path == null ? null : typeof o.image_path === "string" && PATH_RE.test(o.image_path) ? o.image_path : undefined;
  const reply = o.reply_to == null ? null : typeof o.reply_to === "string" && UUID.test(o.reply_to) ? o.reply_to : undefined;
  if (gif === undefined || image === undefined || reply === undefined) return null;
  if (body.length > TEXT_MAX) return null;
  if (!body && !gif && !image) return null;
  if (gif && (image || body)) return null;
  return { body, gif_id: gif, image_path: image, reply_to: reply };
}

export function parseGroupManageBody(raw: unknown): GroupManageBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.action) {
    case "read":
    case "leave":
      return { action: o.action };
    case "mute":
      return typeof o.muted === "boolean" ? { action: "mute", muted: o.muted } : null;
    case "add": {
      const m = ids(o.member_ids, GROUP_MAX_MEMBERS - 1);
      return m ? { action: "add", member_ids: m } : null;
    }
    case "remove":
      return typeof o.person_id === "string" && UUID.test(o.person_id) ? { action: "remove", person_id: o.person_id } : null;
    case "edit": {
      const name = o.name == null ? null : cleanName(o.name);
      if (o.name != null && !name) return null;
      const photo = o.photo_path == null ? null : typeof o.photo_path === "string" && PATH_RE.test(o.photo_path) ? o.photo_path : undefined;
      if (photo === undefined) return null;
      const clear = o.clear_photo === true;
      if (!name && !photo && !clear) return null;
      return { action: "edit", name, photo_path: photo, clear_photo: clear };
    }
    default:
      return null;
  }
}
