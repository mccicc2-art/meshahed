import { test } from "node:test";
import assert from "node:assert/strict";
import { loopzPath, richTokens } from "./richText.ts";

test("نصٌّ بلا رابطٍ ولا منشن يعود كما هو", () => {
  assert.deepEqual(richTokens("مرحبا"), [{ kind: "text", text: "مرحبا" }]);
});

test("الرابطُ بلا علامة الترقيم الأخيرة، ويُكمَّل بـhttps", () => {
  assert.deepEqual(richTokens("شوف www.imdb.com/title/tt1."), [
    { kind: "text", text: "شوف " },
    { kind: "link", text: "www.imdb.com/title/tt1", href: "https://www.imdb.com/title/tt1" },
    { kind: "text", text: "." },
  ]);
});

test("المنشنُ لمن يقبله القارئ وحده، والبريدُ ليس منشناً", () => {
  const ok = (n: string) => n === "khld";
  assert.deepEqual(richTokens("هلا @KHLD و @other", ok), [
    { kind: "text", text: "هلا " },
    { kind: "mention", text: "@KHLD", name: "khld" },
    { kind: "text", text: " و @other" },
  ]);
  assert.deepEqual(richTokens("a@khld.com", ok), [{ kind: "text", text: "a@khld.com" }]);
});

test("مسارُ لوبز من رابطه، وغيرُه لا", () => {
  assert.equal(loopzPath("https://loopztv.com/tv/1399?s=1"), "/tv/1399?s=1");
  assert.equal(loopzPath("https://example.com/tv/1"), null);
  assert.equal(loopzPath("not a url"), null);
});
