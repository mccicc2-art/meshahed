import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { getDict, num, type Dict, type Locale } from "@/core/i18n";
import { RATE_PUSH_FROM_HOUR, RATE_PUSH_WEEKDAY, RATE_QUEUE_MIN, rateWeekOf } from "@/core/rateQueue";
import { countRateQueueFor } from "@/lib/rateQueue";
import { sanitizeUiState } from "@/lib/uiState";
import { PERSON_COLS, type PersonLite } from "@/core/people";
import { curatedName } from "@/core/universes";
import { getMovieIn, getTvIn } from "@/lib/tmdb";
import { SIGNAL_SOURCE_NAME } from "@/core/contracts/stremio";
import type { HomeServer } from "@/core/homeServer";
import type { SignalKind, SignalRow } from "@/core/signals";
import { LINK_SOURCE_NAME, linkEpisodeLabel, linkSourceName, linkWhat, type LinkSource } from "@/core/linkSignals";
import type { PlatformAdded } from "@/core/contracts/deviceLinks";
import { isPersonaId } from "@/core/personas";
import {
  EPISODE_PUSH_FROM_HOUR,
  PUSH_GROUP_OF,
  episodesPush,
  localDayHour,
  messagePush,
  groupMessagePush,
  groupAddedPush,
  talkMentionPush,
  parseMuted,
  signalPush,
  dmNativeOf,
  type PushGroup,
  type PushText,
  airingByDay,
  pushFailureLine,
  rateQueuePush,
  type ExpoTicket,
} from "@/core/push";

/**
 * ====== إشعاراتُ الدفع — الإرسالُ من الخادم عبر خدمة Expo (D-1305) ======
 *
 * 🔑 **فوق الأفعال القائمة لا بجانبها**: الجرسُ يُحسب من الجداول (`my_signals`) ولا صفَّ «إشعار» يُكتب — فلا قادحَ
 * واحداً يُعلَّق عليه. كلُّ فعلٍ يُنتج سطراً في جرسِ غيرك ينادي `notifySignal` بعد نجاح كتابته، والرسالةُ `notifyMessage`.
 *
 * 🔑 **بعد إرسال الردّ** (`after`): صاحبُ الضغطة لا ينتظر Expo، وفشلُ الدفع لا يُفشل فعلَه — **كلُّ ما هنا صامت**.
 *
 * 🔑 **بعميل الخدمة وحدَه**: رموزُ أجهزة المستلم وتفضيلاتُه ليست لجلسة المرسل (الهجرة ١٩٥). والمفتاحُ غائبٌ ⇒ لا
 * يُرسل شيء (لا ارتدادَ إلى الجلسة — كان سيقرأ فراغاً ويبدو سليماً).
 *
 * 🔑 **سجلُّ ما أُرسل** (`push_sent`): إعجابٌ يُسحب ويُعاد، ومتابعةٌ تُلغى وتُعاد، لا يرنّان مرّتين.
 */

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
/** قناةُ أندرويد — تُنشأ في التطبيق بالاسم نفسِه (`apps/mobile/src/push.ts`) */
const CHANNEL = "default";

/**
 * 🆕 1.12.7 — `dmNative`: كودُ الجهاز الأصليُّ يرسم إشعارَ الرسالة من بياناتها بزرّيه (أندرويد، `caps` فيها «dm-native»).
 * «dm-data» (D-1408، رسمُ الجافاسكربت) لا يُقرأ هنا عمداً: أندرويد لا يشغّل تلك المهمّةَ في الخلفية فيضيع الإشعار.
 */
type Device = { token: string; lang: Locale; dmNative: boolean };

async function devicesOf(db: SupabaseClient, userId: string): Promise<Device[]> {
  /* قبل الهجرة ٢٠٤ العمودُ غائب ⇒ القراءةُ بلاه — والطريقةُ القديمةُ للجميع، لا صمتٌ لكلِّ إشعار */
  let rows = (await db.from("device_tokens").select("token, lang, platform, caps").eq("user_id", userId).limit(20)).data as
    | { token: string; lang: string; platform?: string; caps?: string[] | null }[]
    | null;
  if (!rows) rows = (await db.from("device_tokens").select("token, lang").eq("user_id", userId).limit(20)).data as { token: string; lang: string }[] | null;
  return (rows ?? []).map((d) => ({
    token: d.token,
    lang: d.lang === "en" ? "en" : "ar",
    dmNative: d.platform === "android" && Array.isArray(d.caps) && d.caps.includes("dm-native"),
  }));
}

async function mutedOf(db: SupabaseClient, userId: string): Promise<PushGroup[]> {
  const { data } = await db.from("push_prefs").select("muted").eq("user_id", userId).maybeSingle();
  return parseMuted((data as { muted?: unknown } | null)?.muted);
}

/** `true` = المفتاحُ جديد (أرسِل). خطأُ التكرار وكلُّ خطأٍ آخر ⇒ لا إرسال: الصمتُ أرخصُ من رنّتين */
async function claim(db: SupabaseClient, key: string): Promise<boolean> {
  const { error } = await db.from("push_sent").insert({ key: key.slice(0, 200) });
  return !error;
}

/**
 * رسالةُ Expo لجهاز. 🆕 1.12.7 — **إشعارُ رسالةٍ لجهازٍ يرسمه كودُه الأصليّ يُرسل «بيانات»** بلا عنوانٍ ولا نصّ:
 * إشعارُ Expo العاديُّ يعرضه أندرويد بنفسه والتطبيقُ في الخلفية فيسقط الزرّان (D-1406)، ورسمُ الجافاسكربت لا يجري في
 * الخلفية (D-1408، موقوف). البياناتُ تصل خدمةَ الرسائل الأصليّة (`DmPush.kt`) في كلِّ حال فترسمه بـ«رد» و«تمييز كمقروءة».
 * `priority: high` شرطُ أن يصل والجهازُ في وضع السكون.
 */
function expoMessage(m: { token: string; text: PushText; dmNative?: Dict | null }) {
  const data = m.dmNative ? dmNativeOf(m.text, m.dmNative) : null;
  if (data) return { to: m.token, data, priority: "high" };
  return {
    to: m.token,
    title: m.text.title,
    body: m.text.body,
    /* 🆕 T366 — والوسمُ في البيانات أيضاً: التطبيقُ المفتوح يعرف به «وصل من…» فيحدّث الرئيسيّةَ والمكتبة، لا البطاقةَ وحدَها */
    data: { ...(m.text.url ? { url: m.text.url } : {}), ...(m.text.tag ? { tag: m.text.tag } : {}) },
    sound: "default",
    channelId: CHANNEL,
    priority: "high",
    /* 🆕 D-1406 — أزرارُ «رد» و«تمييز كمقروءة» على إشعار الرسالة؛ بناءٌ أقدمُ لا يعرّف النوعَ فيظهر بلا أزرار */
    ...(m.text.category ? { categoryId: m.text.category } : {}),
    /* 🆕 T361 — يحلّ محلَّ الظاهر بالوسم نفسِه: أندرويد بـ`tag` (المعروض)، والآيفون بـ`collapseId` (المعروض وما في الطريق) */
    ...(m.text.tag ? { tag: m.text.tag, collapseId: m.text.tag } : {}),
  };
}

/**
 * 🆕 T313 — **ما فشل يُكتب** (`runtime_errors`، نوع `PushSend`): الخادمُ كان يرمي ردَّ Expo كلَّه، فلم يظهر عطلُ تنبيهات
 * الحلقات ثلاثةَ أسابيع (بلاغُ خالد ٤ نوفمبر). سطرٌ واحدٌ للدفعة بأسباب الفشل معدودةً، بلا رمز جهاز (`pushFailureLine`).
 * صامتٌ كغيره: السجلُّ لا يُفشل إرسالاً.
 */
async function logPushFailure(db: SupabaseClient, line: string | null): Promise<void> {
  if (!line) return;
  try {
    await db.rpc("log_runtime_error", { p_route: "push", p_digest: "", p_kind: "PushSend", p_message: line });
  } catch {
    /* لا شيء */
  }
}

/** مفتاحُ تذكرةٍ ينتظر إيصالَها في `push_sent` (لا جدولَ جديد): `rcpt:<المجموعة>:<معرّف التذكرة>` */
const RECEIPT_KEY = "rcpt:";

/**
 * يعيد **أيَّ الرسائل لم يقبلها Expo** (فهارسُها في الدفعة) مع عدد ما قُبل — ليعيد صاحبُ الحلقات المحاولةَ لمن فشل وحدَه.
 * 🆕 T313 — والتذاكرُ المقبولةُ تُحفظ مفاتيحَ لإيصالها: «مقبول» عند Expo لا يعني «وصل» — الرفضُ من Google/Apple يظهر في
 * الإيصال بعد دقائق (`checkPushReceipts`).
 */
