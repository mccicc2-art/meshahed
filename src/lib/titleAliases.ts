import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MediaType } from "@/core/media";
import { normalizeSearch } from "@/core/arabic";

/**
 * **قارئُ الأسماء البديلة — نداءٌ واحدٌ للصفحة كلِّها** (D-544، الهجرة ١٢٥).
 *
 * ================= الشرطُ الذي يوجد هذا الملفّ لأجله =================
 *
 * **بنصِّ المواصفة: «لا تضف استعلام Supabase لكلّ كارد؛ استخدم جلباً
 * مجمَّعاً أو كاشاً مناسباً».** **وشبكةٌ من ستّين بطاقةً تسأل كلُّ واحدةٍ
 * عن نفسها ستّون استعلاماً** — وهو بعينه ما منعته D-205 في `libState`،
 * **والوصفةُ هنا وصفتُها**: مجموعةُ معرّفاتٍ واحدة، `in (...)` واحدة،
 * خريطةٌ في الذاكرة.
 *
 * ⚠️ **و`cache()` على مفتاحٍ نصّيّ لا على المصفوفة**: `cache` يقارن
 * الوسائطَ بالمرجع، **ومصفوفتان بنفس الأرقام مرجعان مختلفان** — فلو
 * مُرِّرت المصفوفةُ لتكرّر الاستعلامُ لكلِّ رفٍّ في الصفحة. **والمفتاحُ
 * نصٌّ مرتَّبٌ منزوعُ التكرار، فرفّان يسألان عن نفس الأعمال يسألان
 * مرّةً.**
 *
 * ⚠️ **ولا يُقرأ إلّا في وضع الكتابة الصوتيّة** (`needsTranslit`):
 * **الافتراضُ لا يمسّ القاعدةَ بحرف** (D-510).
 *
 * ⚠️ **والتوثيقُ يفرضه RLS لا هذا الملفّ**: السياسةُ `using (verified)`،
 * **فما وصل هنا موثوقٌ بالتعريف** — **وغيرُ الموثوق لا يصل أصلاً**،
 * وهو ما تعنيه «إذا لم تتوفّر كتابة صوتية موثوقة، اعرض الاسم الأصلي».
 */

/** سقفُ المعرّفات في النداء الواحد — شبكةٌ أكبرُ منه تبقى بأسمائها الأصلية */
const MAX_IDS = 120;

const fetchByKey = cache(async (csv: string): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (!csv) return out;
  const ids = csv.split(",").map(Number).filter(Number.isFinite);
  if (!ids.length) return out;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("title_aliases")
      .select("media_type, tmdb_id, title")
      .eq("locale", "ar")
      .eq("alias_type", "translit")
      .in("tmdb_id", ids);

    for (const r of (data ?? []) as { media_type: string; tmdb_id: number; title: string }[]) {
      out.set(`${r.media_type}-${r.tmdb_id}`, r.title);
    }
  } catch {
    /* **سقوطُ النداء لا يُسقط الصفحة** (D-063): خريطةٌ فارغةٌ تعني
       «لا كتابةَ صوتيّة»، **والاسمُ الأصليُّ هو الجواب المكتوب لهذه
       الحال** — لا شاشةَ خطأٍ ولا اسمٌ مفقود. */
  }
  return out;
});

/**
 * خريطةُ الكتابات الصوتيّة لمجموعة أعمال — المفتاح `"tv-1399"`.
 *
 * **تُنادى مرّةً في الصفحة** ثمّ تُمرَّر؛ ونداؤها مرّتين في الطلب نفسِه
 * لا يكلّف استعلاماً ثانياً.
 */
export async function getTranslits(
  keys: { tmdb_id: number; media_type: MediaType | string }[],
): Promise<Map<string, string>> {
  const ids = [...new Set(keys.map((k) => k.tmdb_id).filter((n) => Number.isFinite(n)))]
    .sort((a, b) => a - b)
    .slice(0, MAX_IDS);
  return fetchByKey(ids.join(","));
}

/** خريطةٌ فارغةٌ لا تكذب — للأوضاع التي لا تحتاج القاعدةَ أصلاً */
export const NO_TRANSLITS: ReadonlyMap<string, string> = new Map();


/**
 * 🆕 **بحثٌ في الكتابات الصوتيّة** (D-544، شرطُ المواصفة: «اجعل البحث
 * يتعرّف على… الكتابة الصوتيّة **مهما كان خيار العرض**»).
 *
 * **ولماذا هي وحدَها التي تُسأل:** بحثُ TMDB يطابق الاسمَ الأصليَّ
 * والمترجَمَ معاً منذ اليوم الأوّل — **والكتابةُ الصوتيّةُ اسمٌ لا
 * يعرفه إلّا جدولُنا.**
 *
 * ⚠️ **ولا يُسأل لطلبٍ بلا حرفٍ عربيّ**: لا كتابةَ صوتيّةً عربيّةً
 * تطابق «game» (D-510).
 *
 * ⚠️ **ومطابقتان لا واحدة**: النصُّ كما كُتب، **والنصُّ مطبَّعاً**
 * (`normalizeSearch`) — **فمن كتب «جيم اوف ثرونز» بلا همزةٍ يجد
 * «جيم أوف ثرونز».** **والتطبيعُ على طرف السائل وحدَه** لأن العمودَ
 * مخزَّنٌ كما يُعرض (D-048: العنوانُ يبقى كما كتبه أهلُه)، **وهو
 * تنازلٌ مقصود**: يمسك الهمزةَ والألفَ المقصورة ولا يمسك كلَّ شيء.
 */
export async function searchTranslits(
  query: string,
  limit = 8,
): Promise<{ media_type: MediaType; tmdb_id: number }[]> {
  const raw = query.trim();
  if (raw.length < 2 || !/[؀-ۿ]/.test(raw)) return [];

  const norm = normalizeSearch(raw);
  /* **لا حروفَ بدلٍ من السائل**: `%` و`_` و`,` تُقصّ قبل أن تدخل
     `ilike` — **وسائلٌ يكتب `%` لا يقلب الشرط إلى «كلّ شيء».** */
  const safe = (v: string) => v.replace(/[%_,()]/g, " ").trim();

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("title_aliases")
      .select("media_type, tmdb_id")
      .eq("locale", "ar")
      .eq("alias_type", "translit")
      .or(`title.ilike.%${safe(raw)}%,title.ilike.%${safe(norm)}%`)
      .limit(limit);
    return (data ?? []) as { media_type: MediaType; tmdb_id: number }[];
  } catch {
    return [];
  }
}
