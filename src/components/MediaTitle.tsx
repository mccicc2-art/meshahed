import type { ResolvedTitle } from "@/core/titleMode";

/**
 * **اسمُ العمل كما يُرسم — مكوّنٌ واحدٌ لكلِّ سطح** (D-544، شرطُ
 * المواصفة: «أنشئ دالّةً أو مكوّناً مركزيّاً… واستخدمه في جميع الصفحات
 * والكاردات»).
 *
 * **والقسمةُ بين هذا و`resolveMediaTitle` قسمةُ معنًى:** **تلك تقرّر
 * أيَّ اسمٍ يُقال** (منطقٌ خالصٌ يُختبر بلا متصفّح)، **وهذا يقرّر كيف
 * يُكتب** (سطران، مقاسان، اتّجاهٌ ولغة). **ودمجُهما كان سيجعل كلَّ
 * اختبارِ منطقٍ يحتاج DOM.**
 *
 * ⚠️ **ولا `"use client"`**: مكوّنٌ نقيٌّ بلا حالةٍ ولا مستمع —
 * **يقرؤه الخادمُ في `PosterCard` والعميلُ في شبكة المكتبة**، ولا يعرف
 * أيُّهما ناداه (نمطُ `StatusThread`، D-322).
 *
 * ⚠️ **و`dir="auto"` على كلِّ سطرٍ على حدة لا على الغلاف**: **السطران
 * قد يفترقان اتّجاهاً** — «صراع العروش» فوق «Game of Thrones» —
 * **واتّجاهٌ واحدٌ للاثنين يرمي علامةَ الترقيم إلى الطرف الخطأ.**
 * **و`lang` يُشتقّ من الحروف لا من لغة الواجهة**: نطقُ قارئِ الشاشة
 * لـ«Game of Thrones» في صفحةٍ `lang="ar"` عربيٌّ مكسور.
 */

const ARABIC = /[؀-ۿݐ-ݿ]/;

/** **لغةُ السطر من حروفه** — لا من لغة الصفحة */
function langOf(s: string): "ar" | "en" {
  return ARABIC.test(s) ? "ar" : "en";
}

export function MediaTitle({
  title,
  className = "",
  secondaryClassName = "",
  as: Tag = "span",
}: {
  /** ناتجُ `resolveMediaTitle` — **لا نصٌّ خام**: السطرُ الثاني قرارُها لا قرارُ الرسم */
  title: ResolvedTitle;
  className?: string;
  /** **مقاسُ السطر الثاني يقرّره المستدعي**: بطاقةُ ملصقٍ ليست ترويسةَ عمل */
  secondaryClassName?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}) {
  const { primary, secondary } = title;

  /* **وبلا سطرٍ ثانٍ لا غلافَ ولا عنصرَ زائد**: ثلاثةُ أوضاعٍ من أربعة
     تعيد سطراً واحداً، **وغلافٌ يُرسم لأجل حالةٍ رابعة يزيد عقدةً في
     كلِّ بطاقةٍ في التطبيق** (ولشبكةِ ستّين بطاقةً ثمنٌ مقيس). */
  if (!secondary) {
    return (
      <Tag dir="auto" lang={langOf(primary)} className={className}>
        {primary}
      </Tag>
    );
  }

  return (
    <Tag className={className} dir="auto" lang={langOf(primary)}>
      {primary}
      <span
        dir="auto"
        lang={langOf(secondary)}
        className={`block font-normal text-muted ${secondaryClassName || "text-[10px] leading-tight mt-0.5"}`}
      >
        {secondary}
      </span>
    </Tag>
  );
}