async function send(
  db: SupabaseClient,
  batch: { token: string; text: PushText; dmNative?: Dict | null }[],
  what: string,
): Promise<{ sent: number; failed: Set<number> }> {
  const failed = new Set<number>();
  if (!batch.length) return { sent: 0, failed };
  let sent = 0;
  /* Expo يقبل مئةً في النداء */
  for (let i = 0; i < batch.length; i += 100) {
    const part = batch.slice(i, i + 100);
    let tickets: ExpoTicket[] = [];
    let extra = "";
    try {
      const res = await fetch(EXPO_PUSH, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(part.map(expoMessage)),
        /* A-28 (المدقّق ٢٧ أكتوبر) — مهلةٌ سخيّة لدفعة المئة: Expo متعثّرٌ كان يحبس الدفعاتِ التاليةَ حتى حدّ الدالّة.
           الدفعةُ التي تنقضي مهلتُها تسقط في `catch` القائم وتمضي الحلقةُ إلى ما بعدها. */
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[]; errors?: { code?: string; message?: string }[] } | null;
      tickets = Array.isArray(json?.data) ? json.data : [];
      if (!res.ok || !tickets.length) extra = `http ${res.status}${json?.errors?.[0] ? ` ${json.errors[0].code ?? ""} ${json.errors[0].message ?? ""}` : ""}`;
    } catch (e) {
      /* شبكة Expo — تسقط هذه الدفعةُ وحدَها */
      extra = e instanceof Error ? `${e.name}: ${e.message}` : "fetch failed";
    }
    const dead: string[] = [];
    const receipts: string[] = [];
    part.forEach((m, n) => {
      const tk = tickets[n];
      if (tk?.status === "ok") {
        sent++;
        if (tk.id) receipts.push(`${RECEIPT_KEY}${what}:${tk.id}`);
        return;
      }
      failed.add(i + n);
      /* التطبيقُ حُذف أو الرمزُ دُوِّر: الصفُّ يُنسى فلا يُرسَل إليه ثانيةً */
      if (tk?.details?.error === "DeviceNotRegistered") dead.push(m.token);
    });
    await logPushFailure(db, pushFailureLine(what, tickets, part.length, extra));
    if (dead.length) await db.from("device_tokens").delete().in("token", dead);
    if (receipts.length) await db.from("push_sent").insert(receipts.map((key) => ({ key: key.slice(0, 200) })));
  }
  return { sent, failed };
}

/**
 * 🆕 T313 — **الإيصالات**: بعد ١٥ دقيقة يقول Expo هل سلّمت Google/Apple الرسالةَ فعلاً. يُقرأ ما نضج من `push_sent` (٣٠٠ في
 * المرّة)، ويُكتب الفاشلُ بأسبابه، ثمّ تُمسح المفاتيح — والأقدمُ من يوم يُمسح بلا قراءة (Expo لا يحفظ الإيصالَ أكثر).
 * يُنادى من دورة الحلقات (بحركة المرور، مرّةً كلَّ عشر دقائق للنسخة) فلا مؤقّتَ جديد.
 */
async function checkPushReceipts(db: SupabaseClient, nowMs: number): Promise<void> {
  try {
    /* نسخٌ كثيرةٌ للدالّة: واحدةٌ تقرأ في كلِّ عشر دقائق، فلا يُكتب الفشلُ نفسُه مرّتين */
    if (!(await claim(db, `job:receipts:${dayOf(nowMs)}:${Math.floor((nowMs % 86_400_000) / 600_000)}`))) return;
    const ripe = new Date(nowMs - 15 * 60_000).toISOString();
    const stale = new Date(nowMs - 24 * 3_600_000).toISOString();
    await db.from("push_sent").delete().like("key", `${RECEIPT_KEY}%`).lt("at", stale);
    const { data } = await db.from("push_sent").select("key").like("key", `${RECEIPT_KEY}%`).lt("at", ripe).limit(300);
    const keys = ((data ?? []) as { key: string }[]).map((r) => r.key);
    if (!keys.length) return;
    const byWhat = new Map<string, string[]>();
    for (const k of keys) {
      const rest = k.slice(RECEIPT_KEY.length);
      const at = rest.lastIndexOf(":");
      if (at < 0) continue;
      const what = rest.slice(0, at);
      byWhat.set(what, [...(byWhat.get(what) ?? []), rest.slice(at + 1)]);
    }
    const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...byWhat.values()].flat() }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { data?: Record<string, ExpoTicket> } | null;
    if (!res.ok || !json?.data) {
      await logPushFailure(db, `push receipts: http ${res.status}`);
      return;
    }
    for (const [what, ids] of byWhat) {
      /* إيصالٌ لم يصدر بعد يُعدّ «ناقصاً» لا فاشلاً — لكنّه يُمسح: بعد ١٥ دقيقة غيابُه نفسُه خبر */
      const got = ids.map((id) => json.data?.[id]).filter((x): x is ExpoTicket => !!x);
      await logPushFailure(db, pushFailureLine(`${what} receipts`, got, got.length));
    }
    await db.from("push_sent").delete().in("key", keys);
  } catch {
    /* الإيصالاتُ مراقبةٌ لا شرط — تُعاد في الدورة التالية */
  }
}

/** القلبُ: مستلمٌ واحد، نوعٌ واحد، ونصٌّ يُبنى بلغة كلِّ جهاز */
async function deliver(input: { to: string; group: PushGroup | null; dedupe?: string; actorId?: string; build: (t: Dict, lang: Locale) => PushText | null }) {
  if (!hasServiceKey()) return;
  const db = await createServiceClient();
  const devices = await devicesOf(db, input.to);
  if (!devices.length) return;
  /* 🆕 `null` = إشعارُ حساب (انتهاءُ الاشتراك) لا يتبع مجموعةً تُكتم — يأتي مرّةً في عمر الاشتراك */
  if (input.group && (await mutedOf(db, input.to)).includes(input.group)) return;
  if (input.actorId) {
    /* من حظرتَه لا يرنّ عندك — الكتابةُ نفسُها تُرفض في أغلب الأفعال، وهذا حزامٌ ثانٍ لما لا يُرفض */
    /* 🆕 T498 — **والاتّجاهان** كـ`is_blocked` في الجرس: من حظر المستلمَ لا يصل إليه بمنشنٍ ولا بغيره */
    const { data } = await db
      .from("blocks")
      .select("blocked_id")
      .or(`and(blocker_id.eq.${input.to},blocked_id.eq.${input.actorId}),and(blocker_id.eq.${input.actorId},blocked_id.eq.${input.to})`)
      .limit(1)
      .maybeSingle();
    if (data) return;
  }
  if (input.dedupe && !(await claim(db, input.dedupe))) return;
  const batch: { token: string; text: PushText; dmNative: Dict | null }[] = [];
  for (const d of devices) {
    const t = getDict(d.lang);
    const text = input.build(t, d.lang);
    /* القاموسُ نفسُه لنصوص الزرّين و«أنت:» في الإشعار الأصليّ — بلغة هذا الجهاز */
    if (text) batch.push({ token: d.token, text, dmNative: d.dmNative ? t : null });
  }
  await send(db, batch, input.group ?? "account");
}

async function personOf(db: SupabaseClient, id: string): Promise<PersonLite | null> {
  const { data } = await db.from("public_profiles").select(PERSON_COLS).eq("id", id).maybeSingle();
  return (data as PersonLite | null) ?? null;
}

function quiet(fn: () => Promise<void>) {
  try {
    after(async () => {
      try {
        await fn();
      } catch {
        /* لا شيء — الدفعُ لا يُفشل فعلاً */
      }
    });
  } catch {
    /* خارج طلب (لا `after`) — يسقط */
  }
}

/**
 * سطرٌ جديدٌ في جرس `to` ⇢ دفع. `dedupe` مفتاحُ الحدث (فاعل · مستلم · شيء): بدونه يرنّ كلُّ نداء (الردود).
 * العنوانُ يُقرأ من مكتبة `titleOwner` إن لم يُمرَّر (نصُّ `my_signals`: «العنوان من مكتبتك»)، والقائمةُ من صفّها.
 */
type SignalInput = {
  to: string;
  kind: SignalKind;
  actorId: string;
  tmdbId?: number | null;
  mediaType?: "tv" | "movie" | null;
  title?: string | null;
  titleOwner?: string | null;
  listId?: string | null;
  dedupe?: string;
  /** 🆕 T496 — صاحبُ التعليق الذي جرى فيه الردّ: وجهةُ الدفع صفحتُه لا صفحةُ المستلم (`ownerId` في `SignalRow`) */
  reviewOwner?: string | null;
  /** 🆕 T498 — مفتاحُ خبر Loopz (`ref` في `SignalRow`) */
  ref?: string | null;
  /** 🆕 T509 — الردُّ أو المشاركةُ نفسُها (`item` في `SignalRow`): الضغطُ على الدفع يفتح عليها كسطر الجرس */
  item?: string | null;
};

