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
export type PushRegisterBody = { token: string; platform?: "android" | "ios"; lang?: "ar" | "en" };
/** جسمُ `POST /api/v1/app/push/forget` — بلا جلسة (الخروجُ يسبقه) */
export type PushForgetBody = { token: string };
/** `GET|POST /api/v1/me/prefs/push` */
export type PushPrefsPayload = { muted: PushGroup[] };

/** ما يُرسَل: عنوانٌ وسطرٌ ومسارٌ نسبيٌّ يفتحه الضغط */
export type PushText = { title: string; body: string; url: string | null };

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
  m: { senderId: string; senderName: string; text: string | null; sharedTitle?: string | null; isList?: boolean },
  t: Dict,
): PushText {
  const what = m.sharedTitle ? (m.isList ? t.pushSharedList(m.sharedTitle) : t.pushSharedTitle(m.sharedTitle)) : "";
  const text = (m.text ?? "").replace(/\s+/g, " ").trim();
  const body = text && what ? `${what}\n${text}` : text || what || t.pushNewMessage;
  return { title: m.senderName || APP, body: body.slice(0, 240), url: `/messages?with=${m.senderId}` };
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
