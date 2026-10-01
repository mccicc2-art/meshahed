import type { QueryClient } from "@tanstack/react-query";
import { qk } from "../api";
import { seasonQuery } from "./SeasonAccordion";
import type { LibraryPayload } from "../contracts";

/**
 * 🆕 D-1221 — **رأسُ صفحة العمل من البطاقة التي فُتح منها** (تسجيلُ أحمد ١ أكتوبر: «الدخول لأيّ صفحة فلم فيه تأخير خفيف»).
 *
 * 🔑 **المشكلة**: صفحةُ العمل الباردة تنتظر `/api/v1/title` (~٨٠٠ms وسيطاً، `title.open` cached=0) وتعرض هيكلاً رماديّاً
 * فارغاً — **والاسمُ والملصقُ معروفان قبل أيِّ نداء**: البطاقةُ التي ضُغطت كانت ترسمهما من كاش `react-query` نفسِه.
 * 🔑 **لماذا بحثٌ في الكاش لا معاملٌ في الرابط**: الأبوابُ إلى صفحة العمل ١٩ (اكتشف · المكتبة · الرئيسيّة · البحث · الملفّ ·
 * القائمة · النقاش · الرسائل…) — **ومعاملٌ يُمرَّر في كلٍّ منها يُنسى في العشرين**. الكاشُ يحمل كلَّ بطاقةٍ رُسمت، بالحقول نفسِها
 * (`kind`/`media_type` · `id` · `title`/`name` · `poster_path`)، فالبحثُ مرّةً عند فتح الصفحة يكفي الأبوابَ كلَّها.
 * ⚠️ **الجهةُ شرطٌ لا تخمين**: معرّفاتُ TMDB تتكرّر بين الأفلام والمسلسلات — كائنٌ بلا `kind`/`media_type` لا يُؤخذ.
 * ⚠️ **سقفٌ للمسح** (عمقٌ ٧ · ٢٠٠٠٠ عقدة): الكاشُ قد يكبر، والبحثُ مرّةً عند الفتح لا يجوز أن يكلّف إطاراً.
 */
export type TitleSeed = { name: string; poster_path: string | null };

const MAX_NODES = 20_000;
const MAX_DEPTH = 7;

export function titleSeed(qc: QueryClient, kind: "tv" | "movie", id: number): TitleSeed | null {
  let seen = 0;
  const hit = (o: Record<string, unknown>): TitleSeed | null => {
    if (o.id !== id) return null;
    const k = typeof o.kind === "string" ? o.kind : typeof o.media_type === "string" ? o.media_type : null;
    if (k !== kind) return null;
    const name = [o.display_title, o.title, o.name].find((v): v is string => typeof v === "string" && v.length > 0);
    if (!name) return null;
    return { name, poster_path: typeof o.poster_path === "string" ? o.poster_path : null };
  };
  const walk = (v: unknown, depth: number): TitleSeed | null => {
    if (!v || typeof v !== "object" || depth > MAX_DEPTH || seen > MAX_NODES) return null;
    seen++;
    if (Array.isArray(v)) {
      for (const x of v) {
        const r = walk(x, depth + 1);
        if (r) return r;
      }
      return null;
    }
    const o = v as Record<string, unknown>;
    const h = hit(o);
    if (h) return h;
    for (const key in o) {
      const r = walk(o[key], depth + 1);
      if (r) return r;
    }
    return null;
  };
  for (const q of qc.getQueryCache().getAll()) {
    const r = walk(q.state.data, 0);
    if (r) return r;
  }
  return null;
}

/**
 * 🆕 D-1221 — **حلقاتُ الموسم الأوّل تُطلب مع الصفحة لا بعدها** حين لا يتابعه صاحبُه أو لم يشاهد منه شيئاً: كانت تُطلب بعد وصول
 * ردّ العمل (`firstOpenSeason` يحتاجه) ⇒ ~٨٠٠ms ثمّ ~٦٥٠ms (`season.open` cached=0) على التوالي. ولمن لم يشاهد شيئاً
 * `firstOpenSeason` = أوّلُ موسمٍ بُثّ — الأوّلُ في الغالب. **وإن خالف** (موسمٌ أوّلُ لم يُبثّ) فالأثرُ القائم يطلب الصحيح بعده:
 * الخسارةُ نداءٌ زائد، والربحُ في الغالب ~٦٠٠ms.
 */
export function prefetchFirstSeason(qc: QueryClient, id: number) {
  const lib = qc.getQueryData<LibraryPayload>(qk.tag("me:library"));
  const mine = lib?.items.find((x) => x.kind === "tv" && x.id === id);
  if (mine && mine.watched > 0) return;
  void qc.prefetchQuery(seasonQuery(id, 1));
}
