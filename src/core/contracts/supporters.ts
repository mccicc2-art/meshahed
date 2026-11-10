/**
 * 🆕 D-gold-perks — **لوحةُ داعمي لوبز** (أحمد ١٠ نوفمبر: «١ أ · ٣ ب»): كلُّ عضو Gold يظهر تلقائياً ويخفي نفسه بزرّ.
 * `GET /api/v1/supporters` للجميع (المسجَّلُ يرى بطاقتَه في `me`)، و`POST /api/v1/me/supporter` يخفي أو يُظهر.
 */
export type Supporter = {
  username: string;
  name: string | null;
  avatar_url: string | null;
  avatar_pos: number | null;
  /** أوّلُ اشتراك Gold في الإنتاج — `null` لمنحةٍ بلا صفّ */
  since: string | null;
};

export type SupportersPayload = {
  /** الظاهرون في اللوحة، الأقدمُ أوّلاً */
  list: Supporter[];
  /** للمسجَّل وحدَه: هل هو Gold، وهل أخفى نفسه، ومنذ متى */
  me: { gold: boolean; hidden: boolean; since: string | null } | null;
};

export type SupporterHideBody = { hidden: boolean };
