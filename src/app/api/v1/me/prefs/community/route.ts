import type { NextRequest } from "next/server";
import { setFeedStrangers, setFeedSort, setTalkFollowedOnly, setTranslateEnabled } from "@/lib/actions";
import { parseCommunityPrefsBody } from "@/core/communityParams";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/prefs/community` — مفاتيحُ ورقة أدوات المجتمع (Phase 11-M · M0):
 * `{strangers?, sort?, talk_followed?, translate?}` — جسمٌ جزئيّ، والمجهولُ يسقط.
 *
 * 🔑 **الأفعالُ نفسُها التي تكتبها `CommunityTools` في الويب** (D-255/D-306/D-309) — كوكيزٌ
 * يقرؤها الخادمُ قبل أوّل رسمة؛ وجرّةُ الكوكي مشتركةٌ في أندرويد (D-997)، فما يُضبط في
 * التطبيق يراه الويبُ والعكس (قائمةُ خالد M2). ترتيبُ التبويبات في `me/prefs/tabs`
 * (`surface: "community"`) والصفوفُ في `me/prefs/hidden-rails` — لا بابَ ثالث.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return fail("invalid_input");
    }
    const b = parseCommunityPrefsBody(raw);
    if (!b) return fail("invalid_input");
    await Promise.all([
      b.strangers !== undefined ? setFeedStrangers(b.strangers) : null,
      b.sort !== undefined ? setFeedSort(b.sort) : null,
      b.talk_followed !== undefined ? setTalkFollowedOnly(b.talk_followed) : null,
      b.translate !== undefined ? setTranslateEnabled(b.translate) : null,
    ]);
    return ok({ ok: true as const }, ["people"]);
  });
}
