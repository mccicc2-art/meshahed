import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mentionsIn } from "@/core/contracts/groups";

/**
 * ====== 🆕 T504 — أيُّ `@اسم` في الصفحة حسابٌ حقيقيّ؟ ======
 *
 * أحمد ٢٢ نوفمبر بمقطع: «ليش يظهر لي منشن عمر فقط · ليه مقدر امنشن شخص ثاني وحنا ف المجتمع؟»، ثمّ «١٢ أ ١٣ أ نفذ».
 * كان الرابطُ يُرسم لأسماء من كتبوا في الصفحة وحدهم — فذكرُ عضوٍ من خارجها يبقى نصّاً عاديّاً لا يُضغط، مع أن الخادم يوصل
 * إليه الإشعار. الآن الخادمُ يقول أيَّ الأسماء المكتوبة حساباتٌ قائمة، والواجهةُ ترسمها روابطَ إلى ملفّاتها.
 *
 * 🔑 القاعدةُ قاعدةُ `mentionsIn` نفسُها (ما يُنبَّه هو ما يُرسم) · مخفيُّ الاسم لا يُكشف بمعرّفه · السقفُ ٢٠٠ اسمٍ للصفحة.
 * ⚠️ السقوطُ صامت: مصفوفةٌ فارغةٌ فيبقى ما كان (أسماءُ المشاركين).
 */
export async function realMentions(bodies: (string | null | undefined)[]): Promise<string[]> {
  const names = new Set<string>();
  for (const b of bodies) {
    if (!b) continue;
    for (const n of mentionsIn(b)) {
      names.add(n);
      if (names.size >= 200) break;
    }
    if (names.size >= 200) break;
  }
  if (!names.size) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("username, hide_name").in("username", [...names]);
    if (error || !data) return [];
    return (data as { username: string | null; hide_name: boolean | null }[])
      .filter((p) => p.username && !p.hide_name)
      .map((p) => (p.username as string).toLowerCase());
  } catch {
    return [];
  }
}
