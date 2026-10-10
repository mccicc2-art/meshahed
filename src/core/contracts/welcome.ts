/**
 * ====== عقودُ الترحيب الأصليّ (D-1347 · Phase 11-U · U1 المرحلة ٢ = 11-V · V2) ======
 *
 * 🔑 **الترحيبُ الأصليُّ يكتب بالأفعال نفسِها التي يكتب بها ترحيبُ الويب** (`saveWelcomeIdentity` · `follow` ·
 * `applyOnboardingProgress` · `requestOrFollowUser` · `completeOnboarding`) — هذه أشكالُ ما يعبر السلك فقط.
 */
export type WelcomeProgress = "none" | "some" | "done";

export type WelcomeSeedItem = { id: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null };

/** `GET /api/v1/welcome` — ما تحتاجه الخطواتُ الخمس قبل أيِّ ضغطة */
export type WelcomePayload = {
  email: string | null;
  nickname: string;
  username: string;
  avatar_url: string | null;
  genres: number[];
  seeds: WelcomeSeedItem[];
  /** أتمّ الترحيبَ من قبل (جهازٌ آخر): الشاشةُ تنصرف ولا تعرض خطوة */
  onboarded: boolean;
};

export type WelcomeUsernamePayload = { state: "free" | "taken" | "reserved" | "short" | "unknown" };

export type WelcomePerson = {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  shared: number;
  followers: number;
  partner: boolean;
  plus: boolean;
  founder: boolean;
  verified: boolean;
};
export type WelcomePeopleBody = { seeds: number[] };
export type WelcomePeoplePayload = { people: WelcomePerson[] };

/**
 * `GET /api/v1/welcome/seasons?id=` — مواسمُ مسلسلٍ من أعمال الترحيب، **بما عُرض منها وحدَه**.
 * `first` رقمُ أوّل حلقةٍ في الموسم (١ في الترقيم النسبيّ، ومجموعُ ما قبله + ١ في المطلق — One Piece)،
 * فحلقاتُه `first … first + count − 1`.
 */
export type WelcomeSeason = { season: number; first: number; count: number };
export type WelcomeSeasonsPayload = { id: number; seasons: WelcomeSeason[] };

/** آخرُ حلقةٍ شاهدها — «بدأته» مع موضعٍ (قرارُ أحمد ١٠ أكتوبر: ورقةُ المواسم والحلقات) */
export type WelcomeUpTo = { season: number; episode: number };

export type WelcomeFinishBody = {
  nickname: string;
  username: string;
  avatarUrl: string | null;
  genres: number[];
  titles: { id: number; progress: WelcomeProgress; upTo?: WelcomeUpTo | null }[];
  people: string[];
};

/** النتيجةُ تُقرأ لا تُرمى: الشاشةُ تحتاج أن تعرف **إلى أيِّ خطوةٍ** تعود ولماذا */
export type WelcomeFinishPayload =
  | { done: true }
  | { done: false; step: "me"; reason: "short" | "reserved" | "taken" | "missing" }
  | { done: false; step: "pick"; reason: "missing" }
  | { done: false; step: "end"; reason: "failed" };
