-- ============================================================
--  Loopz — تشديدُ صلاحيّة الإعجاب والحفظ (الهجرة ٢٥١)
--  شغّله في Supabase → SQL Editor (طُبّق على الإنتاج ١٩ نوفمبر ٢٠٢٦ بإذن أحمد: «٢ أ»)
--
--  ============ لماذا ============
--
--  المراجعُ المستقلّ للمهمّة ٤٤٠ وجد أن سياسةَ `list_likes` (الهجرة ٢٤٩)
--  `for all` — **فيعدّل صاحبُ الصفّ صفَّه**، ومنه `created_at`. **ومن يكتب
--  وقتاً في المستقبل بطلبٍ مباشرٍ للقاعدة** يُبقي «أعجب بقائمتك» جديداً
--  في رأس جرس صاحبها أبداً (`is_new` = `at > seen`)، ويُبقي إعجابَه داخل
--  نافذة «الرائجة» أبداً. **والثغرةُ نفسُها في `list_saves` منذ زمن** —
--  ونُسخت منها السياسةُ حرفاً (D-145: وصفةٌ تُنسخ ثم يُصلَح أصلُها وحدَه
--  يعود عطلُها من بابٍ آخر — **فيُصلَح الاثنان في الدفعة نفسها**).
--
--  ============ ما يتغيّر ============
--
--  ١. `list_likes`: **ثلاثُ سياساتٍ مكانَ الشاملة** — قراءةُ إعجاباتي،
--     وإضافةُ إعجابٍ لقائمةٍ معلنةٍ ليست لي، وحذفُ إعجابي. **ولا تعديلَ
--     أصلاً**: الإعجابُ يُضاف أو يُحذف، ولا شيءَ فيه يُعدَّل (والكودُ يكتبه
--     `upsert … ignoreDuplicates` = إضافةٌ لا تعديل).
--  ٢. `list_saves`: **السياسةُ الشاملة تبقى** — لأن رايةَ «التشغيل» على
--     المحفوظة (`is_playlist`، ١٤٩) تُكتب في صفِّ الحفظ نفسِه، و`saveList`
--     يكتب بـ`upsert` يحتاج التعديل.
--  ٣. **حارسٌ في القاعدة للوقت في الجدولين**: عند الإضافة `created_at = now()`
--     مهما أُرسل، وعند التعديل يبقى وقتُه القديم (ويبقى صاحبُ الصفّ وقائمتُه).
--     **والحدُّ في القاعدة لا في الواجهة** (D-302): الطلبُ المباشر لا يمرّ
--     بالكود أصلاً.
--
--  ⚠️ **ولا تتغيّر بياناتٌ قائمة**، ولا يرى المستخدمُ فرقاً.
--  ⚠️ **وإصلاحُ بياناتٍ لاحقٌ يحتاج وقتاً أصليّاً** (مثل تعبئة ٢٤٩) يُطفئ
--     الحارسَ في معاملته: `alter table … disable trigger …` ثم يعيده.
-- ============================================================

begin;

-- ١) الإعجاب: ثلاثُ سياساتٍ لا واحدةٌ شاملة
drop policy if exists "own list likes" on public.list_likes;

create policy "read own list likes" on public.list_likes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "add own list like" on public.list_likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_likes.list_id
        and l.is_public
        and l.user_id <> (select auth.uid())
    )
  );

create policy "remove own list like" on public.list_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ٢) حارسُ الوقت — دالّةٌ واحدةٌ للجدولين (D-216: موضعٌ واحدٌ للحقيقة)
create or replace function public.pin_row_created_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
    new.user_id    := old.user_id;
    new.list_id    := old.list_id;
  end if;
  return new;
end;
$$;

revoke all on function public.pin_row_created_at() from public, anon, authenticated;

drop trigger if exists list_likes_pin_created_at on public.list_likes;
create trigger list_likes_pin_created_at
  before insert or update on public.list_likes
  for each row execute function public.pin_row_created_at();

drop trigger if exists list_saves_pin_created_at on public.list_saves;
create trigger list_saves_pin_created_at
  before insert or update on public.list_saves
  for each row execute function public.pin_row_created_at();

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمَّع (D-247)
-- ============================================================
-- select
--   (select count(*) from pg_policies where tablename = 'list_likes')                         as likes_policies,   -- = 3
--   (select count(*) from pg_policies where tablename = 'list_likes' and cmd in ('ALL','UPDATE')) as likes_update,     -- = 0
--   (select count(*) from pg_policies where tablename = 'list_saves')                         as saves_policies,   -- = 1
--   (select count(*) from pg_trigger where tgname like '%pin_created_at' and not tgisinternal) as triggers,         -- = 2
--   (select count(*) from public.list_likes)                                                  as likes,            -- لم يتغيّر
--   (select count(*) from public.list_saves)                                                  as saves;            -- لم يتغيّر
