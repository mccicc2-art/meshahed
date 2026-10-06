import { Suspense } from "react";
import { cookies } from "next/headers";
import { getT } from "@/lib/locale";
import {
  asTrailerScope,
  asTrailerTab,
  getTrailerFeed,
  getTrailerTabFeed,
  parseTrailerAt,
  type TrailerScope,
  type TrailerTab,
} from "@/lib/trailers";
import { TRAILER_FEED_LIMIT, TRAILER_PER_TITLE } from "@/core/trailerTabs";
import { TrailerTabs } from "@/components/TrailerTabs";
import { TrailerFeed } from "@/components/TrailerFeed";
import { TrailerBackButton } from "@/components/TrailerBackButton";
import { TrailerFilterButton } from "@/components/TrailerFilterButton";
import {
  parseTrailerFilter,
  trailerFilterActive,
  trailerFilterKey,
  trailerFilterParams,
  type TrailerFilter,
} from "@/core/trailerFilter";
import { TRAILER_SOUND_COOKIE, parseTrailerSound } from "@/lib/trailerPrefs";
import type { Locale } from "@/core/i18n";

function safeReturnPath(raw: string | undefined): string {
  return raw === "/news" || raw?.startsWith("/news?") ? raw : "/news";
}

export default async function TrailersPage({
  searchParams,
}: {
  searchParams: Promise<{
    at?: string;
    tab?: string;
    scope?: string;
    from?: string;
    g?: string;
    rel?: string;
    lang?: string;
  }>;
}) {
  const [{ locale, t }, params] = await Promise.all([getT(), searchParams]);
  const active = asTrailerTab(params.tab);
  const scope = active === "for-you" ? asTrailerScope(params.scope) : undefined;
  /* 🆕 D-1311 — الفلترُ من الرابط (`g` · `rel` · `lang`)، وغيابُه الصفحةُ كما كانت حرفاً */
  const filter = parseTrailerFilter(params);
  const filtered = trailerFilterActive(filter);
  /* **«امسح الفلتر» رابطٌ يُبنى هنا**: الصفحةُ نفسُها بتبويبها ونطاقها ووجهةِ رجوعها، بلا محاور الفلتر */
  const clear = new URLSearchParams();
  for (const k of ["tab", "scope", "from"] as const) if (params[k]) clear.set(k, params[k]);
  const clearHref = clear.size ? `/trailers?${clear}` : "/trailers";

  return (
    /* 🆕 **والترويسةُ تصعد ٢٠px نحو خطِّ الشريط** (D-1291، بلاغُ أحمد: «فيه
       مساحة بين trailer for you والخط اللي فوقها نبي نرفع شوي»): **الفراغُ
       فوق العنوان كان أوسعَ ممّا تحته فقُرئ العنوانُ معلّقاً** — **وهو
       `pt-6` القشرةِ المشتركة، فيُستردّ هنا وحدَه ولا تُمسّ صفحةٌ أخرى.** */
    <div className="-mt-5 space-y-3">
      <header className="flex items-center gap-3 py-1">
        <TrailerBackButton label={t.backAria} fallback={safeReturnPath(params.from)} />
        <h1 className="flex-1 text-center text-15 font-bold">
          {active === "for-you" ? t.trailersForYou : t.trailersTitle}
        </h1>
        {/* 🆕 D-1311 — **زرُّ الفلتر في الخانة التي كانت توازن السهم** (طلبُ أحمد: «على نفس خط تريلر فور
            يو اقصى اليمين»): نهايةُ السطر، فهو يمينٌ بالإنجليزيّة ويسارٌ بالعربيّة والسهمُ قبالته. والبديلُ
            بمقاسه، فلا يقفز العنوانُ حين يصل. */}
        <Suspense fallback={<span className="h-9 w-9 shrink-0" aria-hidden />}>
          <TrailerFilterButton locale={locale} tab={active} />
        </Suspense>
      </header>

      <Suspense fallback={<div className="h-9" aria-hidden />}>
        <TrailerTabs active={active} locale={locale} />
      </Suspense>

      <Suspense
        key={`${active}:${scope ?? "all"}:${params.at ?? ""}:${trailerFilterKey(filter)}`}
        fallback={<TrailerFeedSkeleton />}
      >
        <TrailerFeedSection
          active={active}
          scope={scope}
          pinAt={params.at}
          locale={locale}
          filter={filtered ? filter : undefined}
          /* **وفراغُ الفلتر يقول سببَه ويحمل علاجَه** (D-222): «تابِع أعمالاً» تحت فلترٍ ضيّقٍ إرشادٌ إلى
             غير العطل */
          emptyLabel={filtered ? t.trailersFilterEmpty : active === "for-you" ? t.trailersEmpty : t.trailersTabEmpty}
          emptyAction={filtered ? { label: t.trailersFilterClear, href: clearHref } : undefined}
        />
      </Suspense>
    </div>
  );
}

