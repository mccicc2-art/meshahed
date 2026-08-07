-- ============================================================
--  Loopz — متابعة الفنانين
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر زرّ المتابعة في صفحة الشخص.
-- ============================================================

-- ============================================================
--  من تتابعه من الفنانين
--
--  جدولٌ منفصلٌ عن `follows` لا عمودٌ فيه: ذاك يتابع أعمالاً ومفتاحه
--  `(tmdb_id, media_type)`، وهذا يتابع أشخاصاً ومعرّفاتهم فضاءٌ آخر عند
--  TMDB — الرقم ٥٠٠ فيلمٌ وشخصٌ في آنٍ واحد. خلطهما في جدولٍ واحد يعني
--  عموداً ثالثاً في مفتاحٍ يُقرأ في كل شاشة، وتصادماً صامتاً يوم يُنسى
--  شرطُه في استعلام.
--
--  والاسم والصورة يُحفظان مع الصفّ كما تفعل `follows`: الصفّ يبقى مقروءاً
--  حين يسقط TMDB أو ينقطع الاتصال، ويُترجَم عند العرض (D-048).
-- ============================================================
create table if not exists public.person_follows (
  user_id      uuid not null references auth.users (id) on delete cascade,
  person_id    integer not null,
  name         text,
  profile_path text,
  created_at   timestamptz not null default now(),
  primary key (user_id, person_id)
);

alter table public.person_follows enable row level security;

-- صفوفك أنت وحدها — قراءةً وكتابةً. ولا حاجة إلى دالّة definer هنا:
-- «من يتابع فلاناً» ليست ميزةً معروضة في الواجهة، ولو عُرضت يوماً فبدالّة
-- محدودة الأعمدة لا بفتح الجدول (D-012)
drop policy if exists "own person follows" on public.person_follows;
create policy "own person follows" on public.person_follows
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists person_follows_user_idx
  on public.person_follows (user_id, created_at desc);

-- التحقّق بعد التشغيل:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public' and tablename='person_follows';
--   -- ولا يجوز أن يظهر الجدول في استعلام qual='true' الصحّي
