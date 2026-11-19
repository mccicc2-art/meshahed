import { createListFull } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { CreateListFullBody } from "@/core/contracts/library";

/**
 * 🆕 T450 — `POST /api/v1/lists/create-full` — إنشاءُ القائمة بأعمالها وتفاصيلها في نداءٍ واحد (الخطوةُ الثانية من
 * صفحة «قائمة جديدة» الأصليّة) — فوق `createListFull` التي تناديها صفحةُ الويب.
 */
export const POST = bodyRoute<CreateListFullBody, { id: string }>(
  (b) =>
    createListFull({
      name: String(b.name ?? ""),
      subtitle: b.subtitle ?? null,
      isPublic: !!b.isPublic,
      kind: String(b.kind ?? "regular"),
      playlist: !!b.playlist,
      items: Array.isArray(b.items) ? b.items : [],
    }),
  () => ["me:lists", "me:library", "home"],
);