/* 🆕 T498 — أنواعُ العضويّة في قائمةٍ مشتركة: تُدعى إليها وتُجاب وتُخرَج منها خاصّةً كانت أو معلنة */
const MEMBER_KINDS = new Set<SignalKind>(["list_invite", "list_invite_accepted", "list_invite_declined", "list_removed"]);

export function notifySignal(input: SignalInput) {
  if (!input.to || input.to === input.actorId) return;
  quiet(() => signalNow(input));
}

async function signalNow(input: SignalInput): Promise<void> {
  if (!input.to || input.to === input.actorId) return;
  {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const person = await personOf(db, input.actorId);
    if (!person) return;
    let title = input.title ?? null;
    let listSlug: string | null = null;
    let kind = input.kind;
    /* 🆕 T496 — **تعليقٌ أم تقييمٌ وحده** يُقرأ من الصفّ نفسِه كما في `my_signals_v2`: الدفعُ والجرسُ جملةٌ واحدة (D-1183) */
    if (kind === "like_review" && input.tmdbId && input.mediaType) {
      const { data } = await db
        .from("ratings")
        .select("review, title")
        .match({ user_id: input.to, tmdb_id: input.tmdbId, media_type: input.mediaType })
        .maybeSingle();
      const r = data as { review?: string | null; title?: string | null } | null;
      if (!r?.review?.trim()) kind = "like_rating";
      if (!title && r?.title) title = r.title;
    }
    if (input.listId) {
      const { data } = await db.from("user_lists").select("name, source_slug, is_public").eq("id", input.listId).maybeSingle();
      const l = data as { name: string | null; source_slug: string | null; is_public: boolean | null } | null;
      /* قائمةٌ خاصّة لا تُنتج سطراً في الجرس أصلاً (`ul.is_public` في `my_signals`) —
         🆕 234 إلّا الدعوةَ إلى قائمةٍ مشتركة: هي تُدعى إليها خاصّةً كانت أو معلنة، وفرعُها في الجرس بلا هذا الشرط */
      if (!l || (!l.is_public && !MEMBER_KINDS.has(input.kind))) return;
      title = l.name;
      listSlug = l.source_slug;
    } else if (!title && input.tmdbId && input.mediaType) {
      const { data } = await db
        .from("follows")
        .select("title")
        .match({ user_id: input.titleOwner ?? input.to, tmdb_id: input.tmdbId, media_type: input.mediaType })
        .maybeSingle();
      title = (data as { title?: string | null } | null)?.title ?? null;
    }
    const row: SignalRow = {
      kind,
      person,
      tmdbId: input.tmdbId ?? null,
      mediaType: input.mediaType ?? null,
      title,
      at: new Date().toISOString(),
      isNew: true,
      listId: input.listId ?? null,
      listSlug,
      ownerId: input.reviewOwner ?? null,
      ref: input.ref ?? null,
      item: input.item ?? null,
    };
    await deliver({
      to: input.to,
      group: PUSH_GROUP_OF[kind],
      dedupe: input.dedupe,
      actorId: input.actorId,
      build: (t, lang) => signalPush(row, t, curatedName(listSlug, title ?? "", lang), input.to),
    });
  }
}

/**
 * 🆕 **«اشتراكك انتهى، أبقينا X — اختر ما يبقى»** (خطّةُ Loopz+ v2 — أحمد ٥ نوفمبر «٢ أ»): من سقط من بلس وأُوقف من أجهزته
 * ما زاد على خانته. يفتح «الربط» حيث بطاقةُ «اختر ما يبقى». مفتاحُه يومُ النهاية فيأتي مرّة.
 */
export function notifyPlanEnded(input: { to: string; kept: string | null; stopped: number; dedupe: string }) {
  quiet(() =>
    deliver({
      to: input.to,
      group: null,
      dedupe: input.dedupe,
      /* أُوقف جهازٌ ⇒ «اختر ما يبقى» ويفتح الربط؛ لم يُوقف شيء ⇒ سطرُ «المجّانيّة» ويفتح صفحةَ Loopz+ (التطبيقُ يفتحها أصليّةً) */
      build: (t) =>
        input.stopped > 0
          ? { title: t.planEndedPushTitle, body: input.kept ? t.planEndedPushKept(input.kept) : t.planEndedPushNone, url: "/links" }
          : { title: t.planEndedPushTitle, body: t.planEndedPushFree, url: "/plus" },
    }),
  );
}

/**
 * 🆕 المهمّة ٤٠١ — **«هدية من Loopz»: مُنح Loopz+ من لوحة الإدارة** (أحمد ١٨ نوفمبر: «١أ نفذ شكل الاشعار المقترح»). المنحةُ
 * اليدويّة كانت صامتة، فعضوان مُنحا ١٧ نوفمبر ولم يعرفا. يفتح صفحةَ Loopz+ (التطبيقُ يفتحها أصليّة) ليرى ما انفتح له.
 * ⚖️ إشعارُ حسابٍ لا مجموعةَ له تُكتم (`group: null`، كإشعار الانتهاء). مفتاحُه العضوُ ويومُ النهاية: منحةٌ تُعاد بالتاريخ نفسِه
 * لا ترنّ مرّتين. **يُنتظر ويعيد عددَ الأجهزة**: اللوحةُ تقول للمدير هل وصل أم لا جهازَ للعضو أصلاً (حالُ عضوَي ١٧ نوفمبر).
 */
export async function notifyPlusGift(input: { to: string; until: string }): Promise<number> {
  try {
    if (!hasServiceKey()) return 0;
    const db = await createServiceClient();
    const n = (await devicesOf(db, input.to)).length;
    if (!n) return 0;
    /* المنحةُ تنتهي عند منتصف الليل (بداية اليوم التالي بتوقيت الرياض)، فاليومُ المكتوب هو آخرُ يومٍ فيها لا اليومُ الذي يليه */
    const last = new Date(new Date(input.until).getTime() - 1);
    const day = (lang: Locale) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "Asia/Riyadh" }).format(last);
    await deliver({
      to: input.to,
      group: null,
      dedupe: `plusgift:${input.to}:${last.toISOString().slice(0, 10)}`,
      build: (t, lang) => ({ title: t.plusGiftPushTitle, body: t.plusGiftPushBody(day(lang)), url: "/plus" }),
    });
    return n;
  } catch {
    return 0;
  }
}

/** نافذةُ جمع الحلقات: ما سُجّل تلقائياً من المسلسل نفسِه في الساعات الستّ الأخيرة ولم يُرَ — إشعارٌ واحدٌ بعدده */
const AUTO_PUSH_WINDOW_MS = 6 * 60 * 60_000;

/**
 * 🆕 T361 — **«وصل من Kodi»: ما سجّله Loopz بنفسه** (أحمد ١٠ نوفمبر: «١ أ و ج · ٢ ب و … وصل من كودي (أو اسم التطبيق اللي وصل
 * منه) · ٣ أ»). يُنادى بعد أن خُتمت الإشارةُ `auto_at` (`autoMarkSignal`) — مرّةً لكلِّ ما سُجّل، فلا مفتاحَ تكرار: الحدثُ الثاني
 * لما عُلِّم يقف عند `record_watch_signal` («watched») ولا يصل هنا.
 * - **فيلم**: «أضفنا X لمكتبتك · قيّمه» ويفتح الرئيسيّة — بطاقةُ «من تطبيقاتك» أعلاها، ونجومُها هناك (`StremioCard`).
 * - **حلقة**: «أضفنا X · S3 E4 لمكتبتك»؛ وحلقاتُ المسلسل المتتالية **تحلّ محلَّ الإشعار نفسِه** بعددها (`tag`) — «X · ٣ حلقات».
 * ⚖️ مفتاحُ «ما يُسجَّل تلقائياً» (`auto`) يكتمه. والاسمُ بلغة كلِّ جهاز (TMDB بلغتيه، ساعةً في الخبيئة). صامتٌ كلُّه: الإشعارُ
 * لا يُفشل تسجيلاً. ⚠️ **يُنتظر ولا يُؤجَّل** (`after`): المنادي يعمل أصلاً بعد ردِّ السيرفر.
 */
