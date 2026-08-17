-- ═══════════════════════════════════════════════════════════════════════
-- الهجرة ١١٠ — **حارسٌ يسأل بعين النظام لا بعين صاحب الطلب** (D-355)
-- ═══════════════════════════════════════════════════════════════════════
--
-- 🔴 **العطل المقيس:** `title_post_votes` فيه **صفرُ صفوف** منذ ١٦ أغسطس،
-- وسجلُّ Vercel يقول حرفاً:
--   `42501: new row violates row-level security policy for "title_post_votes"`
--
-- **والسبب أن الحارس يسأل سؤالاً لا يستطيع جوابه:** سياسةُ الإدخال في ٩٤
-- (ونظيرتُها في ٩٠) كانت تقول:
--   `exists (select 1 from title_posts p where p.id = post_id
--            and p.hidden = false and p.user_id <> auth.uid())`
-- **وهذا الاستعلامُ الفرعيُّ يُنفَّذ بصلاحية صاحب الطلب لا بصلاحية
-- النظام** — و`title_posts` سياستُها الوحيدةُ للقراءة `auth.uid() =
-- user_id` (المقيسة: `read own talk [SELECT]`)، **لأن كلَّ قراءةٍ عامّةٍ
-- عندنا تمرّ بالمنظور `title_thread` أو بدالّة `definer`** (D-010).
-- **فالسؤال «هل ثمّة مشاركةٌ ليست لي؟» يُطرح على مجموعةٍ لا تحوي إلا ما
-- هو لي — وجوابُه «لا» أبداً.** فسقط كلُّ تصويتٍ وكلُّ إعجابٍ على ردّ.
--
-- ⚖️ **وهي D-059/D-083 نفسُها مُوسَّعةً بحدِّها الحقيقيّ:** «سياسةٌ على
-- جدول X لا تستعلم X» كانت تصف الاستدعاء الذاتيَّ اللانهائيّ — **والحدُّ
-- الأصحّ: سياسةٌ لا تستعلم أيَّ جدولٍ محروسٍ بـRLS، لأنها ستقرؤه بعينِ
-- من لا يرى.** والدواءُ نفسُه: دالّةُ `security definer`.
--
-- **ولماذا دالّةٌ واحدةٌ لا اثنتان:** السؤالُ واحد («أيُمكن التفاعلُ مع
-- هذه المشاركة؟») والعطلان شكلٌ واحد — **ووصفةٌ تُصلَح في موضعٍ وتُنسى
-- في آخر تعود من الباب المنسيّ** (D-145). **وصيغةٌ يقرؤها موضعان
-- تملكها دالّةٌ واحدة** (D-237/D-261).
--
-- **و`is distinct from` لا `<>`:** الشرطُ يجب أن يصدق على مشاركةٍ لا
-- مالكَ لها (`user_id is null`) — **و`null <> uid` ليست «صحيحاً»، هي
-- «مجهول»، والمجهولُ يُقرأ رفضاً** (D-182). لا صفَّ كذلك اليوم، **لكنّ
-- شرطاً يعتمد على قرينةٍ تصحّ اليوم دَينٌ مؤجَّل** (D-214/D-281).
--
-- ⚠️ **و`drop policy` خارج الإذن الدائم كسائر `drop`** (D-252/D-302) —
-- **استُؤذن فيه بعينه، وأذن أحمد: «نعم — الأصوات والإعجاب معاً».**
-- **وهو حذفُ تعريفٍ لا حذفُ بيانات، وفي معاملةٍ واحدة.**
--
-- ⚠️ **والسياساتُ المفتوحة تبقى أربعاً**: هذه سياسةُ `insert` بشرطٍ،
-- لا سياسةُ `qual = true` (D-013).
-- ═══════════════════════════════════════════════════════════════════════

begin;

create or replace function public.can_touch_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.title_posts p
    where p.id = p_post
      and p.hidden = false
      and p.user_id is distinct from auth.uid()
  );
$$;

revoke all on function public.can_touch_post(uuid) from public;
grant execute on function public.can_touch_post(uuid) to authenticated;

-- الأصوات (٩٤ — D-305)
drop policy if exists "insert own post vote" on public.title_post_votes;
create policy "insert own post vote" on public.title_post_votes
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_touch_post(post_id));

-- الإعجاب على الردود (٩٠ — D-289): **الشكلُ نفسُه فالعطلُ نفسُه**
drop policy if exists "insert own post like" on public.title_post_likes;
create policy "insert own post like" on public.title_post_likes
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_touch_post(post_id));

-- ═══════════════════════════════════════════════════════════════════════
-- وتنظيفُ الدخيل — **بإذن أحمد بعينه** (حذفُ بيانات خارج الإذن الدائم)
--
-- «EARLY STREAM!» (`tt38770727`) جلس تاسعاً في «أفضل ٥٠ فيلماً» — تسجيلُ
-- بثٍّ لا فيلم. **والحارسُ البنيويُّ في `imdbChart.ts`** (لا هنا) يمنع
-- أمثالَه مستقبلاً، **وهذا يزيل القائم** لأن القائمة لا تُعاد بناؤها
-- إلا في دورتها. **والحذفُ بالمعرّف لا بالاسم** — الاسمُ يتبدّل والمعرّف
-- لا (D-224).
-- ═══════════════════════════════════════════════════════════════════════
delete from public.imdb_chart where tconst = 'tt38770727';

commit;

-- ═══════════════════════ التحقّق (يُشغَّل بعدها) ═══════════════════════
-- select
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'can_touch_post')            as fn,
--   (select count(*)::int from pg_policies where schemaname = 'public'
--     and tablename in ('title_post_votes','title_post_likes')
--     and cmd = 'INSERT' and with_check like '%can_touch_post%')              as fixed,
--   (select count(*)::int from public.imdb_chart where tconst = 'tt38770727') as intruder,
--   (select count(*)::int from pg_policies where qual = 'true')               as open_policies;
-- المتوقَّع: fn=1 | fixed=2 | intruder=0 | open_policies=4
