import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeWidgetStore, widgetPlanState, widgetToWatch, widgetUpcomingAny, widgetUpLine, widgetFriends, widgetActivity,
  WIDGET_LAYOUTS_CAP,
} from "./widgetFeedV2.ts";
import { defaultWidgetConfig } from "./widgetLayout.ts";

const t = {
  typeMovie: "فيلم", typeSeries: "مسلسل", widgetAnime: "أنمي", widgetPremiereMovie: "عرضٌ أوّل", widgetFriendWatched: "شاهد",
  widgetActWatched: (x: string) => `✓ ${x}`, widgetActRated: (x: string) => `قيّمت ${x}`,
  widgetActReviewed: (x: string) => `راجعت ${x}`, widgetActListed: (x: string) => `أضفت ${x}`,
  epLabel: (s: number, e: number) => `م${s} · ح${e}`,
  widgetFriendEps: (n: number, s: number | null) => (s ? `${n} حلقة · م${s}` : `${n} حلقة`),
  widgetFriendStars: (r: number) => `★ ${r}`,
  widgetFriendAdded: "أضاف",
};

test("التخزين: الفارغ يعطي الإعداد الافتراضي وتخطيطاً رئيسياً واحداً", () => {
  const s = sanitizeWidgetStore(null, "الرئيسي");
  assert.deepEqual(s.config, defaultWidgetConfig());
  assert.equal(s.layouts.length, 1);
  assert.equal(s.layouts[0].name, "الرئيسي");
});

test("التخزين: تخطيطات مكررة أو بلا اسم أو بمعرف غريب تسقط، والسقف محترم", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `l${i}`, name: `ت${i}`, config: {} }));
  const s = sanitizeWidgetStore({ layouts: [{ id: "a", name: "سهرة" }, { id: "a", name: "مكرر" }, { id: "B!", name: "x" }, { id: "c", name: "  " }, ...many] }, "الرئيسي");
  assert.equal(s.layouts[0].id, "main");
  assert.equal(s.layouts[1].id, "a");
  assert.ok(!s.layouts.some((l) => l.name === "مكرر" || l.id === "B!" || l.id === "c"));
  assert.equal(s.layouts.length, WIDGET_LAYOUTS_CAP);
});

/* W41 */
test("الاشتراك: مشترك، منتهي، مجاني", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.deepEqual(widgetPlanState({ plan: "plus", plus_until: future }), { plus: true, lapsed: false });
  assert.deepEqual(widgetPlanState({ plan: "plus", plus_until: null }), { plus: true, lapsed: false });
  assert.deepEqual(widgetPlanState({ plan: "plus", plus_until: past }), { plus: false, lapsed: true });
  assert.deepEqual(widgetPlanState({ plan: "free" }), { plus: false, lapsed: false });
  assert.deepEqual(widgetPlanState(null), { plus: false, lapsed: false });
});

/* W35 */
test("للمشاهدة: الأحدث إضافة أولاً، والزر حسب النوع", () => {
  const items = [
    { mediaType: "tv" as const, tmdbId: 1, title: "Andor", posterPath: "/a.jpg" },
    { mediaType: "movie" as const, tmdbId: 2, title: "Dune", posterPath: "/d.jpg" },
    { mediaType: "tv" as const, tmdbId: 3, title: "Frieren", posterPath: "/f.jpg" },
    { mediaType: "tv" as const, tmdbId: 4, title: "Old", posterPath: null },
  ];
  const added = new Map([["tv-1", "2026-10-10"], ["movie-2", "2026-10-13"], ["tv-3", "2026-10-12"]]);
  const out = widgetToWatch(items, added, new Set([3]), new Map([["movie-2", 8.5]]), t, 3);
  assert.deepEqual(out.map((x) => x.title), ["Dune", "Frieren", "Andor"]);
  assert.deepEqual(out.map((x) => x.action), ["watched", "start", "start"]);
  assert.deepEqual(out.map((x) => x.type_label), ["فيلم", "أنمي", "مسلسل"]);
  assert.equal(out[0].rating, 8.5);
});

/* W32 · W33 */
test("القادم يشمل الأفلام، وسطر القادم أقرب موعد", () => {
  const up = widgetUpcomingAny(
    [
      { media: "tv", tmdbId: 1, title: "The Bear", posterPath: null, date: "2026-10-14" },
      { media: "movie", tmdbId: 2, title: "Avengers", posterPath: null, date: "2026-12-18" },
      { media: "tv", tmdbId: 3, title: "x", posterPath: null, date: "2026-12-20" },
      { media: "tv", tmdbId: 4, title: "y", posterPath: null, date: "2026-12-21" },
    ],
    (id) => (id === 1 ? "م4 · ح1" : null),
    t,
  );
  assert.equal(up.total, 4);
  assert.deepEqual(up.items.map((x) => x.label), ["م4 · ح1", "عرضٌ أوّل", null]);
  assert.equal(widgetUpLine(up).title?.title, "The Bear");
  assert.equal(widgetUpLine({ items: [] }).title, null);
});