export async function notifyAutoTracked(input: { to: string; source: HomeServer; kind: "tv" | "movie"; tmdbId: number; season: number | null; episode: number | null }): Promise<void> {
  try {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    let count = 1;
    if (input.kind === "tv") {
      const { count: n } = await db
        .from("watch_signals")
        .select("id", { count: "exact", head: true })
        .match({ user_id: input.to, media_type: "tv", tmdb_id: input.tmdbId })
        .not("auto_at", "is", null)
        .is("noticed_at", null)
        .gte("auto_at", new Date(Date.now() - AUTO_PUSH_WINDOW_MS).toISOString());
      count = Math.max(1, n ?? 1);
    }
    const nameIn = async (language: "ar-SA" | "en-US") => {
      try {
        const d = input.kind === "tv" ? await getTvIn(input.tmdbId, language) : await getMovieIn(input.tmdbId, language);
        return ((d as { name?: string; title?: string }).name ?? (d as { title?: string }).title ?? "").trim();
      } catch {
        return "";
      }
    };
    const [ar, en] = await Promise.all([nameIn("ar-SA"), nameIn("en-US")]);
    if (!ar && !en) return;
    const app = SIGNAL_SOURCE_NAME[input.source];
    const ep = input.season != null && input.episode != null ? `S${input.season} E${input.episode}` : "";
    await deliver({
      to: input.to,
      group: "auto",
      build: (t, lang) => {
        const title = (lang === "ar" ? ar || en : en || ar).slice(0, 120);
        const body =
          input.kind === "movie" ? t.autoPushMovie(title) : count > 1 ? t.autoPushEpisodes(title, t.episodesCount(count)) : t.autoPushEpisode(title, ep);
        return { title: t.autoPushTitle(app), body, url: "/", tag: `auto-${input.kind}-${input.tmdbId}` };
      },
    });
  } catch {
    /* لا شيء — التسجيلُ تمّ، والإشعارُ تحسين */
  }
}

/** رسالةٌ (عملٌ أو قائمةٌ لصديق، أو ردٌّ في خيطها) ⇢ دفع */
export function notifyMessage(input: { to: string; actorId: string; text: string | null; sharedTitle?: string | null; isList?: boolean; media?: "image" | "gif" | null }) {
  if (!input.to || input.to === input.actorId) return;
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const person = await personOf(db, input.actorId);
    if (!person) return;
    await deliver({
      to: input.to,
      group: "messages",
      actorId: input.actorId,
      build: (t) =>
        messagePush(
          {
            senderId: input.actorId,
            senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser,
            text: input.text,
            sharedTitle: input.sharedTitle,
            isList: input.isList,
            media: input.media,
          },
          t,
        ),
    });
  });
}

/** 🆕 رسالةٌ في قروب: كلُّ عضوٍ غيرُ المرسِل ولم يكتم القروب (الهجرة ٢٠٥) — واحداً واحداً، فلغةُ كلٍّ وأجهزتُه وكتمُه كما في الخاص */
export function notifyGroupMessage(input: {
  groupId: string;
  actorId: string;
  text: string | null;
  media?: "image" | "gif" | null;
  /** 🆕 D-1435 — اسمُ العمل المرسَل */
  sharedTitle?: string | null;
  /** 🆕 D-1436 — أسماءُ المستخدمين المذكورة بـ`@` (صغيرة) — تُطابَق بأعضاء القروب هنا */
  mentions?: string[];
}) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const [{ data: group }, { data: members }, person] = await Promise.all([
      db.from("dm_groups").select("name").eq("id", input.groupId).maybeSingle(),
      db.from("dm_group_members").select("user_id, muted").eq("group_id", input.groupId),
      personOf(db, input.actorId),
    ]);
    if (!group || !person) return;
    const rows = (members ?? []) as { user_id: string; muted: boolean }[];
    /* المذكورون: أعضاءٌ أسماؤهم في الرسالة — يصلهم «ذكرك» حتى لو كتموا القروب (الكتمُ يسكت الكلامَ العامّ لا من يناديك) */
    const named = new Set<string>();
    if (input.mentions?.length) {
      const { data: profs } = await db.from("public_profiles").select("id, username").in("id", rows.map((m) => m.user_id));
      const wanted = new Set(input.mentions);
      for (const p of (profs ?? []) as { id: string; username: string | null }[]) if (p.username && wanted.has(p.username.toLowerCase())) named.add(p.id);
    }
    const to = rows.filter((m) => m.user_id !== input.actorId && (!m.muted || named.has(m.user_id))).map((m) => m.user_id);
    await Promise.all(
      to.map((id) =>
        deliver({
          to: id,
          group: "messages",
          actorId: input.actorId,
          build: (t) =>
            groupMessagePush(
              {
                groupId: input.groupId,
                groupName: (group as { name: string }).name,
                senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser,
                text: input.text,
                media: input.media,
                sharedTitle: input.sharedTitle ?? null,
                mention: named.has(id),
              },
              t,
            ),
        }).catch(() => {}),
      ),
    );
  });
}

/**
 * 🆕 D-1443 — **منشن في نقاش العمل**. فئةُ «الردود» (من كتمها لا يصله)، ومفتاحٌ لكلِّ (مشاركة · مذكور).
 * 🆕 T498 (أحمد: البندان ٦ و٧) — **كلُّ عضوٍ مذكورٍ باسمه** لا من كتب في الغرفة وحدهم، **والنقاشُ العامّ معها**
 * (`mediaType = "general"`، `tmdbId = 0`). والسطرُ نفسُه في الجرس (`mention_talk` في `my_signals_v3`).
 */
export function notifyTalkMention(input: {
  postId: string;
  actorId: string;
  tmdbId: number;
  mediaType: "tv" | "movie" | "general";
  title: string | null;
  text: string;
  mentions: string[];
  /** المشاركةُ الأب — صاحبُها وصله «ردّ عليك» (`notifyReply`) فلا يرنّ مرّتين */
  parentId?: string | null;
  /** 🆕 T498 — مشاركةٌ فيها حرق: النصُّ لا يظهر على الشاشة المقفلة لمن لم يشاهد */
  hasSpoiler?: boolean;
}) {
  if (!input.mentions.length || tooManyMentions(input.text)) return;
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    /* الأسماءُ (١٢ على الأكثر، صغيرةٌ كما تُخزَّن) */
    /* 🆕 T498 — من `profiles` لا `public_profiles`: الأخيرةُ تُخفي اسمَ من أخفى اسمَه عن الخدمة، فكان الجرسُ يذكره والدفعُ لا */
    const [{ data: profs }, person] = await Promise.all([
      db.from("profiles").select("id, username").in("username", input.mentions),
      personOf(db, input.actorId),
    ]);
    if (!person) return;
    let skip: string | null = null;
    if (input.parentId) {
      const { data: par } = await db.from("title_posts").select("user_id").eq("id", input.parentId).maybeSingle();
      skip = (par as { user_id?: string } | null)?.user_id ?? null;
    }
    const to = [...new Set(((profs ?? []) as { id: string }[]).map((p) => p.id).filter((id) => id !== input.actorId && id !== skip))];
    if (!to.length) return;
    await Promise.all(
      to.map((id) =>
        deliver({
          to: id,
          group: "replies",
          dedupe: `talk_mention:${input.postId}:${id}`,
          actorId: input.actorId,
          build: (t) =>
            talkMentionPush(
              {
                senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser,
                title: input.title ?? "",
                tmdbId: input.tmdbId,
                mediaType: input.mediaType,
                text: input.hasSpoiler ? null : input.text,
              },
              t,
            ),
        }).catch(() => {}),
      ),
    );
  });
}

/** ردٌّ في خيط مشاركة: الطرفُ الآخر من صفّها (عملٌ أو قائمة) */
export function notifyShareReply(input: { shareId: string; actorId: string; text: string }) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    let pair: { sender_id: string; recipient_id: string } | null = null;
    for (const table of ["title_shares", "list_shares"] as const) {
      const { data } = await db.from(table).select("sender_id, recipient_id").eq("id", input.shareId).maybeSingle();
      if (data) {
        pair = data as { sender_id: string; recipient_id: string };
        break;
      }
    }
    if (!pair) return;
    const to = pair.sender_id === input.actorId ? pair.recipient_id : pair.recipient_id === input.actorId ? pair.sender_id : null;
    if (!to) return;
    const person = await personOf(db, input.actorId);
    if (!person) return;
    await deliver({
      to,
      group: "messages",
      actorId: input.actorId,
      build: (t) =>
        messagePush({ senderId: input.actorId, senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser, text: input.text }, t),
    });
  });
}

/**
 * ردٌّ على رأي ⇢ صاحبُ الرأي وصاحبُ الردّ الأب — كلٌّ مرّةً، ولا أحدَ لنفسه. 🆕 T496: نوعان لا نوعٌ واحد (`reply` · `reply_reply`).
 * `table`: جدولُ الردود الذي فيه الأب.
 */
