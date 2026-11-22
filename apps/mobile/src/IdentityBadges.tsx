import React from "react";
import { Platform, Pressable, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useApp } from "./state";
import { haptic } from "./haptics";
import { Text } from "./ui";
import { hasGoldBadge, isAiPersona, isFounder, isPartner, isPlus, isVerified, type PlanBearer } from "@/core/plan";

/**
 * ====== شاراتُ الهويّة — مكوّنٌ واحدٌ للتطبيق كلِّه (D-1134 → D-1142) ======
 *
 * **شكلُ الويب نفسُه** (`AccountIdentity.tsx`: `PlanPill` ثمّ `VerifiedBadge`) بقاعدة الطبقة نفسِها
 * (`@/core/plan`): قرصٌ «PARTNER»/«PLUS» ثمّ ختمُ التوثيق الذهبيّ.
 *
 * 🔴 **D-1142 — كان في رأس الرئيسيّة وحدَه** (D-1134)، وبطاقةُ الإعدادات بقيت على الشكلين القديمين (خطُّ ✓
 * رفيعٌ وقرصُ «+») — أحمد بتسجيل: «خلّي الصح والبارتنر بالشكل الصحيح مثل فالهوم». **شكلان لشارةٍ واحدة
 * عطلٌ** (القاعدة ٣)، فانتقل الشكلُ إلى هنا ويقرؤه كلُّ من يرسم اسمَ صاحب الحساب.
 *
 * الألوانُ ثابتةٌ هناك (`BRAND` · `INK`) لا ثيميّة — علامةٌ لا سطح؛ والمقاساتُ نسبةٌ من خطِّ الاسم (`PILL_EM`
 * ٠٫٨٢): العرضُ إلى الارتفاع ٣٨:١٦ (PLUS) و٦٢:١٦ (PARTNER)، نصفُ القطر ٥:١٦، الخطُّ ٩:١٦.
 * 🆕 T510 — **قرصُ الكلمة (PLUS · PARTNER · AI) بقامة حروف الاسم** (`WORD_EM`، أحمد ٢٢ نوفمبر بالمسطرة على لقطة «KHALID
 * ALSEHLI»: «يساوي أعلى الكلمة وأسفل الكلمة»، ثمّ «بلس ثقّلها»): كان أطولَ من الحروف الكبيرة (٠٫٨٢ من الخطّ، وقامتُها ٠٫٧)،
 * فصار بقامتها، والكلمةُ بوزن ٨٠٠ والإطارُ ١٫٥ — فلا يخفّ وقد قصُر. والقرصُ عائلةٌ واحدة فتبعه PARTNER وAI؛ وGOLD باقٍ على
 * `PILL_EM` (أحمد: «قولد ممتاز»).
 */
const BRAND = "#FFD400";
const INK = "#050505";
const PILL_EM = 0.82;
/** قامةُ الحرف الكبير في Poppins (٠٫٧ من الخطّ) — ارتفاعُ قرص الكلمة */
const WORD_EM = 0.7;
/** نِسَبُ قرص الكلمة من ارتفاعه (لوحُ T510): الخطُّ ٨٫٤:١٦، العرضُ ٣٢:١٦ (PLUS) · ٥٤:١٦ (PARTNER) · ٢١:١٦ (AI) */
const WORD_FS = 8.4 / 16;
const WORD_BORDER = 1.5;
const VERIFIED = require("../assets/icons/verified-badge.png");

/** الحالُ مقروءةً من صفّ الحساب (`PlanBearer`) — أو محسوبةً في الخادم كما في `/api/v1/me/settings` */
/** 🆕 D-1563 — `ai`: شخصيّةٌ من شخصيّات لوبز AI (اختياريٌّ فلا ينكسر من يبني الرايات بيده — `/api/v1/me/settings`) */
/** 🆕 `gold`: شارةُ GOLD (خطّةُ Loopz+ v2 §٤) — اختياريّةٌ كـ`ai` فلا ينكسر من يبني الرايات بيده */
export type IdentityFlags = { partner: boolean; plus: boolean; founder: boolean; verified: boolean; ai?: boolean; gold?: boolean };

