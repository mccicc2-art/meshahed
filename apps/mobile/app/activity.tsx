import React from "react";
import { useLocalSearchParams } from "expo-router";
import { MyActivityScreen } from "../src/member/MyActivityScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/activity` — «النشاط» أصليّاً (🆕 D-1213). يُدفع من خانة «الإحصائيات · النشاط» في المكتبة ومن «حصيلة الأسبوع» في الرئيسيّة.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Activity() {
  const { from, scope } = useLocalSearchParams<{ from?: string; scope?: string }>();
  const origin = originOf(from);
  /* 🆕 D-1504 — `scope=watch` بابُ «سجلّ المشاهدة»: الشاشةُ نفسُها على رقاقة «مشاهدة»؛ وغيرُ ذلك «الكل» كما كان */
  const initial = scope === "watch" ? "watch" : undefined;
  return (
    <ErrorBoundary screen="profile">
      <MyActivityScreen from={origin} scope={initial} />
    </ErrorBoundary>
  );
}
