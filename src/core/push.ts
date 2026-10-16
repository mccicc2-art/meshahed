/**
 * ====== إشعاراتُ الدفع — الأنواعُ والجملةُ والوجهة، قاعدةٌ واحدةٌ للخادم والتطبيق (D-1305) ======
 *
 * 🔑 **جملةُ الدفع هي جملةُ الجرس نفسُها** (`signalParts`) **ووجهتُه وجهتُه** (`signalHref`): ما يرنّ على الشاشة
 * المقفلة هو ما يُقرأ في «الإشعارات» ويفتح ما يفتحه — لا نصٌّ ثانٍ ولا وجهةٌ ثانية (D-1183).
 *
 * 🔑 **خمسةُ مفاتيحَ لا أحدَ عشر**: المستخدمُ يكتم «الإعجابات» لا `like_list_review` — النوعُ في الجرس وجهةٌ
 * (D-218)، والمفتاحُ في الإعدادات نيّة. الخريطةُ هنا وحدَها.
 */
import type { Dict } from "./i18n.ts";
import { signalHref, signalParts, type SignalKind, type SignalRow } from "./signals.ts";

export const PUSH_GROUPS = ["messages", "follows", "likes", "replies", "episodes"] as const;
export type PushGroup = (typeof PUSH_GROUPS)[number];

export const PUSH_GROUP_OF: Record<SignalKind, PushGroup> = {
  follow: "follows",
  request: "follows",
  like_review: "likes",
  like_activity: "likes",
  like_list_review: "likes",
  list_review: "replies",
  reply: "replies",
  talk_reply: "replies",
  list_reply: "replies",
};

/** رمزُ Expo كما تصدره `getExpoPushTokenAsync` — الشكلُ نفسُه في قيد الجدول (الهجرة ١٩٥) */
export const PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_:-]{8,200}\]$/;

export function parseMuted(raw: unknown): PushGroup[] {
  if (!Array.isArray(raw)) return [];
  return PUSH_GROUPS.filter((g) => raw.includes(g));
}

/** جسمُ `POST /api/v1/me/push` */
/**
 * 🆕 D-1408 — `caps`: ما يقدر عليه التطبيقُ على هذا الجهاز. «dm-data»: يرسم إشعارَ الرسالة بنفسه من بياناتها (أندرويد) فتظهر
 * أزرارُه والتطبيقُ في الخلفية. غائبٌ ⇒ الطريقةُ القديمة (Expo يعرض الإشعار) — بناءٌ أقدمُ لا يرسم البياناتِ فلا يُرسل له بها.
 */
/**
 * 🆕 1.12.7 — «dm-native»: **كودٌ أصليٌّ (Kotlin) يرسم إشعارَ الرسالة** من بياناتها بزرّيه، ويرسل الردَّ برمز الودجت
 * (`apps/mobile/widget/kotlin/DmPush.kt`) — يعمل والتطبيقُ في الخلفية أو مقفول، لأنّه لا ينتظر الجافاسكربت.
 * و«dm-data» (D-1408، رسمُ الجافاسكربت) يبقى اسماً مقبولاً من البناء 1.12.6 **ولا يُرسل له بالبيانات أبداً**: أندرويد
 * لا يشغّل مهمّتَه في الخلفية فيضيع الإشعار.
 */
export type PushCap = "dm-data" | "dm-native";
export const PUSH_CAPS: readonly PushCap[] = ["dm-data", "dm-native"];
export type PushRegisterBody = { token: string; platform?: "android" | "ios"; lang?: "ar" | "en"; caps?: PushCap[] };

/** إشعارُ رسالةٍ «بيانات» لجهازٍ يرسمه بنفسه: النصُّ في البيانات لا في الإشعار — `kind` يقول للتطبيق ما يرسم */
export type DmDataPush = { kind: "dm"; title: string; body: string; url: string };
export function dmDataOf(text: PushText): DmDataPush | null {
  if (text.category !== "dm" || !text.url) return null;
  return { kind: "dm", title: text.title, body: text.body, url: text.url };
}
/**
 * 🆕 1.12.7 — وجهةُ الردِّ من رابط الإشعار نفسِه: شخصٌ (`?with=`) أو قروبٌ (`?group=`) — **الرابطُ الذي يفتحه الضغطُ
 * هو مصدرُ الوجهة**، فلا يختلف ما يُفتح عمّا يُردّ عليه.
 */
