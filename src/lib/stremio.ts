import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { isPlus } from "@/core/plan";
import { STREMIO_TOKEN_RE, type StremioVideo } from "@/core/stremioId";

/**
 * ====== 🆕 ربطُ Stremio — رمزُ الإضافة وإشاراتُها (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * 🔑 **الرمزُ يسكن في رابط الإضافة** (`/api/v1/stremio/<token>/manifest.json`) — Stremio يحفظ روابطَ إضافاته في حساب
 * العضو ويزامنها. فقدرتُه الوحيدةُ «سجّل أنّه فتح هذا»: لا يقرأ المكتبة ولا يعلّم شيئاً. والجدولُ يحفظ بصمتَه (sha-256)
 * لا هو، ولا يصله إلّا مفتاحُ الخدمة (هجرة ٢٢٢) — لذلك هذا الملفُّ في سياج عميل الخدمة (`eslint.config.mjs`).
 *
 * ⚖️ **رمزٌ واحدٌ لكلِّ عضو**: «أصدر» يستبدل القديم (رابطٌ نُسخ في مكانٍ خطأ يموت بإصدار غيره)، و«ألغِ» يحذفه.
 * ويموت إن نام ٩٠ يوماً كرمز الودجت (A-05).
 *
 * ⚠️ **الفشلُ صمت**: قبل هجرة ٢٢٢ يغيب الجدول — فلا رابطَ يُصدر، والإضافةُ لا تجد صاحباً فلا تسجّل شيئاً.
 */

const IDLE_DAYS = 90;
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const aliveSince = () => new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString();

/** يُصدر رابطاً جديداً (ويُسقط القديم) ويعيد الرمزَ **مرّةً واحدة** — `null` إن غاب المفتاحُ أو الجدول */
export async function issueStremioToken(userId: string): Promise<string | null> {
  if (!hasServiceKey()) return null;
  const db = await createServiceClient();
  const token = `ls_${randomBytes(32).toString("base64url")}`;
  const { error } = await db
    .from("stremio_links")
    .upsert({ token_hash: hashOf(token), user_id: userId, created_at: new Date().toISOString(), last_used_at: null }, { onConflict: "user_id" });
  return error ? null : token;
}

export async function revokeStremioToken(userId: string): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { error } = await db.from("stremio_links").delete().eq("user_id", userId);
  return !error;
}

/** هل للعضو رابطٌ حيّ؟ ومتى صدر — لشاشة «اربط Stremio» */
export async function stremioLinkOf(userId: string): Promise<{ linked_at: string } | null> {
  if (!hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from("stremio_links").select("created_at, last_used_at").eq("user_id", userId).maybeSingle();
    if (!data) return null;
    const r = data as { created_at: string; last_used_at: string | null };
    if ((r.last_used_at ?? r.created_at) < aliveSince()) return null;
    return { linked_at: r.created_at };
  } catch {
    return null;
  }
}

/**
 * صاحبُ الرمز وهل هو Loopz+ — `null` لرمزٍ لا شكلَ له أو لا وجودَ له أو نام ٩٠ يوماً.
 * 🔑 **الصاحبُ من صفِّ البصمة لا من الطلب**، والخطّةُ تُقرأ عند كلِّ طلب (`isPlus`): اشتراكٌ انتهى يُسكت الإضافةَ في حينه.
 */
export async function stremioOwner(token: string): Promise<{ userId: string; plus: boolean } | null> {
  if (!STREMIO_TOKEN_RE.test(token) || !hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db
      .from("stremio_links")
      .select("user_id, created_at, last_used_at")
      .eq("token_hash", hashOf(token))
      .maybeSingle();
    if (!data) return null;
    const r = data as { user_id: string; created_at: string; last_used_at: string | null };
    if ((r.last_used_at ?? r.created_at) < aliveSince()) return null;
    /* «آخرُ استعمال» يُكتب مرّةً في الساعة لا مع كلِّ فتح — يكفي لحكم الـ٩٠ يوماً ولا يكتب صفّاً مع كلِّ حلقة */
    if (!r.last_used_at || Date.now() - Date.parse(r.last_used_at) > 3_600_000)
      await db.from("stremio_links").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hashOf(token));
    const { data: p } = await db.from("profiles").select("plan, plus_until, founder").eq("id", r.user_id).maybeSingle();
    return { userId: r.user_id, plus: isPlus(p as { plan?: unknown; plus_until?: string | null } | null) };
  } catch {
    return null;
  }
}

/**
 * يسجّل «فتحها» (طلبُ المصادر) أو «شغّلها» (`played` — طلبُ الترجمة عند بدء التشغيل) — صامتٌ إن فشل
 * (ردُّ Stremio لا ينتظر قاعدتنا ولا يسقط بها).
 */
export async function recordStremioSignal(userId: string, video: StremioVideo, tmdbId: number, played = false): Promise<void> {
  try {
    const db = await createServiceClient();
    await db.rpc("record_watch_signal", {
      p_user: userId,
      p_type: video.kind,
      p_tmdb: tmdbId,
      p_season: video.kind === "tv" ? video.season : null,
      p_episode: video.kind === "tv" ? video.episode : null,
      p_played: played,
    });
  } catch {
    /* لا إشارةَ هذه المرّة؛ الفتحُ التالي يسجّلها */
  }
}
