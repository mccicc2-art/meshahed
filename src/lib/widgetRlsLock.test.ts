import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * A-12 (المدقّق ٢١ أكتوبر) — **قفلٌ على نسخ قواعد القاعدة في مسارات الودجت.**
 *
 * ردُّ الإشعار و«تمييز كمقروءة» (`src/lib/widgetToken.ts`) يعملان بمفتاح الخدمة، فلا RLS تحرسهما: ما تفرضه السياساتُ
 * والدوالُّ في القاعدة مكتوبٌ هناك بيدٍ ثانية. يطابق اليوم — والخطرُ أن تتغيّر القاعدةُ في هجرةٍ جديدة ولا يتغيّر الكود.
 * فهذا الاختبارُ يحفظ **أيَّ ملفٍّ عرّف كلَّ قاعدةٍ آخرَ مرّة**؛ هجرةٌ تعيد تعريفها تُسقطه حتى يراجع أحدٌ `widgetToken.ts`
 * ثمّ يحدّث القفلَ هنا. ويتأكّد أنّ الكود ما زال يسأل البوّابَ نفسَه قبل الكتابة.
 */

const DIR = new URL("../../supabase/", import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const read = (f: string) => readFileSync(new URL(f, DIR), "utf8");
const code = readFileSync(new URL("./widgetToken.ts", import.meta.url), "utf8");

/** الملفّاتُ التي تعرّف القاعدة (لا التي تذكرها في تعليق) */
function definedIn(re: RegExp): string[] {
  return files.filter((f) => read(f).split("\n").some((l) => !l.trimStart().startsWith("--") && re.test(l))).sort();
}

const LOCKS: { rule: string; re: RegExp; files: string[] }[] = [
  { rule: "policy «send direct message as self» (can_message)", re: /create policy "send direct message as self"/i, files: ["200_direct_messages.sql"] },
  { rule: "policy «members send as self» (group membership)", re: /create policy "members send as self"/i, files: ["205_dm_groups.sql"] },
  { rule: "mark_conversation_read (copied line by line into markDmReadAs)", re: /function public\.mark_conversation_read\b/i, files: ["153_messages_unread_presence.sql", "200_direct_messages.sql"] },
  { rule: "dm_group_mark_read (copied into markGroupReadAs)", re: /function public\.dm_group_mark_read\b/i, files: ["205_dm_groups.sql"] },
];

for (const l of LOCKS) {
  test(`widget DB-rule lock: ${l.rule}`, () => {
    assert.deepEqual(
      definedIn(l.re),
      l.files,
      `${l.rule} is (re)defined in a new migration — review src/lib/widgetToken.ts against it, then update this lock`,
    );
  });
}

test("the DM policy still gates on can_message, and the group policy on membership", () => {
  assert.match(read("200_direct_messages.sql"), /send direct message as self[\s\S]{0,200}public\.can_message\(sender_id, recipient_id\)/);
  assert.match(read("205_dm_groups.sql"), /members send as self[\s\S]{0,250}dm_group_joined_at\(group_id\) is not null/);
});

test("widget reply asks the same gates before it writes", () => {
  const dm = code.indexOf('db.rpc("can_message"');
  const dmInsert = code.indexOf('from("direct_messages").insert');
  assert.ok(dm > 0 && dmInsert > dm, "can_message must be asked before the direct_messages insert");
  const member = code.indexOf('from("dm_group_members").select("user_id").match({ group_id: target.group, user_id: who.userId })');
  const groupInsert = code.indexOf('from("dm_group_messages").insert');
  assert.ok(member > 0 && groupInsert > member, "membership must be checked before the dm_group_messages insert");
});
