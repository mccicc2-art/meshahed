import React from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { CONFIG } from "../config";
import type { LegalDoc, LegalDocName } from "@/core/legal";
import { SettingsScreen, RowsSkeleton } from "./ui";

/**
 * ====== الخصوصيّةُ والشروطُ أصليّتين — شريحةُ «لا ويب في التطبيق» ٢ (١٩ أكتوبر ٢٠٢٦) ======
 *
 * 🔑 **قرارُ أحمد «شاشة تقرأ من الخادم»**: النصُّ لا يُشحن مع التطبيق — يُقرأ من `GET /api/v1/legal/[doc]`، والموقعُ يرسم
 * الصفَّ نفسَه (`@/core/legal`). فتعديلُ فقرةٍ يصل الاثنين معاً بلا تحديثٍ للتطبيق، ولا نسختان تفترقان.
 * (`import type` وحده من النواة: الأنواعُ تُمحى عند البناء، فلا يدخل النصُّ حزمةَ التطبيق.)
 *
 * ⚖️ **`fetch` مباشرةً لا `api()`**: شاشةُ الدخول تفتحها قبل أيِّ جلسة، والمسارُ عامٌّ — وصفةُ `flags.ts`. واللغةُ في
 * العنوان لأنّ التطبيقَ لا يرسل كوكيز. والردُّ يُخزَّن ساعةً على الخادم، وهنا ما دام التطبيقُ مفتوحاً.
 *
 * ⚖️ **لا روابطَ تخرج من الوثيقة** (درسُ D-1345: «الشروط» من شاشة الدخول فتحت الموقعَ كلَّه): البريدُ نصٌّ يُنسخ لا رابط،
 * و«خطوات حذف الحساب» رابطُ الموقع وحدَه — في التطبيق الحذفُ صفٌّ في «الحساب وتسجيل الدخول».
 */
export function LegalScreen({ doc }: { doc: LegalDocName }) {
  const { t, locale, tokens } = useApp();
  const q = useQuery({
    queryKey: ["legal", doc, locale],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBase}/api/v1/legal/${doc}?lang=${locale}`, { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { data?: LegalDoc } | null;
      if (!j?.data) throw new Error("empty");
      return j.data;
    },
    staleTime: 60 * 60 * 1000,
  });
  const d = q.data;
  return (
    <SettingsScreen title={doc === "privacy" ? t.setAboutPrivacy : t.setAboutTerms}>
      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <Text muted>{t.appLegalLoadFailed}</Text>
            <Button size="sm" variant="ghost" label={t.errorRetry} onPress={() => void q.refetch()} />
          </View>
        ) : (
          <RowsSkeleton rows={6} />
        )
      ) : (
        <>
          <View style={{ paddingHorizontal: 4, gap: 4 }}>
            <Text size={22} weight="800">{d.title}</Text>
            <Text size={12} muted>{d.updated}</Text>
          </View>
          {d.sections.map((s) => (
            <View key={s.title} style={{ paddingHorizontal: 4, gap: 6 }}>
              <Text size={17} weight="700">{s.title}</Text>
              <Text size={14} muted style={{ lineHeight: 23 }}>{s.body}</Text>
            </View>
          ))}
          <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, padding: 14 }}>
            <Text size={14} selectable style={{ writingDirection: "ltr", textAlign: "left" }}>{d.contact}</Text>
          </View>
          {d.note ? <Text size={12} color={tokens.muted + "B3"} style={{ paddingHorizontal: 4, lineHeight: 18 }}>{d.note}</Text> : null}
        </>
      )}
    </SettingsScreen>
  );
}
