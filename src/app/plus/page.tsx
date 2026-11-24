import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getT, getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { trendingToday } from "@/lib/tmdb";
import { Icon, type IconName } from "@/components/Icon";
import { PlanWordmark } from "@/components/plus/PlanWordmark";
import { PlusBuyBar } from "@/components/plus/PlusBuyBar";
import { WORDS, deviceOf, type PlanKey } from "@/components/plus/plusStore";
import { seoKeywords } from "@/lib/seo";
import { posterUrl } from "@/core/media";
import { isGold, isPlus } from "@/core/plan";
import type { Dict } from "@/core/i18n";

/* صفحةُ البيع تُفهرَس كأختها `/features`: **الوصفُ هو الإعلانُ الوحيد
   الذي نملكه** في نتيجة البحث، ويُكتب بلغة الزائر لا بالإنجليزية دائماً
   (D-122). و«— Loopz» يُلحَق آلياً بقالب التخطيط. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ar = locale === "ar";
  return {
    title: "Loopz Plus",
    description: ar
      ? "Loopz Plus — اربط تطبيقاتك ومشاهدتك تتسجّل وحدها، وابحث بوصف القصة، ورئيسيتك وثيماتك على ذوقك. والمتابعة والقوائم والمجتمع مجّانيةٌ للجميع دائماً."
      : "Loopz Plus — link your apps and your watching is tracked for you, search by describing the story, and shape your home and themes. Tracking, lists and community stay free for everyone, always.",
    keywords: seoKeywords(locale),
    alternates: { canonical: "/plus" },
    openGraph: { type: "article", url: "/plus" },
  };
}

/**
 * ====== صفحةُ Loopz+ — **التصميم «ج»** (أحمد ١٨ نوفمبر: «صفحة الاشتراك ايضا تكون موجوده و اذا ضغط اشترك تحوله عالتطبيق») ======
 *
 * 🔁 **نقضٌ مسجَّل لـ D-217 («بطاقةُ الثمن بلا زرّ»)**: الزرُّ غاب لأنّ بوّابةَ الدفع لم تكن مفتوحة. اليومَ الاشتراكُ مفتوحٌ في
 * App Store (١٧ نوفمبر) وفي تجربة أندرويد، **فالزرُّ يعود — لكنّه لا يبيع هنا**: يحوّل إلى التطبيق (`PlusBuyBar`).
 * وقاعدةُ D-217 الباقية محفوظة: لا سعرَ يُقال لا يدفعه المتجر (`plusStore.ts` › `PRICES`).
 *
 * 🔑 **المحتوى محتوى شاشة التطبيق نفسُه** (`apps/mobile/src/settings/PlusScreen.tsx`): العنوانُ ومزايا بلس التسع (عشرٌ قبل T540) بترتيب الخطّة
 * (`pwF*`) ومزايا Gold وسطرُ المجّانيّ — من القاموس كما هي، فلا تفترق الصفحتان في ميزة. **والتخطيطُ للويب**: بطلٌ عريضٌ
 * بالاسم، وبلاطاتٌ في خمسة أعمدة، وشريطُ اشتراكٍ ملتصقٌ بالأسفل. ما دون الحاسوب يلتفّ عموداً.
 * 🔑 **قائمتا «الجاهز» و«قريباً» القديمتان حُذفتا**: كُتبتا قبل أن تُبنى المزايا، واليومَ قائمةُ التطبيق هي الحقيقة.
 */
const FEATURES: { icon: IconName; key: keyof Dict }[] = [
  { icon: "tv", key: "pwFLink" },
  { icon: "search", key: "pwFStory" },
  { icon: "grid", key: "pwFHome" },
  { icon: "palette", key: "pwFThemes" },
  { icon: "image", key: "pwFArt" },
  { icon: "view-mixed", key: "pwFWidget" },
  /* 🗑️ T540 — بندُ الإحصاءات خرج كما في التطبيق: صارت للجميع */
  { icon: "list", key: "pwFLists" },
  { icon: "star", key: "pwFBadge" },
  { icon: "people", key: "pwFGroups" },
];

