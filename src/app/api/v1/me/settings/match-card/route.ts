import { handle, requireUser } from "@/lib/v1";
import { bodyRoute } from "@/lib/v1body";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 T596 — **«اسمح بظهور اسمي في بطاقات التطابق»** (أحمد ٢٧ نوفمبر «س٩ أ»: إعدادٌ واحدٌ في الخصوصيّة، مطفأٌ افتراضيّاً).
 * `GET` يقرأ إعدادَ صاحب الجلسة · `POST { allow }` يكتبه — عمودٌ واحد (`profiles.allow_match_card`، الهجرة ٢٧٣).
 * ⚖️ **قبل الهجرة لا يسقط شيء**: القراءةُ تعود `allow: false` و`ready: false` فيُخفي السطحان المفتاح، والكتابةُ ترفض بخللٍ مفهوم.
 */
export type MatchCardSetting = { allow: boolean; ready: boolean };

export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const sb = await createClient();
    const { data, error } = await sb.from("profiles").select("allow_match_card").eq("id", auth.user.id).maybeSingle();
    if (error) return ok<MatchCardSetting>({ allow: false, ready: false });
    return ok<MatchCardSetting>({ allow: (data as { allow_match_card?: boolean } | null)?.allow_match_card === true, ready: true });
  });
}

export const POST = bodyRoute<{ allow: boolean }, MatchCardSetting>(
  async (b) => {
    const auth = await requireUser();
    if (!auth.ok) throw new Error("غير مسجّل الدخول");
    const sb = await createClient();
    const allow = b.allow === true;
    const { error } = await sb.from("profiles").update({ allow_match_card: allow }).eq("id", auth.user.id);
    if (error) throw new Error("match card consent: " + error.code);
    return { allow, ready: true };
  },
  () => ["user:me:profile"],
);
