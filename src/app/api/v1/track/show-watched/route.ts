import { markShowWatched } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { titleTag } from "@/core/contracts/tags";
import type { ShowRefBody, ShowWatchedResult } from "@/core/contracts/track";

/**
 * Phase 11 · B3 — الفعلُ نفسُه الذي تناديه قائمةُ Hold في الويب (`markShowWatched`)، بمعرّف المسلسل وحدَه.
 * 🆕 D-1079 — **والردُّ يحمل ما أُضيف** بدل `{done}` الأصمّ: صحُّ بطاقة القائمة في «تابِع المشاهدة» يحتاجه
 * لرجعةٍ صادقة (`episodes-unmark`)، كما يحفظه `ListContinueCard` الويبيّ في `added`.
 */
export const POST = bodyRoute<ShowRefBody, ShowWatchedResult>(
  async (b) => ({ done: true, added: (await markShowWatched(b.showTmdbId)).added }),
  (b) => ["home", "me:library", "me:stats", titleTag("tv", b.showTmdbId)],
);
