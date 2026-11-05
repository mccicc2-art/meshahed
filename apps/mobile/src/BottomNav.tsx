import React from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { dockArea, dockPressIn, dockTouched, tabGone, tabPressed } from "./perfMarks";
import { Pressable, View, type ViewInstance } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { Text } from "./ui";
import { Icon, type IconName } from "./icons";
import { radius } from "./theme";
import { dockOf, useDockVersion } from "./navDock";

/**
 * ====== الشريطُ السفليُّ في الشاشات الأصليّة — D-961 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد بتسجيل**: «أضف شريطاً في الأسفل إذا دخلت المكتبة أو اكتشف».
 * **والعلّةُ في التسجيل ظاهرة**: كلُّ صفحةٍ ويبيّةٍ تحمل الشريطَ الخماسيَّ،
 * **والشاشتان الأصليّتان وحدَهما بلا شريط** — فمن دخل المكتبة صار مخرجُه الوحيد
 * سهمَ الرجوع، **وتطبيقٌ يفقد شريطَه في شاشتين يُقرأ مكسوراً لا أصليّاً.**
 *
 * 🔑 **والوصفةُ وصفةُ `BottomNav.tsx` (الويب) لا تصميمٌ ثانٍ** (القاعدة ٣):
 * خمسُ خاناتٍ متساوية العرض · حافّةٌ عليا مستديرة ٢٢ (`radius.sheet`) وخطُّ
 * `divider` · رمزٌ ٢٤ ممتلئٌ للنشط ومفرَّغٌ لغيره · كلمةٌ ١٠ تحته ·
 * **لونان لا خمسة**: النشطُ `accent` والخاملُ `disabled` (D-142: اللونُ وحدَه لا
 * يكفي، فالكلمةُ تحته والرمزُ يمتلئ). **والأسماءُ من القاموس نفسِه**
 * (`navHome`/`navLibrary`/`navNews`/`navPeople`/`navSearch`) — لا نصَّ ثانٍ.
 *
 * ⚠️ **وما سقط من الويب عمداً**: **الضبابُ** (`backdrop-blur`) — لا مكتبةَ
 * ضبابٍ في التطبيق، **وإضافةُ تبعيّةٍ لأجل زجاجيّةٍ خلف شريطٍ ثمنٌ بلا مكسب**؛
 * الخلفيّةُ لونُ الأرضيّة صمّاء كما هو احتياطُ الويب نفسِه حين لا يُفهم
 * `color-mix`. **وشارةُ «جديد» ليست هنا** كما ليست هناك (D-392).
 *
 * 🔑 **والارتفاعُ يُقاس لا يُخمَّن**: حشوٌ علويٌّ ١٠ + خانةٌ ٥٦ (٨ + رمزٌ ٢٤ +
 * فجوةٌ ٤ + كلمةٌ ١٢ + ٨) = ٦٦، **وتحتها نصفُ منطقة الأمان بأرضيّةِ ٦** —
 * وصفةُ D-259 حرفاً: **الشريطُ لا يقف فوق شريط الإيماءة، يكفيه ألّا يُدفن
 * تحته.** `navHeight()` يصدّرها **لأنّ من يرسم تحته يحتاج رقمَه** — وذيلُ
 * التمرير يزيد بمقدارها وإلّا اختفى آخرُ صفٍّ خلفه (درسُ الويب في `layout`).
 */
export type NavKey = "home" | "library" | "news" | "people" | "search";

const TABS: { key: NavKey; icon: IconName; on: IconName }[] = [
  { key: "home", icon: "home", on: "home-filled" },
  { key: "library", icon: "library", on: "library-filled" },
  { key: "news", icon: "compass", on: "compass-filled" },
  { key: "people", icon: "people", on: "people-filled" },
  { key: "search", icon: "search", on: "search-filled" },
];

/** المهمّة ٣٢١ — الحشوةُ العلويّة للشريط، داخلَ الخانات لا حولها */
const DOCK_PAD_TOP = 10;

/** ارتفاعُ الشريط بأرضيّته — يقرؤه ذيلُ التمرير والإشعارُ فوقه */
export function navHeight(insetBottom: number) {
  return 66 + Math.max(6, insetBottom * 0.5);
}

