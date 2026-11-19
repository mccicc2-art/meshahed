"use client";

import { useState } from "react";
import { buttonClass } from "../ui/Button";
import { segmentedItem, segmentedTrackFull } from "../ui/controls";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { PlanWordmark } from "./PlanWordmark";
import {
  ANDROID_HREF,
  ANDROID_PUBLIC,
  IOS_HREF,
  PRICES,
  TESTERS_GROUP,
  WORDS,
  androidAppIntent,
  type Device,
  type PlanKey,
} from "./plusStore";

/**
 * ====== 🆕 شريطُ الاشتراك أسفل صفحة Loopz+ (التصميم «ج»، أحمد ١٨ نوفمبر) ======
 *
 * يختار الزائرُ الخطّةَ (بلس سنويّ · بلس شهريّ · Gold) فيرى سعرَها، والزرُّ لا يبيع هنا بل **يحوّله إلى التطبيق**:
 * - **آيفون:** صفحةُ Loopz في App Store مباشرةً (المتجرُ يقول «فتح» لمن ثبّته).
 * - **أندرويد:** شاشةُ الاشتراك داخل التطبيق إن كان مثبّتاً، وإلا صفحةُ الانضمام للتجربة في Google Play (`androidAppIntent`).
 * - **الحاسوب:** نافذةٌ فيها رمزُ QR وزرّا المتجرين — الشراءُ يتمّ على الجوّال.
 * الجهازُ يأتي من ترويسة الطلب في الخادم (لا `navigator` بعد الرسم): الزرُّ الصحيحُ يُرسم من أوّل لحظة بلا قفزة.
 * 🔑 **والمشتركُ لا يرى عرضاً**: سطرُ «نشط» وموعدُه، وملاحظةُ الإدارة من المتجر — كشاشة التطبيق لمن يملك الخطّة.
 * والترقيةُ إلى Gold لصاحب بلس تفتح الطريقَ نفسَه إلى التطبيق (هناك تُحسب فروقُ المتجرين).
 */

type Owned = { tier: "plus" | "gold"; until: string | null } | null;

export function PlusBuyBar({
  locale,
  device,
  owned,
  initial,
}: {
  locale: "ar" | "en";
  device: Device;
  owned: Owned;
  initial: PlanKey;
}) {
  const w = WORDS[locale];
  const [plan, setPlan] = useState<PlanKey>(initial);
  const [open, setOpen] = useState(false);

  if (owned) {
    const until = owned.until
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { day: "numeric", month: "long", year: "numeric" }).format(new Date(owned.until))
      : null;
    return (
      <Bar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <PlanWordmark tier={owned.tier} className="text-lg" />
            <span className="rounded-full bg-[color:var(--success)]/15 px-2.5 py-0.5 text-12 font-extrabold text-[color:var(--success)]">
              {w.ownedActive}
            </span>
          </div>
          <p className="mt-1 text-12 text-muted leading-relaxed">
            {until ? `${w.ownedUntil(until)} · ` : ""}
            {w.ownedManage}
          </p>
        </div>
        {owned.tier === "plus" && (
          <Cta device={device} locale={locale} label={w.upgrade} onSheet={() => setOpen(true)} />
        )}
        <StoreSheet open={open} onClose={() => setOpen(false)} locale={locale} plan="gold" />
      </Bar>
    );
  }

  const p = locale === "en" ? "en" : "ar";
  const price = PRICES[plan][p];
  const sub =
    plan === "yearly"
      ? `${w.firstYear} · ${w.then(PRICES.yearly[p === "en" ? "thenEn" : "thenAr"])}`
      : plan === "monthly"
        ? `${w.perMonth} · ${w.cancelAny}`
        : w.perYear;
  const items: { id: PlanKey; label: string }[] = [
    { id: "yearly", label: w.planYearly },
    { id: "monthly", label: w.planMonthly },
    { id: "gold", label: w.planGold },
  ];

  return (
    <Bar>
      <div role="radiogroup" aria-label={w.chosen} className={`${segmentedTrackFull} md:w-auto md:shrink-0`}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={plan === it.id}
            onClick={() => setPlan(it.id)}
            className={segmentedItem(plan === it.id, "flex-1 md:flex-none")}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div className="w-full min-w-0 md:w-auto md:flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-20 font-extrabold whitespace-nowrap">{price}</span>
          <span className="text-12 text-muted">{sub}</span>
        </p>
        <p className="mt-0.5 text-12 text-muted leading-relaxed">{w.priceNote}</p>
      </div>
      <Cta device={device} locale={locale} label={plan === "gold" ? w.ctaGold : w.cta} onSheet={() => setOpen(true)} />
      <StoreSheet open={open} onClose={() => setOpen(false)} locale={locale} plan={plan} />
    </Bar>
  );
}

