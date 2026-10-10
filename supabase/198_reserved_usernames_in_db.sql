-- 198 — الأسماءُ المحجوزة تُفرض في القاعدة، وكلُّ ما يبدأ بـ«loopz» محجوز (D-1348)
--
-- قرارُ أحمد ١٠ أكتوبر ٢٠٢٦: «LoopzTV امنع اي شخص ياخذه ك يوزر» ثمّ «كل ما يبدا بلوبز».
--
-- العطل قبلها: الحجزُ (D-1341) يسكن خادمَ التطبيق وحدَه (`updateProfile` ← `core/username.ts`)، وعمودُ `username`
-- في منحة UPDATE للعضو (الهجرة ١٥٦) — فنداءُ PostgREST مباشرٌ يأخذ `loopztv` أو `admin` بلا أن يمرّ بالحارس.
-- قراءةُ الإنتاج قبلها: `has_column_privilege('authenticated','public.profiles','username','UPDATE')` = true،
-- واسمٌ واحدٌ يبدأ بـloopz: `loopz` (حسابُ النظام).
--
-- العلاج: دالّةٌ تقول «محجوز؟» وزنادٌ يرفض **أخذاً جديداً** لاسمٍ محجوز:
--   • اسمٌ لم يتبدّل لا يُفحص — حسابُ النظام يبقى على `loopz`، وحفظُ ملفّه لا ينكسر.
--   • بلا مستخدمٍ في الجلسة (محرّرُ SQL · مفتاحُ الخدمة) لا يُفحص — صاحبُ المشروع يمنح اسماً محجوزاً بيده.
--   • الرفضُ برمز `23505`: `updateProfile` يترجمه إلى «اسم المستخدم محجوز، جرّب غيره» — الجملةُ نفسُها التي يقولها
--     للمأخوذ، فلا رسالةَ قاعدةٍ تصل العضو ولا شيفرةَ تتغيّر.
--
-- ⚠️ **القائمةُ والبادئةُ مكتوبتان مرّتين** — هنا وفي `src/core/username.ts` (`RESERVED` · `RESERVED_PREFIX`).
-- `src/core/username.test.ts` يقرأ هذا الملفَّ ويقارن النصَّين: اسمٌ يُضاف في أحدهما وحدَه يُسقط الاختبار.
-- قابلةٌ لإعادة التشغيل.

create or replace function public.username_reserved(p_username text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    lower(btrim(p_username)) like 'loopz%'
    or lower(btrim(p_username)) ~ '^user_[0-9a-f]{8}$'
    or lower(btrim(p_username)) = any (array[
      -- reserved:begin
      'loopz', 'loopztv', 'loopzplus', 'admin', 'administrator', 'support', 'help',
      'official', 'team', 'staff', 'mod', 'moderator', 'system', 'root', 'api', 'www',
      'mail', 'info', 'contact', 'security', 'privacy', 'terms', 'login', 'logout',
      'signup', 'welcome', 'settings', 'profile', 'account', 'news', 'search',
      'discover', 'library', 'community', 'home', 'null', 'undefined', 'me', 'user',
      'users', 'guest', 'anonymous', 'google', 'apple', 'tmdb', 'meshahed'
      -- reserved:end
    ]),
    false
  );
$$;

revoke all on function public.username_reserved(text) from public, anon;
grant execute on function public.username_reserved(text) to authenticated;


create or replace function public.guard_reserved_username()
returns trigger
language plpgsql
-- definer: قراءةُ الصفّ القائم (فرعُ upsert أدناه) لا تتوقّف على سياسة قراءةٍ قد تتبدّل؛ `auth.uid()` يبقى مستخدمَ الجلسة
security definer
set search_path = public
as $$
declare
  kept text;
begin
  -- صاحبُ المشروع (بلا مستخدمٍ في الجلسة) يمنح ما يشاء
  if auth.uid() is null then
    return new;
  end if;
  if new.username is null then
    return new;
  end if;
  -- اسمٌ لم يتبدّل لا يُفحص: من يحمل محجوزاً من قبلُ يبقى عليه
  if tg_op = 'UPDATE' and lower(new.username) is not distinct from lower(old.username) then
    return new;
  end if;
  -- 🔴 `updateProfile` يكتب بـupsert (`insert … on conflict (id) do update`)، وزنادُ INSERT يجري على الصفّ المقترح
  -- **قبل** أن يُعرف التعارض — فحسابُ النظام كان سيُرفض عند كلِّ حفظٍ لملفّه (كُشف في التجربة المحلّيّة قبل الرفع).
  -- الصفُّ القائمُ بالمعرّف نفسِه يحمل الاسمَ نفسَه ⇒ ليس أخذاً جديداً.
  if tg_op = 'INSERT' then
    select username into kept from public.profiles where id = new.id;
    if kept is not null and lower(kept) = lower(new.username) then
      return new;
    end if;
  end if;
  if public.username_reserved(new.username) then
    raise exception 'username_reserved' using errcode = '23505';
  end if;
  return new;
end;
$$;

-- `create or replace` لا `drop` ثمّ `create`: أثرُهما واحد، والأولى بلا لحظةٍ يغيب فيها الزناد — وهي ما شُغّل على
-- الإنتاج فعلاً (١٠ أكتوبر): الموصّلُ ألغى الصيغةَ التي فيها `drop` وقبِل هذه.
create or replace trigger profiles_reserved_username
  before insert or update of username on public.profiles
  for each row execute function public.guard_reserved_username();


-- التحقّق بعد التشغيل — والمتوقَّع: true · true · true · false · false، ثمّ اسمٌ واحدٌ (`loopz`):
-- select public.username_reserved('LoopzTV')       as tv,
--        public.username_reserved('loopz_official') as prefixed,
--        public.username_reserved('Admin')          as listed,
--        public.username_reserved('ahmed_92')       as ordinary,
--        public.username_reserved(null)             as empty;
-- select username from public.profiles where public.username_reserved(username);
