import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getT } from "@/lib/locale";
import { welcomeSeeds } from "@/lib/welcomeSeeds";
import { posterUrl, POSTER_INTRINSIC } from "@/core/media";
import { GoogleButton } from "@/components/GoogleButton";
import { Icon, type IconName } from "@/components/Icon";
import { AppGateSignal } from "@/components/AppGateSignal";

/**
 * بطل صفحة الهبوط — الشاشة الأولى، حرفاً بحرف كما صمّمها المالك.
 *
 * كان يسكن `login/page.tsx` وحده. استُخرج هنا (D-122) لأن الجذر `/` صار
 * يعرض صفحة هبوطٍ حقيقية للزائر غير المسجّل بدل أن يحوّله إلى `/login`:
 * الرابط الذي تجمع عليه المحركات سلطتها هو الجذر، وكان تحويلاً — أي أن
 * كل إشارةٍ خارجية كانت تُهدَر على صفحة دخول.
 *
 * صيغتان لا تصميمان:
 *  - `screen`: مثبّتة بلا تمرير — صفحة `/login` كما هي بالضبط، لم يتغيّر
 *    فيها بكسل واحد.
 *  - `flow`: نفس الشاشة الأولى تماماً، لكنها تجري في مسار الصفحة فيمكن
 *    أن يليها محتوى يُقرأ ويُفهرَس (الجذر).
 */
/** 🆕 D-1349 — النقاطُ الثلاث التي تقولها شاشةُ الدخول الأصليّة (قرارُ أحمد ١٣) — النصُّ نفسُه والأيقوناتُ نفسُها */
const POINTS: { icon: IconName; key: "signInPoint1" | "signInPoint2" | "signInPoint3" }[] = [
  { icon: "check-line", key: "signInPoint1" },
  { icon: "calendar", key: "signInPoint2" },
  { icon: "people", key: "signInPoint3" },
];

