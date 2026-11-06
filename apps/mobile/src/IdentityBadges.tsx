import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useApp } from "./state";
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
 */
const BRAND = "#FFD400";
const INK = "#050505";
const PILL_EM = 0.82;
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
const INFINITY_D = "M6 2.2a3.8 3.8 0 1 0 0 7.6c2.4 0 3.9-1.9 6-3.8s3.6-3.8 6-3.8a3.8 3.8 0 1 1 0 7.6c-2.4 0-3.9-1.9-6-3.8S8.4 2.2 6 2.2z";

/**
 * 🆕 **قرصُ GOLD** — نِسَبُ اللوح من ارتفاع القرص: حشوةٌ ٥:١٦ · فجوةٌ ٣:١٦ · خطٌّ ٩:١٦ · ∞ بعرض ١٢٫٥:١٦ وارتفاع ٦٫٣:١٦.
 * التدرّجُ رسمٌ (`react-native-svg`، في البناء منذ زمن) لا حزمةٌ جديدة؛ وعرضُه من قياس المحتوى (`onLayout`) فيُرسم خلفه تماماً.
 */
function GoldPill({ hgt, label }: { hgt: number; label: string }) {
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
      <Text size={fs} weight="700" color={GOLD_INK} style={{ letterSpacing: (1.1 / 9) * fs, lineHeight: fs * 1.15, writingDirection: "ltr" }}>GOLD</Text>
      <Svg width={(12.5 / 16) * hgt} height={(6.3 / 16) * hgt} viewBox="0 0 24 12">
        <Path d={INFINITY_D} fill="none" stroke={GOLD_INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/**
 * 🆕 D-1454 — `sealOnly`: ختمُ التوثيق وحدَه بلا حبّة PARTNER/PLUS — للتنبيهات (أحمد ١٧ أكتوبر: «في التنبيهات لا تظهر علامة
 * شريك أو بلس، فقط الصح حقّ التوثيق»)، حيث الشارةُ عقدةٌ داخل جملةٍ عربيّةٍ والحبّةُ العريضةُ تتداخل مع الاسم على iOS.
 */
export function IdentityBadges({ flags, nameSize, sealOnly = false }: { flags: IdentityFlags; nameSize: number; sealOnly?: boolean }) {
  const { t } = useApp();
  /* 🆕 D-1563 — «AI» تظهر حتى مع `sealOnly`: هي ما يقول من الكاتب، لا طبقةٌ تُخفى في التنبيهات */
  const ai = !!flags.ai;
  /* 🆕 ⚖️ **و«FOUNDER» حُذفت** (أحمد ٢ نوفمبر ٢٠٢٦: «فاندر شيلها»، نقضٌ لـD-833): **الشارةُ تقول الاشتراكَ وحدَه** — كالويب حرفاً
     (`AccountIdentity`). **و`flags.founder` يبقى في النوع** لأنّ مستدعين كُثُراً يمرّرونه، **ولا يُقرأ هنا أبداً.** */
  /* 🆕 GOLD يغلب PARTNER وPLUS (`hasGoldBadge`): شارةٌ واحدةٌ بجانب الاسم كما في الويب */
  const gold = !sealOnly && !!flags.gold;
  const word = sealOnly || gold ? null : flags.partner ? "PARTNER" : flags.plus ? "PLUS" : null;
  const hgt = nameSize * PILL_EM;
  /* الختمُ بمقاس الرئيسيّة عند اسمٍ ٢٠ (١٦) — ويتناسب مع أيِّ اسم */
  const seal = Math.round((16 / 20) * nameSize);
  return (
    <>
      {ai ? (
        <View accessibilityRole="image" accessibilityLabel={t.aiBadge} style={{ width: (24 / 16) * hgt, height: hgt, borderRadius: (5 / 16) * hgt, borderWidth: 1, borderColor: BRAND, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
          <Text size={(9 / 16) * hgt} weight="700" color={BRAND} style={{ letterSpacing: (0.6 / 9) * ((9 / 16) * hgt), lineHeight: (9 / 16) * hgt * 1.15, writingDirection: "ltr" }}>AI</Text>
        </View>
      ) : null}
      {gold ? <GoldPill hgt={hgt} label={t.goldBadge} /> : null}
      {word ? (() => {
        const w = word === "PLUS" ? 38 : 62;
        const tracking = word === "PLUS" ? 1.3 : 1.1;
        const fs = (9 / 16) * hgt;
        const label = word === "PARTNER" ? t.partnerBadge : t.plusBadge;
        return (
          <View accessibilityRole="image" accessibilityLabel={label} style={{ width: (w / 16) * hgt, height: hgt, borderRadius: (5 / 16) * hgt, borderWidth: 1, borderColor: BRAND, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text size={fs} weight="700" color={BRAND} style={{ letterSpacing: (tracking / 9) * fs, lineHeight: fs * 1.15, writingDirection: "ltr" }}>{word}</Text>
          </View>
        );
      })() : null}
      {flags.verified ? <Image source={VERIFIED} style={{ width: seal, height: seal }} contentFit="contain" accessibilityLabel={t.verifiedBadge} /> : null}
    </>
  );
}
