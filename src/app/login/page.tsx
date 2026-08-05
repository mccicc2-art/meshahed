import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { trending, type SearchResult } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import { GoogleButton } from "@/components/GoogleButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";

/**
 * صفحة الهبوط — أهم شاشة في التجربة: أول ما يراه الغريب.
 *
 * البنية من الأعلى: شارةُ هويةٍ صغيرة، عنوانٌ ضخم من سطرين يقول الوعد،
 * سطرُ شرح، زرُّ الدخول، ثم مروحةُ ملصقاتٍ حيّة من «الرائج» الآن —
 * الملصقات ليست زينة: هي إثباتُ أن المنصة تعيش وتعرف ما يُعرض اليوم.
 * وإن تعذّر TMDB اختفت المروحة ولم تنكسر الصفحة.
 *
 * ولغة الصفحة تتبع لغة جهاز الزائر تلقائياً (Accept-Language) حتى
 * يختار بنفسه من المبدّل.
 */
export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const { locale, t } = await getT();

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // خمسة ملصقات رائجة للمروحة السفلية — بصور موجودة فقط
  const trend = await trending().catch(() => [] as SearchResult[]);
  const posters = trend
    .filter((r) => r.poster_path)
    .slice(0, 5)
    .map((r) => posterUrl(r.poster_path, "w342"));

  return (
    <div className="flex flex-col min-h-[calc(100dvh-6rem)] overflow-hidden">
      <div className="flex-1 flex flex-col items-center text-center pt-6 sm:pt-10">
        {/* شارة الهوية: الشعار + السطر الإنجليزي المتدرّج */}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2">
          <Logo size={20} gradientId="login-badge" />
          <span
            className="text-[13px] font-bold bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))",
            }}
            dir="ltr"
          >
            {t.taglineEn}
          </span>
        </div>

        {/* الوعد — بخطٍّ ضخم يقرأه العابر قبل أن يقرّر */}
        <h1 className="mt-7 text-4xl sm:text-5xl font-extrabold leading-[1.15] tracking-tight px-4">
          {t.landingH1a}
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))",
            }}
          >
            {t.landingH1b}
          </span>
        </h1>

        <p className="mt-4 max-w-md text-sm sm:text-base text-muted leading-relaxed px-4">
          {t.tagline}
        </p>

        {/* الدخول: زرٌّ واحد لا نموذج — أقل قرارٍ ممكن قبل البدء */}
        <div className="mt-8 w-full max-w-sm px-4">
          {configured ? (
            <GoogleButton locale={locale} />
          ) : (
            <p className="text-sm text-accent leading-relaxed">{t.loginNeedsKeys}</p>
          )}
          <p className="text-xs text-muted mt-3">{t.loginConsent}</p>
        </div>

        <div className="mt-6">
          <LanguageSwitch locale={locale} compact />
        </div>
      </div>

      {/* مروحة الرائج: خمس بطاقات حيّة تميل وتتراكب — دليلٌ لا زخرفة */}
      {posters.length >= 3 && (
        <div className="relative mt-10 h-48 sm:h-64" dir="ltr" aria-hidden>
          <div className="absolute inset-x-0 -bottom-16 sm:-bottom-20 flex justify-center items-end">
            {posters.map((p, i) => {
              const mid = (posters.length - 1) / 2;
              const off = i - mid;
              return (
                <div
                  key={i}
                  className="w-32 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.7)] bg-surface-2 -mx-3 sm:-mx-4"
                  style={{
                    transform: `rotate(${off * 7}deg) translateY(${Math.abs(off) * 22}px)`,
                    zIndex: 10 - Math.abs(off),
                  }}
                >
                  {p && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
              );
            })}
          </div>
          {/* حجابٌ سفلي يذيب المروحة في الخلفية */}
          <div
            className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
            style={{
              background: "linear-gradient(to top, var(--background), transparent)",
            }}
          />
        </div>
      )}
    </div>
  );
}
