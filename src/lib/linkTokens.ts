import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { isGold, isPlus, type PlanBearer } from "@/core/plan";
import type { SignalSource } from "@/core/contracts/stremio";
import { markSignalWatched, type SignalRow } from "@/lib/watchMark";
import {
  acceptOnUnbound,
  canIssue,
  HOME_KINDS,
  isAlive,
  isHomeKind,
  kindsOf,
  partition,
  slotLimit,
  slotsOf,
  usedSlots,
  type DeviceKind,
  type HomeKind,
  type LinkRow,
  type LinkTableName,
  type LinkTier,
} from "@/core/deviceLinks";

/**
 * ====== 🆕 رموزُ الروابط الخاصّة — Stremio وسيرفراتُ البيت (هجرتا ٢٢٢ · ٢٣٥) ======
 *
 * 🔑 **رابطٌ يحمل رمزاً قدرتُه الوحيدةُ «سجّل سؤالاً»** — Stremio يحفظه في إضافته، وPlex/Jellyfin/Emby في إعداد Webhooks.
 * كانت هذه الدوالُّ في `stremio.ts` وحدَه؛ ولمّا صار لها جدولٌ ثانٍ (`home_server_links`) بالقواعد نفسِها خرجت إلى هنا
 * (D-145): بصمةٌ (sha-256) لا الرمز، رمزٌ واحدٌ لكلِّ عضو («أصدر» يستبدل القديم)، ويموت إن نام ٩٠ يوماً (A-05)،
 * و«آخرُ استعمال» يُكتب مرّةً في الساعة، والخطّةُ (Loopz+) تُقرأ عند كلِّ طلب.
 * ⚠️ **الفشلُ صمت**: قبل الهجرة يغيب الجدول — فلا رابطَ يُصدر، والرابطُ لا يجد صاحباً.
 */

/* 🆕 هجرة ٢٣٦ — `kodi_links`: رابطُ إضافة Kodi مستقلٌّ عن رابط Plex/Jellyfin/Emby (إصدارُه لا يُسقط ذاك) */
export type LinkTable = LinkTableName;

const IDLE_DAYS = 90;
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const aliveSince = () => new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString();

/* ============================================================
 * 🆕 هجرة ٢٣٧ — الخاناتُ: العدُّ عند الإصدار وعند الاستقبال
 * ============================================================
 * 🔑 **الحكمُ في `@/core/deviceLinks`** (ثابتٌ ومُختبر)، وهنا قراءةُ الصفوف وكتابةُ ما يتغيّر. وكلُّ قراءةٍ تُنزل حكمَ الخانات
 * على الصفوف أوّلاً (`settle`): نزولٌ من بلس لا يحتاج مهمّةً ليليّة — أوّلُ حدثٍ أو فتحٍ لصفحة الربط بعده يُوقف الزائد.
 * ⚠️ **قبل الهجرة تغيب الأعمدةُ الجديدة**: القراءةُ تفشل (`42703`) فيعود السلوكُ القديم بحرفه — بلس وحده، رابطٌ واحدٌ لكلِّ
 * جدول. فالخادمُ يُنشر قبل الهجرة أو بعدها ولا ينكسر.
 */
type Db = Awaited<ReturnType<typeof createServiceClient>>;
type Profile = { plan?: unknown; plus_until?: string | null; founder?: boolean | null; auto_mark?: boolean | null; gold_until?: string | null };

const LINK_COLS = "token_hash, created_at, last_used_at, stopped_at";
const HOME_COLS = `${LINK_COLS}, server, kinds`;
const TABLES: LinkTableName[] = ["stremio_links", "home_server_links", "kodi_links"];

function rowOf(table: LinkTableName, r: Record<string, unknown>): LinkRow {
  const kinds = Array.isArray(r.kinds) ? (r.kinds as unknown[]).filter(isHomeKind) : [];
  return {
    table,
    token_hash: String(r.token_hash),
    server: isHomeKind(r.server) ? r.server : null,
    kinds,
    created_at: String(r.created_at),
    last_used_at: (r.last_used_at as string | null) ?? null,
    stopped_at: (r.stopped_at as string | null) ?? null,
  };
}