async function TrailerFeedSection({
  active,
  scope,
  pinAt,
  locale,
  filter,
  emptyLabel,
  emptyAction,
}: {
  active: TrailerTab;
  scope?: TrailerScope;
  pinAt?: string;
  locale: Locale;
  filter?: TrailerFilter;
  emptyLabel: string;
  emptyAction?: { label: string; href: string };
}) {
  const pin = active === "for-you" ? parseTrailerAt(pinAt) : undefined;
  /* 🆕 **وأربعَ عشرةَ تُطلب واثنتا عشرةَ تُعرض** (D-756): **الفائضُ
     بدائلُ خاناتٍ يحلّ فيها البديلُ محلَّ مقطعٍ يرفضه يوتيوب.**
     ⚠️ **والثمنُ يُقال لا يُخفى**: **المسبارُ يتبع السقفَ** (`probeFor`)
     **فصار واحداً وعشرين بعد أربعةَ عشر** — **سبعةُ نداءاتِ فيديو
     زائدةٍ في أوّل رسمٍ للصفحة كلَّ ساعة** (ردودُ TMDB مخبَّأةٌ ساعةً).
     ⚠️ **وهي على هذه الصفحة وحدَها**: **رايلُ اكتشف يطلب تسعاً فيبقى
     مسبارُه أربعةَ عشرَ** — **والسطحُ الذي طُلبت له السرعةُ لا يدفع
     ثمنَ غيره.** */
  /* 🆕 **والدفعةُ الأولى ثمانٍ وأربعون بطاقةً** (D-772): **البطاقةُ صارت
     مقطعاً لا عملاً** — **والمسبارُ ٢٤ عملاً بدل ٢١** (`probeFor(48)`
     يقف عند سقفه)، **فثلاثةُ نداءاتٍ زائدةٍ في أوّل رسمٍ كلَّ ساعة
     مقابل أربعين بطاقةً بدل اثنتي عشرة.** **والفائضُ فوق الأربعين
     بدائلُ خانات** (D-756). */
  const itemsPromise =
    active === "for-you"
      ? getTrailerFeed(TRAILER_FEED_LIMIT, locale, scope, pin, { perTitle: TRAILER_PER_TITLE, filter })
      : getTrailerTabFeed(active, TRAILER_FEED_LIMIT, locale, { perTitle: TRAILER_PER_TITLE, filter });
  const [items, store] = await Promise.all([itemsPromise, cookies()]);

  return (
    <TrailerFeed
      items={items}
      locale={locale}
      soundOn={parseTrailerSound(store.get(TRAILER_SOUND_COOKIE)?.value)}
      emptyLabel={emptyLabel}
      emptyAction={emptyAction}
      tab={active}
      scope={scope}
      filter={filter ? trailerFilterParams(filter) : undefined}
      pinKey={pin ? `${pin.mediaType}-${pin.tmdbId}` : undefined}
    />
  );
}

function TrailerFeedSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden>
      <div className="aspect-video w-full animate-pulse bg-surface-2" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/5 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-surface-2" />
        <div className="h-10 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
