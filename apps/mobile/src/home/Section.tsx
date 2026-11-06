import React, { useCallback, useRef } from "react";
import { I18nManager, Platform, Pressable, ScrollView, View, type ScrollViewInstance, type TextStyle } from "react-native";
import { useApp } from "../state";
import { Text, firstStrongRtl } from "../ui";
import { Icon, type IconName } from "../icons";

/**
 * قسمُ الرئيسية — نظيرُ `PosterRail`/`Section` في `app/page.tsx` (Phase 11-H · H2):
 * رأسٌ (رمزٌ بالتمييز · عنوانٌ هو بابُ الصفّ · أداةٌ · «الكلّ») ثمّ صفٌّ أفقيٌّ
 * يُمرَّر في البصريّ، أو عمودٌ من الصفوف في المختصر (D-439: المحتوى واحد،
 * الشكلُ وحدَه يتبدّل). الفراغُ بين الأقسام ٢٦ (`Gap`) والعنوانُ ٢٠/٧٠٠.
 *
 * ⚖️ D-863/D-868 — رأسٌ فيه «الكلّ» واحدة: الأداةُ (زرُّ الترتيب) و«الكلّ»
 * يجتمعان، **ولا يجتمع بابُ ورقةٍ مع رابطٍ بالكلمة نفسِها.**
 */
export const PAGE_PAD = 16;
export const RAIL_GAP = 12;
/* عرضُ بطاقة «تابِع المشاهدة» (١٨٤ — D-1278) انتقل إلى `posterSizes.ts` مع مقاسات الملصق (D-1379) */

/**
 * 🆕 T332 — **العنوانُ الإنجليزيّ على خطّ أيقونته في أندرويد** (أحمد ٦ نوفمبر بلقطة خالد: «الكلام جاي أعلى من الأيقونة»):
 * أندرويد يحشو صندوقَ النصّ بحدودِ رسمِ الخطّ (`includeFontPadding`)، وحدودُ Poppins غيرُ متناظرة (فوق ١١٠٨ · تحت ٦٠٦ من ١٠٠٠
 * مقابلَ صعودٍ ١٠٥٠ وهبوطٍ ٣٥٠)، فيتوسّط الصفُّ الصندوقَ ويقع جسمُ الحرف فوقه — قيس في اللقطة ٥ بكسل (≈٢ نقطة) في كلّ عنوان.
 * بلا الحشوة يقع مركزُ الحروف على مركز الصندوق (فرقٌ دون ٠٫٣ نقطة). **العربيُّ لا يُمسّ**: أحمد رآه ممتازاً، ونقاطُ Tajawal
 * تعلو فوق صعوده (D-1499) فتُقصّ بلا حشوة. والآيفون لا يعرف هذه الحشوة أصلاً.
 */
export function latinTitleFit(title: string): TextStyle | undefined {
  return Platform.OS === "android" && firstStrongRtl(title) === false ? { includeFontPadding: false } : undefined;
}