/** صفوفُ العضو في الجداول الثلاثة — `null` قبل الهجرة (عمودٌ غائب) أو إن فشلت القراءة */
async function readRows(db: Db, userId: string): Promise<LinkRow[] | null> {
  const res = await Promise.all(
    TABLES.map((table) => db.from(table).select(table === "home_server_links" ? HOME_COLS : LINK_COLS).eq("user_id", userId).limit(10)),
  );
  if (res.some((r) => r.error)) return null;
  return res.flatMap((r, i) => ((r.data ?? []) as unknown as Record<string, unknown>[]).map((row) => rowOf(TABLES[i], row)));
}

/** الملفُّ للحكم — و`auto_mark` يُقرأ إن وُجد (قبل الهجرة: `null`) */
async function profileOf(db: Db, userId: string): Promise<Profile | null> {
  /* 🆕 هجرة ٢٣٨ — الذهبيُّ (`gold_until`) أوّلاً، ثمّ بلاه قبل الهجرة، ثمّ بلا `auto_mark` قبل ٢٣٧ */
  const gold = await db.from("profiles").select("plan, plus_until, founder, auto_mark, gold_until").eq("id", userId).maybeSingle();
  if (!gold.error) return (gold.data as Profile | null) ?? null;
  const full = await db.from("profiles").select("plan, plus_until, founder, auto_mark").eq("id", userId).maybeSingle();
  if (!full.error) return (full.data as Profile | null) ?? null;
  const base = await db.from("profiles").select("plan, plus_until, founder").eq("id", userId).maybeSingle();
  return (base.data as Profile | null) ?? null;
}

/** الطبقةُ للعدّ — 🆕 الذهبيُّ بحقله (هجرة ٢٣٨): خاناتٌ بلا حدّ */
function tierOf(p: Profile | null): LinkTier {
  const b = p as PlanBearer | null;
  return isGold(b) ? "gold" : isPlus(b) ? "plus" : "free";
}

/** يُنزل حكمَ الخانات على الصفوف (يُوقف الزائد ويُعيد ما اتّسع له) ويعيد الصفوفَ بعده */
async function settle(db: Db, rows: LinkRow[], limit: number): Promise<LinkRow[]> {
  const { keep, stop } = partition(rows, limit);
  const now = new Date().toISOString();
  const writes: PromiseLike<unknown>[] = [];
  for (const r of stop) if (!r.stopped_at) writes.push(db.from(r.table).update({ stopped_at: now }).eq("token_hash", r.token_hash));
  for (const r of keep) if (r.stopped_at) writes.push(db.from(r.table).update({ stopped_at: null }).eq("token_hash", r.token_hash));
  if (writes.length) await Promise.all(writes);
  const stopped = new Set(stop.map((r) => r.token_hash));
  return rows.map((r) => (stopped.has(r.token_hash) ? { ...r, stopped_at: r.stopped_at ?? now } : keep.some((k) => k.token_hash === r.token_hash) ? { ...r, stopped_at: null } : r));
}

/** حالُ خانات العضو كما تقرؤها صفحةُ «الربط» — `null` قبل الهجرة */
export async function deviceLinksOf(userId: string): Promise<{ tier: LinkTier; limit: number; rows: LinkRow[]; autoMark: boolean; plus: boolean } | null> {
  if (!hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const [rows, p] = await Promise.all([readRows(db, userId), profileOf(db, userId)]);
    if (!rows) return null;
    const tier = tierOf(p);
    const limit = slotLimit(tier);
    const settled = await settle(db, rows, limit);
    return { tier, limit, rows: settled.filter((r) => isAlive(r)), autoMark: p?.auto_mark !== false, plus: tier !== "free" };
  } catch {
    return null;
  }
}

