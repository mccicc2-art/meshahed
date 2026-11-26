import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { isGold, isPlus, type PlanBearer } from "@/core/plan";
import type { SignalSource } from "@/core/contracts/stremio";
import type { PlatformAdded, PlatformAskItem } from "@/core/contracts/deviceLinks";
import { markSignalWatched, type SignalRow } from "@/lib/watchMark";
import {
  acceptOnUnbound,
  canIssue,
  canLinkPlatform,
  HOME_KINDS,
  isAlive,
  isHomeKind,
  isPlatformKind,
  kindsOf,
  partitionTier,
  slotLimit,
  slotsOf,
  usedSlots,
  type DeviceKind,
  type HomeKind,
  type LinkRow,
  type LinkTableName,
  type LinkTier,
  type PlatformKind,
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
  const [res, platforms, nuvio] = await Promise.all([
    Promise.all(TABLES.map((table) => db.from(table).select(table === "home_server_links" ? HOME_COLS : LINK_COLS).eq("user_id", userId).limit(10))),
    readPlatformRows(db, userId),
    readNuvioRows(db, userId),
  ]);
  if (res.some((r) => r.error)) return null;
  return [...res.flatMap((r, i) => ((r.data ?? []) as unknown as Record<string, unknown>[]).map((row) => rowOf(TABLES[i], row))), ...nuvio, ...platforms];
}

/**
 * 🆕 هجرة ٢٦٧ — **رابطُ Nuvio** (إضافةُ Stremio نفسُها في Nuvio، برابطٍ وخانةٍ لحاله). ⚠️ **قراءتُه لا تُسقط قراءةَ الأجهزة**:
 * قبل الهجرة يغيب الجدول ⇐ لا Nuvio، والأجهزةُ الخمسة كما كانت — لو دخل `TABLES` لعاد الكلُّ إلى حكم «بلس وحده» حتى تُشغّل.
 */
async function readNuvioRows(db: Db, userId: string): Promise<LinkRow[]> {
  const { data, error } = await db.from("nuvio_links").select(LINK_COLS).eq("user_id", userId).limit(10);
  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => rowOf("nuvio_links", row));
}

/* ============================================================
 * 🆕 هجرة ٢٦٥ — منصّاتُ البثّ (نتفليكس أوّلاً، خطّة `PLAN-NETFLIX-SYNC.md`)
 * ============================================================
 * 🔑 **صفٌّ بلا رمز**: الدخولُ إلى نتفليكس يعيش في متصفّح التطبيق على جهاز العضو، والخادمُ يعرف الربطَ وملفَّه الشخصيّ ومتى زامن.
 * يأخذ خانةً كأيِّ جهاز ويُوقفه النزولُ كإخوته (`settle`) — ومفتاحُه `id` يُحمل في `token_hash` لأنّ الحكمَ يعرف مفتاحاً واحداً.
 * ⚠️ **قراءتُه لا تُسقط قراءةَ الأجهزة**: قبل الهجرة يغيب الجدول ⇐ لا منصّات، والأجهزةُ تعمل كما كانت (لا `null`).
 */
const PLATFORM_COLS = "id, platform, profile_label, created_at, last_used_at, last_item_at, since_at, stopped_at";
const keyCol = (table: LinkTableName) => (table === "platform_links" ? "id" : "token_hash");

export interface PlatformLinkRow {
  platform: PlatformKind;
  profile_label: string | null;
  created_at: string;
  last_used_at: string | null;
  last_item_at: string | null;
  since_at: string | null;
  stopped_at: string | null;
  /** 🆕 T579 (هجرة ٢٧٢) — قبل الهجرة غائب (= نعم) */
  auto_add?: boolean;
}

async function readPlatformRows(db: Db, userId: string): Promise<LinkRow[]> {
  const { data, error } = await db.from("platform_links").select(PLATFORM_COLS).eq("user_id", userId).limit(10);
  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter((r) => isPlatformKind(r.platform))
    .map((r) => ({
      table: "platform_links" as const,
      token_hash: String(r.id),
      server: null,
      kinds: [],
      platform: r.platform as PlatformKind,
      created_at: String(r.created_at),
      last_used_at: (r.last_used_at as string | null) ?? null,
      stopped_at: (r.stopped_at as string | null) ?? null,
    }));
}

