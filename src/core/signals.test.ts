import { test } from "node:test";
import assert from "node:assert/strict";
import { signalHref, signalParts, signalPersonHref, type SignalRow } from "./signals.ts";
import { getDict } from "./i18n.ts";

/**
 * ====== Phase 11-M · M4 — الإشعارات: الجملةُ والوجهةُ في الطرفين ======
 * الويبُ (`NotificationList`) والتطبيقُ يبنيان منهما — فالوجهةُ هنا عقدٌ: D-218 (الشيءُ لا صاحبُه) و D-899 (المعرّفُ لا الاسم).
 */

const ME = "5b7c2a9e-1111-4a2b-9c3d-000000000001";
const P = { id: "5b7c2a9e-2222-4a2b-9c3d-000000000002", nickname: "مشعل", username: "mishal", avatar_url: null, hide_name: false };
const row = (x: Partial<SignalRow>): SignalRow => ({ kind: "follow", person: P, tmdbId: null, mediaType: null, title: null, at: "2026-09-28T10:00:00Z", isNew: false, ...x });

test("الوجهة: القائمةُ أوّلاً ثمّ الغرفةُ ثمّ رأيي بمعرّفي ثمّ الملفّ", () => {
  assert.equal(signalHref(row({ kind: "list_review", listId: "L1", tmdbId: 5 }), ME), "/lists/L1");
  assert.equal(signalHref(row({ kind: "talk_reply", tmdbId: 7, mediaType: "tv" }), ME), "/talk/tv/7");
  assert.equal(signalHref(row({ kind: "reply", tmdbId: 7, mediaType: "movie" }), ME), `/review/movie/7/${ME}`);
  assert.equal(signalHref(row({ kind: "reply", tmdbId: 7, mediaType: "tv" }), null), "/show/7");
  assert.equal(signalHref(row({ kind: "follow" }), ME), "/u/mishal");
  /* D-1460 — الإعجابُ يفتح ما أُعجب به: رأيي بمعرّفي، ونشاطي صفحةَ العمل — لا ملفَّ المُعجِب */
  assert.equal(signalHref(row({ kind: "like_review", tmdbId: 9, mediaType: "tv" }), ME), `/review/tv/9/${ME}`);
  assert.equal(signalHref(row({ kind: "like_review", tmdbId: 9, mediaType: "tv" }), null), "/show/9");
  assert.equal(signalHref(row({ kind: "like_activity", tmdbId: 9, mediaType: "movie" }), ME), "/movie/9");
  assert.equal(signalHref(row({ kind: "like_activity" }), ME), "/u/mishal");
});

test("الجملةُ تُشقُّ عند الاسم، والمخفيُّ «مستخدم»", () => {
  const t = getDict("ar");
  const p = signalParts(row({ kind: "follow" }), t, "");
  assert.equal(p.who, "مشعل");
  assert.equal(`${p.pre}${p.who}${p.post}`, t.notifFollow("مشعل"));
  const hidden = signalParts(row({ kind: "follow", person: { ...P, hide_name: true } }), t, "");
  assert.equal(hidden.who, t.anonymousUser);
  const list = signalParts(row({ kind: "list_reply", title: "مخزَّن" }), getDict("en"), "Top 10");
  assert.equal(`${list.pre}${list.who}${list.post}`, getDict("en").notifListReply("مشعل", "Top 10"));
});