/** هل يُصدر رابطٌ لهذا الجهاز الآن؟ — `null` قبل الهجرة (فالحكمُ القديم: بلس وحده) */
export async function mayLinkDevice(userId: string, kind: DeviceKind): Promise<boolean | null> {
  const st = await deviceLinksOf(userId);
  if (!st) return null;
  return canIssue(st.rows, kind, st.limit);
}

/** رابطُ تطبيق 1.13.x بلا نوع: استبدالُ القديم الشغّال أو خانةٌ فارغة — الحكمُ نفسُه الذي في `issueLinkToken` */
export async function mayLinkUnbound(userId: string): Promise<boolean | null> {
  const st = await deviceLinksOf(userId);
  if (!st) return null;
  const legacy = st.rows.find((r) => r.table === "home_server_links" && !r.server);
  return (!!legacy && !legacy.stopped_at) || usedSlots(st.rows) + 1 <= st.limit;
}

/**
 * «اختر ما يبقى» — يبقى ما اختاره العضو (بحدود خاناته) ويُوقف الباقي. صفٌّ قديمٌ بلا نوع يبقى إن اختير أيُّ نوعٍ فيه.
 * يعيد `false` إن زاد المختارُ على الخانات أو قبل الهجرة.
 */
export async function keepDevices(userId: string, kinds: DeviceKind[]): Promise<boolean> {
  const st = await deviceLinksOf(userId);
  if (!st) return false;
  const want = new Set(kinds);
  const chosen = st.rows.filter((r) => kindsOf(r).some((k) => want.has(k)) || (kindsOf(r).length === 0 && HOME_KINDS.some((k) => want.has(k))));
  if (chosen.reduce((n, r) => n + slotsOf(r), 0) > st.limit) return false;
  const db = await createServiceClient();
  const now = new Date().toISOString();
  const pick = new Set(chosen.map((r) => r.token_hash));
  await Promise.all(
    st.rows.map((r) =>
      db
        .from(r.table)
        .update({ stopped_at: pick.has(r.token_hash) ? null : (r.stopped_at ?? now) })
        .eq("token_hash", r.token_hash),
    ),
  );
  return true;
}

/** «سجّل بلا سؤال» — يكتبه الخادمُ وحده (لا منحةَ تعديلٍ للعضو على العمود) */
export async function setAutoMark(userId: string, value: boolean): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { error } = await db.from("profiles").update({ auto_mark: value }).eq("id", userId);
  return !error;
}

export type IssueOutcome = { ok: true; token: string } | { ok: false; reason: "limit" | "upstream" };

/**
 * يُصدر رابطاً جديداً لجهازٍ ويعيد الرمزَ **مرّةً واحدة**. رابطٌ لجهازٍ مربوطٍ يحلّ محلَّ القديم؛ والجديدُ يحتاج خانة.
 * - Plex/Jellyfin/Emby برابطٍ لكلِّ نوع (`server`)؛ والطلبُ بلا نوع (تطبيقُ 1.13.x) يُصدر الرابطَ القديمَ بلا نوع.
 * - رابطٌ لنوعٍ كان يمرّ في الرابط القديم: يخرج منه النوع، والقديمُ يُحذف إن لم يبقَ له غيرُه.
 * ⚖️ **قبل الهجرة**: رابطٌ واحدٌ لكلِّ عضو في الجدول كما كان (`onConflict: user_id`).
 */
