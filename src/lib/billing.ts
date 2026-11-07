import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { deviceLinksOf } from "@/lib/linkTokens";
import { notifyPlanEnded } from "@/lib/push";
import { isGold, isPlus, type PlanBearer } from "@/core/plan";
import { commissionOf, environmentOf, isUuid, rowKeyOf, rowPatchOf, userIdOf, type RcEvent, type SubTier } from "@/core/billing";
import type { LinkRow } from "@/core/deviceLinks";

/**
 * ====== 🆕 الاشتراكاتُ على الخادم — ما يكتبه ويبهوك RevenueCat (خطّةُ Loopz+ v2 المرحلة ١، هجرة ٢٣٨) ======
 *
 * 🔑 **الخادمُ يكتب ما قاله المتجر، والقاعدةُ تحكم**: صفٌّ لكلِّ شراء، والمرآةُ (`recompute_plan`) تعيد حسابَ الخطّة والذهبيّ
 * من صفوف العضو كلِّها. فلا «اجعله بلس» هنا — ولا يملك أحدٌ غيرُ مفتاح الخدمة أن يكتب صفّاً.
 *
 * 🔑 **مرّةً واحدةً لكلِّ حدث** (`billing_events` بمعرّف الحدث) **وبترتيبه** (`last_event_ms`): RevenueCat يعيد ما لم يأخذ
 * ردَّه ٢٠٠، وقد يصل الأقدمُ بعد الأحدث.
 *
 * 🔑 **ما بعد الكتابة**: أوّلُ شراءٍ حقيقيٍّ يختم الإحالة (ومكافأةُ الصديق ١٤ يوماً)، وعمولةُ الشريك سطرٌ في دفترها، ومن
 * سقط من بلس الآن تُنزل خاناتُه ويصله «اشتراكك انتهى، أبقينا X — اختر ما يبقى» (أحمد «٢ أ»: بلا مهمّةٍ مجدولة).
 */

type Db = SupabaseClient;
type SubRow = { id: string; user_id: string; plan: SubTier; last_event_ms: number | null; environment: string | null; first_purchase_at: string | null };

const PAID_TYPES = new Set(["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"]);

export type ApplyOutcome = "applied" | "duplicate" | "ignored" | "no_user" | "unavailable";

/** الطبقةُ الآن رقماً (مجّانيٌّ ٠ · بلس ١ · ذهبيٌّ ٢) — تُقرأ قبل الحدث وبعده ليُعرف من نزل، ومنه الذهبيُّ إلى بلس بأكثرَ من خمسة */
async function rankOf(db: Db, uid: string): Promise<number | null> {
  const r = await db.from("profiles").select("plan, plus_until, gold_until").eq("id", uid).maybeSingle();
  if (r.error || !r.data) return null;
  const p = r.data as PlanBearer;
  return isGold(p) ? 2 : isPlus(p) ? 1 : 0;
}

export async function applyRevenueCatEvent(ev: RcEvent, nowMs = Date.now()): Promise<ApplyOutcome> {
  if (!hasServiceKey()) return "unavailable";
  const db = await createServiceClient();
  const env = environmentOf(ev);
  const uid = userIdOf(ev);

  /* مرّةً لكلِّ حدث: الإدراجُ هو القفل — تعارضُ المفتاح = وصل قبلاً، إلّا ختماً لم يكتمل منذ دقيقتين (تشغيلٌ انقطع) فيُؤخذ */
  const id = ev.id.slice(0, 200);
  const stamp = { event_id: id, type: ev.type.slice(0, 60), environment: env, event_ms: ev.event_timestamp_ms ?? null };
  let seen = await db.from("billing_events").insert({ ...stamp, user_id: uid });
  /* معرّفٌ بشكل UUID ليس عضواً عندنا (حسابٌ حُذف واشتراكُه باقٍ عند المتجر، أو حدثُ تجربةٍ من لوحة RevenueCat): قيدُ الربط
     يرفضه بـ٢٣٥٠٣، فيُختم بلا عضو — وإلّا ردَدنا ٥٠٠ على كلِّ إعادةٍ ولم يُسجَّل الحدثُ أبداً. ما بعده يقول «لا صاحبَ له» */
  if (seen.error?.code === "23503") seen = await db.from("billing_events").insert({ ...stamp, user_id: null });
  if (seen.error) {
    if (seen.error.code !== "23505") return "unavailable";
    const stale = new Date(nowMs - 2 * 60_000).toISOString();
    const take = await db.from("billing_events").update({ received_at: new Date(nowMs).toISOString() }).eq("event_id", id).is("processed_at", null).lt("received_at", stale).select("event_id");
    if (take.error || !take.data?.length) return "duplicate";
  }
  /* عطلٌ بعد الختم يفكّ الختمَ — فإعادةُ RevenueCat تُكتب ولا تُرى «مكرّرة» */
  const out = await applyClaimed(db, ev, uid, env, nowMs).catch(() => "unavailable" as const);
  if (out === "unavailable") await db.from("billing_events").delete().eq("event_id", id);
  else await db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("event_id", id);
  return out;
}