export type DmTarget = { to: string } | { group: string };
const DM_UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const DM_PEER_URL = new RegExp(`^/messages\\?with=(${DM_UUID})$`);
const DM_GROUP_URL = new RegExp(`^/messages\\?group=(${DM_UUID})$`);
export function dmTargetOf(url: string | null | undefined): DmTarget | null {
  if (!url) return null;
  const p = DM_PEER_URL.exec(url);
  if (p) return { to: p[1].toLowerCase() };
  const g = DM_GROUP_URL.exec(url);
  return g ? { group: g[1].toLowerCase() } : null;
}

/**
 * 🆕 1.12.7 — إشعارُ رسالةٍ «بيانات» لجهازٍ يرسمه **كودُه الأصليّ** (`caps: ["dm-native"]`): النصُّ والوجهةُ ونصوصُ الزرّين
 * بلغة الجهاز المسجَّلة — الكودُ الأصليُّ لا يقرأ قاموسَنا، وما يكتبه بعد الردّ («أنت: …» أو «تعذّر») يأتي من هنا.
 * `tag`: خيطٌ واحدٌ = إشعارٌ واحد (رسالةٌ جديدةٌ من الشخص نفسِه تحلّ محلَّ سابقتها لا تتكدّس).
 */
export type DmNativeLabels = { reply: string; hint: string; send: string; read: string; you: string; failed: string };
export type DmNativePush = { kind: "dm"; title: string; body: string; url: string; tag: string; to?: string; group?: string; l: DmNativeLabels };
export function dmNativeOf(text: PushText, t: Dict): DmNativePush | null {
  if (text.category !== "dm") return null;
  const target = dmTargetOf(text.url);
  if (!target || !text.url) return null;
  const l: DmNativeLabels = { reply: t.msgReply, hint: t.msgReplyPlaceholder, send: t.pushReplySend, read: t.pushMarkRead, you: t.convYou, failed: t.pushReplyFailed };
  const base = { kind: "dm" as const, title: text.title.slice(0, 120), body: text.body.slice(0, 400), url: text.url, l };
  return "to" in target ? { ...base, tag: target.to, to: target.to } : { ...base, tag: `g:${target.group}`, group: target.group };
}
/** جسمُ `POST /api/v1/app/push/forget` — بلا جلسة (الخروجُ يسبقه) */
export type PushForgetBody = { token: string };
/** `GET|POST /api/v1/me/prefs/push` */
export type PushPrefsPayload = { muted: PushGroup[] };

/** ما يُرسَل: عنوانٌ وسطرٌ ومسارٌ نسبيٌّ يفتحه الضغط */
/**
 * 🆕 D-1406 — `category`: نوعُ الإشعار الذي يعرّفه التطبيقُ بأزراره (`apps/mobile/src/notifications/dmReply.ts`) —
 * «dm» للرسالة: «رد» بخانة كتابةٍ داخل الإشعار و«تمييز كمقروءة». غائبٌ ⇒ إشعارٌ بلا أزرار كما كان.
 */
export type PushCategory = "dm";
export type PushText = { title: string; body: string; url: string | null; category?: PushCategory };

const APP = "Loopz";

/** إشعارُ الجرس ⇢ دفع: الجملةُ كاملةً في السطر، واسمُ التطبيق عنواناً */
export function signalPush(s: SignalRow, t: Dict, listName: string, recipientId: string): PushText {
  const p = signalParts(s, t, listName);
  return { title: APP, body: `${p.pre}${p.who}${p.post}`.trim(), url: signalHref(s, recipientId) };
}