export function identityFlags(p: PlanBearer | null | undefined): IdentityFlags {
  return { partner: isPartner(p), plus: isPlus(p), founder: isFounder(p), verified: isVerified(p), ai: isAiPersona(p), gold: hasGoldBadge(p) };
}

/** ألوانُ GOLD من اللوح (`Badges`) — علامةٌ لا سطح، فلا تتبع الثيم؛ والشكلُ نفسُه في `AccountIdentity` بالويب */
const GOLD_INK = "#2A1A00";
const GOLD_EDGE = "#C2860B";
/**
 * 🆕 D-gold-perks — **ذهبُ مزايا Gold خارج الشارة** (إطارُ بطاقتي في لوحة الداعمين، زرّا «اللوحة/انضم»، سطرُ «داعم لوبز منذ»):
 * لونٌ واحدٌ هنا لا نسخةٌ في كلّ شاشة. الإطارُ يُرى على الثيمين، أمّا الكتابةُ فـ#FFC21A تذوب على أبيض `daylight` فتغمق هناك.
 */
/** حدُّ بطاقة الذهبيّ (T340): ذهبٌ بين طرفَي تدرّج الشارة (`#FFD200` · `#F59E0B`) */
export const GOLD_FRAME = "#E9A80F";
export function useGoldText(): string {
  const { themeId } = useApp();
  return themeId === "daylight" ? "#8A5A00" : "#FFC21A";
}
/* 🆕 T337 — **شعارُ لوبز الأصليُّ نفسُه** لا رسمُ ∞ ثانٍ (أحمد ٦ نوفمبر: «طابقه تماماً مع شعار لوبز الأصلي» — كان الخطُّ رفيعاً
   والحلقتان متشابكتين): `loopz-mark-xl.png` مقصوصاً على حدوده (٢:١) ومصبوغاً بحبر الذهبيّ، بلا تعديلٍ في شكله — قاعدةُ D-145 */
const MARK = require("../assets/icons/loopz-mark-badge.png");
/* 🆕 T338 — **«GOLD» بوزن ٨٠٠** (أحمد: «ثقيلة نفس درجة شعار لوبز»، «١أ»): كتلةُ الشعار تُثقل العينَ فوق سماكة خطّه (قيس ٠٫٠٩٧ من
   القرص ≈ جذعُ ٧٠٠)، فاختار ٨٠٠ من ثلاث صور. `Text` يضع `style` بعد العائلة فتغلب هنا وحدَها؛ وقبل تحميل الخطوط لا تُطلب عائلةٌ غائبة */
const GOLD_WEIGHT = { fontFamily: "Poppins-800" } as const;

/**
 * 🆕 T337 — **كلمةُ الشارة إلى وسطها على الآيفون** (لقطةُ أحمد ٦ نوفمبر): بسطرٍ ضيّقٍ (١٫١٥ من الخطّ) يضع الآيفون حروفَ Poppins
 * أعلى من وسط صندوقها — قيس في اللقطة نحو ٠٫٠٩ من ارتفاع القرص فوق مركز الشعار (≈٠٫١٥ من مقاس الخطّ). **أندرويد قيس على جوال
 * خالد في الوسط تماماً فلا يُمسّ.** إزاحةُ رسمٍ لا تغيّر المساحة التي تأخذها الكلمة.
 */
function wordNudge(fs: number) {
  return Platform.OS === "ios" ? { transform: [{ translateY: 0.15 * fs }] } : null;
}

/**
 * 🆕 **قرصُ GOLD** — نِسَبُ اللوح من ارتفاع القرص: حشوةٌ ٥:١٦ · فجوةٌ ٣:١٦ · خطٌّ ٩:١٦ · الشعارُ بعرض ١٢٫٥:١٦ وارتفاع ٦٫٢٥:١٦ (T337).
 * التدرّجُ رسمٌ (`react-native-svg`، في البناء منذ زمن) لا حزمةٌ جديدة؛ وعرضُه من قياس المحتوى (`onLayout`) فيُرسم خلفه تماماً.
 */
