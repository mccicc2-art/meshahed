import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { trending, type SearchResult } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import { GoogleButton } from "@/components/GoogleButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";

/**
 * صفحة الهبوط — أهم شاشة في التجربة.
 *
 * البنية: شارةُ وعدٍ صغيرة، عنوانٌ ضخم من سطرين، سطرُ شرح، زرُّ دخولٍ
 * أبيض ثقيل الحضور، ثم «جدار الرائج»: صفّان من ملصقاتِ ما يُعرض الآن
 * يزحفان ببطءٍ باتجاهين متعاكسين بميلٍ سينمائي خفيف — حركةٌ حيّة تُغني
 * عن أي صورة تسويقية ثابتة، وتثبت أن المنصة تعيش. وإن تعذّر TMDB
 * اختفى الجدار ولم تنكسر الصفحة.
 */
export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const { locale, t } = await getT();

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // اثنا عشر ملصقاً رائجاً لصفّي الجدار — بصورٍ موجودة فقط
  const trend = await trending().catch(() => [] as SearchResult[]);
  const posters = trend
    .filter((r) => r.poster_path)
    .slice(0, 12)
    .map((r) => posterUrl(r.poster_path, "w342"))
    .filter((p): p is string => !!p);
  const rowA = posters.slice(0, 6);
  const rowB = posters.slice(6, 12);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex flex-col items-center text-center pt-8 sm:pt-14">
        {/* شارة الوعد: نقطة نابضة + السطر الإنجليزي — بلا أيقونات */}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--brand-2), var(--brand-3))",
            }}
            aria-hidden
          />
          <span className="text-[13px] font-semibold text-muted" dir="ltr">
            {t.taglineEn}
          </span>
        </div>

        {/* الوعد — بخطٍّ ضخم يقرأه العابر قبل أن يقرّر */}
        <h1 className="mt-7 text-4xl sm:text-6xl font-extrabold leading-[1.18] tracking-tight px-4">
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

        <p className="mt-5 max-w-md text-[15px] sm:text-base text-muted leading-relaxed px-6">
          {t.tagline}
        </p>

        {/* الدخول: زرٌّ أبيض واحد لا نموذج — أقل قرارٍ ممكن قبل البدء */}
        <div className="mt-9 w-full max-w-sm px-6">
          {configured ? (
            <GoogleButton locale={locale} />
          ) : (
            <p className="text-sm text-accent leading-relaxed">{t.loginNeedsKeys}</p>
          )}
          <p className="text-xs text-muted mt-3.5">{t.loginConsent}</p>
        </div>

        <div className="mt-6">
          <LanguageSwitch locale={locale} compact />
        </div>
      </div>

      {/* جدار الرائج: صفّان يزحفان باتجاهين متعاكسين بميلٍ خفيف */}
      {posters.length >= 8 && (
        <div className="relative mt-14 sm:mt-16 pb-4" dir="ltr" aria-hidden>
          <div className="rotate-[-3deg] scale-110 space-y-3">
            {[
              { row: rowA, cls: "marquee-track", dur: "60s" },
              { row: rowB, cls: "marquee-track marquee-rev", dur: "75s" },
            ].map(({ row, cls, dur }, ri) => (
              <div key={ri} className="overflow-hidden">
                <div className={cls} style={{ "--marquee-dur": dur } as React.CSSProperties}>
                  {/* نسختان متتاليتان من الصف = حلقة لا نهائية بلا قفزة */}
                  {[...row, ...row].map((p, i) => (
                    <div
                      key={i}
                      className="w-28 sm:w-36 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-surface-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)] shrink-0 me-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* حجابان جانبيان وسفلي يذيبان الجدار في الخلفية */}
          <div
            className="absolute inset-y-0 left-0 w-16 pointer-events-none"
            style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
          />
          <div
            className="absolute inset-y-0 right-0 w-16 pointer-events-none"
            style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
            style={{ background: "linear-gradient(to top, var(--background), transparent)" }}
          />
        </div>
      )}
    </div>
  );
}
