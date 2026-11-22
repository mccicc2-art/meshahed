import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanReviewText, reviewDate, REVIEW_MAX, type RawRecord } from "./importParse.ts";
import { cleanImportRunSummary, headerOk, planReviewWrites, importRunCounts, importRunTitle } from "./importer.ts";
import { guessRoles, runHeaders, autoRecords, type AutoTable } from "./importAuto.ts";
import { buildImport, latestReview } from "./importBuild.ts";
import { parseLetterboxdFiles } from "./letterboxd.ts";

/* ===== T507 — نصُّ الرأي ويومُه ===== */

test("review text: Letterboxd HTML becomes plain text, and a literal < stays", () => {
  assert.equal(cleanReviewText("Great<br />film &amp; <i>score</i>"), "Great\nfilm & score");
  assert.equal(cleanReviewText("<p>One</p><p>Two</p>"), "One\n\nTwo");
  assert.equal(cleanReviewText("I <3 this > that"), "I <3 this > that");
  assert.equal(cleanReviewText('<a href="https://x.y">link</a> &#8217;s'), "link ’s");
  assert.equal(cleanReviewText("   "), "");
  const long = cleanReviewText("x".repeat(REVIEW_MAX + 50));
  assert.equal(long.length, REVIEW_MAX);
  assert.ok(long.endsWith("…"));
});

test("review date: past dates only — future, pre-2000 and junk are refused", () => {
  const now = Date.parse("2026-11-22T00:00:00Z");
  assert.equal(reviewDate("2024-03-05", now), "2024-03-05T00:00:00.000Z");
  assert.equal(reviewDate("2027-01-01", now), null);
  assert.equal(reviewDate("1999-12-31", now), null);
  assert.equal(reviewDate("not a date", now), null);
  assert.equal(reviewDate(undefined, now), null);
});

/* ===== T507 — سجلُّ الاستيراد ===== */

test("run summary: unknown source writes nothing, counts are clamped, headers only for unknown files", () => {
  assert.equal(cleanImportRunSummary({}), null);
  assert.equal(cleanImportRunSummary({ source: "netflix" }), null);
  const r = cleanImportRunSummary({ source: "letterboxd", status: "weird", shows: -3, movies: 1e9, headers: ["Name"] });
  assert.deepEqual(r, { source: "letterboxd", status: "done", shows: 0, episodes: 0, movies: 100_000, reviews: 0, unmatched: 0 });
  const a = cleanImportRunSummary({ source: "auto", status: "cancelled", headers: ["Title", "Date", "Title", "2024-01-03", "Dune: Part Two (2024) watched with friends at the IMAX", "me@x.com", "42"] });
  assert.equal(a?.status, "cancelled");
  assert.deepEqual(a?.headers, ["Title", "Date"]);
});

test("header names: short words pass; dates, numbers, links and long text do not", () => {
  assert.ok(headerOk("Watched Date"));
  assert.ok(headerOk("تاريخ المشاهدة"));
  assert.equal(headerOk("2024-05-01"), false);
  assert.equal(headerOk("12/03/2023"), false);
  assert.equal(headerOk("1234"), false);
  assert.equal(headerOk("https://letterboxd.com/x"), false);
  assert.equal(headerOk("a".repeat(41)), false);
});

test("run headers: a table where no column was understood gives none (its first row is likely data)", () => {
  const good: AutoTable = { file: "a.csv", headers: ["Title", "Date"], rows: [], roles: ["title", "date"] };
  const blind: AutoTable = { file: "b.csv", headers: ["Dune", "2024-01-01"], rows: [], roles: ["skip", "skip"] };
  assert.deepEqual(runHeaders([good, blind]), ["Title", "Date"]);
});

/* ===== T507 — الرأيُ في الملفّ المجهول ===== */

test("a review column is never guessed — the owner picks it", () => {
  const roles = guessRoles(["Title", "Year", "Review", "Comment"], [["Dune", "2021", "Loved it", "my note"]]);
  assert.equal(roles.includes("review"), false);
});

test("auto rows carry a review to the title, never from an episode row", () => {
  const table: AutoTable = {
    file: "x.csv",
    headers: ["Title", "Type", "Season", "Episode", "Date", "Rating", "Review"],
    rows: [
      ["Dune", "movie", "", "", "2024-01-02", "8", "<i>Big</i> film"],
      ["Show", "tv", "1", "2", "2024-01-03", "7", "episode words"],
    ],
    roles: ["title", "type", "season", "episode", "date", "rating", "review"],
  };
  const recs = autoRecords([table], { media: "movie", status: "watched" });
  assert.equal((recs[0] as Extract<RawRecord, { kind: "auto" }>).review, "Big film");
  const resolved = new Map([
    ["mv:dune:", { tmdbId: 1, mediaType: "movie" as const, title: "Dune", posterPath: null }],
    ["tv:show:", { tmdbId: 2, mediaType: "tv" as const, title: "Show", posterPath: null }],
  ]);
  const built = buildImport(recs, resolved);
  assert.equal(built.movies[0].review?.text, "Big film");
  assert.equal(built.movies[0].review?.at, "2024-01-02T00:00:00.000Z");
  assert.equal(built.shows[0].review, undefined);
});

