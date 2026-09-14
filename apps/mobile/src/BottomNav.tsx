import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { Text } from "./ui";
import { Icon, type IconName } from "./icons";
import { radius } from "./theme";

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

/** ارتفاعُ الشريط بأرضيّته — يقرؤه ذيلُ التمرير والإشعارُ فوقه */
export function navHeight(insetBottom: number) {
  return 66 + Math.max(6, insetBottom * 0.5);
}

export function BottomNav({ active, onGo }: { active: NavKey; onGo: (key: NavKey) => void }) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const label: Record<NavKey, string> = {
    home: t.navHome,
    library: t.navLibrary,
    news: t.navNews,
    people: t.navPeople,
    search: t.navSearch,
  };
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: tokens.divider,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        backgroundColor: tokens.bg,
        paddingTop: 10,
        paddingBottom: Math.max(6, insets.bottom * 0.5),
      }}
    >
      {TABS.map((tb) => {
        const on = tb.key === active;
        const color = on ? tokens.accent : tokens.disabled;
        return (
          <Pressable
            key={tb.key}
            onPress={() => onGo(tb.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label[tb.key]}
            /* خاناتٌ متساويةُ العرض بشبكةٍ لا بحشوٍ لكلِّ خانة (حجّةُ الويب: «المجتمع» ضِعفا «بحث») */
            style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 }}
          >
            <Icon name={on ? tb.on : tb.icon} size={24} color={color} />
            <Text size={10} weight="600" numberOfLines={1} color={color}>{label[tb.key]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