export async function issueLinkToken(table: LinkTable, prefix: string, userId: string, server?: HomeKind | null): Promise<IssueOutcome> {
  if (!hasServiceKey()) return { ok: false, reason: "upstream" };
  const db = await createServiceClient();
  const token = `${prefix}${randomBytes(32).toString("base64url")}`;
  const fresh = { token_hash: hashOf(token), user_id: userId, created_at: new Date().toISOString(), last_used_at: null };
  const st = await deviceLinksOf(userId);
  if (!st) {
    const { error } = await db.from(table).upsert(fresh, { onConflict: "user_id" });
    return error ? { ok: false, reason: "upstream" } : { ok: true, token };
  }
  const kind: DeviceKind | null = table === "stremio_links" ? "stremio" : table === "kodi_links" ? "kodi" : (server ?? null);
  const legacy = st.rows.find((r) => r.table === "home_server_links" && !r.server);
  /* رابطٌ بلا نوع (تطبيقُ 1.13.x) يستبدل القديمَ بلا نوع إن وُجد — وإلّا يحتاج خانةً كأيِّ جهازٍ جديد */
  const room = kind ? canIssue(st.rows, kind, st.limit) : (!!legacy && !legacy.stopped_at) || usedSlots(st.rows) + 1 <= st.limit;
  if (!room) return { ok: false, reason: "limit" };
  if (table !== "home_server_links") {
    const { error } = await db.from(table).upsert({ ...fresh, stopped_at: null }, { onConflict: "user_id" });
    return error ? { ok: false, reason: "upstream" } : { ok: true, token };
  }
  /* ⚖️ **الاستبدالُ تحديثٌ في مكانه لا حذفٌ ثمّ إدراج**: إدراجٌ يفشل بعد الحذف كان يُسقط رابطاً يعمل */
  const own = server ? st.rows.find((r) => r.table === "home_server_links" && r.server === server) : legacy;
  if (server && legacy && (legacy.kinds.length === 0 || (legacy.kinds.length === 1 && legacy.kinds[0] === server))) {
    await db.from("home_server_links").delete().eq("token_hash", legacy.token_hash);
  } else if (server && legacy?.kinds.includes(server)) {
    await db.from("home_server_links").update({ kinds: legacy.kinds.filter((k) => k !== server) }).eq("token_hash", legacy.token_hash);
  }
  if (!own) {
    /* صفٌّ نام ٩٠ يوماً لا يُقرأ حيّاً لكنّه يحجز مكانَه في الفهرس — يُزال قبل الإدراج */
    const stale = db.from("home_server_links").delete().eq("user_id", userId);
    await (server ? stale.eq("server", server) : stale.is("server", null));
  }
  const { error } = own
    ? await db.from("home_server_links").update({ ...fresh, kinds: [], stopped_at: null }).eq("token_hash", own.token_hash)
    : await db.from("home_server_links").insert({ ...fresh, server: server ?? null, kinds: [] });
  return error ? { ok: false, reason: "upstream" } : { ok: true, token };
}

/**
 * يقطع رابطاً. لسيرفرات البيت: نوعٌ بعينه يحذف رابطَه، **والرابطَ القديمَ إن كان يمرّ فيه** (رمزٌ واحدٌ لا يُقطع نصفُه)؛
 * والطلبُ بلا نوع (تطبيقُ 1.13.x: «ألغِ الربط» للسيرفرات كلِّها) يحذف روابطَ السيرفرات الثلاثة.
 */
export async function revokeLinkToken(table: LinkTable, userId: string, server?: HomeKind | null): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  if (table !== "home_server_links" || !server) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    return !error;
  }
  const own = await db.from("home_server_links").delete().eq("user_id", userId).eq("server", server);
  if (own.error) return false;
  const { error } = await db.from("home_server_links").delete().eq("user_id", userId).is("server", null).contains("kinds", [server]);
  return !error;
}

/** يقطع الرابطَ القديمَ المشترك ما دام لم يرسل منه سيرفر (`kinds` فارغة) — ما أرسل منه يُفكّ بنوعه */
export async function revokePendingLegacy(userId: string): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { error } = await db.from("home_server_links").delete().eq("user_id", userId).is("server", null).eq("kinds", "{}");
  return !error;
}

