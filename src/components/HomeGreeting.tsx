"use client";

import { useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/lib/i18n";

/* الساعةُ مصدرٌ خارجيٌّ عن React — **ولهذا `useSyncExternalStore` لا
   `useEffect`+`setState`**: الثاني يُصيّر مرّتين ويكتب حالةً في جسد
   التأثير (وهو ما يمنعه لِنترُ المشروع بحقّ)، **والأوّل يقول للخادم
   `null` وللمتصفّح الساعةَ في نفس النداء** فلا اختلافَ ترطيب.
   ⚠️ **ولا اشتراكَ لأنها لا تُبثّ**: التحيّةُ تُقرأ عند الفتح،
   **ومن أبقى الصفحةَ مفتوحةً حتى الغروب لا ينتظر تحيّةً تتبدّل تحت
   عينه.** والدالّتان خارج المكوّن كي تبقيا ثابتتين بين التصييرات. */
const subscribeNever = () => () => {};
const clientHour = () => new Date().getHours();
const serverHour = (): number | null => null;

/**
 * تحيّةُ الرئيسية — «مساء الخير، أحمد» (D-434).
 *
 * **ولماذا في العميل والصفحةُ كلُّها خادميّة:** التحيّةُ تتبع ساعةَ
 * **القارئ** لا ساعةَ الخادم، **والخادمُ لا يعرف منطقةَ وقتِه** — فتحيّةٌ
 * تُحسب هناك تقول «مساء الخير» لمن يفطر. **ولا نطلب منه إعدادَ منطقة:**
 * سطرٌ واحدٌ في المتصفّح يعرفها مجّاناً.
 *
 * **والسطرُ الأوّل يُرسم بتحيّةٍ محايدة** («أهلاً») ثم يتبدّل بعد
 * الترطيب: **اسمُك — وهو المهمّ — مرسومٌ من الخادم بلا انتظار**،
 * والذي يتأخّر كلمةٌ واحدةٌ لا كتلة. **ولا تحيّةَ مخمَّنةً على الخادم**
 * لأنها كانت ستُخالف ما يرسمه العميل فيومض السطر (اختلافُ ترطيب).
 */
export function HomeGreeting({
  name,
  locale,
}: {
  name: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const hour = useSyncExternalStore(subscribeNever, clientHour, serverHour);

  const word =
    hour == null
      ? t.greetNeutral
      : hour < 12
        ? t.greetMorning
        : hour < 17
          ? t.greetAfternoon
          : hour < 23
            ? t.greetEvening
            : t.greetNight;

  return (
    /* 🆕 **١٥ بدل ١٧** (D-451، طلبُ أحمد على لقطة: «صغّر الخط»):
       **التحيّةُ ترحيبٌ لا عنوانُ صفحة** — والعنوانُ الحقيقيُّ لهذه
       الشاشة هو أوّلُ رفٍّ تحتها. **وسطرٌ بحجم العناوين يتنافس معها.** */
    <p className="min-w-0 truncate text-[15px] leading-tight">
      <span className="text-muted">{word}</span>
      <span className="text-muted">{locale === "ar" ? "، " : ", "}</span>
      {/* 🆕 **٧٠٠ لا ٨٠٠** (D-459): **وزنٌ ثامنُ مئةٍ لا يظهر إلا هنا**،
          وكلُّ غليظٍ في الصفحة ٧٠٠ — **ووزنٌ لكلمةٍ واحدةٍ استثناءٌ لا
          درجة.** */}
      <span className="font-bold">{name}</span>
    </p>
  );
}
