import type { Metadata } from "next";
import Image from "next/image";
import { getProfile, getUser } from "@/lib/data";
import { getT, getLocale } from "@/lib/locale";
import { stremioLinkOf } from "@/lib/stremio";
import { isPlus } from "@/core/plan";
import { GoogleButton } from "@/components/GoogleButton";
import { buttonClass } from "@/components/ui/Button";
import { StremioConnect } from "./StremioConnect";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ar = (await getLocale()) === "ar";
  return {
    title: ar ? "اربط Stremio" : "Link Stremio",
    description: ar
      ? "إضافة Loopz لـ Stremio: كل حلقة أو فيلم تشغّله هناك يسألك عنه Loopz: شفتها؟"
      : "The Loopz addon for Stremio: everything you play there is asked about on your Loopz home.",
    alternates: { canonical: "/stremio" },
  };
}

/**
 * 🆕 **صفحةُ ربط Stremio** (D-1512 «٣ أ»، ٢٢ أكتوبر) — «Configure» في قائمة Community Addons وفي الإضافة المثبّتة يفتحانها.
 * ثلاثُ حالات (الصور المعتمدة): زائرٌ ⇢ الشرحُ ثمّ الدخولُ بـ Google ويعود إلى هنا · عضوٌ بلا Loopz+ ⇢ بابُ الاشتراك ·
 * مشتركٌ ⇢ رابطُه الشخصيُّ والتثبيت (`StremioConnect`، البابُ نفسُه الذي يناديه التطبيق).
 * 🔑 **الشرحُ قبل الدخول**: من ضغط «Configure» في Stremio لا يعرف Loopz بعد — صفحةٌ تبدأ بالدخول تُغلق في وجهه.
 */
export default async function StremioPage() {
  const [{ t }, user] = await Promise.all([getT(), getUser()]);
  const locale = await getLocale();
  const profile = user ? await getProfile() : null;
  const plus = isPlus(profile);
  const link = user && plus ? await stremioLinkOf(user.id) : null;

  return (
    <main className="max-w-md mx-auto px-4 py-10" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <Image src="/loopz-mark.png" alt="" width={52} height={52} className="rounded-control" />
          <div>
            <h1 className="text-20 font-bold">{t.stremioWebTitle}</h1>
            <span className="inline-block mt-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-12 font-bold text-accent">
              {t.stremioForPlus}
            </span>
          </div>
        </div>

        {!user ? (
          <>
            <p className="mt-5 text-15 leading-relaxed">{t.stremioIntro}</p>
            <ul className="mt-3 mb-6 space-y-2 text-sm text-muted leading-relaxed">
              {[t.stremioHow1, t.stremioHow2, t.stremioNoContent].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {line}
                </li>
              ))}
            </ul>
            <GoogleButton locale={locale} next="/stremio" />
            <p className="mt-4 text-center text-12 text-muted">{t.stremioNeedAccount}</p>
          </>
        ) : !plus ? (
          <>
            <div className="mt-5 rounded-card bg-surface-2 p-4">
              <b className="block text-15">{t.stremioLockedTitle}</b>
              <span className="mt-1 block text-sm text-muted leading-relaxed">{t.stremioLockedSub}</span>
            </div>
            <a href="/plus" className={buttonClass({ size: "lg", full: true, className: "mt-5" })}>
              {t.stremioSubscribe}
            </a>
            <a href="stremio:///" className={buttonClass({ variant: "surface", full: true, className: "mt-2.5" })}>
              {t.stremioBack}
            </a>
          </>
        ) : (
          <StremioConnect linked={!!link} locale={locale} />
        )}
      </section>
    </main>
  );
}
