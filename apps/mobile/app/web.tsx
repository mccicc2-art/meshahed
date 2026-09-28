import React from "react";
import { View } from "react-native";
import { SHELL_BG } from "../src/theme";

/**
 * ====== `/web` — مكانُ الطبقة في المكدّس (🆕 K3b) ======
 *
 * كانت هذه الشاشةُ الـWebView نفسَه (D-922)، جذرَ المكدّس تحت كلِّ شاشةٍ أصليّة. **الـWebView الآن طبقةٌ فوق المكدّس**
 * (`src/WebLayer.tsx`، تُرسم في `app/_layout.tsx`)، وهذا المسارُ باقٍ لثلاثة: قاعدةُ المكدّس (ما يعود إليه آخرُ رجوع) ·
 * العنوانُ الذي تصل عليه روابطُ الودجت (`/web?u=/show/123` — تقرؤه الطبقةُ من العنوان المعروض) · وأعلى المكدّس
 * `web` يعني «الطبقةُ هي الشاشة» (`webLayer.visibleFor`). لا يرسم إلّا لونَ الغلاف تحت الطبقة.
 */
export default function Web() {
  return <View style={{ flex: 1, backgroundColor: SHELL_BG }} />;
}