export function notifyReply(input: {
  kind: "reply" | "list_reply" | "talk_reply";
  table: "review_replies" | "list_review_replies" | "title_posts";
  actorId: string;
  ownerId?: string | null;
  parentId?: string | null;
  tmdbId?: number | null;
  mediaType?: "tv" | "movie" | null;
  title?: string | null;
  listId?: string | null;
}) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const to = new Set<string>();
    if (input.ownerId) to.add(input.ownerId);
    let parent: string | undefined;
    if (input.parentId) {
      const { data } = await db.from(input.table).select("user_id").eq("id", input.parentId).maybeSingle();
      parent = (data as { user_id?: string } | null)?.user_id;
      if (parent) to.add(parent);
    }
    to.delete(input.actorId);
    if (!to.size) return;
    const item = await newestReplyOf(db, input);
    for (const id of to) {
      /* 🆕 T496 (أحمد «٢ أ») — **صاحبُ الردّ الأب يقرأ «ردّ على ردّك»** وصاحبُ التعليق «ردّ على تعليقك» — الشرطُ نفسُه في
         `my_signals_v2` (أبو الردّ لي ⇐ `reply_reply`)، فالجرسُ والدفعُ لا يفترقان */
      const kind: SignalKind =
        id === parent && input.kind === "reply" ? "reply_reply" : id === parent && input.kind === "list_reply" ? "list_reply_reply" : input.kind;
      await signalNow({
        to: id,
        kind,
        reviewOwner: input.ownerId ?? null,
        actorId: input.actorId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.title,
        /* عنوانُ العمل من مكتبة صاحب الرأي — صاحبُ الردّ الأب قد لا يتابعه */
        titleOwner: input.ownerId ?? id,
        listId: input.listId,
        item,
      });
    }
  });
}

/**
 * 🆕 T509 — **الردُّ الذي كُتب للتوّ**: `notifyReply` لا يُعطى معرّفَه (نداؤه في `lib/actions` منذ T496)، فيُقرأ أحدثُ ردٍّ
 * للفاعل في الموضع نفسِه — والدفعُ يجري بعد الإدراج (`after`)، فهو هو. يغيب ⇒ الدفعُ يفتح الصفحةَ كما كان.
 */
async function newestReplyOf(
  db: SupabaseClient,
  input: { table: "review_replies" | "list_review_replies" | "title_posts"; actorId: string; ownerId?: string | null; parentId?: string | null; tmdbId?: number | null; mediaType?: string | null },
): Promise<string | null> {
  if (input.table === "list_review_replies") return null;
  let q = db.from(input.table).select("id").eq("user_id", input.actorId);
  q = input.parentId ? q.eq("parent_id", input.parentId) : q.is("parent_id", null);
  if (input.table === "review_replies" && input.ownerId) q = q.eq("review_user_id", input.ownerId);
  if (input.tmdbId != null) q = q.eq("tmdb_id", input.tmdbId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * 🆕 T498 — **ذكرك في ردٍّ على تعليقٍ أو في ردٍّ في قائمة** (البند ٥): الأسماءُ بقاعدة `mentionsIn` نفسِها، ومن وصله
 * «ردّ عليك» من الردِّ نفسِه (صاحبُ التعليق وصاحبُ الردّ الأب) لا يُذكَّر ثانية — الشرطُ نفسُه في `my_signals_v3`.
 */
export function notifyMentions(input: {
  kind: "mention_reply" | "mention_list";
  table: "review_replies" | "list_review_replies";
  replyId: string;
  actorId: string;
  mentions: string[];
  ownerId: string;
  parentId?: string | null;
  tmdbId?: number | null;
  mediaType?: "tv" | "movie" | null;
  listId?: string | null;
  /** نصُّ الردّ — لحدِّ الأسماء الاثني عشر */
  text: string;
}) {
  if (!input.mentions.length || tooManyMentions(input.text)) return;
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const { data: profs } = await db.from("profiles").select("id").in("username", input.mentions);
    let parent: string | null = null;
    if (input.parentId) {
      const { data } = await db.from(input.table).select("user_id").eq("id", input.parentId).maybeSingle();
      parent = (data as { user_id?: string } | null)?.user_id ?? null;
    }
    const to = [...new Set(((profs ?? []) as { id: string }[]).map((p) => p.id))].filter(
      (id) => id !== input.actorId && id !== input.ownerId && id !== parent,
    );
    /* تعليقُ حسابٍ خاصّ: لا يصل إلّا من يراه (متابِعٌ أو ممنوحٌ مكتبتَه) — شرطُ `can_view_profile` في الجرس */
    let allowed = to;
    if (input.kind === "mention_reply" && to.length) {
      const { data: owner } = await db.from("profiles").select("is_private").eq("id", input.ownerId).maybeSingle();
      if ((owner as { is_private?: boolean | null } | null)?.is_private) {
        const [{ data: f }, { data: g }] = await Promise.all([
          db.from("user_follows").select("follower_id").eq("following_id", input.ownerId).in("follower_id", to),
          db.from("library_grants").select("grantee_id").eq("owner_id", input.ownerId).in("grantee_id", to),
        ]);
        const ok = new Set([...((f ?? []) as { follower_id: string }[]).map((r) => r.follower_id), ...((g ?? []) as { grantee_id: string }[]).map((r) => r.grantee_id)]);
        allowed = to.filter((id) => ok.has(id));
      }
    }
    for (const id of allowed) {
      await signalNow({
        to: id,
        kind: input.kind,
        actorId: input.actorId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        titleOwner: input.ownerId,
        reviewOwner: input.ownerId,
        listId: input.listId,
        item: input.table === "list_review_replies" ? null : input.replyId,
        dedupe: `${input.kind}:${input.replyId}:${id}`,
      });
    }
  });
}

/** 🆕 T498 — **ردّ على ردّك تحت خبرٍ من Loopz** (البند ٤): صاحبُ الردّ الأب وحدَه — الخبرُ لا صاحبَ له */
export function notifyNewsReply(input: { postKey: string; parentId: string; actorId: string; replyId: string }) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const [{ data: par }, { data: post }, { data: mine }] = await Promise.all([
      db.from("news_post_replies").select("user_id").eq("id", input.parentId).maybeSingle(),
      db.from("news_posts").select("title").eq("key", input.postKey).maybeSingle(),
      db.from("news_post_replies").select("body").eq("id", input.replyId).maybeSingle(),
    ]);
    const title = (post as { title?: string | null } | null)?.title ?? null;
    const to = (par as { user_id?: string } | null)?.user_id ?? null;
    if (to && to !== input.actorId) {
      await signalNow({
        to,
        kind: "news_reply",
        actorId: input.actorId,
        title,
        ref: input.postKey,
        item: input.replyId,
        dedupe: `news_reply:${input.replyId}`,
      });
    }
    /* 🆕 T509 — **الردُّ على ردٍّ بأسلوب إنستغرام** («١٦ أ»): يُكتب تحت التعليق الأعلى ويبدأ بـ«@اسم» صاحبِ الردّ — فالمذكورُ
       يُخبَر (`mention_news`)، ومن وصله «ردّ على ردّك» من الردِّ نفسِه لا يُذكَّر ثانية (الشرطُ نفسُه في `my_signals_v4`) */
    const text = (mine as { body?: string | null } | null)?.body ?? "";
    const names = mentionNames(text);
    if (!names.length || tooManyMentions(text)) return;
    const { data: profs } = await db.from("profiles").select("id").in("username", names);
    const ids = [...new Set(((profs ?? []) as { id: string }[]).map((p) => p.id))].filter((id) => id !== input.actorId && id !== to);
    for (const id of ids) {
      await signalNow({ to: id, kind: "mention_news", actorId: input.actorId, title, ref: input.postKey, item: input.replyId, dedupe: `mention_news:${input.replyId}:${id}` });
    }
  });
}

/**
 * 🆕 T509 — **أعجب بردّك** (أحمد ٢٢ نوفمبر «١٥ أ»): تحت تعليقٍ (`reply_like`) أو تحت خبرٍ من Loopz (`news_reply_like`). صاحبُ
 * الردِّ وموضعُه من صفّه — لا يُؤتمن عليهما العميل — والمخفيُّ لا يرنّ. مفتاحُ (فاعل · ردّ): السحبُ ثمّ القلبُ لا يرنّ مرّتين.
 */
