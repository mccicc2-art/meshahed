import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "./state";
import { Text } from "./ui";
import { isFounder, isPartner, isPlus, isVerified, type PlanBearer } from "@/core/plan";

/**
 * ====== شاراتُ الهويّة — مكوّنٌ واحدٌ للتطبيق كلِّه (D-1134 → D-1142) ======
 *
 * **شكلُ الويب نفسُه** (`AccountIdentity.tsx`: `PlanPill` ثمّ `VerifiedBadge`) بقاعدة الطبقة نفسِها
 * (`@/core/plan`): قرصٌ «PARTNER»/«PLUS»/«FOUNDER» ثمّ ختمُ التوثيق الذهبيّ.
 *
 * 🔴 **D-1142 — كان في رأس الرئيسيّة وحدَه** (D-1134)، وبطاقةُ الإعدادات بقيت على الشكلين القديمين (خطُّ ✓
 * رفيعٌ وقرصُ «+») — أحمد بتسجيل: «خلّي الصح والبارتنر بالشكل الصحيح مثل فالهوم». **شكلان لشارةٍ واحدة
 * عطلٌ** (القاعدة ٣)، فانتقل الشكلُ إلى هنا ويقرؤه كلُّ من يرسم اسمَ صاحب الحساب.
 *
 * الألوانُ ثابتةٌ هناك (`BRAND` · `INK`) لا ثيميّة — علامةٌ لا سطح؛ والمقاساتُ نسبةٌ من خطِّ الاسم (`PILL_EM`
 * ٠٫٨٢): العرضُ إلى الارتفاع ٣٨:١٦ (PLUS) و٦٢:١٦ (PARTNER/FOUNDER)، نصفُ القطر ٥:١٦، الخطُّ ٩:١٦.
 */
const BRAND = "#FFD400";
const INK = "#050505";
const PILL_EM = 0.82;
const VERIFIED = require("../assets/icons/verified-badge.png");

/** الحالُ مقروءةً من صفّ الحساب (`PlanBearer`) — أو محسوبةً في الخادم كما في `/api/v1/me/settings` */
export type IdentityFlags = { partner: boolean; plus: boolean; founder: boolean; verified: boolean };

export function identityFlags(p: PlanBearer | null | undefined): IdentityFlags {
  return { partner: isPartner(p), plus: isPlus(p), founder: isFounder(p), verified: isVerified(p) };
}

export function IdentityBadges({ flags, nameSize }: { flags: IdentityFlags; nameSize: number }) {
  const { t } = useApp();
  const word = flags.partner ? "PARTNER" : flags.plus ? "PLUS" : flags.founder ? "FOUNDER" : null;
  const hgt = nameSize * PILL_EM;
  /* الختمُ بمقاس الرئيسيّة عند اسمٍ ٢٠ (١٦) — ويتناسب مع أيِّ اسم */
  const seal = Math.round((16 / 20) * nameSize);
  return (
    <>
      {word ? (() => {
        const w = word === "PLUS" ? 38 : 62;
        const tracking = word === "PLUS" ? 1.3 : 1.1;
        const fs = (9 / 16) * hgt;
        const label = word === "PARTNER" ? t.partnerBadge : flags.founder ? t.founderBadge : t.plusBadge;
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
