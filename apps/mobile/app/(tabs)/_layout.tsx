import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { useApp } from "../../src/state";
import { rootsMounted } from "../../src/bootRoot";

/**
 * ====== K3 — الجذورُ الأربعة تبويباتٌ ثابتة (Phase 11-K) ======
 *
 * **لماذا**: كان التبديلُ بين الرئيسيّة والمكتبة واكتشف والبحث `router.replace` (D-1074) — الشاشةُ القديمة تُهدم
 * والجديدةُ تُبنى من الصفر عند كلِّ ضغطة: صناديقُ الملصقات فارغةً ثمّ تتلاشى الصورُ إليها (تسجيلا خالد، ٢٨ سبتمبر)،
 * ويضيع موضعُ التمرير والتبويبُ الفرعيّ. الآن كلُّ جذرٍ يُبنى أوّلَ ما يُفتح (`lazy`) ثمّ **يبقى مركَّباً ومجمَّداً**
 * وهو مخفيّ (`freezeOnBlur` — لا يرسم ولا يستهلك)، والضغطةُ انتقالٌ إلى تبويبٍ حيّ.
 *
 * 🔑 **الشريطُ هو `BottomNav` نفسُه** كما يرسمه كلُّ جذرٍ اليوم — لا شريطَ ثانياً (القاعدة ٣): شريطُ هذا المتنقّل
 * مخفيّ (`tabBar` لا شيء) وهو هنا للإبقاء على الشاشات لا لرسمها.
 * 🔑 **الرجوعُ ليس للمتنقّل** (`backBehavior: "none"`): كلُّ جذرٍ يملك زرَّ الرجوع وهو ظاهر (`useBootRoot`) —
 * و`router.back()` منه ينزع المجموعةَ كلَّها فيكشف ما تحتها (الويبَ) كما كان.
 */
export default function TabsLayout() {
  const { tokens } = useApp();
  /* مجموعةٌ جديدةٌ فوق الويب ⇒ لم تُزر الرئيسيّةُ فيها بعد (انظر `bootBack`) */
  useEffect(() => rootsMounted(), []);
  return (
    <Tabs
      backBehavior="none"
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        animation: "none",
        sceneStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