test("أصدقاؤك: عمل بلا صاحب ظاهر لا يصير سطراً", () => {
  const rows = [
    { tmdb_id: 1, media_type: "tv" as const, title: "The Wire", poster_path: "/w.jpg", at: "2026-10-14T01:00:00Z", people: [{ name: "خالد", avatar_url: null }] },
    { tmdb_id: 2, media_type: "movie" as const, title: "Hidden", poster_path: "/h.jpg", at: "2026-10-14T00:00:00Z", people: [] },
    { tmdb_id: 3, media_type: "movie" as const, title: "Dune", poster_path: "/d.jpg", at: "2026-10-13T00:00:00Z", people: [{ name: "مشعل", avatar_url: "/m.png" }] },
  ];
  const out = widgetFriends(rows, t);
  assert.deepEqual(out.map((x) => `${x.name}:${x.title.title}`), ["خالد:The Wire", "مشعل:Dune"]);
});

test("أنشطتك: الأحدث أولاً بسطر كل نوع", () => {
  const out = widgetActivity(
    [
      { kind: "rate", at: "2026-10-13T10:00:00Z", mediaType: "movie", tmdbId: 2, title: "Dune", posterPath: null, rating: 9 },
      { kind: "watch", at: "2026-10-14T10:00:00Z", mediaType: "tv", tmdbId: 1, title: null, posterPath: null, season: 2, episode: 6 },
      { kind: "list", at: "2026-10-12T10:00:00Z", mediaType: "tv", tmdbId: 3, title: "Andor", posterPath: null, listName: "للمشاهدة" },
    ],
    new Map([["tv-1", { title: "Severance", poster: "/s.jpg" }]]),
    t,
  );
  assert.deepEqual(out.map((x) => x.line), ["✓ Severance", "قيّمت Dune", "أضفت Andor"]);
  assert.deepEqual(out.map((x) => x.sub), ["م2 · ح6", "★ 9/10", "للمشاهدة"]);
  assert.equal(out[0].title.poster_path, "/s.jpg");
});

test("المخزَّن: غير المخصِّص null، ولا يُخزَّن تخطيط «الرئيسي» المولَّد", async () => {
  const { sanitizeStoredWidget } = await import("./widgetFeedV2.ts");
  assert.equal(sanitizeStoredWidget(undefined), null);
  const s = sanitizeStoredWidget({ config: { order: ["tw"] }, layouts: [{ id: "main", name: "قديم", config: {} }] });
  assert.equal(s?.layouts.length, 0);
  assert.equal(s?.config.order[0], "tw");
});

/* 🆕 عملٌ بلا اسم لا يُرسم «#138843» — يسقط ويأخذ الذي بعده مكانَه (تسجيلُ أحمد ١٤ أكتوبر) */
test("أنشطتك: العملُ الذي لا يُعرف اسمُه يسقط", () => {
  const out = widgetActivity(
    [
      { kind: "watch", at: "2026-10-14T10:00:00Z", mediaType: "tv", tmdbId: 138843, title: null, posterPath: null, season: 1, episode: 1 },
      { kind: "rate", at: "2026-10-13T10:00:00Z", mediaType: "movie", tmdbId: 2, title: "Dune", posterPath: null, rating: 9 },
    ],
    new Map(),
    t,
  );
  assert.deepEqual(out.map((x) => x.line), ["قيّمت Dune"]);
});

/* 🆕 W51 — سطرُ الصديق: حلقاتُ يومه وأعلى موسم، أو تقييمُه — ولا رقمَ حلقةٍ بعينها */
test("أصدقاؤك W51: «٣ حلقة · م٢» أو «★ ٨»، ووقتُ صاحب الاسم", () => {
  const p = (x: object) => ({ name: "خالد", avatar_url: null, ...x });
  const rows = [
    { tmdb_id: 1, media_type: "tv" as const, title: "The Wire", poster_path: "/w.jpg", at: "2026-10-14T03:00:00Z", people: [p({ kind: "episodes", episode_count: 3, top_season: 2, at: "2026-10-14T01:00:00Z" })] },
    { tmdb_id: 2, media_type: "movie" as const, title: "Dune", poster_path: "/d.jpg", at: "2026-10-13T00:00:00Z", people: [p({ kind: "rate", rating: 8 })] },
    { tmdb_id: 3, media_type: "movie" as const, title: "Heat", poster_path: "/h.jpg", at: "2026-10-12T00:00:00Z", people: [p({ kind: "movie" })] },
    { tmdb_id: 4, media_type: "tv" as const, title: "Andor", poster_path: "/a.jpg", at: "2026-10-11T00:00:00Z", people: [p({ kind: "add" })] },
    { tmdb_id: 5, media_type: "tv" as const, title: "Fifth", poster_path: "/f.jpg", at: "2026-10-10T00:00:00Z", people: [p({})] },
  ];
  const out = widgetFriends(rows, t);
  /* W54 — أربعةٌ لا ثلاثة */
  assert.equal(out.length, 4);
  assert.deepEqual(out.map((x) => x.line), ["3 حلقة · م2", "★ 8", "شاهد Heat", "أضاف Andor"]);
  assert.equal(out[0].at, "2026-10-14T01:00:00Z");
  assert.deepEqual([out[0].episodes, out[0].season, out[1].rating], [3, 2, 8]);
  /* مصدرٌ بلا الحقول: الفعلُ والعنوانُ كما كان */
  assert.equal(widgetFriends([rows[4]], t)[0].line, "شاهد Fifth");
});

test("للمشاهدة: أربعة (W54)", () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ mediaType: "tv" as const, tmdbId: i + 1, title: `x${i}`, posterPath: null }));
  assert.equal(widgetToWatch(items, new Map(), new Set(), new Map(), t).length, 4);
});