async function applyClaimed(db: Db, ev: RcEvent, uid: string | null, env: "production" | "sandbox", nowMs: number): Promise<ApplyOutcome> {
  if (ev.type === "TEST") return "ignored";
  if (ev.type === "TRANSFER") return transfer(db, ev);
  if (!uid) return "no_user";
  const before = await rankOf(db, uid);
  if (before == null) return "no_user";

  const key = rowKeyOf(ev);
  if (!key) return "ignored";
  const cur = await db.from("subscriptions").select("id, user_id, plan, last_event_ms, environment, first_purchase_at").eq("provider", "revenuecat").eq("external_id", key).maybeSingle();
  if (cur.error) return "unavailable";
  const row = cur.data as SubRow | null;
  const at = ev.event_timestamp_ms ?? nowMs;
  const patch = rowPatchOf(ev, nowMs, row);
  /* حدثٌ أقدمُ ممّا كُتب لا يُرجع الصفّ — والعمولةُ تُحسب له مع ذلك (مفتاحُها المعاملة) */
  const stale = !!row && row.last_event_ms != null && at < row.last_event_ms;
  if (patch && !stale) {
    const fields = {
      ...patch,
      store: String(ev.store ?? "").toLowerCase() || null,
      environment: env,
      period_type: ev.period_type ?? null,
      last_event_ms: at,
    };
    if (row) {
      /* شرطيٌّ في القاعدة لا قراءةٌ ثمّ كتابة: حدثان معاً للصفّ نفسِه (إلغاءٌ وانتهاء) — الأحدثُ يغلب أيّاً وصل أخيراً */
      const up = await db
        .from("subscriptions")
        .update({ ...fields, user_id: uid })
        .eq("id", row.id)
        .or(`last_event_ms.is.null,last_event_ms.lte.${Math.trunc(at)}`)
        .select("id");
      if (up.error) return "unavailable";
    } else {
      const paid = typeof ev.purchased_at_ms === "number" ? new Date(ev.purchased_at_ms).toISOString() : new Date(nowMs).toISOString();
      /* الشريكُ وسنتُه الأولى يُثبَّتان على الصفّ يومَ يُكتب: نقلُ الشراء لاحقاً لا ينسبه لغيره، وتبديلُ الخطّة لا يجدّد السنة */
      const pin = env === "production" ? await pinOf(db, uid, paid) : { partner: null, yearEnds: null };
      const ins = await db.from("subscriptions").insert({
        ...fields,
        user_id: uid,
        provider: "revenuecat",
        external_id: key,
        first_purchase_at: paid,
        first_year_ends_at: pin.yearEnds ?? new Date(Date.parse(paid) + 365 * 86_400_000).toISOString(),
        partner_id: pin.partner,
      });
      if (ins.error) return "unavailable";
    }
  }

  if (env === "production") {
    /* أوّلُ دفعةٍ حقيقيّة — لا تجربةٌ مجّانيّة ولا منحةٌ مؤقّتة ولا إلغاءٌ وصل أوّلاً (المراجعةُ المستقلّة): الدالّةُ تختم مرّةً
       (`subscribed_at`)، فالتجديدُ بعدها لا يعيد المكافأة، وتجربةٌ تحوّلت تصل `RENEWAL` بسعرها */
    if (PAID_TYPES.has(ev.type) && (ev.price ?? 0) > 0) {
      /* أوّلُ صفٍّ حقيقيٍّ لهذا العضو؟ (الدالّةُ نفسُها لا تعيد المكافأة: `subscribed_at` يُختم مرّة) */
      try {
        await db.rpc("billing_first_purchase", { p_user: uid });
      } catch {
        /* المكافأةُ لا تُفشل الاشتراك */
      }
    }
    await commission(db, ev, key, uid);
  }

  const after = await rankOf(db, uid);
  /* T344 — **الترقيةُ ليست نهاية**: في قوقل يُغلق حدثُها الشراءَ القديم، وقد يسبق `INITIAL_PURCHASE` الذهبيَّ بثوانٍ فتهبط
     الرتبةُ لحظةً — فلا يُقال لمن رقّى للتوّ «انتهى اشتراكك». النهايةُ الحقيقيّةُ يلتقطها حدثُها أو الدورةُ الساعيّة */
  if (after != null && after < before && ev.type !== "PRODUCT_CHANGE") await planEnded(uid);
  return "applied";
}

