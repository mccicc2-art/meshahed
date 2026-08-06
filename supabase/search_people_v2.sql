-- ============================================================
--  بحث الأشخاص — نسخةٌ أذكى (تحلّ محلّ التعريف في security.sql)
--
--  ثلاث علل في النسخة السابقة:
--
--  ١) `where p.username is not null` كانت تُخفي كل من لم يختر معرّفاً.
--     المعرّف يُكتب في التهيئة أو صفحة الملف، وكثيرٌ ممن يدخلون بحساب
--     Google لا يمرّون عليها — فيبقى لهم اسمٌ مستعار ظاهر في المجتمع
--     ولا يظهرون في البحث إطلاقاً. الصفّ الآن يظهر، ورابطه يسقط إلى
--     صفحة المجتمع لأن صفحة الملف العام تحتاج معرّفاً.
--
--  ٢) الترتيب كان أبجدياً بالمعرّف وحده: من طابق اسمه المكتوب حرفاً بحرف
--     قد يجيء بعد عشرة أسماءٍ تحوي الحروف في وسطها. الآن التطابق التام
--     أولاً، ثم ما يبدأ بالمكتوب، ثم ما يحويه.
--
--  ٣) المسافات الزائدة لم تُقصّ في القاعدة — والعميل يقصّها، لكن الدالة
--     عامّة وقد تُستدعى من غيره.
--
--  حالة الأحرف لم تكن علّة: `ilike` غير حسّاسة لها أصلاً، وكذلك تبقى.
--
--  التشغيل: الصقه في Supabase → SQL Editor ثم Run.
-- ============================================================

create or replace function public.search_people(q text)
returns table (
  id uuid,
  nickname text,
  username text,
  avatar_url text,
  hide_name boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select
      btrim(coalesce(q, ''))                                              as raw,
      replace(replace(btrim(coalesce(q, '')), '%', '\%'), '_', '\_')      as pat
  )
  select
    p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from public.profiles p, needle n
  where length(n.raw) >= 2
    -- المعرّف يبقى مبحوثاً فيه دائماً، والاسم المستعار لمن لم يُخفِ اسمه
    and (
      p.username ilike '%' || n.pat || '%'
      or (
        coalesce(p.hide_name, false) = false
        and p.nickname ilike '%' || n.pat || '%'
      )
    )
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by
    case
      when lower(p.username) = lower(n.raw)                                   then 0
      when coalesce(p.hide_name, false) = false
           and lower(p.nickname) = lower(n.raw)                               then 0
      when p.username ilike n.pat || '%'                                      then 1
      when coalesce(p.hide_name, false) = false
           and p.nickname ilike n.pat || '%'                                  then 1
      else 2
    end,
    -- من له معرّف أولاً: صفحته العامة قابلة للفتح
    (p.username is null),
    p.username,
    p.nickname
  limit 20;
$$;

revoke all on function public.search_people(text) from public;
grant execute on function public.search_people(text) to authenticated;