/* 🆕 T496 (أحمد ٢١ نوفمبر: «اعجب بتعليق على … او بتقييمك او بقائمتك» · «١ أ · ٢ أ») */
test("T496 — الإعجابُ والردُّ يسمّيان ما جرى عليه التفاعل، باللغتين", () => {
  const line = (k: SignalRow["kind"], lang: "ar" | "en", title = "Ebenezer", list = "") => {
    const p = signalParts(row({ kind: k, title }), getDict(lang), list);
    return `${p.pre}${p.who}${p.post}`;
  };
  assert.equal(line("like_review", "ar"), "أعجب مشعل بتعليقك على «Ebenezer»");
  assert.equal(line("like_rating", "ar"), "أعجب مشعل بتقييمك لـ«Ebenezer»");
  assert.equal(line("like_activity", "ar"), "أعجب مشعل بمشاهدتك لـ«Ebenezer»");
  assert.equal(line("like_review", "en"), "مشعل liked your comment on “Ebenezer”");
  assert.equal(line("like_rating", "en"), "مشعل liked your rating of “Ebenezer”");
  assert.equal(line("like_activity", "en"), "مشعل liked that you watched “Ebenezer”");
  assert.equal(line("reply", "ar"), "ردّ مشعل على تعليقك على «Ebenezer»");
  assert.equal(line("reply_reply", "ar"), "ردّ مشعل على ردّك في «Ebenezer»");
  assert.equal(line("talk_like", "en"), "مشعل liked your post in the “Ebenezer” discussion");
  assert.equal(line("list_reply_reply", "ar", "", "Best Shows"), "ردّ مشعل على ردّك في قائمة «Best Shows»");
  assert.equal(line("request_accepted", "ar"), "قبل مشعل طلب متابعتك");
  assert.equal(line("library_grant", "ar"), "منحك مشعل الاطلاع على مكتبته");
  assert.equal(line("library_grant", "en"), "مشعل gave you access to their library");
  assert.equal(line("follow", "ar"), "بدأ مشعل متابعتك");
  /* لا سطرَ يقول «liked your Ebenezer» بعد اليوم */
  for (const k of ["like_review", "like_rating", "like_activity"] as const) assert.ok(!/liked your Ebenezer/.test(line(k, "en")));
});

test("T496 — الوجهة: الردُّ على ردّي يفتح تعليقَ صاحبه، والجديدُ في مكانه", () => {
  const OWNER = "5b7c2a9e-3333-4a2b-9c3d-000000000003";
  assert.equal(signalHref(row({ kind: "reply_reply", tmdbId: 7, mediaType: "tv", ownerId: OWNER }), ME), `/review/tv/7/${OWNER}`);
  assert.equal(signalHref(row({ kind: "reply_reply", tmdbId: 7, mediaType: "tv" }), ME), `/review/tv/7/${ME}`);
  assert.equal(signalHref(row({ kind: "like_rating", tmdbId: 9, mediaType: "movie" }), ME), `/review/movie/9/${ME}`);
  assert.equal(signalHref(row({ kind: "talk_like", tmdbId: 7, mediaType: "movie" }), ME), "/talk/movie/7");
  assert.equal(signalHref(row({ kind: "list_reply_reply", listId: "L2" }), ME), "/lists/L2");
  assert.equal(signalHref(row({ kind: "request_accepted" }), ME), "/u/mishal");
  assert.equal(signalHref(row({ kind: "library_grant" }), ME), "/u/mishal");
  /* النقاشُ العامّ (tmdb_id = 0): كان الصفرُ يُسقَط فيفتح ملفَّ الفاعل */
  assert.equal(signalHref(row({ kind: "talk_like", tmdbId: 0 }), ME), "/talk/general/0");
  assert.equal(signalHref(row({ kind: "talk_reply", tmdbId: 0, mediaType: "general" as never }), ME), "/talk/general/0");
});

