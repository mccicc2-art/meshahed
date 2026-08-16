import Link from "next/link";
import { getTitleLoopzNews } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { Icon } from "./Icon";

/**
 * 🆕 **تبويبُ «الأخبار» في صفحة العمل** (D-300، طلبُ أحمد: «يُفضّل في
 * صفحة الفلم يكون فيه تبويب أخبار أو تحديث ويُكتب فيه»).
 *
 * ================= وهذا جوابُ سؤالٍ عُلِّق أربعَ رسائل =================
 *
 * **السؤالُ كان: أين تُكتب نشرةُ Loopz عن عملٍ ما؟** — **داخل خيط
 * `/review`؟ أم رداً يُكتب من صفحة العمل؟** **واختار أحمد ثالثاً أنظفَ
 * منهما: بيتٌ خاصٌّ بها في صفحة العمل.**
 * **وهو الأصحُّ بنيوياً أيضاً:** خيطُ `/review` كلامُ إنسانٍ عن عمل،
 * **والنشرةُ حقيقةٌ عن العمل نفسِه** — **وخلطُهما كان سيجعل صفَّ الخبر
 * يبدو رأياً** (D-254: النقاشُ ليس الرأي، وهذا ثالثٌ ليس أيَّهما).
 *
 * ================= ولا مكوّنَ صفٍّ جديد يُخترع =================
 *
 * **الصيغةُ `newsLine` نفسُها** التي يقرؤها خطُّ النشاط وصفحةُ النشرة
 * (D-211/D-261: صيغةٌ يقرؤها أكثرُ من موضع تملكها دالّةٌ واحدة)،
 * **والمصدرُ `newsSource` نفسُه**، **والوجهةُ `/post/[key]` القائمة.**
 * **فالجديدُ هنا تخطيطُ قائمةٍ لا أكثر.**
 *
 * ⚠️ **ولا ملصقَ في الصفوف**: نحن **داخل** صفحة العمل — **وصورتُه في
 * ترويستها فوق** — **وملصقٌ يتكرّر ثلاثين مرّةً في تبويبٍ عن عملٍ واحد
 * ضجيجٌ لا هويّة** (D-223/D-257).
 *
 * **وفراغُه يُقال مرّةً**: لا نشرةَ بعد — **ولا يُرسل القارئُ إلى مكانٍ
 * آخر ليفعل ما جاء له هنا** (D-167).
 */
export async function TitleNewsTab({
  tmdbId,
  mediaType,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
}) {
  const t = getDict(locale);
  const items = await getTitleLoopzNews(tmdbId, mediaType);

  if (!items.length) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
        {t.workNewsEmpty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--divider)]">
      {items.map((n) => {
        const line = newsLine(n, t, locale);
        /* **ونشرةٌ بلا صيغةٍ تسقط هنا لا في الرسم** — نفسُ حارس
           `ActivityFeed` و`/post` حرفاً (D-179: القراءةُ متسامحة). */
        if (!line) return null;
        const src = newsSource(n);
        return (
          <li key={n.key}>
            <Link
              href={`/post/${encodeURIComponent(n.key)}`}
              prefetch={false}
              className="block py-3.5 group"
            >
              {/* **ختمُ Loopz صغيراً في صدر السطر** — **الخبرُ منسوبٌ
                  دائماً** (D-213: الصياغةُ ملكُ كاتبها)، **ورمزٌ يكفي
                  حيث الاسمُ واحدٌ في القائمة كلِّها** (D-224). */}
              <p className="flex items-start gap-2">
                <Icon name="newspaper" size={15} className="shrink-0 mt-0.5 text-accent" />
                <span className="min-w-0 text-[14px] leading-relaxed font-semibold group-hover:text-accent transition">
                  {line}
                </span>
              </p>
              <p className="mt-1 ms-[23px] flex items-center gap-2 text-[12px] text-muted">
                <span>{timeAgo(n.published_at, t)}</span>
                {src && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{t.newsPerSource(src.name)}</span>
                  </>
                )}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
