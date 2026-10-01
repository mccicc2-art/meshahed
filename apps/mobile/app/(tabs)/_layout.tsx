import React, { useEffect } from "react";
import { InteractionManager } from "react-native";
import { Tabs, router } from "expo-router";
import { useApp } from "../../src/state";
import { rootsMounted } from "../../src/bootRoot";
import { queryClient } from "../../src/api";
import { tabPreloaded, tabSeen } from "../../src/perfMarks";

/** مهلةٌ بعد وصول بيانات «اكتشف» المسخَّنة: بقيّةُ الصفوف تصل غالباً، فيُركَّب التبويبُ ببياناتٍ لا بهياكل */
const PRELOAD_AFTER_WARM_MS = 1200;
const PRELOAD_FALLBACK_MS = 6000;

/**
 * 🆕 D-1229 — **تبويبُ «اكتشف» يُركَّب مسبقاً لا بياناتُه فقط**. أرقامُ ١ أكتوبر: أوّلُ زيارةٍ له في الجلسة ~٢٤٠ms
 * وسيطاً (`cached=0`: ٣–٤ رسماتِ جذر · لوحتان · ١٠ صفوف · ٣٠–٤٠ بطاقة تُبنى على خيط JS بعد اللمس) والدافئةُ ~١٧٥.
 * والجلسةُ تبدأ من جديدٍ مع كلِّ تحديثٍ هوائيّ، فالبارد ليس نادراً.
 * 🔑 **الإشارةُ وصولُ `discover:view`** الذي يجلبه `warmDiscoverOnce` بعد أن تهدأ الرئيسيّة — فالتركيبُ لا يسبق
 * الرئيسيّة ولا ينافسها، ومن فتح «اكتشف» بنفسه أوّلاً لا يُركَّب له شيء (`tabSeen`).
 * 🔑 **`router.prefetch`** (إجراءُ `PRELOAD` في React Navigation 7): الشاشةُ تُرسم مخفيّةً **ولا تُجمَّد**
 * (`shouldFreeze` يستثني المركَّبَ مسبقاً) **ولا يُطلق تركيزاً** — فالتجديدُ عند الظهور وزرُّ الرجوع لا يعملان قبل الزيارة.
 * ⚖️ الكلفةُ (~٢٠٠ms على خيط JS) تُدفع مرّةً بعد `runAfterInteractions` — لا أثناء تمريرٍ أو لمس.
 */
let preloadArmed = false;
function usePreloadDiscover() {
  useEffect(() => {
    if (preloadArmed) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (preloadArmed) return;
      preloadArmed = true;
      unsub();
      timer = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          if (tabSeen("news")) return;
          tabPreloaded("news");
          router.prefetch("/discover");
        });
      }, PRELOAD_AFTER_WARM_MS);
    };
    const unsub = queryClient.getQueryCache().subscribe((e) => {
      if (e.type === "updated" && e.action.type === "success" && e.query.queryKey[0] === "discover:view") fire();
    });
    /* البياناتُ قد تكون طازجةً من الكاش المحفوظ فلا يجلبها التسخينُ ولا يصل حدث — مهلةٌ احتياطيّة تكفي الرئيسيّةَ لتهدأ */
    const fallback = setTimeout(fire, PRELOAD_FALLBACK_MS);
    return () => {
      unsub();
      clearTimeout(fallback);
      if (timer) clearTimeout(timer);
    };
  }, []);
}

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
  usePreloadDiscover();
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
      {/* 🆕 11-M · M1 — الجذرُ الخامس (D-1168) */}
      <Tabs.Screen name="community" />
    </Tabs>
  );
}
