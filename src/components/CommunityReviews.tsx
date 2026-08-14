import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import type { ReviewReply, TitleReview } from "@/lib/data";
import { TalkThread } from "./TalkThread";
import { Icon } from "./Icon";

/**
 * تبويبُ «الآراء» في صفحة العمل — **ترويسةُ التقييم، ثم الخيطُ نفسه**.
 *
 * **وما كان قبله (D-193):** هذا المكوّن كان يرسم الآراء بنفسه — بطاقةٌ
 * لكل رأي، وإعجابٌ وبلاغٌ تحتها، **ولا ردّ**. ثم وُلدت `‎/talk` بالردود،
 * فصار الرأيُ الواحد يُرسم في سطحين بقدرتين مختلفتين: هنا حديثٌ مغلق،
 * وهناك حوار. **ونسخةٌ ثانية من أيّ شيء عيب** (قاعدة ٦) — والأسوأ أن
 * الردَّ يُكتب في صفحةٍ ولا يظهر في الأخرى، فيبدو أنه ضاع.
 *
 * **فالرسمُ كلُّه انتقل إلى `TalkThread`** وبقي هنا ما لا يملكه غيرُه:
 * سطرُ «تقييم المستخدمين» ومتوسّطُه وعددُه. **والردودُ تصل من الصفحة**
 * (`getTitleReplies`) لأن القراءة شأنُ الخادم لا شأنُ المكوّن.
 *
 * ⚠️ **وثمنُه نداءٌ إضافيّ على أسخن صفحة** — لكنه داخل نفس `Suspense`
 * الذي يبثّ التبويب، وقراءةٌ واحدة مفهرسة بالعمل. **والبديلُ كان
 * سطحين يفترقان**، وذاك أغلى.
 */
export function CommunityReviews({
  locale,
  avg,
  count,
  reviews,
  replies,
  tmdbId,
  mediaType,
}: {
  locale: Locale;
  avg: number;
  count: number;
  tmdbId: number;
  mediaType: "tv" | "movie";
  /** مراجعات مع أصحابها — الاسم يظهر إلا لمن أخفاه من الإعدادات */
  reviews: TitleReview[];
  /**
   * الردودُ على تلك المراجعات (هجرة ٦٢).
   *
   * **اختياريّةٌ لسببٍ واحد:** النشرُ في هذا المستودع يقع مجلّداً مجلّداً
   * و**كلُّ رفعةٍ تُبنى وحدها** (`19_Tools_And_Access.md`) — فخاصّيةٌ
   * إلزاميةٌ هنا تكسر البناءَ في اللحظة بين رفعة `components` ورفعة
   * `app`. وغيابُها يعني «لا ردود» لا «تعذّرت القراءة»: `getTitleReplies`
   * تُرجع مصفوفةً فارغة عند الفشل أصلاً، فالحالتان تُرسمان سواءً.
   */
  replies?: ReviewReply[];
}) {
  const t = getDict(locale);
  const rounded = Math.round(avg * 10) / 10;

  return (
    <section className="mt-6 max-w-xl">
      {count > 0 && (
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <h3 className="font-bold text-[15px]">{t.communityRating}</h3>
          <span className="text-accent text-sm font-bold tabular-nums">
            ★ {rounded} <span className="text-muted font-normal">/ 10</span>
          </span>
          <span className="text-xs text-muted">{t.communityCount(count)}</span>
        </div>
      )}

      {/* **بابُ غرفة النقاش من صفحة العمل** (D-257).
          **ولماذا بابٌ هنا ولا تبويبَ رابع:** الغرفةُ صارت كياناً مستقلّاً
          (`title_posts`) **ولم يكن يصلها من صفحة العمل طريقٌ قطّ** —
          يصلها من تبويب «نقاش» ومن صفحة تعليق. **وسطحٌ لا يُوصَل إليه من
          حيث يُطلَب لا يُستعمل.**
          **وسطرٌ لا تبويب**: التبويبُ الرابع يزاحم «الآراء» و«المجتمع»
          على انتباهٍ واحد، **ورقاقةٌ تحت الترويسة تقول «هنا أيضاً حديث»
          بلا أن تدّعي أنها نصفُ الصفحة.** */}
      <Link
        href={`/talk/${mediaType}/${tmdbId}`}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-foreground hover:border-[color:var(--divider)] active:scale-95 transition"
      >
        <Icon name="comment" size={13} className="shrink-0 text-accent" />
        {t.reviewOpenTalk}
      </Link>

      {/* الحالةُ الفارغة داخل `TalkThread` لا هنا: من يملك الرسم يملك
          فراغه — وإلا صار للفراغ صندوقان */}
      <TalkThread
        reviews={reviews}
        replies={replies ?? []}
        tmdbId={tmdbId}
        mediaType={mediaType}
        locale={locale}
        signedIn
      />
    </section>
  );
}
