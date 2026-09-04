/**
 * ====== وسومُ الإبطال — قاعدةُ تحديثٍ واحدةٌ لمنصّتين (Phase 9 §4.3 القاعدة ٤) ======
 *
 * 🔑 **المشكلة بدقّة:** في المستودع اليوم **١٨٠ استدعاءً لـ`revalidatePath`**
 * داخل `actions.ts` — **و`revalidatePath` مفهومٌ لا مقابلَ له في React Native.**
 * فلو كتب التطبيقُ إبطالَه بنفسه لصارت **قاعدةُ «ما الذي يبطل حين تُكتب هذه
 * الكتابة» مكتوبةً مرّتين**، ويومَ تتغيّر إحداهما ولا تتغيّر الأخرى **يرى
 * مستخدمُ التطبيق بياناتٍ قديمةً بلا خطأٍ ولا سطرِ سجلّ** — وهو صنفُ العطل
 * نفسُه الذي عاش ستّةَ أيّامٍ في D-899.
 *
 * 🔑 **والحلّ: الكتابةُ تُعلن ما أبطلته، ولا تُبطله بنفسها.** كلُّ عمليّةٍ في
 * `core` تعيد `Tag[]`، ثمّ:
 *   • غلافُ الويب  → يترجمها إلى `revalidatePath` (في `src/lib/revalidate.ts`).
 *   • غلافُ الـAPI → يعيدها في جسم الردّ ليُسقط التطبيقُ استعلاماتِه المحلّية.
 * **فالقاعدةُ في مكانٍ واحد، والترجمةُ إلى كلِّ منصّةٍ سطرٌ واحد.**
 *
 * ⚠️ **والوسمُ ليس مساراً**: `/u/[username]` شكلُ مسارٍ في Next لا معنًى في
 * التطبيق — **فالوسمُ يقول «ملفُّ هذا المستخدم» والترجمةُ تعرف كيف تكتبه.**
 */

/** نوعُ العمل كما يظهر في المسارات والوسوم — `tv` أو `movie` لا غير. */
export type TitleKind = "tv" | "movie";

export type Tag =
  /** الصفحةُ الرئيسة — أكثرُ ما يُبطَل اليوم (٣٩ استدعاءً). */
  | "home"
  | "me:library"
  | "me:lists"
  | "me:stats"
  | "me:ratings"
  | "me:diary"
  | "me:reports"
  | "me:invites"
  | "people"
  | "news"
  /** لوحةُ الإدارة كاملةً — ويب فقط، ولا تدخل `v1` (§4.4). */
  | "admin"
  | `list:${string}`
  | `title:${TitleKind}:${number}`
  | `user:${string}:profile`
  | `post:${string}`;

export const listTag = (id: string): Tag => `list:${id}`;
export const titleTag = (kind: TitleKind, tmdbId: number): Tag =>
  `title:${kind}:${tmdbId}`;
export const userProfileTag = (username: string): Tag =>
  `user:${username}:profile`;
export const postTag = (key: string): Tag => `post:${key}`;

/**
 * تُستعمل عند تجميع وسومٍ من فروعٍ متعدّدة: **التكرارُ لا يضرّ الويب**
 * (`revalidatePath` مرّتين لا شيء) **لكنّه يضرّ التطبيق** — كلُّ وسمٍ زائدٍ
 * استعلامٌ يُعاد جلبُه على شبكةِ الجوّال. فالتنظيفُ هنا مرّةً واحدة.
 */
export const uniqueTags = (tags: readonly Tag[]): Tag[] => [...new Set(tags)];
