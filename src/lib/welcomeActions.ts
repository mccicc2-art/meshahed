"use server";

import { createClient } from "@/lib/supabase/server";
import { getFollowsOf } from "@/lib/data";
import { allow } from "@/core/ratelimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 🆕 T414 — **ثلاثةُ ملصقاتٍ لكلِّ شخصٍ مقترح** في الخطوة الأخيرة من الترحيب العريض (التصميم «ج»: بطاقةٌ واقفةٌ عليها ما
 * يشاهده — «لماذا هو» تُرى قبل أن تُقرأ).
 *
 * 🔑 **من الباب العامّ نفسِه الذي تقرأ منه صفحةُ الملفّ** (`user_public_follows`، دالّةٌ محدودةُ الأعمدة والعدد) — لا قراءةَ
 * جديدةً للمكتبات ولا عمودَ يُضاف إلى `people_to_follow` (تغييرُ جدول عودةِ دالّةٍ قائمةٍ يوجب `drop`).
 * ⚖️ **ستّةُ أشخاصٍ حدّاً** (`PEOPLE_LIMIT`) ودلوٌ ضيّق: ستّةُ نداءاتٍ لكلِّ وصولٍ إلى الخطوة، لا باباً لقراءة مكتباتٍ بالجملة.
 * ⚖️ **والفشلُ خريطةٌ فارغة**: البطاقةُ تُرسم بلا ملصقات — زينةٌ لا شرط.
 */
export async function peoplePosters(ids: string[]): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !allow(`${user.id}:welcome-posters`, 6, 60_000)) return {};
  const want = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && UUID.test(id)).slice(0, 6);
  const rows = await Promise.all(
    want.map(async (id) => {
      const follows = await getFollowsOf(id).catch(() => []);
      const posters = [...follows]
        .sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""))
        .map((f) => f.poster_path)
        .filter((p): p is string => !!p)
        .slice(0, 3);
      return [id, posters] as const;
    }),
  );
  return Object.fromEntries(rows.filter(([, p]) => p.length > 0));
}