/** منصّاتُ العضو بتفاصيلها لصفحة «الربط» — `[]` قبل الهجرة أو إن فشلت القراءة */
export async function platformLinksOf(userId: string): Promise<PlatformLinkRow[]> {
  if (!hasServiceKey()) return [];
  try {
    const db = await createServiceClient();
    /* 🆕 T579 — والمفتاحُ معها (هجرة ٢٧٢)؛ قبل الهجرة العمودُ غائبٌ فتُقرأ الصفوفُ بدونه كما كانت */
    const withAuto = await db.from("platform_links").select(`${PLATFORM_COLS}, auto_add`).eq("user_id", userId).limit(10);
    const { data, error }: { data: unknown[] | null; error: unknown } = withAuto.error ? await db.from("platform_links").select(PLATFORM_COLS).eq("user_id", userId).limit(10) : withAuto;
    if (error) return [];
    return ((data ?? []) as unknown as PlatformLinkRow[]).filter((r) => isPlatformKind(r.platform) && (r.last_used_at ?? r.created_at) >= aliveSince());
  } catch {
    return [];
  }
}

export type PlatformLinkOutcome = { ok: true } | { ok: false; reason: "plus" | "limit" | "upstream" | "not_ready" };

/**
 * يربط منصّةً (أو يعيد ربطها): **الصفُّ نفسُه يُحدَّث** — دخولٌ جديدٌ بعد انتهاء الجلسة لا يأخذ خانةً ثانية.
 * - `profileLabel`: اسمُ الملفّ الشخصيّ في المنصّة كما يراه العضو (للعرض وحده).
 * - `importAll`: «استيراد الكل» ⇐ `since_at = null`؛ «من الآن فقط» ⇐ `since_at = الآن` — وما شوهد قبله لا يدخل أبداً.
 * ⚖️ إعادةُ الربط تبدأ المزامنةَ من جديد (`last_item_at = null`): ملفٌّ شخصيٌّ آخر له سجلٌّ آخر — وما في المكتبة يبقى
 *   (الكتابةُ «ما في Loopz يبقى»، `keep`).
 */
export async function linkPlatform(userId: string, platform: PlatformKind, profileLabel: string | null, importAll: boolean): Promise<PlatformLinkOutcome> {
  if (!hasServiceKey()) return { ok: false, reason: "upstream" };
  const st = await deviceLinksOf(userId);
  if (!st) return { ok: false, reason: "upstream" };
  /* 🆕 T551 — لا «اشترك» للمجّانيّ: المنصّةُ تأخذ خانتَه الواحدة كأيِّ جهاز، والممتلئةُ `limit` («فك ربط تطبيقك أولاً») */
  if (!canLinkPlatform(st.rows, platform, st.tier)) return { ok: false, reason: "limit" };
  const db = await createServiceClient();
  const now = new Date().toISOString();
  const label = (profileLabel ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) || null;
  const { error } = await db.from("platform_links").upsert(
    { user_id: userId, platform, profile_label: label, created_at: now, last_used_at: now, last_item_at: null, since_at: importAll ? null : now, stopped_at: null },
    { onConflict: "user_id,platform" },
  );
  if (error) return { ok: false, reason: error.code === "42P01" ? "not_ready" : "upstream" };
  return { ok: true };
}

/**
 * مزامنةٌ تمّت على الجهاز: «آخرُ استعمال» الآن، وأحدثُ مشاهدةٍ قُرئت (لا يتراجع: مزامنتان متداخلتان لا تُرجعان المؤشّر).
 * يعيد `false` إن لم يكن الربطُ قائماً أو كان موقوفاً — فالتطبيقُ لا يكتب مزامنةً لربطٍ فُكّ أو نزل من خاناته.
 */
export async function recordPlatformSync(userId: string, platform: PlatformKind, lastItemAt: string | null): Promise<boolean> {
  if (!hasServiceKey()) return false;
  try {
    /* الحكمُ أوّلاً (`deviceLinksOf` يُنزل الخاناتِ والطبقة): مزامنةٌ لمنصّةٍ أوقفها النزولُ لا تُكتب */
    const st = await deviceLinksOf(userId);
    const linked = st?.rows.find((r) => r.table === "platform_links" && r.platform === platform);
    if (!linked || linked.stopped_at) return false;
    const db = await createServiceClient();
    const { data } = await db.from("platform_links").select("last_item_at, stopped_at").eq("user_id", userId).eq("platform", platform).maybeSingle();
    const row = data as { last_item_at: string | null; stopped_at: string | null } | null;
    if (!row || row.stopped_at) return false;
    const next = lastItemAt && (!row.last_item_at || Date.parse(lastItemAt) > Date.parse(row.last_item_at)) ? lastItemAt : row.last_item_at;
    const { error } = await db
      .from("platform_links")
      .update({ last_used_at: new Date().toISOString(), last_item_at: next })
      .eq("user_id", userId)
      .eq("platform", platform);
    return !error;
  } catch {
    return false;
  }
}

