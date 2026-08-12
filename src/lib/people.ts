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
