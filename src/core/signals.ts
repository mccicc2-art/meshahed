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
  /* 🆕 T496 (الهجرة ٢٥٥) — قبل طلبَ متابعتك */
  | "request_accepted"
  /* 🆕 T496 — منحك الاطلاعَ على مكتبته (الإعدادات › «من يرى مكتبتي») */
  | "library_grant"
  /* `like_review` = تعليقٌ فيه نصّ · 🆕 `like_rating` = نجومٌ وحدها (T496) */
  | "like_review"
  | "like_rating"
  | "like_activity"
  /* `reply` = ردٌّ على تعليقك · 🆕 `reply_reply` = ردٌّ على ردّك في تعليق غيرك (T496) */
  | "reply"
  | "reply_reply"
  | "talk_reply"
  /* 🆕 T496 — أعجب بمشاركتك في نقاش */
  | "talk_like"
  | "list_review"
  | "like_list_review"
  | "list_reply"
  /* 🆕 T496 — ردٌّ على ردّك في قائمة */
  | "list_reply_reply"
  | "list_copy"
  | "list_invite"
  | "list_like";

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
  /**
   * 🆕 T496 — **صاحبُ التعليق الذي جرى فيه الردّ** (`owner_id` في `my_signals_v2`). 🔴 لماذا: الردُّ على ردّك يقع في
   * تعليق غيرك، والوجهةُ كانت تُبنى بمعرّفك فتفتح صفحةً ليس فيها ما رُدَّ عليك. يغيب ⇒ معرّفُك كما كان.
   */
  ownerId?: string | null;
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
  const title = s.title ?? "";
  const text = ((): string => {
    switch (s.kind) {
      case "follow": return t.notifFollow(NAME_SLOT);
      case "request": return t.notifRequest(NAME_SLOT);
      case "request_accepted": return t.notifRequestAccepted(NAME_SLOT);
      case "library_grant": return t.notifLibraryGrant(NAME_SLOT);
      case "like_review": return t.notifCommentLike(NAME_SLOT, title);
      case "like_rating": return t.notifRatingLike(NAME_SLOT, title);
      case "like_activity": return t.notifWatchLike(NAME_SLOT, title);
      case "reply": return t.notifReply(NAME_SLOT, title);
      case "reply_reply": return t.notifReplyReply(NAME_SLOT, title);
      case "talk_reply": return t.notifTalkReply(NAME_SLOT, title);
      case "talk_like": return t.notifTalkLike(NAME_SLOT, title);
      case "list_review": return t.notifListReview(NAME_SLOT, listName);
      case "like_list_review": return t.notifListReviewLike(NAME_SLOT, listName);
      case "list_reply": return t.notifListReply(NAME_SLOT, listName);
      case "list_reply_reply": return t.notifListReplyReply(NAME_SLOT, listName);
      case "list_copy": return t.notifListCopy(NAME_SLOT, listName);
      case "list_invite": return t.notifListInvite(NAME_SLOT, listName);
      case "list_like": return t.notifListLike(NAME_SLOT, listName);
      /* نوعٌ أحدثُ من هذا الإصدار (خادمٌ سبق التطبيق): جملةٌ محايدة لا جملةُ نوعٍ آخر */
      default: return t.notifLike(NAME_SLOT, title);
    }
  })();
  const at = text.indexOf(NAME_SLOT);
  if (at < 0) return { pre: text, who, post: "" };
  return { pre: text.slice(0, at), who, post: text.slice(at + NAME_SLOT.length) };
}

const LIST_KINDS = new Set<SignalKind>(["list_review", "like_list_review", "list_reply", "list_reply_reply", "list_copy", "list_invite", "list_like"]);
const REVIEW_KINDS = new Set<SignalKind>(["reply", "reply_reply", "like_review", "like_rating"]);

/**
 * 🔑 **الوجهةُ هي الشيءُ نفسُه لا صاحبُه** (D-218): القائمةُ أوّلاً (لا `tmdb_id` لها أصلاً)، ثمّ الغرفةُ، ثمّ صفحةُ
 * تعليقك — **بمعرّفك لا باسمك** (D-899: الاسمُ كان يفتح 404)، للردِّ والإعجاب معاً (D-1460) — ثمّ العمل لإعجاب النشاط،
 * ثمّ ملفُّ الفاعل (المتابعةُ وطلبُها).
 */
export function signalHref(s: SignalRow, myId: string | null): string | null {
  const titleHref = s.tmdbId ? `/${s.mediaType === "tv" ? "show" : "movie"}/${s.tmdbId}` : null;
  if (LIST_KINDS.has(s.kind) && s.listId) return `/lists/${s.listId}`;
  if (s.kind === "talk_reply" || s.kind === "talk_like") {
    if (s.tmdbId) return `/talk/${s.mediaType ?? "movie"}/${s.tmdbId}`;
    /* 🆕 T496 — **النقاشُ العامّ** (`tmdb_id = 0`، الهجرة ٢١٩): الشرطُ أعلاه يُسقط الصفر، فكان الردُّ فيه يفتح ملفَّ الفاعل */
    if (s.tmdbId === 0 || (s.mediaType as string | null) === "general") return "/talk/general/0";
  }
  /* 🆕 D-1460 — **الإعجابُ يفتح ما أُعجب به لا من أعجبه** (أحمد ١٨ أكتوبر: «المفروض يفتح لي مكان التفاعل مايفتح لي حساب
     الشخص»). إعجابُ رأيك ⇐ صفحةُ رأيك كالردّ عليه؛ إعجابُ نشاطك (حلقةٌ أنهيتها — لا صفحةَ له) ⇐ صفحةُ العمل. */
  if (REVIEW_KINDS.has(s.kind) && s.tmdbId) {
    /* 🆕 T496 — صفحةُ التعليق الذي جرى فيه التفاعل: صاحبُه إن عُرف، وإلّا أنا (إعجابُ تعليقي وردٌّ عليه) */
    const owner = s.ownerId || myId;
    return owner ? `/review/${s.mediaType ?? "movie"}/${s.tmdbId}/${owner}` : titleHref;
  }
  if (s.kind === "like_activity" && titleHref) return titleHref;
  return profileHref(s.person) ?? titleHref;
}
