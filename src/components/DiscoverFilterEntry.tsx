"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { browseHref } from "@/lib/browse";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { DiscoverFilterSheet } from "./DiscoverFilterSheet";

/**
 * «فلتر الاكتشاف» — بابُ ورقة الفلاتر، في صفحة البحث (D-174).
 *
 * **طلب أحمد ١٢ أغسطس:** «ضيف الفلتر في البحث و احذفه من الديسكفري»، ثم
 * وضّح: «تظهر نفس قائمة الفلتر منبثقة **و يُنفَّذ على الديسكفري**، ممكن
 * يكون اسمه ديسكفري فلتر».
 *
 * **ولماذا هو صحيحٌ لا نقلَ موضعٍ فحسب:** «اكتشف» صفحةُ تصفّحٍ بلا نيّة —
 * تفتحها لترى ما هناك. و«ابحث» صفحةُ نيّةٍ صريحة — تفتحها وأنت تعرف ما
 * تريد. **والفلترُ فعلُ نيّة**، فبابُه حيث تُعلَن النيّة. وربحٌ ثانٍ: من
 * كتب في البحث ولم يجد ما أراد يجد أمامه مخرجاً بدل شاشةٍ فارغة.
 *
 * **ولا نسخةَ ثانية من الورقة ولا من الرابط:** الورقةُ `DiscoverFilterSheet`
 * نفسُها حرفاً بحرف، والرابطُ يبنيه `browseHref` وحده (نفس ما يناديه رأسُ
 * اكتشف) — ونسخةٌ ثانية من أيّهما عيبٌ بنصّ D-145.
 *
 * **وجهةُ الأفلام هي المهبط، وهو قصدٌ لا تبسيط:** الورقة تُصفّي أنواعَها
 * وجوائزَها بحسب الجهة، وصفحةُ البحث لا جهةَ لها تُسأل عنها. فالمهبطُ تبويبُ
 * الأفلام، **ولمسةُ «مسلسلات» هناك تحمل الفلتر معها كاملاً** (`goTab`) —
 * فالطريق إلى الجهة الأخرى لمسةٌ واحدة، بلا محورِ اختيارٍ سادسٍ في الورقة.
 */
export function DiscoverFilterEntry({
  locale,
  providers,
  region,
}: {
  locale: Locale;
  /** منصّات المنطقة — تُجلب على الخادم كما في «اكتشف» تماماً */
  providers: { id: number; name: string }[];
  /** بلد المشاهدة */
  region: string;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(8);
          setSheet(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={sheet}
        /* ارتفاعٌ ٤٤ بكسلاً كاملاً (`min-h-11`): هدفُ لمسٍ في صفحةٍ يُستعمل
           فيها الإبهام وحده — نفس حارس D-168 على زرّ إنشاء اللستة */
        className="w-full min-h-11 flex items-center justify-center gap-2 rounded-full border border-border text-muted hover:text-foreground hover:border-accent/50 px-4 py-2 text-[13px] font-semibold transition active:scale-[0.99]"
      >
        <Icon name="sliders" size={15} strokeWidth={1.9} />
        <span>{t.discoverFilterEntry}</span>
      </button>

      {sheet && (
        <DiscoverFilterSheet
          locale={locale}
          /* جهةُ الأفلام: مهبطُ التطبيق ومهبطُ الورقة واحد، فلا تُصفّى
             أنواعٌ بجهةٍ ثم تُعرض النتيجة بجهةٍ أخرى */
          type="movie"
          /* يبدأ فارغاً دائماً — صفحةُ البحث لا تحمل فلتراً في رابطها،
             و«حالةٌ» تُخترَع هنا كذبةٌ على المستخدم. وتعديلُ فلترٍ قائم
             بابُه رقاقةُ «تعديل الفلتر» في اكتشف، حيث الحالةُ معروضة. */
          initial={{
            genre: null,
            lang: null,
            country: null,
            provider: null,
            era: null,
            rate: null,
            award: null,
          }}
          providers={providers}
          region={region}
          onClose={() => setSheet(false)}
          onApply={(next) => {
            setSheet(false);
            /* `push` لا `replace`: هذه مغادرةٌ لصفحةٍ إلى أخرى، وزرّ الرجوع
               يجب أن يُعيده إلى بحثه. (وداخل اكتشف تبقى اللمساتُ `replace`
               بقصد D-023.) */
            router.push(
              browseHref({
                tab: "movies",
                g: next.genre,
                lang: next.lang,
                co: next.country,
                p: next.provider,
                era: next.era,
                rate: next.rate,
                award: next.award,
              }),
            );
          }}
        />
      )}
    </>
  );
}
