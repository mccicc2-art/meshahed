import React from "react";
import type { useRouter } from "expo-router";
import { ThreadScreen, threadQuery, type ThreadRoute } from "./ThreadScreen";
import { queryClient } from "../api";
import { ErrorBoundary } from "../ErrorBoundary";
import type { NativeRoot } from "../shell";

/** مِن أين فُتح النقاش — إليه يعود بابُ الويب (`returnTo`)، و`web` بلا عودة (نهجُ صفحة العمل D-949) */
export function originOf(from: string | undefined): NativeRoot | "web" {
  return from === "discover" || from === "search" || from === "home" || from === "community" || from === "library" ? from : "web";
}

/**
 * الأبوابُ الثلاثة إلى شاشةٍ واحدة (Phase 11-M · M3). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export function ThreadRouteScreen({ route, from, compose = false, focus = null }: { route: ThreadRoute; from: string | undefined; compose?: boolean; focus?: string | null }) {
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="thread">
      <ThreadScreen route={route} from={origin} compose={compose} focus={focus} />
    </ErrorBoundary>
  );
}

/**
 * 🆕 11-M · M3 — **مسارُ ويبٍ للنقاش ⇐ دفعٌ أصليّ** (خطّة §٣: «النقاش ↗» وأبوابُ المجتمع). يعيد `false` لما ليس
 * نقاشاً فيبقى بابَ ويبٍ كما كان. الشكلُ شكلُ روابط الويب نفسِها، فلا جدولَ مساراتٍ ثانٍ.
 */
export function openThreadPath(router: ReturnType<typeof useRouter>, path: string, from: NativeRoot | "web"): boolean {
  /* 🆕 R55 — `?r=<id>` صفحةُ منشورٍ أو ردٍّ في الغرفة (رابطُ الويب نفسُه) */
  let m = /^\/talk\/(tv|movie)\/(\d+)\/?(?:\?r=([0-9a-f-]{36}))?$/i.exec(path);
  if (m) {
    warm({ t: "talk", kind: m[1] === "movie" ? "movie" : "tv", id: Number(m[2]) });
    router.push({ pathname: "/talk/[kind]/[id]", params: { kind: m[1], id: m[2], from, ...(m[3] ? { r: m[3] } : {}) } });
    return true;
  }
  m = /^\/review\/(tv|movie)\/(\d+)\/([0-9a-f-]{36})\/?$/i.exec(path);
  if (m) {
    warm({ t: "review", kind: m[1] === "movie" ? "movie" : "tv", id: Number(m[2]), user: m[3] });
    router.push({ pathname: "/review/[kind]/[id]/[user]", params: { kind: m[1], id: m[2], user: m[3], from } });
    return true;
  }
  m = /^\/post\/([^/?#]+)\/?$/.exec(path);
  if (m) {
    const key = decodeURIComponent(m[1]);
    warm({ t: "post", key });
    router.push({ pathname: "/post/[key]", params: { key, from } });
    return true;
  }
  return false;
}

/**
 * 🆕 1.12.7 — **الغرفةُ تُطلب قبل الدفع لا بعد تركيب شاشتها** (`thread.open` ٦٣٣ms على آيفون): الطلبُ كان يخرج من `useQuery`
 * بعد أن يرسم المتنقّلُ الشاشةَ الجديدة؛ الآن يخرج مع الضغطة، والشاشةُ تجده في الطريق (المفتاحُ والدالّةُ `threadQuery` نفسُهما).
 * غرفةٌ في الكاش طازجةٌ لا تُطلب ثانيةً (`staleTime`).
 */
function warm(r: ThreadRoute) {
  void queryClient.prefetchQuery(threadQuery(r));
}
