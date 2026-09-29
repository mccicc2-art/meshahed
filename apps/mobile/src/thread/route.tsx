import React from "react";
import { useRouter } from "expo-router";
import { ThreadScreen, type ThreadRoute } from "./ThreadScreen";
import { ErrorBoundary } from "../ErrorBoundary";
import type { NativeRoot } from "../shell";

/** مِن أين فُتح النقاش — إليه يعود بابُ الويب (`returnTo`)، و`web` بلا عودة (نهجُ صفحة العمل D-949) */
export function originOf(from: string | undefined): NativeRoot | "web" {
  return from === "discover" || from === "search" || from === "home" || from === "community" || from === "library" ? from : "web";
}

function webPathOf(r: ThreadRoute): string {
  if (r.t === "post") return `/post/${encodeURIComponent(r.key)}`;
  if (r.t === "talk") return `/talk/${r.kind}/${r.id}`;
  return `/review/${r.kind}/${r.id}/${r.user}`;
}

/**
 * الأبوابُ الثلاثة إلى شاشةٍ واحدة (Phase 11-M · M3) — **والبديلُ عند الانهيار صفحتُها الويبيّةُ نفسُها** (نهجُ
 * `title`/`list`، D-974/D-981): يُطوى المكدّسُ الأصليُّ حتى `/web` فيُرى البديل، والرجوعُ منه يعيد من فتح.
 */
export function ThreadRouteScreen({ route, from, compose = false }: { route: ThreadRoute; from: string | undefined; compose?: boolean }) {
  const router = useRouter();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="thread" webPath={webPathOf(route)} returnTo={origin === "web" ? undefined : origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <ThreadScreen route={route} from={origin} compose={compose} />
    </ErrorBoundary>
  );
}

/**
 * 🆕 11-M · M3 — **مسارُ ويبٍ للنقاش ⇐ دفعٌ أصليّ** (خطّة §٣: «النقاش ↗» وأبوابُ المجتمع). يعيد `false` لما ليس
 * نقاشاً فيبقى بابَ ويبٍ كما كان. الشكلُ شكلُ روابط الويب نفسِها، فلا جدولَ مساراتٍ ثانٍ.
 */
export function openThreadPath(router: ReturnType<typeof useRouter>, path: string, from: NativeRoot | "web"): boolean {
  let m = /^\/talk\/(tv|movie)\/(\d+)\/?$/.exec(path);
  if (m) {
    router.push({ pathname: "/talk/[kind]/[id]", params: { kind: m[1], id: m[2], from } });
    return true;
  }
  m = /^\/review\/(tv|movie)\/(\d+)\/([0-9a-f-]{36})\/?$/i.exec(path);
  if (m) {
    router.push({ pathname: "/review/[kind]/[id]/[user]", params: { kind: m[1], id: m[2], user: m[3], from } });
    return true;
  }
  m = /^\/post\/([^/?#]+)\/?$/.exec(path);
  if (m) {
    router.push({ pathname: "/post/[key]", params: { key: decodeURIComponent(m[1]), from } });
    return true;
  }
  return false;
}
