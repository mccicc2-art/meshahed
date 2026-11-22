-- ============================================================
--  ٢٦٠ — cinema_titles · **ما يُعرض في صالات السعودية وما سيُعرض** (T512)
--
--  أحمد ٢٢ نوفمبر ٢٠٢٦: «نبي نطورها ونحسنها بحيث يكون فيها جميع الاعمال
--  فالسينما السعودية سواء اعمال سعودية او مصرية او عربية او اجنبية»، ثم
--  «مهمة مجدولة كل اربعاء تشيك ف موقع موفي وفوكس وامباير» («١أ ٢أ ٣أ»)،
--  و«ااذن لك بتشغيلها».
--
--  قائمةُ TMDB (`/movie/now_playing`) تنقصها الأفلامُ العربيّةُ والمصريّةُ
--  والهنديّة. فهذا الجدولُ يحفظ ما يقرؤه الوكيلُ الأسبوعيُّ من مواقع الصالات:
--  صفٌّ لكلِّ عملٍ باسمه المنظَّف، وحالُه (يُعرض · قريباً)، وتاريخُ نزوله في
--  السعودية، ولغاتُ نسخه. والخادمُ يطابق العملَ برقمه في TMDB (`tmdb_id`)
--  ويرسم القسمَ من TMDB (الملصق · الاسم بلغة القارئ · المنشأ).
--
--  ⚠️ **أسماءُ الصالات داخليّةٌ لا تُعرض** (أحمد: «لا تحط اسامي صالات السينما
--  حاليا فقط الاعمال» — حتى نحصل على إذنها): `chains` يُحفظ ليعرف الوكيلُ
--  مصدرَ كلِّ صفّ، ولا يخرج في أيِّ ردٍّ للتطبيق.
--
--  **لا يقرؤه أحدٌ ولا يكتبه إلا الخادمُ والوكيل**: RLS مفعّلة بلا سياسة —
--  عميلُ الخدمة (`createServiceClient`) يقرأ ويطابق، والوكيلُ يكتب من لوحة
--  القاعدة. لا منحَ لـ`anon` ولا لـ`authenticated`، فلا يصل الجدولَ أحدٌ من
--  PostgREST بمفتاحٍ عامّ.
--
--  المفتاحُ (`key`) يُشتقّ من الاسم في القاعدة نفسها (حروفٌ وأرقامٌ صغيرة):
--  «The Cat In The Hat» و«THE CAT IN THE HAT» صفٌّ واحد، فلا يُكرّر الوكيلُ
--  عملاً لأنّ صالتين كتبتاه بحالتين.
--
--  إضافيّةٌ كلُّها: جدولٌ جديدٌ لا يمسّ غيرَه، والكودُ يتحمّل غيابَه (يرجع
--  إلى قائمة TMDB)، فترتيبُ النشر حرّ.
--
--  الرجوع: drop table if exists public.cinema_titles;
-- ============================================================

create table if not exists public.cinema_titles (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  key text generated always as (lower(regexp_replace(title, '[^[:alnum:]]+', '', 'g'))) stored,
  status text not null check (status in ('now', 'soon')),
  release_date date,
  langs text[] not null default '{}' check (cardinality(langs) <= 12),
  chains text[] not null default '{}' check (cardinality(chains) <= 12),
  tmdb_id integer check (tmdb_id is null or tmdb_id > 0),
  match_checked_at timestamptz,
  first_seen date not null default (now() at time zone 'Asia/Riyadh')::date,
  last_seen date not null default (now() at time zone 'Asia/Riyadh')::date,
  updated_at timestamptz not null default now()
);

comment on table public.cinema_titles is
  'T512 — films showing / coming to Saudi cinemas, read weekly from the chains'' sites. chains is internal (not shown in the app). Service role only.';

create unique index if not exists cinema_titles_key_idx on public.cinema_titles (key);
create index if not exists cinema_titles_last_seen_idx on public.cinema_titles (last_seen desc);

alter table public.cinema_titles enable row level security;

revoke all on public.cinema_titles from anon, authenticated;