export async function LandingHero({
  variant = "screen",
}: {
  variant?: "screen" | "flow";
}) {
  const { locale, t } = await getT();

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* المقاسات بـclamp لا بنقاط قطع: البطل يتوسّط المساحة الحرّة وجدار
     الملصقات يلتصق بالقاع ويُقصّ ما فاض — في الصيغتين سواء.
     في `flow` تُلغى حشوة `<main>` بهوامش سالبة كي تبقى الشاشة الأولى
     ملء العرض والارتفاع تماماً كما في `screen`. */
  const shell =
    variant === "screen"
      ? "fixed inset-x-0 top-16 bottom-0 overflow-hidden flex flex-col"
      : "relative -mx-4 -mt-6 min-h-[calc(100svh-4rem)] overflow-hidden flex flex-col";

  return (
    <div className={shell}>
      {/* D-1150 — العتبةُ تُعلن نفسَها للغلاف فيخفي شريطَه ما دامت ظاهرة */}
      <AppGateSignal />
      {/* D-1349 — والجدارُ غائبٌ (تحت ٦٠٠ ارتفاعاً) لا يبقى ما يجلس تحت الشريط السفليّ للجوّال: البطلُ يحجز مكانَه */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 max-md:[@media(max-height:600px)]:pb-20">
        {/* شارة الوعد: نقطة نابضة + السطر الإنجليزي — بلا أيقونات */}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden
          />
          <span className="text-12 font-semibold text-muted" dir="ltr">
            {t.taglineEn}
          </span>
        </div>

        {/* الوعد — يكبر ويصغر مع الشاشة لا مع نقاط قطعٍ ثابتة.
            وهو `h1` الصفحة الوحيد: عنوانٌ واحد في المستند قاعدةُ بنيةٍ
            دلالية، وما تحته من أقسام يبدأ من `h2`. */}
        {/* 🆕 D-1349 — **الإنجليزيّةُ سطرٌ لكلِّ جملة** (حكمُ أحمد على المعاينة: «جاي سطرين سطرين مو حلو اوزنها»): الجملةُ
            الإنجليزيّةُ أطولُ من العربيّة فكانت تنكسر على الجوّال إلى أربعة أسطر. الحدُّ الأدنى فيها يتبع عرضَ
            الشاشة (٥٫٥vw ≈ ٢١px على ٣٩٠) ولا ينكسر السطر؛ العربيّةُ كما كانت حرفاً. */}
        <h1
          className={`mt-[clamp(14px,2.6vh,30px)] font-extrabold leading-[1.16] tracking-tight ${
            locale === "en"
              ? "text-[clamp(17px,min(5.5vw,5.4vh),62px)] whitespace-nowrap px-2"
              : "text-[clamp(28px,min(3.4vw,5.4vh),62px)] px-4"
          }`}
        >
          {t.landingH1a}
          <br />
          {/* 🔴 🆕 **تدرّجُ الواجهة لا تدرّجُ الهويّة** (D-846):
              `--gradient-brand-x` مبنيٌّ من `--brand-*` **وهي ألوانُ
              الهويّة الثابتةُ في كلِّ ثيم** — 📏 **وعلى خلفيّة
              `daylight` (#f5f5f3) تباينُها ١٫٣١–١٫٩٧** أي أنّ أكبرَ
              عنوانٍ في واجهة المنتج **لا يُقرأ نهاراً.**
              🔑 **والثيمُ النهاريُّ نفسُه كتب القاعدةَ في تعريفه**:
              «الأصفر يُعتَّم إلى ذهبيٍّ داكن #8A6D00 لأن #FFD200 على
              الأبيض لا يُقرأ نصّاً» — **و`--accent`/`--accent-2` هما
              تلك الدرجةُ المعتَّمة**، **وهذا السطرُ كان يتخطّاهما إلى
              الهويّة الخام.**
              ⚠️ **ولا يُبنى من `--accent`/`--accent-2`**: 🔴 **جُرّب
              فسقط في القياس الحيّ** — **زوجُ الواجهة ليس درجتين من
              لونٍ واحد في كلِّ ثيم** (`amber`: كهرمانيٌّ وأخضر) —
              **فصار العنوانُ تدرّجاً من لونين.** **والثيماتُ الداكنةُ
              ترث الثلاثيَّ حرفاً، والنهاريُّ وحدَه يعمّقه.** */}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-brand-text)" }}
          >
            {t.landingH1b}
          </span>
        </h1>

        {/* 🆕 D-1349 (Phase 11-U · U2) — **النقاطُ الثلاثُ مكانَ الجملة الوصفيّة** (قرارُ أحمد ١٣، وحكمُه على المعاينة: «صغّر
            حجم الاضافة الجديدة بشكل بسيط»): ما تقوله شاشةُ الدخول الأصليّة يقوله الويب — وعدٌ يُعدّ لا جملةٌ تُقرأ.
            أصغرُ من بطاقات التطبيق درجةً (نصٌّ ١٣ · أيقونةٌ ٢٦): الشارةُ فوق العنوان باقيةٌ هنا فالمساحةُ أضيق. */}
        <ul className="mt-[clamp(12px,2.2vh,24px)] w-full max-w-[360px] px-6 space-y-2 text-start">
          {POINTS.map((p) => (
            <li
              key={p.key}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-medium"
            >
              <span
                className="grid place-items-center w-[26px] h-[26px] rounded-lg shrink-0 text-accent"
                style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
                aria-hidden
              >
                <Icon name={p.icon} size={14} />
              </span>
              {t[p.key]}
            </li>
          ))}
        </ul>

        {/* الدخول: زرٌّ أبيض واحد لا نموذج — أقل قرارٍ ممكن قبل البدء */}
        <div className="mt-[clamp(16px,3.2vh,36px)] w-full max-w-[360px] px-6">
          {configured ? (
            <GoogleButton locale={locale} />
          ) : (
            <p className="text-sm text-accent leading-relaxed">{t.loginNeedsKeys}</p>
          )}
          {/* 🆕 D-1349 — **جملةُ الموافقة مكانَ الرابطين** (قرارُ أحمد ١٤): ما يوافق عليه الداخلُ يُقال له عند الزرّ الذي
              يضغطه، بالنصِّ الذي وافق عليه أحمد لشاشة التطبيق. والرابطان باقيان فيها — شاشةُ موافقة Google تطلبهما
              ويفتحهما المراجعُ بلا حساب. `prefetch={false}` كما كانا (D-893).
              ⚖️ **«تصفَّح أوّلاً» حُذف** (حكمُه ١٠ أكتوبر: «احذف تصفح اولا حتى من الويب») ومعه سطرُ الشعار
              «Every story matters». الشريطُ السفليُّ للزائر باقٍ: تصفّحُ الويب بلا حسابٍ لم يُمسّ (الفهرسةُ وروابطُ
              المشاركة تقومان عليه). */}
          <p className="mt-3.5 text-12 text-muted leading-relaxed text-balance">
            {t.signInConsentLead}
            <Link href="/terms" prefetch={false} className="text-foreground underline underline-offset-2 hover:text-accent transition">
              {t.signInConsentTerms}
            </Link>
            {t.signInConsentAnd}
            <Link href="/privacy" prefetch={false} className="text-foreground underline underline-offset-2 hover:text-accent transition">
              {t.signInConsentPrivacy}
            </Link>
          </p>
        </div>
      </div>

      {/* الجدار زينةٌ خالصة فلا يحقّ له حجبُ البطل: طلب TMDB كان يؤخّر رسم
          العنوان وزرّ الدخول على أهم شاشة انطباع، فصار خلف Suspense.

          والبديل صندوقٌ فارغ بارتفاع الجدار لا `null`: بـ`null` كان البطل
          يتوسّط الشاشة كلّها ثم يقفز للأعلى لحظة وصول الملصقات. */}
      {/* 🆕 D-1349 — **الشاشةُ القصيرةُ تأخذ من الجدار لا من البطل**: النقاطُ الثلاثُ أطالت البطلَ ~١١٠px، ومتصفّحُ الجوّال
          بشريطَيه يترك ~٦٦٠px من ٨٤٤ — فكان البطلُ يُقصّ من أعلاه (الشارةُ تحت الترويسة، مقيسٌ محلّيّاً على ٣٩٠×٦٦٤
          و٣٦٠×٥٦٠). الجدارُ زينة: يقصر تحت ٧٢٠ ارتفاعاً ويغيب تحت ٦٠٠، والوعدُ والزرُّ لا يُمسّان. */}
      <Suspense fallback={<div className="shrink-0 h-[34vh] md:h-[46vh] [@media(max-height:720px)]:h-[20vh] [@media(max-height:600px)]:hidden" aria-hidden />}>
        <PosterWall />
      </Suspense>
    </div>
  );
}