function GoldPill({ hgt, label }: { hgt: number; label: string }) {
  const { fontsReady } = useApp();
  const [w, setW] = React.useState(0);
  const fs = (9 / 16) * hgt;
  const r = (5 / 16) * hgt;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: hgt, borderRadius: r, flexDirection: "row", alignItems: "center", gap: (3 / 16) * hgt, paddingHorizontal: (5 / 16) * hgt, overflow: "hidden", direction: "ltr" }}
    >
      {w > 0 ? (
        <Svg width={w} height={hgt} style={{ position: "absolute", left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="lzGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFE680" />
              <Stop offset="0.45" stopColor="#FFD200" />
              <Stop offset="1" stopColor="#F59E0B" />
            </LinearGradient>
          </Defs>
          <Rect x={0.5} y={0.5} width={w - 1} height={hgt - 1} rx={r - 0.5} fill="url(#lzGold)" stroke={GOLD_EDGE} strokeWidth={1} />
          {/* الضوءُ الداخليّ (`inset 0 1px 0`) خطٌّ أبيضُ شفّافٌ تحت الحدّ العلويّ */}
          <Rect x={r} y={1.5} width={Math.max(0, w - 2 * r)} height={1} fill="rgba(255,255,255,0.55)" />
        </Svg>
      ) : null}
      <Text size={fs} weight="700" color={GOLD_INK} style={[{ letterSpacing: (1.1 / 9) * fs, lineHeight: fs * 1.15, writingDirection: "ltr" }, fontsReady ? GOLD_WEIGHT : null, wordNudge(fs)]}>GOLD</Text>
      <Image source={MARK} style={{ width: (12.5 / 16) * hgt, height: (6.25 / 16) * hgt }} contentFit="contain" accessible={false} />
    </View>
  );
}

/**
 * 🆕 D-1454 — `sealOnly`: ختمُ التوثيق وحدَه بلا حبّة PARTNER/PLUS — للتنبيهات (أحمد ١٧ أكتوبر: «في التنبيهات لا تظهر علامة
 * شريك أو بلس، فقط الصح حقّ التوثيق»)، حيث الشارةُ عقدةٌ داخل جملةٍ عربيّةٍ والحبّةُ العريضةُ تتداخل مع الاسم على iOS.
 */
/**
 * 🆕 T510 — `onGold`: شارةُ GOLD تُضغط فتفتح لوحةَ الداعمين (أحمد ٢٢ نوفمبر: «إذا أحد ضغط على قولد يوديه لصفحة الداعمين») —
 * بدلَ سطر «♡ داعم لوبز منذ …» الذي حُذف من الملفّ. الشكلُ هو هو، واللمسُ يتّسع بـ`hitSlop` لأنّ القرصَ أصغرُ من الإصبع.
 */
