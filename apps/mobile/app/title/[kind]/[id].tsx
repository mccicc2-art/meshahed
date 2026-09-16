import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TitleScreen } from "../../../src/title/TitleScreen";
import { ErrorBoundary } from "../../../src/ErrorBoundary";

/**
 * `/title/[kind]/[id]` — صفحةُ العمل أصليّةً (Phase 11-D · D1، D-956). تُدفع في
 * المكدّس من المكتبة و«اكتشف» الأصليّتين (`from` يقرّر إلى أين يعود بابُ الويب)،
 * والرجوعُ يعود إليهما بلا جسر.
 * D-974 — وإن سقطت فصفحةُ العمل الويبيّةُ (`/show/123` · `/movie/123`) بديلُها،
 * بالعودة إلى الشاشة التي فُتحت منها — لا شاشةٌ سوداء تُخرج من التطبيق.
 */
export default function Title() {
  const router = useRouter();
  const { kind, id, from } = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  const k = kind === "movie" ? "movie" : "tv";
  const origin = from === "discover" ? "discover" : from === "web" ? "web" : "library";
  /* D-981 — البديلُ الويبيّ يجب أن يُرى: إغلاقُ صفحة العمل وحدَها يترك «اكتشف» الأصليّةَ فوقه
     (المقطعُ الثاني، ١٥ سبتمبر مساءً) — فيُطوى المكدّسُ الأصليّ كلُّه حتى `/web`، والرجوعُ
     من الصفحة الويبيّة يعيد الشاشةَ التي فُتح منها (D-949 بـ`returnTo`). */
  return (
    <ErrorBoundary screen="title" webPath={`/${k === "tv" ? "show" : "movie"}/${Number(id)}`} returnTo={origin === "web" ? undefined : origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <TitleScreen kind={k} id={Number(id)} from={origin} />
    </ErrorBoundary>
  );
}