export default async function PlusPage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const [{ locale, t }, profile, trending, hdrs, sp] = await Promise.all([
    getT(),
    getProfile(),
    trendingToday().catch(() => []),
    headers(),
    searchParams,
  ]);
  const lang = locale === "en" ? "en" : "ar";
  const w = WORDS[lang];
  const device = deviceOf(hdrs.get("user-agent") ?? "");

  const gold = isGold(profile);
  const plus = isPlus(profile);
  /* المالكُ: ذهبيٌّ بتاريخه، أو بلس (اشتراكُ متجرٍ أو منحةٌ أو شريك) — والتاريخُ ما يعرضه الحساب، لا حسابٌ ثانٍ */
  const owned = gold
    ? { tier: "gold" as const, until: profile?.gold_until ?? null }
    : plus
      ? { tier: "plus" as const, until: profile?.plus_until ?? null }
      : null;
  const initial: PlanKey = sp.tier === "gold" ? "gold" : sp.tier === "monthly" ? "monthly" : "yearly";

  const posters = trending
    .map((r) => posterUrl(r.poster_path ?? null, "w342"))
    .filter((u): u is string => !!u)
    .slice(0, 3);
  const headline = owned ? w.ownedTitle(owned.tier === "gold" ? "Loopz Gold" : "Loopz Plus") : t.pwHeadOffer.replace("\n", lang === "ar" ? "، " : " — ");

  return (
    /* 🆕 **وعلى الشاشة العريضة ١٠٤٠ لا عرضُ الصفحة كلِّه** (الخيار «ب»): المزايا الخمسُ في الصفّ تتمدّد بلا داعٍ فوق ذلك */
    <article className="pb-6 xl:mx-auto xl:max-w-[65rem]" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* ===== البطل ===== */}
      <section className="relative flex items-center gap-10 overflow-hidden rounded-3xl border border-border bg-surface px-6 py-8 md:px-10 md:py-10">
        <div aria-hidden className="pointer-events-none absolute -top-28 -start-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative min-w-0 flex-1">
          <PlanWordmark tier={owned?.tier ?? "plus"} className="text-[34px] leading-none md:text-[46px]" />
          <h1 className="mt-4 text-xl font-extrabold leading-relaxed md:text-[26px]">{headline}</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">{t.pwFreeNote}</p>
        </div>
        {posters.length === 3 && (
          <div aria-hidden className="relative hidden shrink-0 items-center gap-2 md:flex">
            {posters.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={96}
                height={144}
                sizes="96px"
                className={`h-36 w-24 rounded-xl object-cover shadow-[0_14px_40px_rgba(0,0,0,0.5)] ${
                  i === 0 ? "-rotate-6" : i === 2 ? "rotate-6" : ""
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== مزايا Plus ===== */}
      <h2 className="mt-8 mb-3 flex items-center gap-2 text-20 font-bold">
        <Icon name="sparkle-star" size={18} className="text-accent" />
        {w.plusFeatures}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FEATURES.map((f) => (
          <li key={f.key} className="relative min-h-[118px] rounded-2xl border border-border bg-surface p-4">
            <Icon name={f.icon} size={22} className="text-accent" />
            <p className="mt-3 text-sm font-semibold leading-relaxed">{t[f.key] as string}</p>
            {owned && (
              <span className="absolute top-3 end-3 text-[color:var(--success)]" title={w.included}>
                <Icon name="check" size={16} />
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* ===== Gold ===== */}
      <h2 className="mt-8 mb-3 flex flex-wrap items-baseline gap-x-2 text-20 font-bold">
        <PlanWordmark tier="gold" />
        <span className="text-sm font-medium text-muted">{w.goldWith}</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        <GoldTile icon="star" title={t.pwGoldBadgeLine} />
        {/* 🆕 T413 — «ادعم لوبز» يفتح لوحةَ الداعمين (زرُّ «اللوحة» في صفحة الاشتراك بالتطبيق) */}
        <GoldTile icon="heart" title={gold ? t.pwGoldSupportMine : t.pwGoldSupport} sub={w.goldBoard} href="/supporters" />
        <GoldTile icon="people" title={w.goldPartners} sub={w.goldPartnersSub} />
      </ul>

      <PlusBuyBar locale={lang} device={device} owned={owned} initial={initial} />

      <p className="mt-6 text-12 text-muted leading-relaxed">
        {w.verifiedNote}{" "}
        <Link href="/features" className="font-bold text-accent hover:underline">
          {w.features}
        </Link>
        {" · "}
        <Link href="/terms" className="hover:text-foreground">
          {w.terms}
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-foreground">
          {w.privacy}
        </Link>
      </p>
    </article>
  );
}

function GoldTile({ icon, title, sub, href }: { icon: IconName; title: string; sub?: string; href?: string }) {
  const inner = (
    <>
      <Icon name={icon} size={20} className="shrink-0 text-[#d7a531]" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{title}</span>
        {sub && <span className="mt-0.5 block text-12 text-muted leading-snug">{sub}</span>}
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border border-[#d7a531]/50 bg-surface px-4 py-3.5";
  return (
    <li>
      {href ? (
        <Link href={href} prefetch={false} className={`${cls} transition hover:border-[#d7a531]`}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
