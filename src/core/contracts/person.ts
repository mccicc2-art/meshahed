import type { TitleKind } from "./tags";

/**
 * ====== عقدُ صفحة الشخص — `GET /api/v1/person/{id}` (D-983، ١٥ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «نبيها كلّها أصليّة بالكامل»** — السلسلةُ فيلم → ممثّل → عمل آخر كانت
 * تبدأ أصليّةً وتنتقل إلى الويب من أوّل ممثّل ولا تعود. هذا الردُّ الواحدُ يحمل ما تعرضه
 * `src/app/person/[id]/page.tsx`: الترويسةُ والحقائقُ والنبذةُ وحالةُ المتابعة والأعمالُ
 * بمجموعاتها الثلاث (أفلام · مسلسلات · برامج) — **بالتقسيم نفسِه** (`isTvProgram`)
 * فلا يختلف تبويبٌ بين المنصّتين.
 */
export type PersonWork = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  year: string;
  /** أفلام · مسلسلات · برامج (توك شو/واقع/أخبار بأنواع TMDB) */
  group: "movie" | "tv" | "show";
};

export type PersonPayload = {
  id: number;
  /** الاسمُ المعروض — العربيُّ من ويكي‑بيانات إن وُجد (D-171) */
  name: string;
  profile_path: string | null;
  /** المهنةُ مترجمةً كما في الصفحة (`departmentName`) */
  department: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  biography: string;
  /** النبذةُ إنجليزيّةٌ لأنّ العربيّة غيرُ مكتوبة في TMDB */
  biography_is_fallback: boolean;
  /** فارغٌ للزائر — كصفحة العمل (D-892) */
  me: { following: boolean };
  works: PersonWork[];
};

/** `POST /api/v1/track/follow-artist` — كما `followArtist` */
export type FollowArtistBody = { personId: number; name?: string | null; profilePath?: string | null };
/** `POST /api/v1/track/unfollow-artist` — كما `unfollowArtist` */
export type UnfollowArtistBody = { personId: number };

/** `POST /api/v1/lists/from-person` — «أضِف أعماله إلى قائمة»: كما `createListFromPerson` */
export type ListFromPersonBody = { personId: number };
export type ListFromPersonResult = { listId: string; name: string; added: number; created: boolean };