/** الشريطُ يلتصق بأسفل الشاشة من الحاسوب اللوحيّ فما فوق؛ وعلى الجوّال بطاقةٌ في مكانها آخرَ الصفحة — شريطٌ ملتصقٌ فوق
 *  شريط التنقّل كان سيأكل نصفَ الشاشة الصغيرة ويغطّي المزايا التي يقرؤها الزائر */
function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="z-30 mt-8 md:sticky md:bottom-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur md:px-6">
        {children}
      </div>
    </div>
  );
}

function Cta({ device, locale, label, onSheet }: { device: Device; locale: "ar" | "en"; label: string; onSheet: () => void }) {
  const cls = buttonClass({ size: "lg", className: "w-full md:w-auto shrink-0" });
  if (device === "ios")
    return (
      <a href={IOS_HREF} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
      </a>
    );
  if (device === "android")
    return (
      <a href={androidAppIntent()} className={cls}>
        {label}
      </a>
    );
  /* 🆕 **الحاسوبُ يرى الرمزَ نفسَه لا زرّاً يفتحه** (أحمد ١٩ نوفمبر، الخيار «ب» لصفحة Plus): الشراءُ لا يكون من المتصفّح،
     فكانت الضغطةُ تفتح ورقةً كلُّ ما فيها رمزٌ يُمسح — **ضغطةٌ زائدةٌ قبل الشيء الوحيد الذي يُفعل هنا**. الرمزُ (`/get`) يفتح صفحةَ
     التطبيق في المتجر (حكمُه: «يوديه لصفحة التطبيق كافي»)، **والورقةُ باقيةٌ خلف «طرقٌ أخرى»** لمن يريد شارةَ المتجر أو شرحَ
     الدخول بالحساب نفسِه. وتحت ١٠٢٤ يعود الزرُّ: الشريطُ هناك يلتفّ ولا يتّسع لرمز */
  const w = WORDS[locale];
  return (
    <>
      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        {/* الفعلُ نفسُه بكلمته (اشترك · Gold · الترقية) سطراً أوّل — **الرمزُ يقول «كيف» لا «ماذا»**، وبلا الكلمة يفقد المشتركُ
            معنى «الترقية» ويفقد اختيارُ Gold عبارتَه (المراجعة المستقلّة) */}
        <span className="text-end">
          <span className="block text-14 font-bold">{label}</span>
          <span className="mt-0.5 block text-12 text-muted">
            {w.scan} ·{" "}
            <button type="button" onClick={onSheet} className="font-semibold text-accent hover:underline">
              {w.moreWays}
            </button>
          </span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- صورةٌ ثابتةٌ مولَّدةٌ مرّةً (`public/qr-get-plus.svg`) لا ملصق */}
        <img src="/qr-get-plus.svg" alt="" width={76} height={76} className="h-[76px] w-[76px] rounded-lg bg-white p-1" />
      </div>
      <button type="button" onClick={onSheet} className={`${cls} lg:hidden`}>
        {label}
      </button>
    </>
  );
}

