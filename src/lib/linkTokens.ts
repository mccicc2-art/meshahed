import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { isPlus } from "@/core/plan";
import type { SignalSource } from "@/core/contracts/stremio";

/**
 * ====== 🆕 رموزُ الروابط الخاصّة — Stremio وسيرفراتُ البيت (هجرتا ٢٢٢ · ٢٣٥) ======
 *
 * 🔑 **رابطٌ يحمل رمزاً قدرتُه الوحيدةُ «سجّل سؤالاً»** — Stremio يحفظه في إضافته، وPlex/Jellyfin/Emby في إعداد Webhooks.
 * كانت هذه الدوالُّ في `stremio.ts` وحدَه؛ ولمّا صار لها جدولٌ ثانٍ (`home_server_links`) بالقواعد نفسِها خرجت إلى هنا
 * (D-145): بصمةٌ (sha-256) لا الرمز، رمزٌ واحدٌ لكلِّ عضو («أصدر» يستبدل القديم)، ويموت إن نام ٩٠ يوماً (A-05)،
 * و«آخرُ استعمال» يُكتب مرّةً في الساعة، والخطّةُ (Loopz+) تُقرأ عند كلِّ طلب.
 * ⚠️ **الفشلُ صمت**: قبل الهجرة يغيب الجدول — فلا رابطَ يُصدر، والرابطُ لا يجد صاحباً.
 */

export type LinkTable = "stremio_links" | "home_server_links";

const IDLE_DAYS = 90;
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const aliveSince = () => new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString();

/** يُصدر رابطاً جديداً (ويُسقط القديم) ويعيد الرمزَ **مرّةً واحدة** — `null` إن غاب المفتاحُ أو الجدول */
export async function issueLinkToken(table: LinkTable, prefix: string, userId: string): Promise<string | null> {
  if (!hasServiceKey()) return null;
  const db = await createServiceClient();
  const token = `${prefix}${randomBytes(32).toString("base64url")}`;
  const { error } = await db
    .from(table)
    .upsert({ token_hash: hashOf(token), user_id: userId, created_at: new Date().toISOString(), last_used_at: null }, { onConflict: "user_id" });
  return error ? null : token;
}

export async function revokeLinkToken(table: LinkTable, userId: string): Promise<boolean> {
  if (!hasServiceKey()) return false;
  const db = await createServiceClient();
  const { error } = await db.from(table).delete().eq("user_id", userId);
  return !error;
}

/** هل للعضو رابطٌ حيّ؟ ومتى صدر، ومتى استُعمل آخرَ مرّة */
export async function linkStateOf(table: LinkTable, userId: string): Promise<{ linked_at: string; used_at: string | null } | null> {
  if (!hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from(table).select("created_at, last_used_at").eq("user_id", userId).maybeSingle();
    if (!data) return null;
    const r = data as { created_at: string; last_used_at: string | null };
    if ((r.last_used_at ?? r.created_at) < aliveSince()) return null;
    return { linked_at: r.created_at, used_at: r.last_used_at };
  } catch {
    return null;
  }
}

/**
 * صاحبُ الرمز وهل هو Loopz+ — `null` لرمزٍ لا شكلَ له أو لا وجودَ له أو نام ٩٠ يوماً.
 * 🔑 **الصاحبُ من صفِّ البصمة لا من الطلب**، والخطّةُ تُقرأ عند كلِّ طلب (`isPlus`): اشتراكٌ انتهى يُسكت الرابطَ في حينه.
 */
export async function linkOwner(table: LinkTable, token: string, shape: RegExp): Promise<{ userId: string; plus: boolean } | null> {
  if (!shape.test(token) || !hasServiceKey()) return null;
  try {
    const db = await createServiceClient();
    const { data } = await db.from(table).select("user_id, created_at, last_used_at").eq("token_hash", hashOf(token)).maybeSingle();
    if (!data) return null;
    const r = data as { user_id: string; created_at: string; last_used_at: string | null };
    if ((r.last_used_at ?? r.created_at) < aliveSince()) return null;
    if (!r.last_used_at || Date.now() - Date.parse(r.last_used_at) > 3_600_000)
      await db.from(table).update({ last_used_at: new Date().toISOString() }).eq("token_hash", hashOf(token));
    const { data: p } = await db.from("profiles").select("plan, plus_until, founder").eq("id", r.user_id).maybeSingle();
    return { userId: r.user_id, plus: isPlus(p as { plan?: unknown; plus_until?: string | null } | null) };
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