export function BottomNav({ active, onGo, shell = false }: { active: NavKey; onGo: (key: NavKey) => void; /** 🆕 11-M · M1 — شريطُ الغلاف فوق الويب: «المجتمع» يمرّ بـ`onGo` (نزعُ الباب قبل الانتقال) */ shell?: boolean }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const label: Record<NavKey, string> = {
    home: t.navHome,
    library: t.navLibrary,
    news: t.navNews,
    people: t.navPeople,
    search: t.navSearch,
  };
  /* 🩺 R57 — `dock.miss`: الشريطُ المركَّزُ يعلن كيف يُقاس أعلاه في النافذة (ويسحبه حين يغيب) — فلمسةٌ تحته لم تصل زرّاً تُعرف */
  const navRef = React.useRef<ViewInstance>(null);
  useFocusEffect(
    React.useCallback(() => {
      /* 🆕 المهمّة ٣١٩ — والارتفاعُ معها: `dock.miss` يكتب موضعَ النقرة من الحافّة (`dy`) نسبةً إليه */
      dockArea((cb) => navRef.current?.measureInWindow((_x, y, _w, h) => cb(Math.round(y), Math.round(h))));
      return () => dockArea(null);
    }, []),
  );
  /* المهمّة ٣٢١ — الحشوتان كما كانتا على الحاوية، تُضافان الآن إلى كلِّ خانة */
  const padBottom = Math.max(6, insets.bottom * 0.5);
  return (
    <View
      ref={navRef}
      onTouchStart={dockTouched}
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: tokens.divider,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        backgroundColor: tokens.bg,
        /* 🆕 المهمّة ٣٢١ (تقييمُ ٥ نوفمبر ٢ب) — **الحشوةُ صارت داخل الأزرار لا حولها**: قياسُ R178 — ١٣ نقرةً ميتةً من ١٣ وقعت
           في ذيل الشريط (النقطة ٦٥–٧٤ من ارتفاع ٨٢ على الآيفون، ٧٤ من ٧٧ على أندرويد) تحت أسماء التبويبات، حيث كانت الحشوةُ
           السفلى (`insets.bottom × 0.5` ≈ ١٧ على الآيفون) ملكَ الشريط لا ملكَ زرّ. والعلويّةُ (١٠) كذلك. الآن تحملها الخاناتُ
           نفسُها فارتفاعُ الشريط كلُّه زرّ — والمقاساتُ والمواضعُ كما هي حرفاً (`navHeight` لم يتغيّر).
           ⚠️ آخرُ النقاط على الآيفون فوق شريط العودة للشاشة الرئيسيّة: النظامُ قد يأخذ بعضَ ما يقع هناك مهما فعلنا */
      }}
    >
      {TABS.map((tb) => {
        const on = tb.key === active;
        const color = on ? tokens.accent : tokens.disabled;
        return (
          <Pressable
            key={tb.key}
            onPressIn={dockPressIn}
            onPress={() => {
              tabPressed(tb.key, active);
              /* 🆕 11-M · M1 — «المجتمع» جذرٌ أصليٌّ خامس (D-1171): من أيِّ جذرٍ تبديلٌ إلى تبويبه الحيّ كأخواته،
                 في مكانٍ واحدٍ لا في كلِّ جذر. الغلافُ (`shell`) يمرّره لأنّ عليه نزعَ الباب قبل الانتقال */
              if (tb.key === "people" && !shell && active !== "people") {
                router.navigate("/community");
                tabGone();
                return;
              }
              onGo(tb.key);
              /* D-1208 — مرحلةُ `go`: كم أخذ نداءُ التنقّل نفسُه قبل أن يعود */
              tabGone();
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label[tb.key]}
            /* خاناتٌ متساويةُ العرض بشبكةٍ لا بحشوٍ لكلِّ خانة (حجّةُ الويب: «المجتمع» ضِعفا «بحث») */
            style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8 + DOCK_PAD_TOP, paddingBottom: 8 + padBottom }}
          >
            <Icon name={on ? tb.on : tb.icon} size={24} color={color} />
            <Text size={10} weight="600" numberOfLines={1} color={color}>{label[tb.key]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** مسارُ كلِّ خانةٍ في مجموعة التبويبات — احتياطُ `TabDock` حين لم يسجّل الجذرُ سلوكَه بعد */
const ROOT_PATH = { home: "/home", library: "/library", news: "/discover", people: "/community", search: "/search" } as const;

/**
 * 🆕 D-1277 — **الشريطُ الواحد فوق التبويبات** (الحجّةُ والقياسُ في `navDock.tsx`): يرسمه المتنقّلُ في `tabBar`
 * مرّةً، والخانةُ المضيئةُ من حالته — فلا يُعاد تركيبُ الشريط ولا رموزه عند التبديل.
 *
 * - **مطلقُ الموضع** كما كان في كلِّ جذر: المشهدُ يبقى بطول الشاشة والمحتوى يمرّ تحته بذيله (`navHeight`).
 * - **`hidden`** قيمةُ الكسوة الذكيّة للجذر الظاهر (D-966) — يهبط الشريطُ بارتفاعه كما كان يهبط شريطُ الجذر.
 * - **`locked`** الجذرُ يغادر إلى باب (D-951): الشريطُ لا يستقبل ضغطة.
 * - **الضغطُ** يقرأ `onGo` الجذرِ الظاهر لحظتَها؛ وإن لم يُسجَّل (حالةُ تحميلٍ بلا شريطٍ سابقاً) فتبديلٌ عامّ.
 */
export function TabDock({ active }: { active: NavKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useDockVersion();
  const dock = dockOf(active);
  const navH = navHeight(insets.bottom);
  /* 🆕 D-1629 — الكسوةُ قيمةٌ مشتركة (`ChromeHide`): الشريطُ يهبط بها على Reanimated فموضعُ اللمس هو موضعُ الرسم.
     جذرٌ بلا كسوةٍ (أو قبل أن يسجّل) يقرأ صفراً ثابتاً */
  const still = useSharedValue(0);
  const hidden = dock?.hidden ?? still;
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: hidden.value * navH }] }), [hidden, navH]);
  return (
    <Reanimated.View
      pointerEvents={dock?.locked ? "none" : "box-none"}
      style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, motion]}
    >
      <BottomNav
        active={active}
        onGo={(k) => {
          const own = dockOf(active)?.onGo;
          if (own) return own(k);
          if (k !== active) router.navigate(ROOT_PATH[k]);
        }}
      />
    </Reanimated.View>
  );
}
