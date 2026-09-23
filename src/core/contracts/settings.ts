import type { ContentPrefs } from "@/core/contentPrefs";
import type { FontSize } from "@/core/fontPrefs";
import type { TitleMode } from "@/core/titleMode";
import type { PersonLite } from "@/core/people";

/**
 * ====== عقودُ الإعدادات — Phase 11-I (I0) ======
 *
 * 🔑 **حمولةٌ واحدةٌ لكلِّ الإعدادات** (`GET /api/v1/me/settings`): الفهرسُ
 * وصفحاتُه الأصليّةُ ترسم من قراءةٍ واحدةٍ لا من سبعِ نداءات — وما هو
 * كوكي في الويب (اللغة · الخطّ · أسماءُ الأعمال · المنطقة) يُقرأ هنا من
 * الكوكي نفسِه لأنّ `fetch` في أندرويد يتقاسم مخزنَه مع الـWebView (D-947)،
 * **فالتطبيقُ والصفحةُ يقرآن قيمةً واحدة.**
 *
 * ⚠️ **ولا بريدَ في الحمولة إلّا لصفحة الحساب**: `email` يُعاد لأنّ صفَّ
 * «البريد» في الويب يعرضه — **والحمولةُ شخصيّةٌ بلا كاش** (`respond` تضع
 * `private, no-store`).
 */
export type SettingsPayload = {
  account: {
    username: string | null;
    nickname: string | null;
    avatar_url: string | null;
    avatar_pos: number;
    email: string | null;
    /** اسمُ الخطّة كما يكتبه `planNameOf` — بلغة الطلب */
    plan_label: string;
    plus: boolean;
    partner: boolean;
    verified: boolean;
    founder: boolean;
  };
  appearance: {
    locale: "ar" | "en";
    theme: string;
    font_ui: FontSize;
    font_content: FontSize;
  };
  content: {
    title_mode: TitleMode;
    region: string;
    prefs: ContentPrefs;
  };
  privacy: {
    hide_name: boolean;
    is_private: boolean;
    hide_follow_lists: boolean;
    /** عددُ من مُنحوا المكتبةَ وعددُ المحظورين — للقيمة على صفِّ الفهرس؛ القوائمُ باباها */
    library_grants: number;
    blocked: number;
  };
  help: {
    /** الجولاتُ من سجلّها (`TOUR_IDS`) بعناوينها المترجَمة — فجولةٌ ثالثةٌ غداً صفٌّ لا سطر */
    tours: { id: string; title: string; sub: string }[];
    contact_email: string;
  };
  about: {
    /** سبعةُ أحرفٍ من `VERCEL_GIT_COMMIT_SHA` كما في صفحة «عن Loopz» */
    build: string;
  };
};

export type LocaleBody = { locale: string };
export type ThemeBody = { theme: string };
export type FontBody = { ui: string; content: string };
export type TitleModeBody = { mode: string };
export type RegionBody = { region: string };
export type ContentPrefsBody = Partial<ContentPrefs>;
/** الحقولُ الثلاثةُ معاً كما يرسلها `AccountSettings` في الويب — كتابةٌ واحدةٌ للثلاثة */
export type PrivacyBody = { hide_name: boolean; is_private: boolean; hide_follow_lists: boolean };
export type LibraryGrantBody = { user_id: string; grant: boolean };
export type UnblockBody = { user_id: string };
export type HintsResetBody = { reset: true };

export type PeoplePayload = { people: PersonLite[] };

/* ====== 🆕 Phase 11-I · I3 — تعديلُ الملفّ والتوثيقُ أصليّاً (D-1106 · D-1107) ====== */

/**
 * `GET /api/v1/me/profile` — ما يحتاجه نموذجُ «تعديل الملف» وحدَه (`app/profile/edit/page.tsx` حرفاً):
 * الهويّةُ والصورتان بموضعيهما، وحالةُ الظهور للقراءة، وحسابُ X للعرض (ربطُه بابٌ — جلسةُ الويب، D-932).
 */
export type ProfileEditPayload = {
  nickname: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  cover_pos: number;
  avatar_pos: number;
  is_private: boolean;
  /** نطاقُ الرابط كما يُنسخ (`SITE_URL`) — لا يُكتب في التطبيق مرّةً ثانية */
  site_url: string;
  /** `null` حين لا يوجد مزوّدُ X (القسمُ يغيب كما في الويب — D-217) */
  x: { handle: string | null; verified: boolean } | null;
};

/** الحقولُ السبعةُ التي يحرّرها النموذج — الأنواعُ والتخصيصُ تُقرأ في الخادم فلا تُمحى (D-462) */
export type ProfileSaveBody = {
  nickname: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  cover_pos: number;
  avatar_pos: number;
};

/** ردُّ الرفع: الرابطُ العامُّ للصورة الجديدة — لا يُكتب في الملفّ حتى «حفظ» */
export type ProfileImagePayload = { url: string };

/** `GET /api/v1/me/verify` — `getVerificationScreen` كما هو (الأهليّة · حالةُ الطلب · الحساباتُ المرتبطة) */
export type VerifyPayload = {
  eligibility: {
    complete: boolean;
    active: boolean;
    activeDays: number;
    needDays: number;
    clean: boolean;
    verified: boolean;
    eligible: boolean;
  };
  state: {
    status: "pending" | "more_info" | "approved" | "rejected" | null;
    kind: "person" | "org" | "media" | null;
    note: string | null;
    createdAt: string | null;
    decidedAt: string | null;
    nextApplyAt: string | null;
    canApply: boolean;
  };
  providers: { provider: string; handle: string | null }[];
};

export type VerifyBody = { kind: string; links: string[]; website: string; sources: string; reason: string };
