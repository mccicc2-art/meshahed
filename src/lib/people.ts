/**
 * الشخصُ كما يُرسم — **وحدةٌ نقيّة يقرؤها الخادمُ والمتصفّح** (D-193).
 *
 * **ولماذا خرجت من `data.ts`:** كانت `PersonLite` و`displayNameOf` تسكنان
 * `data.ts`، وذاك ملفٌّ يستورد عميلَ Supabase للخادم (`next/headers`).
 * فأيُّ مكوّنِ عميلٍ يستورد الاسمَ منه **يسحب الخادمَ إلى حزمة المتصفّح**
 * ويسقط البناء (`You're importing a component that needs next/headers`).
 *
 * **وأثرُ ذلك كان قاعدتين للاسم لا واحدة:** `Inbox` — وهو مكوّنُ عميل —
 * كتب منطقَ الإخفاء بنفسه سطراً محلّياً، فصار للتطبيق تعريفان لـ«اسمُ من
 * أخفى اسمه»، ولو تغيّر أحدُهما لافترقا في صمت. **فالدالّةُ هنا، والملفُّ
 * لا يستورد شيئاً** — يقرؤها الطرفان.
 *
 * و`data.ts` يُعيد تصديرَهما كما كانا، فلا استدعاءٌ قائمٌ انكسر.
 */

export interface PersonLite {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
}

/** الاسم المعروض مع احترام خيار الإخفاء */
export function displayNameOf(
  p:
    | { nickname: string | null; username: string | null; hide_name?: boolean | null }
    | null
    | undefined,
  anonymousLabel: string,
): string {
  /* `null` يُقبل: خيطُ رسالةٍ صاحبُه حُذف حسابُه يُرسم ولا يسقط —
     وكان هذا سببَ النسخة المحلّية في `Inbox`، فصار في الأصل */
  if (!p || p.hide_name) return anonymousLabel;
  return p.nickname || p.username || anonymousLabel;
}

/**
 * 🆕 **رابطُ ملفِّ شخصٍ — تعريفٌ واحدٌ لكلِّ من يرسم اسماً أو صورة**
 * (D-655، بلاغُ أحمد بلقطةٍ على صفحة رأي: «إذا ضغطت على الصورة أو
 * الاسم يفتح لي بروفايل الشخص»).
 *
 * 🔴 **والرابطُ كان موجوداً في تلك الصفحة فعلاً** — **والذي سقط أن
 * صاحبَ الرأي بلا اسم مستخدم**: `‎/u/` كان مبنيّاً على `username`
 * وحدَه، **وسبعةَ عشرَ عضواً من واحدٍ وثلاثين لا اسمَ مستخدمٍ لهم
 * اليوم** — **فكلُّ رابطٍ إليهم في التطبيق كلِّه كان ميّتاً أو غائباً**،
 * لا في هذه الشاشة وحدَها.
 *
 * 🔑 **والمعرّفُ يعمل أصلاً**: `getProfileByUsername` وسيطُها اسمُه
 * `handleOrId` وفيها فرعُ `UUID_RE` منذ زمن — **فالطريقُ مفتوحٌ ولم
 * يكن أحدٌ يسلكه.** **ولا حرفَ يُكتب في القاعدة، ولا اسمَ مستخدمٍ
 * يُخترع لأحدٍ نيابةً عنه.**
 *
 * 🔴 **وثلاثةُ سلوكٍ لفكرةٍ واحدة كانت مبثوثةً في عشرين موضعاً**:
 * `username ?? id` (صحيح) · `username ? … : null` (بابٌ يغيب) ·
 * و`‎/u/${username}` عارياً (**رابطٌ إلى `/u/undefined`**) —
 * **وهو بعينه ما تمنعه D-145، وقد افترقت فعلاً قبل أن يُمسك.**
 *
 * ⚠️ **والاسمُ المستخدَمُ يتقدّم حين يوجد**: هو الرابطُ الذي يُشارَك
 * ويُقرأ ويُفهرَس — **والمعرّفُ احتياطٌ لا بديل.**
 */
export function profileHref(
  p: { username?: string | null; id?: string | null } | null | undefined,
): string | null {
  const handle = p?.username?.trim();
  if (handle) return `/u/${encodeURIComponent(handle)}`;
  const id = p?.id?.trim();
  return id ? `/u/${id}` : null;
}
