"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import { TitleSearchSheet } from "./TitleSearchSheet";

/**
 * شريط التبويبات السفلي.
 *
 * خمس وجهات: الرئيسية، المكتبة، اكتشف، المجتمع، البحث. والبحث أُضيف
 * بقرار المالك ويُسجَّل به D-024: كان مدخلاً داخل «اكتشف» وحده، فمن أراده
 * دفع ضغطتين ومرّ على صفحةٍ لا يريدها — وهو أكثر أفعال التطبيق تكراراً
 * بعد التأشير.
 *
 * والخانات متساوية العرض بشبكةٍ من خمسة أعمدة لا بحشوٍ لكل خانة:
 * «المجتمع» أعرض من «بحث» بضعف، فالحشو المتساوي يعطي خاناتٍ متفاوتة
 * والعين تقرأ التفاوت اضطراباً. العرض واحد والنصّ يُقصّ إن طال.
 *
 * لونان لا خمسة: النشط بلون الهوية، والخامل رماديّ `--disabled`. تلوين
 * كل تبويبٍ بلونه كان يجعلها متساوية في الصياح، فلا يُعرف موضعك إلا
 * بقراءة الكلمات.
 *
 * ---
 *
 * **الشكل: شريطٌ ملتصقٌ بالحافّة لا كبسولةٌ عائمة** (طلب أحمد ١١ أغسطس:
 * «الشريط السفلي احتاجك تغير تصميمه وما يكون كذا عائم، يكون مثل تبع
 * تويتر»). وثلاثةُ أشياء تغيّرت معاً، وكلٌّ منها له سببُه:
 *
 *  ١) **الكبسولة ذهبت.** كانت لوحاً مستديراً بحدٍّ وظلٍّ ثقيل يطفو فوق
 *     المحتوى، **فتأكل من الشاشة مرّتين**: بارتفاعها، وبالتدرّج المعتم
 *     الذي كان تحتها ليفصلها عمّا خلفها. والشريطُ الملتصق يحتاج **خطّاً
 *     واحداً** ليقول أين ينتهي التطبيق ويبدأ النظام.
 *
 *  ٢) **شفافيةٌ وضباب** (طلب أحمد، ولقطته الثالثة مرجعاً): الخلفية
 *     `color-mix` مع الشفاف و`backdrop-blur` — فيُرى أن تحته محتوًى يمرّ،
 *     وهو ما يجعل الشريط جزءاً من الصفحة لا صندوقاً فوقها. **والصنف
 *     الصمّاء تبقى مكتوبةً قبله**: لو لم يفهم متصفّحٌ `color-mix` سقط
 *     السطر المضمَّن وعاد اللون الصمّاء — **ولا شريط شفّافاً بلا ضباب**،
 *     فذاك نصٌّ فوق ملصقات.
 *
 *  ٣) **النقطة الصفراء تحت الاسم ذهبت** (طلب أحمد: «ما يحتاج النقطة
 *     الصفراء اللي تحت، كفاية إذا اخترت الأيقونة يتغير لونها أصفر مثل
 *     الثيم»). **وهو محقّ:** الأيقونةُ الصفراء والاسمُ العريض يقولان
 *     «أنت هنا» مرّتين، والنقطةُ ثالثة. **وإشارةٌ تُكرَّر ثلاثاً تُقرأ
 *     زينةً لا معنى.**
 *
 * **وحلَّ محلّها معنًى مختلف تماماً — نقطةُ «هناك جديدٌ هناك»** على تبويبٍ
 * **لستَ فيه** (`NavSignalDot`). الفرق ليس في الشكل بل في الجملة: تلك
 * كانت تقول ما تعرفه، وهذه تقول ما لا تعرفه.
 */

const TABS: {
  href: string;
  key: "home" | "library" | "news" | "search" | "people";
  icon: IconName;
}[] = [
  { href: "/", key: "home", icon: "home" },
  { href: "/library", key: "library", icon: "film" },
  { href: "/news", key: "news", icon: "compass" },
  { href: "/people", key: "people", icon: "people" },
  /* البحث في الطرف: فعلٌ لا وجهةَ تصفّح، والأطراف أسهل ما تصله الإبهام.
     ولأنه فعل، لا يُنقل المستخدم إلى صفحة: ضغطُه يفتح ورقةً بحقلٍ مركَّز
     فتظهر لوحة المفاتيح فوراً. الرابط يبقى مكتوباً لمن فتح `/search`
     برابطٍ مباشر أو بلا جافاسكربت. */
  { href: "/search", key: "search", icon: "search" },
];