/**
 * 🆕 T579 — «إضافة مشاهداتي تلقائياً» لمنصّةٍ مربوطة (أحمد: «احيانا شخصين يستخدمون نفس الملف الشخصي»). يكتبه الخادمُ وحده
 * كـ`auto_mark`. يعيد `false` إن لم تكن مربوطة أو قبل الهجرة.
 */
export async function setPlatformAutoAdd(userId: string, platform: PlatformKind, value: boolean): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { data, error } = await db.from("platform_links").update({ auto_add: value }).eq("user_id", userId).eq("platform", platform).select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** فكُّ منصّة — الصفُّ يُحذف وتنفتح خانتُه. **ما دخل المكتبة يبقى** (أحمد: «ما استُورد يبقى») */
export async function revokePlatform(userId: string, platform: PlatformKind): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { error } = await db.from("platform_links").delete().eq("user_id", userId).eq("platform", platform);
  return !error;
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

/** يُنزل حكمَ الخانات على الصفوف (يُوقف الزائد ويُعيد ما اتّسع له) ويعيد الصفوفَ بعده — 🆕 بالطبقة: المنصّاتُ لبلس وحده */
async function settle(db: Db, rows: LinkRow[], tier: LinkTier): Promise<LinkRow[]> {
  const { keep, stop } = partitionTier(rows, tier);
  const now = new Date().toISOString();
  const writes: PromiseLike<unknown>[] = [];
  for (const r of stop) if (!r.stopped_at) writes.push(db.from(r.table).update({ stopped_at: now }).eq(keyCol(r.table), r.token_hash));
  for (const r of keep) if (r.stopped_at) writes.push(db.from(r.table).update({ stopped_at: null }).eq(keyCol(r.table), r.token_hash));
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
    const settled = await settle(db, rows, tier);
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
export async function keepDevices(userId: string, kinds: DeviceKind[], platforms: PlatformKind[] = []): Promise<boolean> {
  const st = await deviceLinksOf(userId);
  if (!st) return false;
  const want = new Set(kinds);
  const wantPlatforms = new Set(platforms);
  /* 🆕 المنصّةُ تُختار باسمها (`platforms`) — صفُّها بلا أنواع، فلولا الفرزُ الأوّل لقُرئ رابطَ سيرفرٍ قديماً */
  const chosen = st.rows.filter((r) =>
    r.table === "platform_links"
      ? !!r.platform && wantPlatforms.has(r.platform)
      : kindsOf(r).some((k) => want.has(k)) || (kindsOf(r).length === 0 && HOME_KINDS.some((k) => want.has(k))),
  );
  if (chosen.reduce((n, r) => n + slotsOf(r), 0) > st.limit) return false;
  const db = await createServiceClient();
  const now = new Date().toISOString();
  const pick = new Set(chosen.map((r) => r.token_hash));
  await Promise.all(
    st.rows.map((r) =>
      db
        .from(r.table)
        .update({ stopped_at: pick.has(r.token_hash) ? null : (r.stopped_at ?? now) })
        .eq(keyCol(r.table), r.token_hash),
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
  const kind: DeviceKind | null = table === "stremio_links" ? "stremio" : table === "nuvio_links" ? "nuvio" : table === "kodi_links" ? "kodi" : (server ?? null);
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
      const settled = await settle(db, rows, tier);
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
 * نفسِه الذي يفعله ✓ العضو** (`watchMark.ts`) وشارةِ المصدر. ⚖️ Stremio وNuvio لا يصلان هنا أبداً: «شغّلها» ليس «خلّصها».
 */
/**
 * 🆕 T361 — **يعيد رقمَ الإشارة المعلَّمة** (أو `null`) ويختمها `auto_at` (هجرة ٢٤٢): منها بطاقةُ الرئيسيّة «أضفناه لمكتبتك» وإشعارُ
 * «وصل من …». الختمُ صامتٌ إن فشل — قبل الهجرة لا عمود، فيبقى التعليمُ كما كان بلا بطاقةٍ ولا إشعار.
 */
export async function autoMarkSignal(userId: string, source: Exclude<SignalSource, "stremio" | "nuvio">, kind: "tv" | "movie", tmdbId: number, season: number | null, episode: number | null): Promise<number | null> {
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

/**
 * سطرُ «أُضيفت من نتفليكس/OSN+» بعد مزامنةٍ أدخلت شيئاً — بمفتاح الخدمة (الجدولُ لا يُكتب بجلسة العضو: الهجرة ٢٦٩) — 🆕 المهمّة ٥٦١، هنا بجانب `recordPlatformSync` أخيه.
 * صامتٌ إن فشل: المزامنةُ تمّت، والسطرُ تحسين.
 */
export async function recordLinkAdd(userId: string, source: PlatformKind, added: PlatformAdded): Promise<boolean> {
  try {
    if (!hasServiceKey()) return false;
    const db = await createServiceClient();
    const one = added.episodes + added.movies === 1;
    const { error } = await db.from("link_adds").insert({
      user_id: userId,
      source,
      episodes: added.episodes,
      movies: added.movies,
      works: added.works,
      title: added.title,
      season: one && added.episodes === 1 ? added.season : null,
      episode: one && added.episodes === 1 ? added.episode : null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * ====== 🆕 أسئلةُ «شاهدتها؟» من سجلّ المنصّة (T579، هجرة ٢٧٢) ======
 * ⚠️ هنا لا في ملفٍّ وحدَه: سياجُ مفتاح الخدمة (D-898) يحصر عميلَه في هذا الملفّ وإخوته — كـ`recordLinkAdd`.
 *
 * أحمد ٢٦ نوفمبر: «احيانا شخصين يستخدمون نفس الملف الشخصي .. يقدر يطفي التسجيل التلقائي و يسير يسأله هل شاهدت او لا».
 * المفتاحُ مطفأ ⇒ التطبيقُ يقرأ السجلَّ ويطابقه كعادته ثمّ يرسل ما طابق إلى هنا بدل الكتابة في المكتبة، فيصير كلُّ عنصرٍ سؤالاً في
 * `watch_signals` — **الجدولُ الذي يسأل منه Stremio وKodi**: بطاقةُ «من تطبيقاتك» والجرسُ وإشعارُ الجوال (`runLinkAskPush`) كما هي.
 *
 * - `played_at` = الآن: السؤالُ «شُغِّل» فيظهر في الرئيسيّة والجرس ويرنّ (المنصّةُ تقول «شاهدها» لا «بدأها» — لا انتظار).
 * - `seen_at` = يومُ المشاهدة على المنصّة: ✓ يكتب الحلقةَ بيومها (`markSignalWatched`).
 * - **لا يُسأل مرّتين**: ما في المكتبة أصلاً، وما سُئل عنه من المنصّة نفسِها من قبل (أُجيب أو ينتظر) — «✕ لا» جوابٌ نهائيّ.
 */

const askKey = (k: "tv" | "movie", id: number, s: number | null, e: number | null) => `${k}-${id}-${s ?? -1}-${e ?? -1}`;

/** يكتب الأسئلةَ الجديدة ويعيد عددها — `null` إن تعذّرت الكتابة (قبل الهجرة: قيدُ المصدر يرفض) */
export async function recordPlatformAsks(userId: string, platform: PlatformKind, items: PlatformAskItem[]): Promise<number | null> {
  if (!hasServiceKey()) return null;
  if (!items.length) return 0;
  const db = await createServiceClient();
  const shows = [...new Set(items.filter((i) => i.kind === "tv").map((i) => i.tmdb_id))];
  const movies = [...new Set(items.filter((i) => i.kind === "movie").map((i) => i.tmdb_id))];
  const ids = [...new Set(items.map((i) => i.tmdb_id))];
  const [eps, mvs, asked] = await Promise.all([
    shows.length
      ? db.from("watched_episodes").select("show_tmdb_id, season_number, episode_number").eq("user_id", userId).in("show_tmdb_id", shows).limit(20_000)
      : Promise.resolve({ data: [] as unknown[] }),
    movies.length ? db.from("watched_movies").select("movie_tmdb_id").eq("user_id", userId).in("movie_tmdb_id", movies).limit(5000) : Promise.resolve({ data: [] as unknown[] }),
    db.from("watch_signals").select("media_type, tmdb_id, season, episode").eq("user_id", userId).eq("source", platform).in("tmdb_id", ids).limit(20_000),
  ]);
  const skip = new Set<string>();
  for (const r of (eps.data ?? []) as { show_tmdb_id: number; season_number: number; episode_number: number }[]) skip.add(askKey("tv", r.show_tmdb_id, r.season_number, r.episode_number));
  for (const r of (mvs.data ?? []) as { movie_tmdb_id: number }[]) skip.add(askKey("movie", r.movie_tmdb_id, null, null));
  for (const r of (asked.data ?? []) as { media_type: "tv" | "movie"; tmdb_id: number; season: number | null; episode: number | null }[]) skip.add(askKey(r.media_type, r.tmdb_id, r.season, r.episode));
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const i of items) {
    const k = askKey(i.kind, i.tmdb_id, i.season, i.episode);
    if (skip.has(k)) continue;
    skip.add(k);
    rows.push({ user_id: userId, source: platform, media_type: i.kind, tmdb_id: i.tmdb_id, season: i.season, episode: i.episode, seen_at: i.at, played_at: now });
  }
  if (!rows.length) return 0;
  const { error } = await db.from("watch_signals").insert(rows);
  return error ? null : rows.length;
}