test("latest review wins; an undated one never beats a dated one", () => {
  assert.equal(latestReview({ text: "a", at: "2020-01-01" }, { text: "b", at: "2021-01-01" })?.text, "b");
  assert.equal(latestReview({ text: "a", at: "2022-01-01" }, { text: "b", at: "2021-01-01" })?.text, "a");
  assert.equal(latestReview({ text: "a", at: "2020-01-01" }, { text: "b" })?.text, "a");
  assert.equal(latestReview(undefined, { text: "" }), undefined);
});

/* ===== T507 — Letterboxd ===== */

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

test("Letterboxd: reviews.csv carries the review and its written date; deleted/ is not read", async () => {
  const reviews = "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2024-02-01,Dune,2021,u,4.5,,Loved it<br/>so much,,2024-01-30\n";
  const out = await parseLetterboxdFiles([
    { name: "reviews.csv", buf: enc(reviews) },
    { name: "deleted/reviews.csv", buf: enc(reviews.replace("Dune", "Gone")) },
  ]);
  assert.equal(out.records.length, 1);
  const r = out.records[0] as Extract<RawRecord, { kind: "movie-name" }>;
  assert.equal(r.name, "Dune");
  assert.equal(r.rating, 9);
  assert.equal(r.review, "Loved it\nso much");
  assert.equal(r.reviewAt, "2024-02-01T00:00:00.000Z");
});

/* ===== T507 — قرارُ كتابة الآراء (مراجعةُ الوكيل الثاني، البند ٧) ===== */

const rv = (text: string, at: string) => ({ text, at, spoiler: false });

test("review plan: new / kept / fill / mismatch / no rating / duplicates", () => {
  const stamp = "2026-11-22T00:00:00.000Z";
  const plan = planReviewWrites(
    [
      { kind: "movie", tmdbId: 1, rating: 8, review: rv("new title", "2024-01-01T00:00:00.000Z") },
      { kind: "movie", tmdbId: 1, rating: 2, review: rv("duplicate ignored", "2025-01-01T00:00:00.000Z") },
      { kind: "movie", tmdbId: 2, review: rv("no rating anywhere", "2024-01-01T00:00:00.000Z") },
      { kind: "movie", tmdbId: 3, rating: 9, review: rv("Loopz already has words", "2024-01-01T00:00:00.000Z") },
      { kind: "tv", tmdbId: 4, rating: 7, review: rv("fill: same rating", "2023-06-01T00:00:00.000Z") },
      { kind: "tv", tmdbId: 5, review: rv("fill: no rating in source, empty string review", "2026-10-01T00:00:00.000Z") },
      { kind: "movie", tmdbId: 6, rating: 2, review: rv("rant on a nine", "2024-01-01T00:00:00.000Z") },
      { kind: "movie", tmdbId: 7, rating: 5, review: null },
    ],
    [
      { tmdb_id: 3, media_type: "movie", rating: 9, review: "mine", updated_at: "2025-01-01T00:00:00.000Z" },
      { tmdb_id: 4, media_type: "tv", rating: 7, review: null, updated_at: "2025-05-05T00:00:00.000Z" },
      { tmdb_id: 5, media_type: "tv", rating: 6, review: "  ", updated_at: "2026-01-01T00:00:00.000Z" },
      { tmdb_id: 6, media_type: "movie", rating: 9, review: "", updated_at: "2025-01-01T00:00:00.000Z" },
    ],
    stamp,
  );
  assert.deepEqual(plan.fresh.map((f) => [f.tmdbId, f.rating, f.review.text]), [[1, 8, "new title"]]);
  assert.equal(plan.kept, 1);
  assert.equal(plan.skipped, 2);
  /* الملءُ بأبكر اليومين: يومُ الرأي (٢٠٢٣) أبكرُ من التقييم القائم (٢٠٢٥)، والتقييمُ القائم (٢٠٢٦/١) أبكرُ من الرأي (٢٠٢٦/١٠) */
  assert.deepEqual(plan.fills.map((f) => [f.item.tmdbId, f.at]), [
    [4, "2023-06-01T00:00:00.000Z"],
    [5, "2026-01-01T00:00:00.000Z"],
  ]);
});

test("history labels come from one place for web and app", () => {
  const t = {
    importImdbTitle: "IMDb", importMalTitle: "MAL", importLetterboxdTitle: "Letterboxd", importSimklTitle: "Simkl",
    importBingersTitle: "Bingers", importTvTimeTitle: "TV Time", importTraktTitle: "Trakt", importAutoTitle: "Other app",
    importDoneBody: (s: number, e: number, m: number) => `${s}/${e}/${m}`,
    importRunReviews: (n: string) => `${n} reviews`,
    importRunUnmatched: (n: string) => `${n} not found`,
  };
  assert.equal(importRunTitle("auto", t), "Other app");
  assert.equal(importRunTitle("plex", t), "Plex");
  const run = { id: 1, source: "letterboxd" as const, platform: "web" as const, status: "done" as const, shows: 0, episodes: 0, movies: 3, reviews: 2, unmatched: 0, createdAt: "2026-11-21T20:00:00Z" };
  assert.equal(importRunCounts(run, t, String), "0/0/3 · 2 reviews");
});