export function notifyReplyLike(input: { scope: "review" | "news"; replyId: string; actorId: string }) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    if (input.scope === "review") {
      const { data } = await db.from("review_replies").select("user_id, review_user_id, tmdb_id, media_type, hidden").eq("id", input.replyId).maybeSingle();
      const r = data as { user_id: string; review_user_id: string; tmdb_id: number; media_type: "tv" | "movie"; hidden: boolean } | null;
      /* شخصيّاتُ لوبز AI لا تُنبَّه (D-1563) */
      if (!r || r.hidden || isPersonaId(r.user_id)) return;
      await signalNow({
        to: r.user_id,
        kind: "reply_like",
        actorId: input.actorId,
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        titleOwner: r.review_user_id,
        reviewOwner: r.review_user_id,
        item: input.replyId,
        dedupe: `reply_like:${input.actorId}:${input.replyId}`,
      });
      return;
    }
    const { data } = await db.from("news_post_replies").select("user_id, post_key, hidden").eq("id", input.replyId).maybeSingle();
    const r = data as { user_id: string; post_key: string; hidden: boolean | null } | null;
    if (!r || r.hidden || isPersonaId(r.user_id)) return;
    const { data: post } = await db.from("news_posts").select("title").eq("key", r.post_key).maybeSingle();
    await signalNow({
      to: r.user_id,
      kind: "news_reply_like",
      actorId: input.actorId,
      title: (post as { title?: string | null } | null)?.title ?? null,
      ref: r.post_key,
      item: input.replyId,
      dedupe: `news_reply_like:${input.actorId}:${input.replyId}`,
    });
  });
}

/**
 * 🆕 T498 — **أضافك إلى مجموعة رسائل** (البند ١٢): دفعٌ وحدَه مع «الرسائل». من صار عضواً فعلاً وحدَه يُخبَر —
 * `dm_group_create` و`dm_group_add` يُسقطان من لا يجوز (البوّابُ والحدّ)، فالأعضاءُ يُقرؤون بعد الكتابة.
 */
export function notifyGroupAdded(input: { groupId: string; actorId: string; memberIds: string[] }) {
  const ids = [...new Set(input.memberIds)].filter((id) => id !== input.actorId).slice(0, 20);
  if (!ids.length) return;
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const [{ data: group }, { data: members }, person] = await Promise.all([
      db.from("dm_groups").select("name").eq("id", input.groupId).maybeSingle(),
      db.from("dm_group_members").select("user_id").eq("group_id", input.groupId).in("user_id", ids),
      personOf(db, input.actorId),
    ]);
    if (!group || !person) return;
    const name = (group as { name: string | null }).name ?? "";
    await Promise.all(
      ((members ?? []) as { user_id: string }[]).map((m) =>
        deliver({
          to: m.user_id,
          group: "messages",
          dedupe: `group_added:${input.groupId}:${m.user_id}:${new Date().toISOString().slice(0, 10)}`,
          actorId: input.actorId,
          build: (t) =>
            groupAddedPush(
              { groupId: input.groupId, groupName: name, actorName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser },
              t,
            ),
        }).catch(() => {}),
      ),
    );
  });
}

/**
 * 🆕 T498 — **أكثرُ من ١٢ اسماً لا يُبلَّغ أحد**: `mentionsIn` يقطع عند ١٢، فبدون هذا تصل الدفعةُ أوّلَ ١٢ ويرى الباقون السطرَ
 * في الجرس — والشرطُ نفسُه في `my_signals_v3`. القاعدةُ قاعدةُ `mentionsIn` حرفاً.
 */
/** الأسماءُ المذكورةُ بقاعدة `mentionsIn` نفسِها، صغيرةً كما تُخزَّن */
function mentionNames(text: string | null | undefined): string[] {
  const names = new Set<string>();
  for (const m of String(text ?? "").matchAll(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g)) names.add(m[2].toLowerCase());
  return [...names];
}

function tooManyMentions(text: string | null | undefined): boolean {
  const names = new Set<string>();
  for (const m of String(text ?? "").matchAll(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g)) names.add(m[2].toLowerCase());
  return names.size > 12;
}

/* ================= حلقاتُ اليوم ================= */

/** بوّابةُ الذاكرة: نسخةُ الوظيفة لا تسأل القاعدةَ أكثرَ من مرّةٍ كلَّ عشر دقائق */
let lastTry = 0;
const TRY_EVERY_MS = 10 * 60_000;
/** نافذةُ الدورة: مرّةٌ كلَّ ساعتين مهما كثر المرور */
const WINDOW_HOURS = 2;

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * **«حلقةٌ جديدة اليوم»** — بحركة المرور، بلا cron ولا سرّ (نمطُ D-210): يُنادى في `after` من `me/badges`.
 *
 * 🔑 **موعدُ الحلقة من لقطة العمل** (`title_snapshots`، تُحدَّث يوميّاً) — 🆕 T313، نقضٌ لـ«من مكتبات الناس»: موعدُ
 * `follows.next_air_date` لا يتحدّث إلّا لمن فتح رئيسيّتَه بعد فوات الموعد المحفوظ، ففاتت «بلاك كلوفر» ثلاثَ حلقاتٍ بلا
 * محاولة (بلاغُ خالد ٤ نوفمبر: عند متابعٍ ما زال ٢٤ أكتوبر، وعند آخرَ فارغ). **اليومُ يُطابق القادمةَ أو الأخيرة**
 * (`airingByDay`): يومَ الحلقة تنقل TMDB القادمةَ أسبوعاً فتصير الأخيرة. **ومكتباتُ الناس احتياطٌ لعملٍ بلا لقطة** وحدَه —
 * موعدُها القديمُ لا يعلو موعدَ اللقطة. صفرُ نداءِ TMDB كما كان.
 *
 * 🔑 **اليومُ بمنطقة صاحبه، ولا رنينَ قبل العاشرة** (`EPISODE_PUSH_FROM_HOUR`) — D-1253: الحلقةُ معروضةٌ متى حلّ
 * تاريخُها. ومفتاحٌ في `push_sent` لكلِّ (مستخدم · عمل · يوم): دورةٌ لاحقةٌ لا تعيد ما أُعلن.
 *
 * 🔑 🆕 T313 — **المفتاحُ يُردّ إن لم يقبل Expo الرسالة**: كان يُكتب قبل الإرسال ويبقى مهما حدث، فإشعارٌ سقط ضاع يومُه
 * (يوما ٢٤ و٣١ أكتوبر: المفتاحُ موجود ولم يصل شيء). الآن من لم تُقبل له رسالةٌ على أيِّ جهاز تُمسح مفاتيحُه، فتعيده
 * الدورةُ التالية بعد ساعتين. الثمنُ تكرارٌ نادر إن وصلت الرسالةُ وانقطع ردُّ Expo — أهونُ من صمت.
 */
