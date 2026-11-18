"use client";

import Image from "next/image";
import { useState } from "react";
import { IMG } from "@/core/media";
import { regionName } from "@/core/region";
import { getDict, type Locale } from "@/core/i18n";
import { logProviderEvent } from "@/lib/actions";
import {
  isTrustedProviderUrl,
  providerSearchUrl,
  type ProviderEvent,
} from "@/core/providerLinks";
import type { WatchOptions, Provider } from "@/lib/tmdb";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { tap } from "@/lib/haptics";

/**
 * شارة «أين يُبثّ» في ترويسة صفحة العمل — **رموزٌ بلا أسماء، وطبقةٌ
 * واحدة** (D-190، طلب أحمد: «لا تكتب شاهد VIP، اكتفِ بالرمز وحطّ رمز تود
 * كذلك… فقط منصّات الاشتراك، إن ما فيه نذكر رنت، ما فيه نذكر البيع بهذا
 * الترتيب — ممنوع ذكر الثلاثة»).
 *
 * ⚖️ 🆕 **والشعارُ صار بابَ المنصّة نفسِها لا بابَ JustWatch** (D-608،
 * طلبُ أحمد: «الضغط على شعار المنصّة يؤدّي إلى العمل داخل المنصّة
 * نفسها، بدل تحويل المستخدم تلقائيًا إلى JustWatch») — **نقضٌ مسجَّلٌ
 * لشطر D-190 «الضغطُ يفتح JustWatch»**:
 *
 * ١) **رابطٌ مباشرٌ موثَّقٌ** (من `provider_content_links` بعملٍ ومنصّةٍ
 *    وبلد) → الشعارُ `<a https>` من ضغطة المستخدم نفسِها — **فيفتح
 *    تطبيقَ المنصّة عبر Universal Link إن كان مثبَّتاً، وإلا موقعَها.**
 *    **ولا `router.push` لرابطٍ خارجيّ، ولا مخطّطاتِ تطبيقاتٍ (`nflx://`)**
 *    — https على نطاقٍ من قائمة المنصّة الموثوقة حصراً (تُفحص هنا مرّةً
 *    ثانية — رابطٌ فسد بعد الحفظ لا يُرسم).
 * ٢) **ولا رابطَ؟ ورقةُ خياراتٍ من القاع** باسم المنصّة: بحثٌ رسميٌّ
 *    مجرَّبٌ فيها (إن كان لها قالب)، **وخيارُ JustWatch صريحاً لا
 *    تلقائيّاً** — ⚖️ **والقاعُ نقضٌ محصورٌ لحصر D-558 بحكم صاحبه**
 *    («افتح Bottom Sheet صغيرة» — نصُّ الطلب).
 *
 * **ونسبةُ البيانات إلى JustWatch باقيةٌ ظاهرةً** في ذيل الورقة —
 * TMDB تشترطها مع بيانات المنصّات.
 *
 * (بقيّةُ قرارات الشكل — الرموزُ بلا أسماء، كلُّ منصّات الطبقة، طبقةٌ
 * واحدةٌ تُعرض والمجّانيُّ مع الاشتراك، وتسميةُ البلد حين لا يكون بلدَك
 * (D-150) — كما كانت حرفاً.)
 */
