/**
 * ====== الإشعارات — الجملةُ والوجهة، قاعدةٌ واحدةٌ للويب والتطبيق (Phase 11-M · M4) ======
 *
 * 🔑 **منقولةٌ بحرفها من `NotificationList`** (D-218 · D-257 · D-259 · D-343 · D-775 · D-899) — **نقلٌ لا إعادةُ كتابة**:
 * الويبُ يرسم منها، والتطبيقُ الأصليُّ يرسم منها، فلا وجهتان تفترقان يوماً لإشعارٍ واحد.
 */
import type { Dict } from "./i18n.ts";
import type { PersonLite } from "./people.ts";
import { profileHref } from "./people.ts";

/** أنواعُ `SignalKind` في `lib/actions` (شروحُها هناك) — `like_review`/`like_activity` جملتُهما «أعجبه» */
export type SignalKind =
  | "follow"
  | "request"
  | "like_review"
  | "like_activity"
  | "reply"
  | "talk_reply"
  | "list_review"
  | "like_list_review"
  | "list_reply";

/** سطرُ الجرس كما تعيده `mySignals` — الشكلُ نفسُه (`Signal` في `lib/actions`) */
export type SignalRow = {
  kind: SignalKind;
  person: PersonLite;
  tmdbId: number | null;
  mediaType: "tv" | "movie" | null;
  title: string | null;
  at: string;
  isNew: boolean;
  listId?: string | null;
  listSlug?: string | null;
};

/**
 * 🆕 **علامةٌ مؤقّتةٌ مكانَ الاسم، ثمّ تُشقُّ الجملةُ عندها** (D-775): القاموسُ يبني الجملةَ بالاسم في وسطها، فيُمرَّر
 * محرفٌ لا يظهر في أيِّ ترجمة (`U+0000`) مكانَه وتعود الجملةُ مشقوقةً عند موضعه — **فالشارةُ تقف بجانب الاسم**.
 * وإن أسقطت ترجمةٌ الاسمَ يُرسم النصُّ كما هو والاسمُ بعده — **فلا سطرَ يضيع لأنّ حيلةً لم تنجح.**
 */
const NAME_SLOT = "\u0000";

/**
 * `listName`: اسمُ القائمة بلغة القارئ — **بوّابةٌ واحدةٌ لثلاثة أنواع** (D-343)، يمرّره المستدعي من `curatedName`
 * (`core/universes` يجرّ جداولَ ثقيلةً لا يحتاجها اختبارُ هذا الملفّ ولا تُحمَّل إلّا حيث تُرسم القوائم).
 */
export function signalParts(s: SignalRow, t: Dict, listName: string): { pre: string; who: string; post: string } {
  const who = s.person.hide_name ? t.anonymousUser : s.person.nickname || s.person.username || t.anonymousUser;
  const text =
    s.kind === "follow"
      ? t.notifFollow(NAME_SLOT)
      : s.kind === "request"
        ? t.notifRequest(NAME_SLOT)
        : s.kind === "reply"
          ? t.notifReply(NAME_SLOT, s.title ?? "")
          : s.kind === "talk_reply"
            ? t.notifTalkReply(NAME_SLOT, s.title ?? "")
            : s.kind === "list_review"
              ? t.notifListReview(NAME_SLOT, listName)
              : s.kind === "like_list_review"
                ? t.notifListReviewLike(NAME_SLOT, listName)
                : s.kind === "list_reply"
                  ? t.notifListReply(NAME_SLOT, listName)
                  : t.notifLike(NAME_SLOT, s.title ?? "");
  const at = text.indexOf(NAME_SLOT);
  if (at < 0) return { pre: text, who, post: "" };
  return { pre: text.slice(0, at), who, post: text.slice(at + NAME_SLOT.length) };
}

/**
 * 🔑 **الوجهةُ هي الشيءُ نفسُه لا صاحبُه** (D-218): القائمةُ أوّلاً (لا `tmdb_id` لها أصلاً)، ثمّ الغرفةُ، ثمّ صفحةُ
 * تعليقك — **بمعرّفك لا باسمك** (D-899: الاسمُ كان يفتح 404) — ثمّ ملفُّ الفاعل، ثمّ العمل.
 */
export function signalHref(s: SignalRow, myId: string | null): string | null {
  const titleHref = s.tmdbId ? `/${s.mediaType === "tv" ? "show" : "movie"}/${s.tmdbId}` : null;
  if ((s.kind === "list_review" || s.kind === "like_list_review" || s.kind === "list_reply") && s.listId) return `/lists/${s.listId}`;
  if (s.kind === "talk_reply" && s.tmdbId) return `/talk/${s.mediaType ?? "movie"}/${s.tmdbId}`;
  if (s.kind === "reply" && s.tmdbId) return myId ? `/review/${s.mediaType ?? "movie"}/${s.tmdbId}/${myId}` : titleHref;
  return profileHref(s.person) ?? titleHref;
}