export async function runEpisodePush(nowMs = Date.now()): Promise<{ ran: boolean; users: number; sent: number }> {
  const idle = { ran: false, users: 0, sent: 0 };
  if (!hasServiceKey()) return idle;
  if (nowMs - lastTry < TRY_EVERY_MS) return idle;
  lastTry = nowMs;
  const db = await createServiceClient();
  /* 🆕 T313 — إيصالاتُ ما أُرسل قبل ربع ساعة (كلُّ الأنواع) — قبل بوّابة النافذة: تُقرأ في كلِّ دورةٍ لا مرّةً كلَّ ساعتين */
  await checkPushReceipts(db, nowMs);
  const window = Math.floor(new Date(nowMs).getUTCHours() / WINDOW_HOURS);
  if (!(await claim(db, `job:episodes:${dayOf(nowMs)}:${window}`))) return idle;

  const { data: tok } = await db.from("device_tokens").select("user_id, token, lang").limit(5000);
  const tokens = (tok ?? []) as { user_id: string; token: string; lang: string }[];
  if (!tokens.length) return { ran: true, users: 0, sent: 0 };
  const users = [...new Set(tokens.map((x) => x.user_id))];

  /* ما يُعرض أمس · اليوم · غداً (UTC) — يغطّي كلَّ منطقةٍ زمنيّة */
  const days = [dayOf(nowMs - 86_400_000), dayOf(nowMs), dayOf(nowMs + 86_400_000)];
  const inDays = `(${days.join(",")})`;
  const [{ data: snaps }, { data: air }] = await Promise.all([
    db
      .from("title_snapshots")
      .select("tmdb_id, next_air_date, last_air_date")
      .eq("media_type", "tv")
      .or(`next_air_date.in.${inDays},last_air_date.in.${inDays}`)
      .limit(10_000),
    db.from("follows").select("tmdb_id, next_air_date").eq("media_type", "tv").in("next_air_date", days).limit(10_000),
  ]);
  const airing = airingByDay((snaps ?? []) as { tmdb_id: number; next_air_date: string | null; last_air_date: string | null }[], days);
  /* الاحتياط: ما في المكتبات ولا لقطةَ له أصلاً */
  const fromLibs = airingByDay((air ?? []) as { tmdb_id: number; next_air_date: string | null }[], days);
  const libIds = [...new Set([...fromLibs.values()].flatMap((x) => [...x]))];
  if (libIds.length) {
    const { data: known } = await db.from("title_snapshots").select("tmdb_id").eq("media_type", "tv").in("tmdb_id", libIds.slice(0, 1000));
    const has = new Set(((known ?? []) as { tmdb_id: number }[]).map((r) => r.tmdb_id));
    for (const [day, set] of fromLibs) {
      for (const id of set) {
        if (has.has(id)) continue;
        const into = airing.get(day) ?? new Set<number>();
        into.add(id);
        airing.set(day, into);
      }
    }
  }
  const ids = [...new Set([...airing.values()].flatMap((s) => [...s]))];
  if (!ids.length) return { ran: true, users: users.length, sent: 0 };

  const muted = new Set<string>();
  const zone = new Map<string, string | null>();
  const mine = new Map<string, { tmdbId: number; title: string }[]>();
  for (let i = 0; i < users.length; i += 200) {
    const part = users.slice(i, i + 200);
    const [prefs, profs, rows] = await Promise.all([
      db.from("push_prefs").select("user_id, muted").in("user_id", part),
      db.from("profiles").select("id, timezone").in("id", part),
      db.from("follows").select("user_id, tmdb_id, title, dropped").eq("media_type", "tv").in("user_id", part).in("tmdb_id", ids.slice(0, 1000)).limit(10_000),
    ]);
    for (const p of (prefs.data ?? []) as { user_id: string; muted: unknown }[]) if (parseMuted(p.muted).includes("episodes")) muted.add(p.user_id);
    for (const p of (profs.data ?? []) as { id: string; timezone: string | null }[]) zone.set(p.id, p.timezone);
    for (const r of (rows.data ?? []) as { user_id: string; tmdb_id: number; title: string; dropped: boolean | null }[]) {
      if (r.dropped) continue;
      const list = mine.get(r.user_id) ?? [];
      list.push({ tmdbId: r.tmdb_id, title: r.title });
      mine.set(r.user_id, list);
    }
  }

  const batch: { token: string; text: PushText }[] = [];
  /* مفاتيحُ كلِّ مستخدمٍ وفهارسُ رسائله في الدفعة — لردّ المفاتيح إن لم تُقبل له رسالة */
  const claimed = new Map<string, { keys: string[]; at: number[] }>();
  for (const user of users) {
    if (muted.has(user)) continue;
    const { day, hour } = localDayHour(nowMs, zone.get(user));
    if (hour < EPISODE_PUSH_FROM_HOUR) continue;
    const today = airing.get(day);
    if (!today) continue;
    const fresh: { tmdbId: number; title: string }[] = [];
    const keys: string[] = [];
    for (const s of mine.get(user) ?? []) {
      const key = `ep:${user}:${s.tmdbId}:${day}`;
      if (today.has(s.tmdbId) && (await claim(db, key))) {
        fresh.push(s);
        keys.push(key);
      }
    }
    if (!fresh.length) continue;
    const at: number[] = [];
    for (const d of tokens.filter((x) => x.user_id === user)) {
      const text = episodesPush(fresh, getDict(d.lang === "en" ? "en" : "ar"));
      if (text) {
        at.push(batch.length);
        batch.push({ token: d.token, text });
      }
    }
    claimed.set(user, { keys, at });
  }
  const { sent, failed } = await send(db, batch, "episodes");
  const release = [...claimed.values()].filter((c) => c.at.length && c.at.every((n) => failed.has(n))).flatMap((c) => c.keys);
  if (release.length) await db.from("push_sent").delete().in("key", release);
  return { ran: true, users: users.length, sent };
}

/* ================= 🆕 T530 — «بانتظار تقييمك» أسبوعيّاً ================= */

let rateLastTry = 0;
/** أعضاءٌ يُحسب عددُهم في الدورة الواحدة — الحسابُ أربعةُ استعلاماتٍ للعضو، والدورةُ في `after` لا تطول */
const RATE_PUSH_PER_RUN = 60;

/**
 * **«N عملاً بانتظار تقييمك»** — مرّةً في الأسبوع، **الخميس بعد السابعة مساءً بتوقيت صاحبه** (أوّلُ العطلة)، لمن ينتظره
 * عشرةُ أعمالٍ فأكثر (أحمد ٢٣ نوفمبر «٢ أ وب وج»). بحركة المرور كالحلقات (`me/badges` → `after`)، والمفتاحُ في `push_sent`
 * لكلِّ (عضو · أسبوع) — فلا يرنّ مرّتين في أسبوعٍ واحد، ويُردّ إن لم يقبل Expo رسالتَه فتعيده الدورةُ التالية.
 *
 * 🔑 **العددُ بقرار القائمة نفسِه** (`countRateQueueFor` → `pickToRate`) ومعه «تخطَّ» من حسابه — فالرقمُ في الإشعار هو
 * ما يجده حين يفتح القائمة. ومفتاحُ «تذكير التقييم» في الإعدادات يكتمه (`rate`).
 */
export async function runRateQueuePush(nowMs = Date.now()): Promise<{ ran: boolean; users: number; sent: number }> {
  const idle = { ran: false, users: 0, sent: 0 };
  if (!hasServiceKey()) return idle;
  if (nowMs - rateLastTry < TRY_EVERY_MS) return idle;
  rateLastTry = nowMs;
  /* الخميسُ بعد السابعة مساءً بأيِّ منطقةٍ (UTC−12 … UTC+14) يقع بين الخميس ٠٥:٠٠ والجمعة ١١:٠٠ بتوقيت غرينتش — خارجها لا عملَ ولا
     استعلام (مراجعةُ الوكيل، البند ٨: الأربعاءُ لا يدخلها أبداً) */
  const utcDay = new Date(nowMs).getUTCDay();
  if (utcDay !== 4 && utcDay !== 5) return idle;
  const db = await createServiceClient();
  /* نافذةُ ساعةٍ لا ساعتين: ليلةُ الخميس في الرياض خمسُ دوراتٍ لا ثلاث */
  if (!(await claim(db, `job:ratequeue:${dayOf(nowMs)}:${new Date(nowMs).getUTCHours()}`))) return idle;

  const { data: tok } = await db.from("device_tokens").select("user_id, token, lang").limit(5000);
  const tokens = (tok ?? []) as { user_id: string; token: string; lang: string }[];
  const all = [...new Set(tokens.map((x) => x.user_id))].sort();
  if (!all.length) return { ran: true, users: 0, sent: 0 };
  /* البدايةُ تدور كلَّ دورة (البند ٨): بلا ترتيبٍ ثابتٍ يُحرم مَن بعد سقف الدورات كلَّ أسبوع — والمفتاحُ يحجز مَن حُسب له فلا يُعاد */
  const start = Math.floor(nowMs / 3_600_000) % all.length;
  const users = [...all.slice(start), ...all.slice(0, start)];

  /* مَن وقتُه الآن: الخميسُ بعد السابعة بتوقيته، ولم يكتم «تذكير التقييم»، ولم يُرسَل له هذا الأسبوع */
  const due: { user: string; key: string; skipped: Set<string> }[] = [];
  for (let i = 0; i < users.length && due.length < RATE_PUSH_PER_RUN; i += 200) {
    const part = users.slice(i, i + 200);
    const [prefs, profs] = await Promise.all([
      db.from("push_prefs").select("user_id, muted").in("user_id", part),
      db.from("profiles").select("id, timezone, ui_state").in("id", part),
    ]);
    const muted = new Set(((prefs.data ?? []) as { user_id: string; muted: unknown }[]).filter((p) => parseMuted(p.muted).includes("rate")).map((p) => p.user_id));
    const keyed: { user: string; key: string; skipped: Set<string> }[] = [];
    for (const p of (profs.data ?? []) as { id: string; timezone: string | null; ui_state: unknown }[]) {
      if (muted.has(p.id)) continue;
      const { day, hour } = localDayHour(nowMs, p.timezone);
      if (new Date(`${day}T00:00:00Z`).getUTCDay() !== RATE_PUSH_WEEKDAY || hour < RATE_PUSH_FROM_HOUR) continue;
      keyed.push({ user: p.id, key: `rq:${p.id}:${rateWeekOf(day)}`, skipped: new Set(sanitizeUiState(p.ui_state).rateSkip) });
    }
    if (!keyed.length) continue;
    const { data: sentRows } = await db.from("push_sent").select("key").in("key", keyed.map((k) => k.key));
    const already = new Set(((sentRows ?? []) as { key: string }[]).map((r) => r.key));
    for (const k of keyed) if (!already.has(k.key) && due.length < RATE_PUSH_PER_RUN) due.push(k);
  }
  if (!due.length) return { ran: true, users: users.length, sent: 0 };

  const batch: { token: string; text: PushText }[] = [];
  const claimed = new Map<string, { key: string; at: number[] }>();
  for (let i = 0; i < due.length; i += 10) {
    const counts = await Promise.all(
      due.slice(i, i + 10).map(async (d) => ({ d, c: await countRateQueueFor(db, d.user, d.skipped).catch(() => null) })),
    );
    for (const { d, c } of counts) {
      if (!c) continue;
      /* المفتاحُ يُحجز لمن حُسب له ولو قلّ عن عشرة: حُكمُ أسبوعه صدر، ولا يُعاد حسابُه كلَّ نافذةٍ فيحجب الدورَ عمّن بعده */
      if (!(await claim(db, d.key))) continue;
      if (c.total < RATE_QUEUE_MIN) continue;
      const at: number[] = [];
      for (const dev of tokens.filter((x) => x.user_id === d.user)) {
        const lang: Locale = dev.lang === "en" ? "en" : "ar";
        at.push(batch.length);
        batch.push({ token: dev.token, text: rateQueuePush(c.total, c.first, getDict(lang), (n) => num(n, lang)) });
      }
      claimed.set(d.user, { key: d.key, at });
    }
  }
  const { sent, failed } = await send(db, batch, "ratequeue");
  const release = [...claimed.values()].filter((c) => c.at.length && c.at.every((n) => failed.has(n))).map((c) => c.key);
  if (release.length) await db.from("push_sent").delete().in("key", release);
  return { ran: true, users: users.length, sent };
}

