import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { trending, type SearchResult } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import { GoogleButton } from "@/components/GoogleButton";

/**
 * صفحة الهبوط — أهم شاشة في التجربة. (v3)
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

  return (
    /* الصفحة كلها شاشةٌ واحدة لا تُمرَّر: مثبَّتة من أسفل الترويسة إلى أسفل
       الشاشة، والمقاسات بـ clamp تتكيّف مع أي ارتفاع — البطل يتوسّط
       المساحة الحرّة وجدار الملصقات يلتصق بالقاع ويُقصّ ما فاض */
    <div className="fixed inset-x-0 top-16 bottom-0 overflow-hidden flex flex-col">
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4">
        {/* شارة الوعد: نقطة نابضة + السطر الإنجليزي — بلا أيقونات */}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: "var(--gradient-brand)",
            }}
            aria-hidden
          />
          <span className="text-[13px] font-semibold text-muted" dir="ltr">
            {t.taglineEn}
          </span>
        </div>

        {/* الوعد — يكبر ويصغر مع الشاشة لا مع نقاط قطعٍ ثابتة */}
        <h1 className="mt-[clamp(14px,2.6vh,30px)] text-[clamp(28px,min(3.4vw,5.4vh),62px)] font-extrabold leading-[1.16] tracking-tight px-4">
          {t.landingH1a}
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "var(--gradient-brand-x)",
            }}
          >
            {t.landingH1b}
          </span>
        </h1>

        <p className="mt-[clamp(10px,1.8vh,20px)] max-w-lg text-[clamp(13px,1.05vw,17px)] text-muted leading-relaxed px-6">
          {t.tagline}
        </p>

        {/* الدخول: زرٌّ أبيض واحد لا نموذج — أقل قرارٍ ممكن قبل البدء */}
        <div className="mt-[clamp(16px,3.2vh,36px)] w-full max-w-[360px] px-6">
          {configured ? (
            <GoogleButton locale={locale} />
          ) : (
            <p className="text-sm text-accent leading-relaxed">{t.loginNeedsKeys}</p>
          )}
          {/* الشعار ملتصقٌ بالزرّ لا في قاع الصفحة: التذييل العام كان
              يهبط تحت جدار الملصقات فيبتعد — والموضع هنا قرارُ المالك.
              (التذييل العام يُخفي نفسه في هذه الصفحة كي لا يتكرّر السطر.) */}
          <p className="mt-3.5 text-[13px] tracking-wide text-muted/70" dir="ltr">
            {t.footer}
          </p>

          {/* الوثيقتان تحت زرّ الدخول لا في الإعدادات: هذا هو الموضع الذي
              يبحث فيه من لم يسجّل بعد، وهو الرابط الذي تطلبه شاشة موافقة
              Google ويفتحه المراجع بلا حساب. صغيرتان عمداً — الوعد فوقهما
              هو البطل، وهما إتاحةٌ لا دعوة. */}
          <p className="mt-2.5 text-[11px] text-muted/50 flex items-center justify-center gap-2">
            <Link href="/privacy" className="hover:text-muted transition">
              {locale === "ar" ? "الخصوصية" : "Privacy"}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:text-muted transition">
              {locale === "ar" ? "الشروط" : "Terms"}
            </Link>
          </p>
        </div>
      </div>

      {/* الجدار زينةٌ خالصة فلا يحقّ له حجبُ البطل: كان طلب TMDB يؤخّر
          رسم العنوان وزرّ الدخول على أهم شاشة انطباع — الآن خلف Suspense
          يظهر متأخراً بلا أي هيكل، والبطل يرسم فوراً */}
      <Suspense fallback={null}>
        <PosterWall />
      </Suspense>
    </div>
  );
}

/** جدار الرائج — يجلب ملصقاته بنفسه بعد رسم البطل */
async function PosterWall() {
  // اثنا عشر ملصقاً رائجاً لصفّي الجدار — بصورٍ موجودة فقط
  const trend = await trending().catch(() => [] as SearchResult[]);
  // w185 تكفي: الملصق يُعرض بأقل من ١١٠ بكسل — كانت w342 تُحمِّل ضعف اللازم
  const posters = trend
    .filter((r) => r.poster_path)
    .slice(0, 12)
    .map((r) => posterUrl(r.poster_path, "w185"))
    .filter((p): p is string => !!p);
  const rowA = posters.slice(0, 6);
  const rowB = posters.slice(6, 12);

  /* أربع نسخٍ من الصفّ لا واحدة.
     الحلقة تعمل بإزاحة نصف المسار، فشرطُ ألّا يظهر فراغ أن يكون النصف
     الواحد أعرضَ من الشاشة. ستّة ملصقات ≈ ٩٠٠ بكسل: تكفي جوالاً ولا تكفي
     شاشة مكتبٍ عريضة — فكان الصفّ ينتهي عند ثلث العرض ويترك يمينه أسود،
     وهو ما ظهر في لقطة الحاسوب. والملصقات هنا ستّ صورٍ مكرّرة لا أكثر،
     فالتكرار يكلّف عقداً في الصفحة ولا يكلّف طلب شبكةٍ واحداً. */
  const tile = (row: string[]) => [...row, ...row, ...row, ...row];

  return (
    <>
      {/* جدار الرائج: صفّان يزحفان باتجاهين متعاكسين بميلٍ خفيف.
          محبوسٌ في صندوقه: ارتفاع أقصى واقتصاصٌ صريح وبلا أي تكبير —
          فلا يزحف فوق زرّ الدخول مهما ضاقت الشاشة */}
      {posters.length >= 8 && (
        <div
          className="relative shrink-0 max-h-[34vh] md:max-h-[46vh] overflow-hidden pt-6 pb-1"
          dir="ltr"
          aria-hidden
        >
          <div className="rotate-[-2deg] -mx-10 space-y-2.5">
            {[
              { row: rowA, cls: "marquee-track", dur: "60s" },
              { row: rowB, cls: "marquee-track marquee-rev", dur: "75s" },
            ].map(({ row, cls, dur }, ri) => (
              <div key={ri} className="overflow-hidden">
                <div className={cls} style={{ "--marquee-dur": dur } as React.CSSProperties}>
                  {/* نصفان متطابقان = حلقة لا نهائية بلا قفزة */}
                  {[...tile(row), ...tile(row)].map((p, i) => (
                    <div
                      key={i}
                      className="relative w-[clamp(60px,min(6.5vw,12vh),132px)] aspect-[2/3] rounded-poster overflow-hidden border border-white/10 bg-surface-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)] shrink-0 me-2.5"
                    >
                      {/* `next/image` لا وسمَ صورةٍ خام: الوسم الخام يطلب
                          image.tmdb.org مباشرةً، وهو نطاقٌ لا يصل من كل
                          شبكة — فيظهر الجدار مربّعاتٍ فارغة في أول شاشة
                          يراها الزائر. `next/image` يقدّمها من نطاقنا
                          (`/_next/image`) فتصل حيثما وصل الموقع. نفس
                          العلّة أُصلحت في المجتمع والاقتراحات واللقطات. */}
                      <Image
                        src={p}
                        alt=""
                        fill
                        sizes="132px"
                        priority={ri === 0 && i < 6}
                        className="object-cover"
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
    </>
  );
}
