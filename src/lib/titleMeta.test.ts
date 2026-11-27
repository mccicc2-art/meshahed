import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCardText, titleMetadata, type TitleCard } from "./titleMeta.ts";

const lost: TitleCard = {
  kind: "tv",
  name: "Lost",
  date: "2004-09-22",
  genres: ["دراما", "غموض", "خيال"],
  extent: 6,
  overview: "ناجون من تحطّم طائرة على جزيرة غامضة. ".repeat(10),
  posterPath: "/og.jpg",
  path: "/show/4607",
  locale: "ar",
};

test("الاسمُ والسنة، والسطرُ: النوعُ والتصنيفان والمواسمُ ثمّ الوصفُ مختصراً", () => {
  const { title, description } = titleCardText(lost);
  assert.equal(title, "Lost (2004) — على Loopz");
  assert.ok(description.startsWith("مسلسل · دراما وغموض · 6 مواسم — "));
  assert.ok(description.endsWith("…"));
  assert.ok(description.length < 220);
});

test("🆕 ن٨ — الصورةُ العريضةُ بلغة المعاينة، وبطاقةُ X كبيرة", () => {
  const m = titleMetadata(lost);
  const og = m.openGraph as { images?: { url: string; width: number; height: number }[]; url?: string };
  assert.equal(og.images?.[0].url, "/api/og/tv/4607?l=ar");
  assert.equal(og.images?.[0].width, 1200);
  assert.equal(og.url, "/show/4607");
  assert.equal((m.twitter as { card?: string }).card, "summary_large_image");
});

test("بلا رقمٍ في المسار يبقى البوسترُ من ممرّنا (w500) وبطاقةٌ صغيرة", () => {
  const m = titleMetadata({ ...lost, path: "/show/lost" });
  assert.equal((m.openGraph as { images?: { url: string }[] }).images?.[0].url, "/i/w500/og.jpg");
  assert.equal((m.twitter as { card?: string }).card, "summary");
});

test("مسارُ صورةٍ غريبٌ لا يُبنى منه رابط، وفيلمٌ بالإنجليزيّة بمدّته", () => {
  const m = titleMetadata({ ...lost, kind: "movie", name: "Heat", date: "1995-12-15", extent: 170, genres: ["Crime"], posterPath: "/../x.jpg", locale: "en", overview: "", path: "/movie/heat" });
  assert.equal((m.openGraph as { images?: unknown }).images, undefined);
  assert.equal(titleCardText({ ...lost, kind: "movie", name: "Heat", date: "1995-12-15", extent: 170, genres: ["Crime"], locale: "en", overview: "" }).description, "Movie · Crime · 170 min");
});
