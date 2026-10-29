import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 D-1563 — إدارةُ شخصيّات لوبز AI: الطابور والإيقاف (الهجرة ٢٢٥).
 *
 * 🔑 **الحارسُ في القاعدة** (`am_admin` داخل كلِّ دالّة) — الصفحةُ تسأل `getAmAdmin` لتعرض أو تُخفي، **والكتابةُ يرفضها
 * الخادمُ لغير المدير ولو وصل الطلب**. والأخطاءُ تُرمى نصّاً تعيده الصفحةُ في شريطها (`AdminNotice`) كبقيّة اللوحة.
 */

export interface AdminPersonaReview {
  id: string;
  slug: string;
  media_type: "tv" | "movie";
  tmdb_id: number;
  title: string | null;
  scope_ar: string | null;
  scope_en: string | null;
  body_ar: string;
  body_en: string;
  has_spoiler: boolean;
  status: "live" | "hidden";
  publish_at: string;
  created_at: string;
  /** ظاهرةٌ الآن (حان وقتُها، وليست مخفيّة، ولم يحجبها الإيقاف) */
  visible: boolean;
  likes: number;
  /** 🆕 D-1565 — درجتُها ١–١٠ (الهجرة ٢٢٦)؛ قبل الهجرة غائبة */
  rating?: number | null;
}

export interface AdminPersonaSettings {
  paused: boolean;
  paused_at: string | null;
  per_hour_min: number;
  per_hour_max: number;
  /** لم يحن وقتُها (أو حجبها الإيقاف) */
  waiting: number;
  live: number;
  hidden: number;
}

export async function getAdminPersonaReviews(limit = 200): Promise<AdminPersonaReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_persona_reviews", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminPersonaReview[];
}

export async function getAdminPersonaSettings(): Promise<AdminPersonaSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_persona_settings");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AdminPersonaSettings[])[0] ?? null;
}

export async function adminPersonaReviewUpdate(id: string, v: { status?: "live" | "hidden"; body_ar?: string; body_en?: string; rating?: number }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_persona_review_update", {
    p_id: id,
    p_status: v.status ?? null,
    p_body_ar: v.body_ar ?? null,
    p_body_en: v.body_en ?? null,
    p_rating: v.rating ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function adminPersonaPause(paused: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_persona_pause", { p_paused: paused });
  if (error) throw new Error(error.message);
}
