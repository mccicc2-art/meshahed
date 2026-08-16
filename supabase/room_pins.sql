-- ============================================================
--  ٩٢ — تثبيتُ غرفةِ نقاش (D-301)
--  تُشغَّل بعد saved_lists_include_loopz.sql (٩١)
--
--  **طلبُ أحمد بلقطةٍ عليها دبّوس في زاوية البطاقة:** «احتاج هذي
--  العلامة فوق بالزاوية، إذا ضغطت عليها يتثبّت».
--
--  ================= التثبيتُ لك أنت وحدَك =================
--
--  **وهو القرارُ الوحيدُ الذي يصحّ لعلامةٍ يضغطها أيُّ أحد:** الدبّوسُ
--  على بطاقةٍ يراها كلُّ الناس، **فلو كان عامّاً لرتّب أوّلُ من يضغطه
--  شاشةَ الجميع.** **وترتيبُ شاشتي شأني** (D-255: الشخصنةُ إعدادٌ
--  يُضبط مرّةً).
--  **⬜ وإن أراد أحمد تثبيتاً إداريّاً يراه الكلّ فهو ميزةٌ ثانية**
--  بحارسٍ ثانٍ — مكتوبةٌ في `05` ولم تُبنَ.
--
--  ================= السياساتُ المفتوحة تبقى أربعاً =================
--
--  **نمطُ `title_post_likes` نفسُه حرفاً** (٩٠ · D-140/D-289):
--  **صفوفُك أنت قراءةً وإدخالاً وحذفاً، ولا سياسةَ قراءةٍ مفتوحة.**
--  **وثلاثُ سياساتٍ «صفوفي أنا» لا تضيف واحدةً إلى الأربع.**
--
--  ⚠️ **ولا `drop` في هذا الملفّ إطلاقاً** — السياساتُ تُنشأ داخل
--  `do $$` بشرطِ الغياب، **والملفُّ قابلٌ لإعادة التشغيل** (D-252/D-285).
--
--  ⚠️ **ولا دالّةَ قراءةٍ جديدة**: الصفوفُ صفوفي، **وسياسةُ القراءة
--  تكفي** — **ودالّةُ `definer` تُكتب حين يُقرأ ما ليس لك** (٩٠ كانت
--  تعدّ إعجاباتِ الناس كلِّهم، وهذه تقرأ مفاتيحي أنا). **وأرخصُ دالّةٍ
--  هي التي لا تُكتب** (D-266).
-- ============================================================

begin;

-- **مفتاحٌ مركَّبٌ ثلاثيّ لا عمودُ ترتيب** (D-263/D-130): «هل ثبّتُّه؟»
-- سؤالُ وجودٍ لا سؤالُ قيمة، **والوجودُ يحرسه المفتاح** — فلا صفَّ
-- مكرَّرٌ ولا فهرسٌ إضافيّ.
-- **و`created_at` تبقى**: يومَ يُطلب «الأحدثُ تثبيتاً أوّلاً» يكون
-- الجوابُ في الصفّ ولا يحتاج هجرةً (D-215: ما ينفع بألفين يُبنى أوّلاً).
create table if not exists public.title_room_pins (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tmdb_id    integer not null,
  media_type text not null check (media_type in ('tv', 'movie')),
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

alter table public.title_room_pins enable row level security;

-- ⚠️ **ولا فهرسَ ثانٍ**: القراءةُ الوحيدةُ «كلُّ مفاتيحي»، **وهي البادئةُ
-- اليسرى للمفتاح الأساسيّ** — **وفهرسٌ بلا استعلامٍ يستعمله كلفةُ كتابةٍ
-- بلا مقابل** (D-036).

do $$
begin
  -- **صفوفي أنا وحدَها** — ولا «من ثبّت ماذا» لأحد (D-011)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_room_pins'
      and policyname = 'read own room pins'
  ) then
    create policy "read own room pins" on public.title_room_pins
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  -- **ولا يثبّت أحدٌ نيابةً عن غيره** — والحارسُ في القاعدة لا في الزرّ
  -- (D-193). **ولا شرطَ على وجود الغرفة**: التثبيتُ نيّةُ قارئ،
  -- **وغرفةٌ تُفتح غداً لعملٍ ثبّتَه اليوم نيّةٌ محترمة** (D-179).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_room_pins'
      and policyname = 'insert own room pin'
  ) then
    create policy "insert own room pin" on public.title_room_pins
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  -- **«تراجَع بعد» لا «أكِّد قبل»** (D-047): يُفكّ من مكانه
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_room_pins'
      and policyname = 'delete own room pin'
  ) then
    create policy "delete own room pin" on public.title_room_pins
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

commit;

-- ============================================================
--  فحوصُ الصحّة — تُشغَّل بعدها، **والدليلُ أثرٌ في الكتالوج لا جملةٌ
--  في اللوحة** (D-247).
-- ============================================================
--  select
--    (select count(*)::int from information_schema.tables
--       where table_schema='public' and table_name='title_room_pins')        as tbl,
--    (select count(*)::int from pg_policies
--       where schemaname='public' and tablename='title_room_pins')           as pol,
--    (select count(*)::int from pg_policies
--       where schemaname='public' and tablename='title_room_pins'
--         and qual = 'true')                                                 as open_here,
--    (select count(*)::int from pg_policies
--       where schemaname='public' and qual = 'true')                         as open_policies;
--  -- المتوقَّع: tbl=1 · pol=3 · open_here=0 · open_policies=4
