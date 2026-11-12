import type { NextRequest } from "next/server";
import { handle, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { aiStorySearch, storyTrialsLeft, type StoryPhases } from "@/lib/actions";
import type { SearchStoryBody, SearchStoryPayload, SearchStoryTrialsPayload } from "@/core/contracts/search";

/**
 * `POST /api/v1/search/story` — «ابحث بالوصف» للتطبيق (Phase 11-G · G3).
 *
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`aiStorySearch`): جلسةٌ إلزاميّة، دلوٌ ٦/دقيقة،
 * تثبيتٌ بـTMDB، وذوقُ صاحبِ الحساب (D-076). رميُه «غير مسجّل»/«طلبات كثيرة»
 * يترجمه `handle` إلى رمزه — فلا حارسَ ثانياً هنا.
 *
 * 🔑 **`reason` بدل رفض**: وصفٌ قصيرٌ أو نتيجةٌ خاوية حالتا منتجٍ لا خطأان —
 * الواجهةُ تكتب نصَّها (`aiSearchHint`/`aiSearchEmpty`) كما يفعل الويب.
 */
export async function POST(req: NextRequest) {
  const t0 = performance.now();
  let phases: StoryPhases | undefined;
  const out = await handle<SearchStoryPayload>(async () => {
    const body = (await req.json().catch(() => null)) as SearchStoryBody | null;
    const description = typeof body?.description === "string" ? body.description : "";
    if (!description.trim()) return fail("invalid_input", { field: "description" });

    const res = await aiStorySearch(description);
    phases = res.phases;
    /* 🆕 هجرة ٢٤٣ — `left` يُرسل حين يعرفه الخادم فقط: غيابُه عند «قصير»/«لم أجد» يُبقي الرصيدَ المعروضَ كما هو */
    const left = res.left !== undefined ? { left: res.left } : {};
    if (!res.ok) return ok({ items: [], reason: res.reason, fallback: false, ...left });
    return ok({
      items: res.results.map((r) => ({
        id: r.id,
        mediaType: r.kind === "tv" ? "tv" : "movie",
        title: r.title,
        titleSecondary: r.titleSecondary ?? null,
        year: r.year ?? null,
        poster: r.poster,
        reason: r.reason ?? null,
      })),
      reason: res.results.length ? null : "empty",
      fallback: !!res.fallback,
      ...left,
    });
  });
  /* 🆕 المهمّة ٣٧٩ — **أين يذهب وقتُ البحث بالوصف؟** (بلاغُ mesho ١٢ نوفمبر: «بطيء جداً»). المراحلُ في ترويسة `Server-Timing`
     كصفحة العمل (المهمّة ٣١٩): الجسمُ والعقدُ كما هما، والتطبيقُ يقرؤها ويطرحها من زمن رحلته (`story.search`).
     `mdl`/`try` ليسا زمناً: ترتيبُ النموذج الذي أجاب وعددُ النداءات — في خانة `dur` لأنّها الخانةُ الرقميّةُ الوحيدة */
  const parts = Object.entries(phases ?? {})
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([k, v]) => `${k === "tries" ? "try" : k};dur=${v}`);
  parts.push(`total;dur=${(performance.now() - t0).toFixed(1)}`);
  out.headers.set("Server-Timing", parts.join(", "));
  return out;
}

/**
 * 🆕 `GET /api/v1/search/story` — كم تجربةً بقيت للمجانيّ (هجرة ٢٤٣ · ٢ أ): السطرُ تحت حقل الوصف يُرسم قبل أوّل
 * بحث، و«انتهت» تُعرف قبل أن يكتب العضوُ وصفاً لن يُبحث. `null` = بلا حدّ (Plus).
 */
export async function GET() {
  return handle<SearchStoryTrialsPayload>(async () => ok({ left: await storyTrialsLeft() }));
}