/** جدار الملصقات — يجلب ملصقاته بنفسه بعد رسم البطل */
async function PosterWall() {
  /* 🆕 D-1349 — **الأعمالُ الأربعةُ والعشرون المثبتةُ لا رائجُ الأسبوع** (قرارُ أحمد للجدار الأصليّ: «اشهر الاعمال»):
     ما يراه الزائرُ في الويب هو ما يراه في شاشة الدخول الأصليّة وما سيختار منه في الترحيب — قائمةٌ واحدةٌ
     (`welcomeSeeds`، D-1344) لا واجهتان تفترقان كلَّ أسبوع. اثنا عشر لكلِّ صفّ. */
  const seeds = await welcomeSeeds().catch(() => []);
  // w185 تكفي: الملصق يُعرض بأقل من ١١٠ بكسل — كانت w342 تُحمِّل ضعف اللازم
  const posters = seeds
    .map((r) => posterUrl(r.posterPath, "w185"))
    .filter((p): p is string => !!p);
  const half = Math.ceil(posters.length / 2);
  const rowA = posters.slice(0, half);
  const rowB = posters.slice(half);

  /* أربع نسخٍ من الصفّ لا واحدة.
     الحلقة تعمل بإزاحة نصف المسار، فشرطُ ألّا يظهر فراغ أن يكون النصف
     الواحد أعرضَ من الشاشة. ستّة ملصقات ≈ ٩٠٠ بكسل: تكفي جوالاً ولا تكفي
     شاشة مكتبٍ عريضة. والملصقات هنا ستّ صورٍ مكرّرة لا أكثر، فالتكرار
     يكلّف عقداً في الصفحة ولا يكلّف طلب شبكةٍ واحداً. */
  /* D-1349 — الصفُّ صار اثنَي عشر ملصقاً (كان ستّة) فنسختان تكفيان ما كانت تكفيه أربع: العقدُ في الصفحة كما كانت */
  const tile = (row: string[]) => [...row, ...row];

  return (
    <>
      {/* جدار الرائج: صفّان يزحفان باتجاهين متعاكسين بميلٍ خفيف.
          محبوسٌ في صندوقه: ارتفاع أقصى واقتصاصٌ صريح وبلا أي تكبير —
          فلا يزحف فوق زرّ الدخول مهما ضاقت الشاشة */}
      {posters.length >= 8 && (
        <div
          className="relative shrink-0 max-h-[34vh] md:max-h-[46vh] [@media(max-height:720px)]:max-h-[20vh] [@media(max-height:600px)]:hidden overflow-hidden pt-6 pb-1"
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
                          يراها الزائر. */}
                      <Image
                        src={p}
                        alt=""
                        {...POSTER_INTRINSIC.w185}
                        priority={ri === 0 && i < 6}
                        className="absolute inset-0 w-full h-full object-cover"
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