function StoreSheet({ open, onClose, locale, plan }: { open: boolean; onClose: () => void; locale: "ar" | "en"; plan: PlanKey }) {
  const w = WORDS[locale];
  if (!open) return null;
  const p = locale === "en" ? "en" : "ar";
  const chosen = plan === "gold" ? w.planGold : plan === "monthly" ? w.planMonthly : w.planYearly;
  return (
    <Sheet open onClose={onClose} closeLabel={locale === "en" ? "Close" : "إغلاق"} variant="center" labelledBy="plus-store-title">
      <SheetHeader id="plus-store-title" title={w.sheetTitle} closeLabel={locale === "en" ? "Close" : "إغلاق"} onClose={onClose} />
      <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
        <p className="text-14 text-muted leading-relaxed">{w.sheetBody}</p>
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- صورةٌ ثابتةٌ مولَّدةٌ مرّةً (`public/qr-get-plus.svg`) لا ملصق */}
          <img src="/qr-get-plus.svg" alt="" width={124} height={124} className="h-[124px] w-[124px] shrink-0 rounded-xl bg-white" />
          <div className="min-w-0">
            <p className="text-15 font-bold">{w.scan}</p>
            <p className="mt-1 text-12 text-muted leading-relaxed">{w.scanBody}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <StoreBadge href={IOS_HREF} top={w.appStoreTop} name="App Store" icon="apple" />
          <StoreBadge href={ANDROID_HREF} top={w.playTop} name="Google Play" icon="play" />
        </div>
        {!ANDROID_PUBLIC && (
          <p className="text-12 text-muted leading-relaxed">
            {w.androidTesting}{" "}
            <a href={TESTERS_GROUP} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
              {w.groupFirst}
            </a>
          </p>
        )}
        <p className="text-center text-12 text-muted">
          {w.chosen}: <PlanWordmark tier={plan === "gold" ? "gold" : "plus"} /> · {chosen} · {PRICES[plan][p]}
        </p>
      </div>
    </Sheet>
  );
}

function StoreBadge({ href, top, name, icon }: { href: string; top: string; name: string; icon: "apple" | "play" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      className="flex h-[52px] items-center gap-2.5 rounded-control border border-[#3a3a3a] bg-black px-3.5 text-white transition hover:border-accent"
    >
      {icon === "apple" ? <AppleMark /> : <PlayMark />}
      <span className="min-w-0 text-start leading-none" dir="auto">
        <span className="block truncate text-[10.5px] text-[#bbb]">{top}</span>
        <span className="mt-1 block text-15 font-bold" dir="ltr">
          {name}
        </span>
      </span>
    </a>
  );
}

/* علامتا المتجرين كما تطلبهما إرشاداتُهما للروابط (شارةٌ سوداء بالعلامة والاسم) — رسمٌ لا صورة، فيبقى حادّاً في كلِّ مقاس */
function AppleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden className="shrink-0">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C7 7.4 5.6 8.3 4.8 9.7c-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7ZM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2.1-.5 2.7-1.3Z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg width="20" height="22" viewBox="0 0 22 24" aria-hidden className="shrink-0">
      <path d="M1 1.2 12.6 12 1 22.8c-.4-.2-.6-.6-.6-1.1V2.3c0-.5.2-.9.6-1.1Z" fill="#00d7fe" />
      <path d="m16.3 8.5-3.7 3.5L1 1.2c.2-.1.6-.1.9.1l14.4 7.2Z" fill="#00f076" />
      <path d="M16.3 15.5 1.9 22.7c-.3.2-.7.2-.9.1L12.6 12l3.7 3.5Z" fill="#ff3a44" />
      <path d="M20.4 10.6c.8.4.8 1.6 0 2.8l-4.1 2.1-3.7-3.5 3.7-3.5 4.1 2.1Z" fill="#ffd400" />
    </svg>
  );
}