export function BottomNav({
  locale,
  signedIn = true,
  peopleDot,
}: {
  locale: Locale;
  signedIn?: boolean;
  /** نقطةُ «جديد» على تبويب المجتمع — عقدةُ خادمٍ تصل خلف Suspense */
  peopleDot?: ReactNode;
}) {
  const pathname = usePathname();
  const t = getDict(locale);
  // الحالة قبل أي خروجٍ مبكّر: ترتيب الخطّافات لا يتغيّر بين تصييرين
  const [searchOpen, setSearchOpen] = useState(false);
  /* الزائر غير المسجّل لا شريط له (D-122): تبويباته الخمسة كلها خلف
     تسجيل الدخول، فكلّ ضغطةٍ فيها تردّه — وهو فوق صفحة هبوطٍ تعرّفه
     بالمنتج، لا داخل تطبيقٍ يتنقّل فيه */
  if (!signedIn) return null;
  // شاشات مركّزة: لا شريط تبويبات يزاحم زر الإجراء
  if (pathname === "/login" || pathname === "/welcome") return null;

  const label: Record<string, string> = {
    home: t.navHome,
    library: t.navLibrary,
    news: t.navNews,
    search: t.navSearch,
    people: t.navPeople,
  };

  /* صفحات التفاصيل والسجلّ تُنسب إلى المكتبة: المستخدم في عمق التطبيق
     يحتاج مرساةً — تبويبٌ لا يضيء يقرأ وكأن الشريط تعطّل */
  const LIBRARY_PREFIXES = ["/library", "/show/", "/movie/", "/stats", "/diary", "/lists", "/ratings"];
  // للبحث تبويبه الآن، فصفحته لم تعد تُنسب إلى «اكتشف»
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/library"
        ? LIBRARY_PREFIXES.some((p) => pathname.startsWith(p))
        : pathname.startsWith(href);

  return (
    <>
      <nav
        aria-label={t.navHome}
        /* الصنف الصمّاء أوّلاً وهي الاحتياط: السطر المضمَّن أدناه يغلبها
           حيث يُفهم، ويسقط كاملاً حيث لا يُفهم فيبقى اللون الصمّاء */
        /* **والارتفاعُ نزل** (D-259، بلاغُ أحمد بلقطةٍ معلَّمة: «الشريط
           اللي تحت ارتفاعه عالي»). **والعلّةُ كانت في الحشو السفليّ لا في
           الأيقونة**: `max(0.5rem, env(safe-area-inset-bottom))` تعني على
           الآيفون **٣٤px حشواً كاملاً تحت الأيقونات** — وهو ارتفاعُ شريط
           الإيماءة نفسِه. **والشريطُ لا يحتاج أن يقف فوقه، يحتاج ألّا
           يُدفن تحته**: نصفُه يكفي فاصلاً، **والخلفيّةُ تمتدّ تحته كما
           كانت** فلا يظهر شقٌّ.
           ⚠️ **والأرضيةُ تبقى** (`0.375rem`) للمتصفّح حيث `env` صفر —
           **وشريطٌ ملاصقٌ للحافّة بلا هامشٍ يُقرأ مقصوصاً.** */
        className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[color:var(--divider)] bg-[color:var(--background)] backdrop-blur-xl pt-1.5 pb-[max(0.375rem,calc(env(safe-area-inset-bottom)*0.5))]"
        style={{ background: "color-mix(in srgb, var(--background) 76%, transparent)" }}
      >
        {TABS.map(({ href, key, icon }) => {
          const isSearch = key === "search";
          const active = isSearch ? searchOpen : isActive(href);
          /* **أيقونةٌ بلا كلمة** (D-258، طلبُ أحمد: «اخفِ الكلمات في
             الشريط السفلي واكتبها فوق»). **والاسمُ لم يُحذف بل انتقل**
             إلى منتصف الشريط العلويّ (`NavTitle`) — انظر حجّتَه هناك.

             **والمقاسُ ٢٥ لا ٢٣**: الأيقونةُ صارت وحدَها تحمل الخانة،
             **ورمزٌ ورث فراغَ كلمةٍ يجب أن يرث شيئاً من ثقلها** — وإلا
             قُرئ الشريطُ أنحفَ لا أنظف.

             ⚠️ **والاسمُ يبقى في `aria-label`**: ما سقط رسمُه لا يسقط
             نطقُه — **وشريطُ تنقّلٍ بخمسة أزرارٍ بلا أسماء لقارئ الشاشة
             خمسةُ أزرارٍ بلا معنى** (D-177: الرمزُ عُرفٌ يُقرأ بالعين،
             والمعنى في `aria-label`). */
          const face = (
            <span className="relative">
              <Icon
                name={icon}
                size={25}
                strokeWidth={active ? 2.2 : 1.7}
                style={{ color: active ? "var(--accent)" : "var(--disabled)" }}
              />
              {/* «هناك جديدٌ هناك» — وتسقط على التبويب المفتوح: أنت فيه */}
              {key === "people" && !active && peopleDot}
            </span>
          );
          /* **والحشوُ يعوّض ارتفاعَ السطر الذاهب**: هدفُ اللمس ٤٤px
             (D-033/D-168) **لا يُشترى بالنصّ بل يُكتب** — وخانةٌ بلا
             كلمةٍ وبحشوها القديم تصير ٣٤px.
             **و`py-2` لا `py-2.5`** (D-259): ٢٥+١٦ = ٤١px، **والأربعةُ
             والأربعون تكتمل بحشو الشريط العلويّ فوقها** — والخانةُ
             لا تُقاس وحدها. */
          const face_cls =
            "relative flex min-w-0 items-center justify-center rounded-2xl px-1 py-2 transition active:bg-surface-2";

          // البحث يفتح ورقةً في مكانه؛ وبقية التبويبات وجهاتٌ تُزار
          return isSearch ? (
            <button
              key={href}
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-expanded={searchOpen}
              aria-haspopup="dialog"
              aria-label={label[key]}
              title={label[key]}
              className={face_cls}
            >
              {face}
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label[key]}
              title={label[key]}
              className={face_cls}
            >
              {face}
            </Link>
          );
        })}
      </nav>

      {/* الورقة خارج الشريط عمداً: الشريط `z-40` ويصنع سياق تكديسٍ يحبس
          ما بداخله — فورقةٌ بداخله لا تعلو غيرها مهما رُفع رقمها */}
      {searchOpen && (
        <TitleSearchSheet onClose={() => setSearchOpen(false)} locale={locale} />
      )}
    </>
  );
}