/** الشريكُ (إحالةٌ مباشرةٌ لشريكٍ قائم، لا نفسه) ونهايةُ السنة الأولى من أقدم شراءٍ حقيقيٍّ للعضو */
async function pinOf(db: Db, uid: string, paid: string): Promise<{ partner: string | null; yearEnds: string | null }> {
  let partner: string | null = null;
  try {
    const ref = await db.from("referrals").select("inviter_id, source, rejected_at").eq("invitee_id", uid).maybeSingle();
    const r = ref.data as { inviter_id: string; source: string; rejected_at: string | null } | null;
    if (r && r.source === "partner" && !r.rejected_at && r.inviter_id !== uid) {
      const ok = await db.from("partners").select("user_id").eq("user_id", r.inviter_id).maybeSingle();
      if (ok.data) partner = r.inviter_id;
    }
  } catch {
    /* بلا شريك */
  }
  const first = await db
    .from("subscriptions")
    .select("first_purchase_at")
    .eq("user_id", uid)
    .eq("provider", "revenuecat")
    .eq("environment", "production")
    .not("first_purchase_at", "is", null)
    .order("first_purchase_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const earliest = (first.data as { first_purchase_at: string } | null)?.first_purchase_at;
  const anchor = earliest && Date.parse(earliest) < Date.parse(paid) ? earliest : paid;
  return { partner, yearEnds: new Date(Date.parse(anchor) + 365 * 86_400_000).toISOString() };
}

/** نقلُ الشراء إلى حسابٍ آخر («استرجاع المشتريات» بحساب Apple نفسه في حسابٍ آخر): الصفوفُ تتبع الحسابَ الجديد، والعمولةُ لا تُنقل */
async function transfer(db: Db, ev: RcEvent): Promise<ApplyOutcome> {
  const to = (ev.transferred_to ?? []).find(isUuid)?.toLowerCase();
  const from = (ev.transferred_from ?? []).filter(isUuid).map((x) => x.toLowerCase()).filter((x) => x !== to);
  if (!to || !from.length) return "ignored";
  const before = new Map<string, number>();
  for (const f of from) before.set(f, (await rankOf(db, f)) ?? 0);
  /* شراءُ هذا المتجر وحده: من له بلس على أندرويد واسترجع شراءَ iOS في حسابٍ آخر لا يفقد الاثنين */
  let q = db.from("subscriptions").update({ user_id: to }).eq("provider", "revenuecat").in("user_id", from);
  const store = String(ev.store ?? "").toLowerCase();
  if (store) q = q.eq("store", store);
  const up = await q;
  if (up.error) return "unavailable";
  for (const f of from) if (((await rankOf(db, f)) ?? 0) < (before.get(f) ?? 0)) await planEnded(f);
  return "applied";
}

/** عمولةُ الشريك على هذه المعاملة — شريكُ الصفّ المثبَّت وسنتُه الأولى (لا إحالةُ الحساب الحاليّ: النقلُ لا يعيد النسبة) */
async function commission(db: Db, ev: RcEvent, key: string, uid: string): Promise<void> {
  try {
    const row = await db.from("subscriptions").select("partner_id, first_year_ends_at").eq("provider", "revenuecat").eq("external_id", key).maybeSingle();
    const r = row.data as { partner_id: string | null; first_year_ends_at: string | null } | null;
    if (!r?.partner_id || !r.first_year_ends_at) return;
    const c = commissionOf(ev, Date.parse(r.first_year_ends_at) - 365 * 86_400_000);
    if (!c) return;
    /* استرجاعٌ لما لم يُحتسب له أصلاً لا يعكس شيئاً */
    if (c.kind === "reversed") {
      const earned = await db.from("partner_commissions").select("id").eq("event_id", c.key.replace(/:reversed$/, ":earned")).maybeSingle();
      if (!earned.data) return;
    }
    await db.from("partner_commissions").upsert(
      {
        event_id: c.key,
        partner_id: r.partner_id,
        subscriber_id: uid,
        kind: c.kind,
        net: c.net,
        amount: c.amount,
        product_id: ev.product_id ?? null,
        store: String(ev.store ?? "").toLowerCase() || null,
        paid_at: c.paidAt,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
  } catch {
    /* الدفترُ لا يُفشل الاشتراك — والحدثُ مختومٌ فلا يُعاد؛ ما فات يُرى في سجلّ RevenueCat */
  }
}

/** اسمُ الجهاز للإشعار — أسماءُ علمٍ لا تُترجم */
const NAME: Record<string, string> = { stremio: "Stremio", plex: "Plex", jellyfin: "Jellyfin", emby: "Emby", kodi: "Kodi" };
function nameOf(r: LinkRow): string {
  if (r.table === "stremio_links") return NAME.stremio;
  if (r.table === "kodi_links") return NAME.kodi;
  const k = r.server ?? r.kinds[0];
  return (k && NAME[k]) || "Plex";
}

/**
 * نزل طبقةً (انتهى أو استُرجع أو نُقل، أو من الذهبيّ إلى بلس بأكثرَ من خمسة): تُنزل خاناتُه الآن — لا عند أوّل حدث — ويصله
 * الإشعارُ **دائماً** (أحمد ٦ نوفمبر: «اي احد ينتهي اشتراكه يجيه اشعار .. لاكن ما يكون شيء خاص بالمؤسسين»): أُوقف شيءٌ ⇒
 * «اختر ما يبقى»، لم يُوقف شيء ⇒ «حسابك الآن على الخطّة المجّانيّة». مفتاحُه يومُ النهاية فلا يتكرّر.
 */
export async function planEnded(uid: string, endedAt?: string | null): Promise<void> {
  try {
    const st = await deviceLinksOf(uid);
    if (!st) return;
    /* ما أوقفه هذا النزول — لا ما وقف قبل شهر */
    const since = Date.now() - 15 * 60_000;
    const stopped = st.rows.filter((r) => r.stopped_at && Date.parse(r.stopped_at) >= since).length;
    /* من الذهبيّ إلى بلس بلا جهازٍ أُوقف: الاشتراكُ لم ينتهِ ولا شيءَ يُختار — فلا إشعار (و«المجّانيّة» تكون كذباً له) */
    if (!stopped && st.tier !== "free") return;
    /* 🔴 مراجعةُ الصحّة (٦ نوفمبر) — **تجديدٌ تأخّر ليس نهاية**: المرآةُ تجعل `plus_until` نهايةَ الفترة بالضبط، وحدثُ التجديد
       يصل بعدها بدقائقَ أو ساعات — فالدورةُ الساعيّةُ كانت تقول لمشتركٍ يتجدّد «حسابك الآن على المجّانيّة». صفُّ متجرٍ ما زال
       «نشطاً» أو «في مهلة الدفع» ⇒ لم ينتهِ بعد، فلا إشعارَ «المجّانيّة» (أمّا الأجهزةُ إن أُوقفت فتُقال كما كانت) */
    if (!stopped && (await storeStillLive(uid))) return;
    const kept = st.rows.find((r) => !r.stopped_at);
    /* المفتاحُ يومُ النهاية من الملفّ نفسِه (لا يومُ الويبهوك) — فالويبهوكُ والدورةُ الساعيّةُ لا يرسلان مرّتين حول منتصف الليل */
    const day = (endedAt ?? (await endOf(uid)) ?? new Date().toISOString()).slice(0, 10);
    notifyPlanEnded({ to: uid, kept: kept ? nameOf(kept) : null, stopped, dedupe: `planend:${uid}:${st.tier}:${day}` });
  } catch {
    /* صامت */
  }
}

/** اشتراكٌ من المتجر لم يصله «انتهى» بعد (`active` أو `past_due`) — المتجرُ سيقول كلمتَه، والإشعارُ ينتظرها */
async function storeStillLive(uid: string): Promise<boolean> {
  try {
    const db = await createServiceClient();
    /* 🔴 T344 — **وحيٌّ بنهايةٍ قريبة**: التجديدُ المتأخّر يصل بعد النهاية بدقائقَ أو ساعات، أمّا صفٌّ مضى على نهايته يومٌ
       وما زال «نشطاً» فصفٌّ عالقٌ لم يصله «انتهى» (ترقيةُ قوقل قبل T344) — لا يحبس إشعارَ النهاية إلى الأبد */
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await db.from("subscriptions").select("id").eq("user_id", uid).eq("provider", "revenuecat").in("status", ["active", "past_due"]).or(`current_period_end.is.null,current_period_end.gt.${since}`).limit(1);
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function endOf(uid: string): Promise<string | null> {
  const db = await createServiceClient();
  const { data } = await db.from("profiles").select("plus_until, gold_until").eq("id", uid).maybeSingle();
  const p = data as { plus_until: string | null; gold_until: string | null } | null;
  return p?.plus_until ?? null;
}

/* دورةُ «انتهى بلس» بلا مهمّةٍ مجدولة (أحمد «٢ أ»): تُنادى بعد قراءة الجرس — مرّةً في الساعة على الأكثر لكلِّ نسخة */
let lastPlanEndRun = 0;
const PLAN_END_EVERY_MS = 60 * 60_000;

/**
 * من انتهى بلسُه في الأيّام الثلاثة الأخيرة (المؤسِّسون يوم ٣٠ نوفمبر، ومنحةٌ يدويّة، ومكافأةٌ انقضت) ولم يأته الويبهوك:
 * تُنزل خاناتُه ويصله الإشعارُ مرّةً واحدة. ⚖️ لا يجري لمن لا يفتح التطبيق — ومن لا يفتحه لا يقرأ الإشعارَ اليوم أيضاً.
 */
export async function runPlanEndNotices(nowMs = Date.now()): Promise<number> {
  if (!hasServiceKey() || nowMs - lastPlanEndRun < PLAN_END_EVERY_MS) return 0;
  lastPlanEndRun = nowMs;
  const db = await createServiceClient();
  const hour = new Date(nowMs).toISOString().slice(0, 13);
  const { error: claimErr } = await db.from("push_sent").insert({ key: `job:planend:${hour}` });
  if (claimErr) return 0;
  const { data } = await db
    .from("profiles")
    .select("id, plus_until")
    .neq("plan", "free")
    .lt("plus_until", new Date(nowMs).toISOString())
    .gt("plus_until", new Date(nowMs - 3 * 86_400_000).toISOString())
    .order("plus_until", { ascending: true })
    .limit(500);
  const rows = (data ?? []) as { id: string; plus_until: string }[];
  for (const r of rows) await planEnded(r.id, r.plus_until);
  return rows.length;
}

/** 🆕 الذهبيُّ لصاحب الجلسة أو لغيره — قارئٌ مستقلٌّ: قبل الهجرة يغيب العمود فيُقرأ «لا» ولا يسقط الملفُّ كلُّه */
export async function goldUntilOf(db: Db, uid: string): Promise<string | null> {
  try {
    const { data, error } = await db.from("profiles").select("gold_until").eq("id", uid).maybeSingle();
    if (error) return null;
    return (data as { gold_until: string | null } | null)?.gold_until ?? null;
  } catch {
    return null;
  }
}
