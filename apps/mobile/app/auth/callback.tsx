import React, { useEffect } from "react";
import { View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SHELL_BG } from "../../src/theme";
import { mark } from "../../src/perfMarks";

/**
 * عنوانُ الرجوع `com.loopztv.app://auth/callback`.
 * التبديلُ الفعليّ (`code` ⇢ جلسة) يقع في `signInWithGoogle` حين يعود
 * المتصفّح؛ هذه الشاشةُ لا تفعل شيئاً سوى ألّا تُفسد ذلك.
 *
 * 🔴 D-1158 — **ترجع ولا تحوّل** (مِجسُّ D-1157، ٢٧ سبتمبر: أوّلُ دخولٍ بعد كلِّ خروجٍ يرتدّ إلى الترحيب):
 * الموجِّهُ يلتقط رابطَ الرجوع هو أيضاً فيدفع هذه الشاشة، وكانت تحوّل إلى `/` ⇢ `/web` — **فتُركَّب شاشةُ
 * ويبٍ ثانية بـWebView جديدة فوق الأولى**، تحمّل `/` فوراً بلا كوكي (لم يصل التسليمُ بعد) فترسم الترحيبَ
 * للزائر، بينما التسليمُ الناجحُ يجري في الـWebView القديمة المدفونة تحتها. في المحاولة الثانية الكوكي موجودٌ
 * سلفاً فتنجح أيُّ شاشة — لذلك «مرّتان». الآن: تحتها شاشةٌ (الدخولُ بدأ منها) ⇐ رجوعٌ إليها، ولا شاشةَ ثانية.
 * ⚖️ **والتحويلُ القديمُ باقٍ حين لا شيءَ تحتها** — تطبيقٌ قتله أندرويد أثناء نافذة Google فعاد بالرابط وحدَه.
 */
export default function AuthCallback() {
  const router = useRouter();
  const canBack = router.canGoBack();
  useEffect(() => {
    /* 🧪 D-1159 — هل فُتحت هذه الشاشةُ أثناء الدخول، وماذا فعلت؟ (قياسٌ مؤقّت) */
    mark("auth.callback", 0, { result: canBack ? "back" : "redirect" });
    if (canBack) router.back();
  }, [canBack, router]);
  if (!canBack) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: SHELL_BG }} />;
}