export function WatchChip({
  options,
  region,
  userRegion,
  locale,
  links = {},
  query = null,
  tmdbId,
  mediaType,
  variant = "chip",
}: {
  options: WatchOptions;
  /** البلد الذي جاءت منه هذه البيانات فعلاً */
  region: string;
  /** بلد المستخدم المختار */
  userRegion: string;
  locale: Locale;
  /** 🆕 روابطُ المنصّات الموثَّقة لهذا العمل والبلد (D-608) — معرّفُ TMDB → https */
  links?: Record<number, string>;
  /** 🆕 نصُّ البحث: الأصليُّ مع السنة، والعربيُّ لمنصّةٍ فهرسُها عربيّ */
  query?: { q: string; qAr: string | null } | null;
  /** 🆕 للأحداث بلا هويّة — غيابُهما يسكت التسجيلُ لا الشارة */
  tmdbId?: number;
  mediaType?: "tv" | "movie";
  /** 🆕 R257 — `card`: **بطاقةُ «أين أشاهده» في العمود الجانبيّ على الحاسوب** (أحمد ١٨ نوفمبر — «أ»): الشعارُ بحجمٍ يُقرأ
      واسمُ المنصّة بجانبه، والضغطةُ نفسُها (رابطٌ مباشر أو ورقةُ البحث). والرقاقةُ في الترويسة تغيب هناك فلا تتكرّر */
  variant?: "chip" | "card";
}) {
  const t = getDict(locale);
  const [sheetFor, setSheetFor] = useState<Provider | null>(null);

  /* الطبقةُ الأولى غيرُ الفارغة وحدها — بهذا الترتيب حرفياً.
     🆕 **و`ads` مع `free` في الطبقة الأولى** (D-415): «مجّاناً بفواصل
     إعلانيّة» جوابُ «أقدر أشاهده؟» تماماً كالاشتراك. */
  const firstTier = [...options.flatrate, ...options.free, ...(options.ads ?? [])];
  const tier =
    firstTier.length > 0
      ? firstTier
      : options.rent.length > 0
        ? options.rent
        : options.buy;
  if (tier.length === 0) return null;

  /* لا تكرار لمنصّةٍ ظهرت في `flatrate` و`free` معاً */
  const seen = new Set<number>();
  const shown = tier.filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id)).slice(0, 4);
  if (shown.length === 0) return null;

  const elsewhere = region !== userRegion;

  function fire(event: ProviderEvent, p: Provider) {
    if (!tmdbId || !mediaType) return;
    /* إطلاقٌ ونسيان — الرابطُ يفتح في لسانٍ جديد والتسجيلُ لا يؤخّره */
    void logProviderEvent({
      event,
      tmdbId,
      mediaType,
      providerId: p.provider_id,
      country: region,
    });
  }

  const logo = (p: Provider) =>
    p.logo_path ? (
      <Image
        src={`${IMG}/w92${p.logo_path}`}
        alt={p.provider_name}
        title={p.provider_name}
        width={18}
        height={18}
        className="rounded-[5px] shrink-0"
      />
    ) : (
      /* بلا شعار؟ اسمُه — **فالبديل عن الرمز الاسمُ لا الفراغ** */
      <span className="text-12 font-semibold text-foreground/90">{p.provider_name}</span>
    );

  /* بابُ المنصّة الواحد — رابطٌ مباشرٌ موثوق، أو ورقةُ «ابحث فيها» — والشكلُ وحدَه يختلف بين الرقاقة والبطاقة */
  const door = (p: Provider, inner: React.ReactNode, className: string) => {
    const raw = links[p.provider_id];
    const direct = raw && isTrustedProviderUrl(p.provider_name, raw) ? raw : null;
    return direct ? (
      <a
        key={p.provider_id}
        href={direct}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={`${t.watchWhereTitle}: ${p.provider_name}`}
        title={p.provider_name}
        className={className}
        onClick={() => fire("provider_open_direct", p)}
      >
        {inner}
      </a>
    ) : (
      <button
        key={p.provider_id}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${t.watchWhereTitle}: ${p.provider_name}`}
        title={p.provider_name}
        className={className}
        onClick={() => {
          tap(6);
          fire("provider_link_missing", p);
          setSheetFor(p);
        }}
      >
        {inner}
      </button>
    );
  };

  const searchUrl = sheetFor && query ? providerSearchUrl(sheetFor.provider_name, query) : null;

  return (
    <>
      {variant === "card" ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-12 font-semibold text-muted">
            {t.watchWhereTitle}
            {elsewhere ? <span className="font-normal"> · {regionName(region, locale === "en" ? "en" : "ar")}</span> : null}
          </h2>
          <ul className="mt-2.5 space-y-2">
            {shown.map((p) => (
              <li key={p.provider_id}>
                {door(
                  p,
                  <>
                    {p.logo_path ? (
                      <Image src={`${IMG}/w92${p.logo_path}`} alt="" width={36} height={36} className="rounded-[9px] shrink-0" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-surface-2 text-12 font-bold">{p.provider_name.slice(0, 1)}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-start text-14 font-bold">{p.provider_name}</span>
                  </>,
                  "flex w-full items-center gap-3 rounded-xl p-1 -m-1 hover:bg-surface-2 transition",
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
      <span className="inline-flex items-center gap-1.5 bg-surface-2 border border-border px-2 py-1 rounded-lg transition">
        {shown.map((p) => door(p, logo(p), "grid place-items-center active:scale-90 transition"))}
        {elsewhere && (
          <span className="text-12 text-muted font-normal">
            {regionName(region, locale === "en" ? "en" : "ar")}
          </span>
        )}
      </span>
      )}

      {sheetFor && (
        <Sheet
          open
          onClose={() => setSheetFor(null)}
          closeLabel={t.closeLabel}
          anchor="bottom"
          labelledBy="prov-sheet-title"
        >
          <SheetHeader
            id="prov-sheet-title"
            title={sheetFor.provider_name}
            closeLabel={t.closeLabel}
            onClose={() => setSheetFor(null)}
          >
            <p className="text-12 text-muted mt-0.5">{t.provNoDirect}</p>
          </SheetHeader>

          <div className="px-4 py-4 space-y-2.5">
            {searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={buttonClass({ full: true })}
                onClick={() => {
                  fire("provider_open_search", sheetFor);
                  setSheetFor(null);
                }}
              >
                {t.provSearchIn(sheetFor.provider_name)}
              </a>
            )}
            {/* JustWatch باختيارٍ صريحٍ وحدَه — لا تحويلَ تلقائيّاً (D-608) */}
            {options.link && (
              <a
                href={options.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={buttonClass({ variant: "surface", full: true })}
                onClick={() => {
                  fire("provider_open_justwatch", sheetFor);
                  setSheetFor(null);
                }}
              >
                {t.provOtherOptions}
              </a>
            )}
            {/* نسبةُ البيانات — شرطُ TMDB لعرض بيانات المنصّات */}
            <p className="text-[10px] text-muted text-center pt-1">{t.provJustwatch}</p>
          </div>
        </Sheet>
      )}
    </>
  );
}