/* 🆕 T498 (أحمد ٢١ نوفمبر «نفذ البقيه وارفعها») */
test("T498 — الجملُ والوجهاتُ الجديدة", () => {
  const ar = getDict("ar");
  const line = (x: Partial<SignalRow>, list = "") => {
    const p = signalParts(row(x), ar, list);
    return `${p.pre}${p.who}${p.post}`;
  };
  assert.equal(line({ kind: "news_reply", title: "حلقة جديدة" }), "ردّ مشعل على ردّك في «حلقة جديدة»");
  assert.equal(line({ kind: "mention_reply", title: "Dark" }), "ذكرك مشعل في ردٍّ على «Dark»");
  assert.equal(line({ kind: "mention_list" }, "Best Shows"), "ذكرك مشعل في ردٍّ في قائمة «Best Shows»");
  assert.equal(line({ kind: "mention_talk", title: "Severance", tmdbId: 5, mediaType: "tv" }), "ذكرك مشعل في نقاش «Severance»");
  assert.equal(line({ kind: "mention_talk", tmdbId: 0 }), "ذكرك مشعل في النقاش العام");
  assert.equal(line({ kind: "list_invite_accepted" }, "L"), "قبل مشعل دعوتك إلى قائمة «L»");
  assert.equal(line({ kind: "list_invite_declined" }, "L"), "اعتذر مشعل عن دعوتك إلى قائمة «L»");
  assert.equal(line({ kind: "list_removed" }, "L"), "أخرجك مشعل من قائمة «L»");
  assert.equal(line({ kind: "list_save" }, "L"), "حفظ مشعل قائمتك «L»");
  const OWNER = "5b7c2a9e-4444-4a2b-9c3d-000000000004";
  assert.equal(signalHref(row({ kind: "news_reply", ref: "ep:12/a b" }), ME), "/post/ep%3A12%2Fa%20b");
  assert.equal(signalHref(row({ kind: "mention_reply", tmdbId: 3, mediaType: "tv", ownerId: OWNER }), ME), `/review/tv/3/${OWNER}`);
  assert.equal(signalHref(row({ kind: "mention_list", listId: "L9" }), ME), "/lists/L9");
  assert.equal(signalHref(row({ kind: "mention_talk", tmdbId: 0 }), ME), "/talk/general/0");
  assert.equal(signalHref(row({ kind: "list_save", listId: "L1" }), ME), "/lists/L1");
  /* من أُخرج من قائمةٍ قد تكون خاصّة لا يُرسَل إليها: ملفُّ من أخرجه */
  assert.equal(signalHref(row({ kind: "list_removed", listId: "L2" }), ME), "/u/mishal");
});

test("T509 — الوجهةُ على الردِّ نفسِه (`?r=`)، والصورةُ تفتح الحساب", () => {
  const R = "5b7c2a9e-3333-4a2b-9c3d-000000000003";
  const O = "5b7c2a9e-4444-4a2b-9c3d-000000000004";
  assert.equal(signalHref(row({ kind: "reply_like", tmdbId: 7, mediaType: "movie", ownerId: O, item: R }), ME), `/review/movie/7/${O}?r=${R}`);
  assert.equal(signalHref(row({ kind: "reply_reply", tmdbId: 7, mediaType: "tv", ownerId: O, item: R }), ME), `/review/tv/7/${O}?r=${R}`);
  assert.equal(signalHref(row({ kind: "news_reply_like", ref: "abc", item: R }), ME), `/post/abc?r=${R}`);
  assert.equal(signalHref(row({ kind: "mention_news", ref: "a b", item: R }), ME), `/post/a%20b?r=${R}`);
  assert.equal(signalHref(row({ kind: "talk_like", tmdbId: 7, mediaType: "tv", item: R }), ME), `/talk/tv/7?r=${R}`);
  assert.equal(signalHref(row({ kind: "mention_talk", tmdbId: 0, item: R }), ME), `/talk/general/0?r=${R}`);
  /* معرّفٌ ليس بشكله لا يدخل الرابط — والقائمةُ تبقى صفحتَها */
  assert.equal(signalHref(row({ kind: "reply", tmdbId: 7, mediaType: "movie", item: "x?y" }), ME), `/review/movie/7/${ME}`);
  assert.equal(signalHref(row({ kind: "list_reply", listId: "L1", item: R }), ME), "/lists/L1");
  assert.equal(signalPersonHref(row({ kind: "reply_like" })), "/u/mishal");
  assert.equal(signalPersonHref(row({ kind: "reply_like", person: { ...P, hide_name: true } })), null);
  for (const lang of ["ar", "en"] as const) {
    for (const kind of ["reply_like", "news_reply_like", "mention_news"] as const) {
      const p = signalParts(row({ kind, title: "Clayface" }), getDict(lang), "");
      assert.equal(p.who, "مشعل");
      assert.ok(`${p.pre}${p.post}`.includes("Clayface"));
    }
  }
});