/** هل للعضو رابطٌ حيّ في الجدول؟ ومتى صدر، ومتى استُعمل آخرَ مرّة — للشاشات القديمة (أحدثُ صفٍّ حيّ) */
export async function linkStateOf(table: LinkTable, userId: string): Promise<{ linked_at: string; used_at: string | null } | null> {
  if (!hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from(table).select("created_at, last_used_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    const rows = ((data ?? []) as { created_at: string; last_used_at: string | null }[]).filter((r) => (r.last_used_at ?? r.created_at) >= aliveSince());
    if (!rows.length) return null;
    const used = rows.map((r) => r.last_used_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
    return { linked_at: rows[0].created_at, used_at: used };
  } catch {
    return null;
  }
}

export interface LinkOwner {
  userId: string;
  plus: boolean;
  /** 🆕 هجرة ٢٣٧ — الرابطُ داخل خانات العضو: يُستقبل حدثُه. (قبل الهجرة = `plus` كما كان) */
  active: boolean;
  /** 🆕 «سجّل بلا سؤال» فعّالٌ لهذا العضو الآن (بلس + الإعداد) — لا يقرؤه Stremio أبداً */
  autoMark: boolean;
}

/**
 * صاحبُ الرمز وهل يُستقبل حدثُه — `null` لرمزٍ لا شكلَ له أو لا وجودَ له أو نام ٩٠ يوماً.
 * 🔑 **الصاحبُ من صفِّ البصمة لا من الطلب**، والخطّةُ تُقرأ عند كلِّ طلب: اشتراكٌ انتهى يُسكت ما زاد على خانته في حينه.
 * 🆕 هجرة ٢٣٧ — **«نشِط» بدل «بلس»**: الرابطُ داخل الخانات بعد إنزال حكمها (`settle`)؛ و«آخرُ استعمال» يُكتب بعده وللنشِط وحده —
 * فحدثٌ من رابطٍ موقوف لا يجعله الأحدثَ فيُوقف غيرَه. ورابطٌ قديمٌ بلا نوعٍ يأخذ نوعَ السيرفر المرسِل (`kind`) أوّلَ مرّة.
 */
/** 🆕 T361 — `fresh`: حدثُ «انتهت» — يُكتب وقتُ آخرِ حدثٍ الآن لا مرّةً في الساعة (أحمد «١ب»): صفحةُ الجهاز تقول «آخر ما وصل»
    بعد الفيلم مباشرةً. رسائلُ التشغيل والإيقاف تبقى مرّةً في الساعة — كثيرةٌ ولا تُرى. */
export async function linkOwner(table: LinkTable, token: string, shape: RegExp, kind?: HomeKind, fresh = false): Promise<LinkOwner | null> {
  if (!shape.test(token) || !hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const hash = hashOf(token);
    const { data } = await db.from(table).select("user_id, created_at, last_used_at").eq("token_hash", hash).maybeSingle();
    if (!data) return null;
    const r = data as { user_id: string; created_at: string; last_used_at: string | null };
    if ((r.last_used_at ?? r.created_at) < aliveSince()) return null;
    const [rows, p] = await Promise.all([readRows(db, r.user_id), profileOf(db, r.user_id)]);
    const tier = tierOf(p);
    const plus = tier !== "free";
    let active = plus;
    if (rows) {
      const settled = await settle(db, rows, slotLimit(tier));
      const me = settled.find((x) => x.token_hash === hash);
      active = !!me && !me.stopped_at;
      if (me && active && me.table === "home_server_links" && !me.server) {
        if (!kind) active = false;
        else {
          const v = acceptOnUnbound(settled, me, kind, slotLimit(tier));
          active = v.ok;
          if (v.bind) await db.from("home_server_links").update({ kinds: [...me.kinds, kind] }).eq("token_hash", hash);
        }
      }
      if (me && me.table === "home_server_links" && me.server && kind && me.server !== kind) active = false;
    }
    /* قبل الهجرة (`rows` غائبة) يُكتب كما كان لكلِّ رابطٍ حيّ */
    if ((active || !rows) && (fresh || !r.last_used_at || Date.now() - Date.parse(r.last_used_at) > 3_600_000))
      await db.from(table).update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
    return { userId: r.user_id, plus, active, autoMark: plus && p?.auto_mark !== false && rows != null };
  } catch {
    return null;
  }
}

/**
 * 🆕 «سجّل بلا سؤال» — حدثُ «انتهت» من سيرفر البيت أو Kodi لمن فعّله: السؤالُ يُسجَّل ثمّ يُجاب ✓ في الحال، **بالتعليم
 * نفسِه الذي يفعله ✓ العضو** (`watchMark.ts`) وشارةِ المصدر. ⚖️ Stremio لا يصل هنا أبداً: «فتحها» ليس «خلّصها».
 */
/**
 * 🆕 T361 — **يعيد رقمَ الإشارة المعلَّمة** (أو `null`) ويختمها `auto_at` (هجرة ٢٤٢): منها بطاقةُ الرئيسيّة «أضفناه لمكتبتك» وإشعارُ
 * «وصل من …». الختمُ صامتٌ إن فشل — قبل الهجرة لا عمود، فيبقى التعليمُ كما كان بلا بطاقةٍ ولا إشعار.
 */
export async function autoMarkSignal(userId: string, source: Exclude<SignalSource, "stremio">, kind: "tv" | "movie", tmdbId: number, season: number | null, episode: number | null): Promise<number | null> {
  try {
    const db = await createServiceClient();
    let q = db
      .from("watch_signals")
      .select("id, media_type, tmdb_id, season, episode")
      .match({ user_id: userId, state: "pending", media_type: kind, tmdb_id: tmdbId });
    q = kind === "tv" ? q.eq("season", season as number).eq("episode", episode as number) : q;
    const { data } = await q.maybeSingle();
    if (!data) return null;
    const row = data as SignalRow;
    /* 🆕 T367 — **بلغة العضو**: الطلبُ من Kodi أو السيرفر أو Stremio بلا كوكي، فلغةُ الطلب العربيّةُ الافتراضيّة لا لغتُه.
       المحفوظةُ في ملفّه (`setLocale`)، وبلا قيمةٍ = كما كان */
    const { data: prof } = await db.from("profiles").select("locale").eq("id", userId).maybeSingle();
    const loc = (prof as { locale?: string | null } | null)?.locale;
    await markSignalWatched(db, userId, row, source, loc === "en" ? "en-US" : loc === "ar" ? "ar-SA" : null);
    const { error } = await db.from("watch_signals").update({ auto_at: new Date().toISOString() }).match({ id: row.id, user_id: userId });
    return error ? null : row.id;
  } catch {
    return null;
  }
}

/**
 * يسجّل «فتحها» أو «شغّلها/أنهاها» (`played`) سؤالاً منتظراً — صامتٌ إن فشل (المرسِلُ لا ينتظر قاعدتنا ولا يسقط بها).
 * ⚖️ `p_source` يُرسل لغير Stremio وحده: نداءُ Stremio بشكله القديم يعمل قبل هجرة ٢٣٥ وبعدها.
 */
export async function recordSignal(
  userId: string,
  source: SignalSource,
  kind: "tv" | "movie",
  tmdbId: number,
  season: number | null,
  episode: number | null,
  played: boolean,
): Promise<string | null> {
  try {
    const db = await createServiceClient();
    const { data } = await db.rpc("record_watch_signal", {
      p_user: userId,
      p_type: kind,
      p_tmdb: tmdbId,
      p_season: kind === "tv" ? season : null,
      p_episode: kind === "tv" ? episode : null,
      p_played: played,
      ...(source === "stremio" ? {} : { p_source: source }),
    });
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

/* ============================================================
 * 🆕 ربطُ Kodi برمزٍ قصير (هجرة ٢٣٦ — أحمد ٥ نوفمبر «٢ أ»)
 * ============================================================
 * 🔑 **رابطٌ طويلٌ لا يُكتب بريموت التلفزيون** — فالتطبيقُ يعرض ستّةَ أرقام، والعضوُ يكتبها في إعدادات الإضافة، والإضافةُ تبدّلها
 * برابطها (`/api/v1/home-server/kodi/pair`). الرمزُ: بصمتُه لا هو، عشرُ دقائق، مرّةً واحدة، ورمزٌ واحدٌ للعضو (الجديدُ يُسقط القديم).
 * ⚖️ **والتخمينُ محدود**: مليونُ رمزٍ وعشرُ دقائق، وبابُ التبديل محدودٌ بعنوان المرسِل في القاعدة (A-14) — عشرةٌ في الدقيقة.
 */
const PAIR_TTL_MS = 10 * 60_000;

export async function issueKodiPairCode(userId: string): Promise<{ code: string; expires_at: string } | null> {
  if (!hasServiceKey()) return null;
  const db = await createServiceClient();
  await db.from("kodi_pair_codes").delete().eq("user_id", userId);
  /* رمزٌ يصادف رمزاً حيّاً لعضوٍ آخر (المفتاحُ بصمتُه) يُعاد اختيارُه — نادرٌ، وثلاثُ محاولاتٍ تكفي */
  for (let i = 0; i < 3; i++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expires_at = new Date(Date.now() + PAIR_TTL_MS).toISOString();
    const { error } = await db.from("kodi_pair_codes").insert({ code_hash: hashOf(`kodi:${code}`), user_id: userId, expires_at });
    if (!error) return { code, expires_at };
  }
  return null;
}

/** الرمزُ ⇐ رابطُ Kodi جديدٌ لصاحبه (ويُسقط رابطَ Kodi قبله)، باسم الجهاز — `null` لرمزٍ مجهولٍ أو منتهٍ */
export async function redeemKodiPairCode(code: string, device: string | null): Promise<{ token: string; userId: string } | null> {
  if (!/^\d{6}$/.test(code) || !hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from("kodi_pair_codes").delete().eq("code_hash", hashOf(`kodi:${code}`)).select("user_id, expires_at").maybeSingle();
    const row = data as { user_id: string; expires_at: string } | null;
    if (!row || Date.parse(row.expires_at) < Date.now()) return null;
    const out = await issueLinkToken("kodi_links", "lk_", row.user_id);
    if (!out.ok) return null;
    const token = out.token;
    const name = (device ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) || null;
    /* 🆕 تبديلُ الرمز دليلُ الربط: الإضافةُ وصلت فعلاً — «آخرُ استعمال» الآن، فصفحةُ Kodi تقول «مربوط» في حينها */
    await db.from("kodi_links").update({ ...(name ? { device: name } : {}), last_used_at: new Date().toISOString() }).eq("user_id", row.user_id);
    return { token, userId: row.user_id };
  } catch {
    return null;
  }
}

/** اسمُ جهاز Kodi المربوط — لسطر «مربوط من …» */
export async function kodiDeviceOf(userId: string): Promise<string | null> {
  if (!hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from("kodi_links").select("device").eq("user_id", userId).maybeSingle();
    return (data as { device: string | null } | null)?.device ?? null;
  } catch {
    return null;
  }
}

/** هل للعضو رمزُ ربطٍ حيٌّ الآن؟ — التطبيقُ يسأل وهو ينتظر Kodi، فيعرف أن الرمزَ استُعمل حين يختفي */
export async function kodiPairPending(userId: string): Promise<boolean> {
  if (!hasServiceKey()) return false;
  try {
    const db = await createServiceClient();
    const { data } = await db.from("kodi_pair_codes").select("expires_at").eq("user_id", userId).maybeSingle();
    const r = data as { expires_at: string } | null;
    return !!r && Date.parse(r.expires_at) > Date.now();
  } catch {
    return false;
  }
}