/**
 * رسالة ⇢ دفع: **اسمُ المرسل عنواناً والمتنُ سطراً** — شكلُ كلِّ تطبيق مراسلة. `text` ملاحظةُ المشاركة أو الردّ؛
 * وبلا ملاحظةٍ يقول السطرُ ما أُرسل. الوجهةُ الخيطُ نفسُه (`/messages?with=`).
 */
export function messagePush(
  m: { senderId: string; senderName: string; text: string | null; sharedTitle?: string | null; isList?: boolean; media?: "image" | "gif" | null },
  t: Dict,
): PushText {
  /* 🆕 D-1387 — صورةٌ أو GIF: «📷 صورة» / «GIF» بلغة المستلم، والتعليقُ بعدها إن وُجد */
  const what = m.sharedTitle
    ? m.isList
      ? t.pushSharedList(m.sharedTitle)
      : t.pushSharedTitle(m.sharedTitle)
    : m.media === "image"
      ? t.msgImagePreview
      : m.media === "gif"
        ? t.msgGifPreview
        : "";
  const text = (m.text ?? "").replace(/\s+/g, " ").trim();
  const body = text && what ? `${what}\n${text}` : text || what || t.pushNewMessage;
  return { title: m.senderName || APP, body: body.slice(0, 240), url: `/messages?with=${m.senderId}`, category: "dm" };
}

/**
 * 🆕 رسالةٌ في قروب (الهجرة ٢٠٥): العنوانُ اسمُ القروب، والسطرُ «المرسِل: النصّ» — والوجهةُ القروبُ نفسُه.
 * الفئةُ `dm` نفسُها فالردُّ من الإشعار يعمل، والهدفُ يُقرأ من الرابط (`?group=`).
 */
export function groupMessagePush(
  m: {
    groupId: string;
    groupName: string;
    senderName: string;
    text: string | null;
    media?: "image" | "gif" | null;
    /** 🆕 D-1435 — اسمُ العمل المرسَل */
    sharedTitle?: string | null;
    /** 🆕 D-1436 — القارئُ مذكورٌ في الرسالة */
    mention?: boolean;
  },
  t: Dict,
): PushText {
  const what = m.media === "image" ? t.msgImagePreview : m.media === "gif" ? t.msgGifPreview : m.sharedTitle ? `🎬 ${m.sharedTitle}` : "";
  const text = (m.text ?? "").replace(/\s+/g, " ").trim();
  const line = text && what ? `${what} ${text}` : text || what || t.pushNewMessage;
  const who = m.mention ? t.pushGroupMention(m.senderName) : m.senderName;
  return { title: m.groupName || APP, body: `${who}: ${line}`.slice(0, 240), url: `/messages?group=${m.groupId}`, category: "dm" };
}

/** حلقاتُ اليوم ⇢ دفعٌ واحدٌ للمستخدم: عملٌ واحدٌ يفتح صفحتَه، وأكثرُ يفتح الرئيسيّة */
export function episodesPush(shows: { tmdbId: number; title: string }[], t: Dict): PushText | null {
  if (!shows.length) return null;
  if (shows.length === 1) return { title: APP, body: t.pushNewEpisode(shows[0].title), url: `/show/${shows[0].tmdbId}` };
  const [a, b, ...rest] = shows;
  return { title: APP, body: t.pushNewEpisodes(a.title, b.title, rest.length), url: "/" };
}

/** «اليوم» و«الساعة» في منطقة القارئ — منطقةٌ مجهولةٌ أو غائبة ⇒ UTC */
export function localDayHour(nowMs: number, timeZone: string | null | undefined): { day: string; hour: number } {
  const read = (tz: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(nowMs));
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
    return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
  };
  try {
    return read(timeZone || "UTC");
  } catch {
    return read("UTC");
  }
}

/** لا رنينَ قبل العاشرة صباحاً بتوقيت صاحبه: تاريخُ الحلقة يحلّ منتصفَ الليل، والإشعارُ لا */
export const EPISODE_PUSH_FROM_HOUR = 10;