export function SectionHeader({
  title,
  icon,
  accent = true,
  onTitle,
  action,
  seeAll,
  seeAllLabel,
  onSeeAll,
}: {
  title: string;
  icon?: IconName;
  /** رمزٌ بلون التمييز (أقسامُ الرئيسية) أو باهتٌ (الرائج) */
  accent?: boolean;
  onTitle?: () => void;
  action?: React.ReactNode;
  seeAll?: string;
  /** ما يُقرأ للقارئ الصوتيّ حين تختلف الكلمةُ المرئيّة عن الفعل — `QueueOrderButton` الويب: يُرى «الكل» ويُقرأ «أعد الترتيب» */
  seeAllLabel?: string;
  onSeeAll?: () => void;
}) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, paddingHorizontal: PAGE_PAD }}>
      <Pressable onPress={onTitle} disabled={!onTitle} accessibilityRole={onTitle ? "link" : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        {icon ? <Icon name={icon} size={20} color={accent ? tokens.accent : tokens.muted} /> : null}
        {/* D-1378 — عنوانُ القسم ٢٢ ⇐ ٢٠ (أحمد ١٢ أكتوبر، بلقطتين على جهاز خالد): كان أكبرَ ما في الصفحة فطغى على البطاقات تحته.
            (١٨ أوّلاً ثمّ ٢٠ بعد جدول الدرجات — أحمد «اعتمد ٢٠»). الرقمُ نفسُه في «أسبوعك» (`WeekStrip`) وعناوين حالات المكتبة وقوائمها */}
        <Text size={20} weight="700" numberOfLines={1} style={[{ flexShrink: 1 }, latinTitleFit(title)]}>
          {title}
        </Text>
      </Pressable>
      {action || (seeAll && onSeeAll) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {action}
          {seeAll && onSeeAll ? (
            <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={seeAllLabel}>
              <Text size={12} weight="500" muted>{seeAll}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** الصفُّ الأفقيّ — حشوةُ الصفحة في الطرفين، والفجوةُ ١٢ كالويب (`gap-3`) */
export function Rail({ children }: { children: React.ReactNode }) {
  /* 🆕 D-1459 — **في الآيفون بالعربيّ يبدأ الصفُّ من أوّل بطاقةٍ في كلِّ تركيب** (تسجيلُ أحمد ١٨ أكتوبر): تبديلُ
     «مختلط ⇄ بصريّ» يشيل الصفَّ ويركّبه من جديد، فيفتح «أكمل المشاهدة» من آخره (Detective Conan) ويضطرّ المستخدمُ
     يسحب إلى Fargo. الفتحةُ الأولى سليمة، فالعطلُ في التركيب الثاني لا في الترتيب.
     ⚠️ **لماذا `scrollToEnd` لا `scrollTo({ x: 0 })`**: Fabric في iOS يقلب الصفَّ بالعربيّ (scaleX ‎-1) ويحوّل الإزاحة:
     JS ‏x = عرضُ المحتوى − عرضُ الإطار − الإزاحةُ الأصليّة. فبدايةُ الصفِّ المرئيّة (يمين) هي «النهاية» في إحداثيّات
     JS، و`x: 0` هو الطرفُ الأيسر — أي العطلُ نفسُه. في الصفِّ السليم الأمرُ لا يحرّك شيئاً.
     مرّةً واحدةً لكلِّ تركيب: تحديثُ البيانات بعدها لا يسحب صفّاً حرّكه المستخدم. الأندرويد والإنجليزيّ كما هما. */
  const ref = useRef<ScrollViewInstance>(null);
  const pinned = useRef(false);
  const pinStart = useCallback((w: number) => {
    if (pinned.current || w <= 0) return;
    pinned.current = true;
    ref.current?.scrollToEnd({ animated: false });
  }, []);
  const rtlIos = Platform.OS === "ios" && I18nManager.isRTL;
  /* 🆕 D-1597 — **التباطؤُ الطبيعيّ كصفوف المكتبة** (تسجيلُ أحمد ٣٠ أكتوبر: «ليه وقت التمرير ماهي ناعمه وتتزحلق مثل المكتبة؟»):
     كان الصفُّ بـ`decelerationRate="fast"` فيقف لحظةَ رفع الإصبع؛ صفوفُ المكتبة على الافتراضيّ فتنساب وتهدأ. لا التقاطَ للبطاقات
     هنا يبرّر «سريع» — فالصفُّ الأفقيُّ في التطبيق يتحرّك بإحساسٍ واحد */
  return (
    <ScrollView ref={ref} onContentSizeChange={rtlIos ? pinStart : undefined} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: RAIL_GAP }}>
      {children}
    </ScrollView>
  );
}

/** العمودُ المختصر — `space-y-2` كالويب */
export function Column({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>{children}</View>;
}

/**
 * الفراغُ بين الأقسام (D-467).
 * 🆕 D-1615 — ١٢ ⇐ ٢٦ (≈٢٨ مرئيّة) مع عنوانٍ أقرب إلى محتواه (٦ ⇐ ٨ تحت العنوان ≈١٠ مرئيّة) — أحمد «٣ أ»: كان ما بين
 * قسمين (~١٤) قريباً ممّا بين العنوان وقسمه (~٩) فلا يُعرف أيُّ عنوانٍ لأيِّ صفّ.
 * 🆕 T320 — ٢٦ ⇐ ١٦ (خالد ٥ نوفمبر، بأربع صورٍ على لقطته: ٢٦ · ١٦ · ١٢ · ٨ — «١٦»): الفراغُ كان واسعاً فقلّ ما يُرى في الشاشة.
 * ١٦ يبقى ضعفَ ما تحت العنوان (٨) فيُعرف أيُّ عنوانٍ لأيِّ صفّ — ولهذا رُفض ١٢ و٨ وهما يعيدان عطلَ D-1615 —
 * ويساوي ما بين بطاقة الأرقام وأوّل قسم (١٦، `HomeScreen`) فالصفحةُ كلُّها بمسافةٍ واحدة. الرئيسيّةُ وحدَها تستعمله.
 * ↩️ T333 — **رجع ٢٦** (أحمد ٦ نوفمبر: «نرجعه ٢٦ — بعطيه فرصة أخيرة»): ١٦ لم يُرضِه على الجهاز، فعاد الرقمُ الذي كان قبل T320.
 * ما بين بطاقة الأرقام وأوّل قسم يبقى ١٦ كما كان قبل T320 وبعده. لا تُغيّره بلا كلمةٍ من أحمد.
 */
export function Gap({ size = 26 }: { size?: number }) {
  return <View style={{ height: size }} />;
}