export function IdentityBadges({ flags, nameSize, sealOnly = false, onGold }: { flags: IdentityFlags; nameSize: number; sealOnly?: boolean; onGold?: () => void }) {
  const { t, fontsReady } = useApp();
  /* 🆕 D-1563 — «AI» تظهر حتى مع `sealOnly`: هي ما يقول من الكاتب، لا طبقةٌ تُخفى في التنبيهات */
  const ai = !!flags.ai;
  /* 🆕 ⚖️ **و«FOUNDER» حُذفت** (أحمد ٢ نوفمبر ٢٠٢٦: «فاندر شيلها»، نقضٌ لـD-833): **الشارةُ تقول الاشتراكَ وحدَه** — كالويب حرفاً
     (`AccountIdentity`). **و`flags.founder` يبقى في النوع** لأنّ مستدعين كُثُراً يمرّرونه، **ولا يُقرأ هنا أبداً.** */
  /* 🆕 GOLD يغلب PARTNER وPLUS (`hasGoldBadge`): شارةٌ واحدةٌ بجانب الاسم كما في الويب */
  const gold = !sealOnly && !!flags.gold;
  const word = sealOnly || gold ? null : flags.partner ? "PARTNER" : flags.plus ? "PLUS" : null;
  const hgt = nameSize * PILL_EM;
  /* 🆕 T510 — قرصُ الكلمة بقامة حروف الاسم (انظر `WORD_EM`) */
  const wh = nameSize * WORD_EM;
  const wfs = WORD_FS * wh;
  /* الختمُ بمقاس الرئيسيّة عند اسمٍ ٢٠ (١٦) — ويتناسب مع أيِّ اسم */
  const seal = Math.round((16 / 20) * nameSize);
  const wordPill = (text: "PLUS" | "PARTNER" | "AI", w: number, tracking: number, label: string) => (
    <View accessibilityRole="image" accessibilityLabel={label} style={{ width: (w / 16) * wh, height: wh, borderRadius: (5 / 16) * wh, borderWidth: WORD_BORDER, borderColor: BRAND, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
      <Text size={wfs} weight="700" color={BRAND} style={[{ letterSpacing: (tracking / 9) * wfs, lineHeight: wfs * 1.15, writingDirection: "ltr" }, fontsReady ? GOLD_WEIGHT : null, wordNudge(wfs)]}>{text}</Text>
    </View>
  );
  return (
    <>
      {ai ? wordPill("AI", 21, 0.6, t.aiBadge) : null}
      {gold ? (
        onGold ? (
          <Pressable
            onPress={() => {
              haptic.pick();
              onGold();
            }}
            accessibilityRole="link"
            accessibilityLabel={t.goldBadge}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <GoldPill hgt={hgt} label={t.goldBadge} />
          </Pressable>
        ) : (
          <GoldPill hgt={hgt} label={t.goldBadge} />
        )
      ) : null}
      {word === "PLUS" ? wordPill("PLUS", 32, 1.3, t.plusBadge) : word === "PARTNER" ? wordPill("PARTNER", 54, 1.1, t.partnerBadge) : null}
      {flags.verified ? <Image source={VERIFIED} style={{ width: seal, height: seal }} contentFit="contain" accessibilityLabel={t.verifiedBadge} /> : null}
    </>
  );
}

/**
 * 🆕 D-gold-perks — **زرُّ Gold المحدَّد** (أحمد ١٠ نوفمبر: «بدل سهم … خلي بنفس حجم قولد زر اللوحة وزر انضم»): إطارٌ ذهبيٌّ ونصٌّ
 * ذهبيٌّ على السطح، والشارةُ نفسُها ممتلئةٌ — فلا يُخلط الزرُّ بالشارة. مقاسان لا شكلان:
 * بارتفاع شارة GOLD بجانب اسمٍ ٢٠ (٠٫٨٢ منه) وعرضِها المقيس؛ في صفوف صفحة الاشتراك.
 * 🆕 T510 — مقاسُ `line` (سطرُ «♡ داعم لوبز منذ …» تحت النبذة) حُذف مع السطر: صار البابُ شارةَ GOLD نفسَها (`onGold`).
 * الارتفاعُ حدٌّ أدنى لا ثابت (خطُّ الواجهة الكبير يكبر ولا يُقصّ)، واللمسُ ٤٤ بـ`hitSlop` لأنّ الشكلَ أصغرُ منها.
 */
export function GoldButton({ label, onPress, width, a11yRole = "button" }: { label: string; onPress: () => void; width?: number; a11yRole?: "button" | "link" }) {
  const ink = useGoldText();
  const hgt = 20 * 0.82;
  return (
    <Pressable
      onPress={() => {
        haptic.pick();
        onPress();
      }}
      accessibilityRole={a11yRole}
      accessibilityLabel={label}
      hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
      style={({ pressed }) => ({
        minWidth: width || 48,
        minHeight: hgt,
        paddingHorizontal: 6,
        paddingVertical: 0,
        borderRadius: (5 / 16) * hgt,
        borderWidth: 1,
        borderColor: GOLD_FRAME,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text size={10} weight="800" color={ink} numberOfLines={1} style={{ lineHeight: 13 }}>{label}</Text>
    </Pressable>
  );
}
