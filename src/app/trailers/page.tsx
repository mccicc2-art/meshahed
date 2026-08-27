import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/locale";
import { getTrailerFeed } from "@/lib/trailers";
import { TrailerFeed } from "@/components/TrailerFeed";
import { Icon } from "@/components/Icon";
import { TRAILER_SOUND_COOKIE, parseTrailerSound } from "@/lib/trailerPrefs";

/**
 * 🆕 **صفحةُ الترايلرات** (D-726، المرحلةُ الأولى بحكمه: «الرايل أوّلاً»).
 *
 * ⚠️ **وتبويبُ «لك» وحدَه اليوم**: بقيّةُ التبويبات (رائج · أفلام ·
 * مسلسلات · أنمي) **مواصفةٌ مقروءةٌ لم تُبنَ بعد** — **وشريطُ تبويباتٍ
 * أربعتُه معطّلةٌ أسوأُ من غيابه** (D-030: لا بابَ لا يفتح).
 *
 * ⚠️ **ولا `force-dynamic`**: الصفحةُ تقرأ اقتراحاتِ صاحبها فهي
 * ديناميّةٌ بطبعها (كوكيز + جلسة)، **وعلَمٌ يُكتب لأجل ما هو واقعٌ أصلاً
 * تعليقٌ خاطئٌ في ثوب إعداد.**
 */
export default async function TrailersPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { locale, t } = await getT();
  const { at } = await searchParams;
  const store = await cookies();
  const soundOn = parseTrailerSound(store.get(TRAILER_SOUND_COOKIE)?.value);

  /* **واثنا عشرَ لا ثلاثمئة**: القارئُ يمرّر مقطعاً بعد مقطع،
     **وقائمةٌ لا تُبلغ نهايتَها لا تُجلب كاملةً** (D-510). */
  const items = await getTrailerFeed(12, locale);

  return (
    <div className="space-y-3">
      {/* **والصفحةُ تحمل ترويستَها** — رجوعٌ إلى موضعه في اكتشف
          (`ScrollMemory` هناك يستعيده)، والعنوانُ وسطاً (وصفةُ D-681). */}
      <header className="flex items-center gap-3 py-1">
        <Link
          href="/news"
          aria-label={t.backAria}
          className="shrink-0 w-9 h-9 grid place-items-center rounded-full active:opacity-70 transition"
        >
          {/* **والسهمُ يرتدّ مع الاتّجاه** — `rtl:rotate-180` (القاعدة ١٧) */}
          <Icon name="chevron-down" size={20} className="rotate-90 rtl:-rotate-90" />
        </Link>
        <h1 className="flex-1 text-center text-16 font-bold">{t.trailersForYou}</h1>
        <span className="shrink-0 w-9" />
      </header>

      <TrailerFeed items={items} locale={locale} soundOn={soundOn} startAt={at} />
    </div>
  );
}