/* ================= 🆕 المهمّة ٥٦١ — ما وصل من الربوط ================= */

/** وجهةُ إشعارات الربوط: الجرسُ نفسُه (تبويبُ «التنبيهات») — فيه السطرُ وجوابُ السؤال */
const ALERTS_URL = "/messages?tab=alerts";

/**
 * **«وصل من نتفليكس/OSN+»** بعد مزامنة الفتح الصامتة (أحمد ٢٦ نوفمبر «٢ب»: إشعارُ الجوال لا الشريط). ⚠️ المزامنةُ لا تجري إلّا والتطبيقُ
 * مفتوح (متصفّحُها المخفيّ لا يعمل في الخلفية)، فالإشعارُ يصل لحظةَ الفتح ويبقى في مركز إشعارات الجوال. مفتاحُ «ما يُسجَّل تلقائياً»
 * (`auto`) يكتمه كأخيه «وصل من Kodi». والوسمُ واحدٌ للمنصّة: دفعةٌ ثانيةٌ تحلّ محلَّ الأولى ولا تتراكم.
 */
export function notifyPlatformAdded(input: { to: string; source: "netflix" | "osn" | "shahid" | "prime"; added: PlatformAdded }) {
  quiet(() =>
    deliver({
      to: input.to,
      group: "auto",
      build: (t) => {
        const what = linkWhat(input.added, t);
        if (!what) return null;
        return { title: t.autoPushTitle(linkSourceName(input.source, t)), body: what, url: ALERTS_URL, tag: `link-${input.source}` };
      },
    }),
  );
}

let askLastTry = 0;
/**
 * كم ينتظر السؤالُ بعد بدء التشغيل قبل أن يرنّ: Stremio وNuvio يقولان «شغّلها» عند البدء لا عند النهاية — سؤالُ «شاهدتها؟» في أوّل
 * دقيقةٍ من الحلقة إزعاج. سيرفرُ البيت (Kodi وأخواته) يقول «أنهاها» فيُسأل فوراً.
 */
const ASK_DELAY_MS: Record<"tv" | "movie", number> = { tv: 45 * 60_000, movie: 130 * 60_000 };
const ASK_STARTS_ONLY: ReadonlySet<string> = new Set(["stremio", "nuvio"]);
/** سؤالٌ أقدمُ من يومٍ لم يعد خبراً — يبقى في الجرس أسبوعاً بلا رنين */
const ASK_FRESH_MS = 24 * 60 * 60_000;
const ASK_USERS_PER_RUN = 50;

/**
 * **«شغّلت X في Stremio. شاهدتها؟»** على الجوال (أحمد «١أ») — بحركة المرور كالحلقات (`me/badges` → `after`)، مفتاحٌ لكلِّ سؤالٍ في
 * `push_sent` فلا يرنّ مرّتين، ولا رنينَ قبل العاشرة بتوقيت صاحبه (السؤالُ ينتظر يوماً). سؤالان فأكثر لعضوٍ واحد إشعارٌ واحدٌ بعددها.
 * الضغطةُ تفتح الجرس، والجوابُ هناك.
 */
export async function runLinkAskPush(nowMs = Date.now()): Promise<{ ran: boolean; users: number; sent: number }> {
  const idle = { ran: false, users: 0, sent: 0 };
  if (!hasServiceKey()) return idle;
  if (nowMs - askLastTry < TRY_EVERY_MS) return idle;
  askLastTry = nowMs;
  const db = await createServiceClient();
  const { data } = await db
    .from("watch_signals")
    .select("id, user_id, source, media_type, tmdb_id, season, episode, played_at")
    .eq("state", "pending")
    .is("auto_at", null)
    .not("played_at", "is", null)
    .gte("played_at", new Date(nowMs - ASK_FRESH_MS).toISOString())
    .order("played_at", { ascending: false })
    .limit(500);
  type Ask = { id: number; user_id: string; source: string; media_type: "tv" | "movie"; tmdb_id: number; season: number | null; episode: number | null; played_at: string };
  const ripe = ((data ?? []) as Ask[]).filter((a) => !ASK_STARTS_ONLY.has(a.source) || nowMs - Date.parse(a.played_at) >= ASK_DELAY_MS[a.media_type]);
  if (!ripe.length) return { ran: true, users: 0, sent: 0 };
  const byUser = new Map<string, Ask[]>();
  for (const a of ripe) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a]);
  const users = [...byUser.keys()].slice(0, ASK_USERS_PER_RUN);
  const [{ data: tok }, { data: profs }] = await Promise.all([
    db.from("device_tokens").select("user_id").in("user_id", users).limit(2000),
    db.from("profiles").select("id, timezone").in("id", users),
  ]);
  const hasDevice = new Set(((tok ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const zone = new Map(((profs ?? []) as { id: string; timezone: string | null }[]).map((p) => [p.id, p.timezone]));
  let sent = 0;
  for (const user of users) {
    if (!hasDevice.has(user)) continue;
    if (localDayHour(nowMs, zone.get(user)).hour < EPISODE_PUSH_FROM_HOUR) continue;
    const fresh: Ask[] = [];
    for (const a of byUser.get(user) ?? []) if (await claim(db, `ask:${a.id}`)) fresh.push(a);
    if (!fresh.length) continue;
    const first = fresh[0];
    const srcOf = (first.source in LINK_SOURCE_NAME ? first.source : "stremio") as LinkSource;
    /* 🆕 T579 — أسئلةُ المنصّة تصل دفعةً من عملٍ واحد (حلقاتُ ليلةٍ واحدة): «٤ حلقات من Dark» لا «٤ أعمال» */
    const oneWork = fresh.every((a) => a.media_type === first.media_type && a.tmdb_id === first.tmdb_id);
    const nameIn = async (language: "ar-SA" | "en-US") => {
      try {
        const d = first.media_type === "tv" ? await getTvIn(first.tmdb_id, language) : await getMovieIn(first.tmdb_id, language);
        return ((d as { name?: string }).name ?? (d as { title?: string }).title ?? "").trim();
      } catch {
        return "";
      }
    };
    const [ar, en] = fresh.length === 1 || oneWork ? await Promise.all([nameIn("ar-SA"), nameIn("en-US")]) : ["", ""];
    await deliver({
      to: user,
      group: "auto",
      build: (t, lang) => {
        const title = (lang === "ar" ? ar || en : en || ar).slice(0, 120);
        const ep = linkEpisodeLabel(first.season, first.episode);
        /* «شاهد» اسمٌ عربيٌّ يُكتب بلغة القارئ (`linkSourceName`) */
        const app = linkSourceName(srcOf, t);
        const body =
          fresh.length > 1 && oneWork && first.media_type === "tv" && title
            ? t.linkAskEpisodesOf(t.linkEpisodes(fresh.length), title, app)
            : fresh.length > 1
            ? t.linkAskMany(t.linkWorks(fresh.length), app)
            : !title
              ? t.linkAskUntitled(app)
              : first.media_type === "movie" || !ep
                ? t.linkAskMovie(title, app)
                : t.linkAsk(title, ep, app);
        return { title: t.linkAskPushTitle(app), body, url: ALERTS_URL, tag: `ask-${user.slice(0, 8)}` };
      },
    });
    sent++;
  }
  return { ran: true, users: users.length, sent };
}
