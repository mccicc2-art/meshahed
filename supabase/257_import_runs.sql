-- ============================================================
--  ٢٥٧ — import_runs · **سجلُّ الاستيراد: من أين جاءت مكتبتك** (T507)
--
--  أحمد ٢٢ نوفمبر ٢٠٢٦: «نبغى نتعرف عالملف ونسجل عندنا وعنده انه استورد
--  من لتربوكسيد مثلا» ثم «١ أ — واذا ضغط عليه تظهر له استيراداته» و«٢ أ»
--  (نحفظ أسماء أعمدة الملف المجهول وحدها)، و«ااذن لك ب انشاء الجدول الجديد».
--
--  صفٌّ واحدٌ لكلِّ استيراد، يُكتب **في ختامه** (`finishImport` في الويب،
--  `POST /api/v1/me/import/finish` في التطبيق، و`runTraktImport` لـTrakt) —
--  ولا صفَّ بدايةٍ يُحدَّث: الختامُ يجري مرّةً واحدةً ولو أوقف صاحبُه
--  الاستيرادَ في منتصفه، واستيرادٌ انقطع بانهيارٍ لا يُكتب له شيء.
--
--  ما يُحفظ: المصدرُ والسطحُ والحصيلةُ (أعداد) — **ولا عنوانَ ولا اسمَ ملفّ**.
--  وللملفّ المجهول (`auto`) أسماءُ أعمدته وحدها: نعرف بها أيَّ تطبيقٍ يكثر
--  الناسُ الاستيرادَ منه فنبني له قارئاً، دون أن نرى من سجلِّ أحدٍ شيئاً.
--
--  **سجلٌّ يقرؤه صاحبُه ولا يكتبه بيده**: `select` وحده لـ`authenticated`،
--  والكتابةُ من الخادم بعميل الخدمة بعد تنقيةٍ (`cleanImportRunSummary`):
--  منحُ `insert` كان سيفتح لكلِّ عضوٍ أن يكتب في PostgREST مباشرةً ما شاء
--  فيتخطّى التنقية (مراجعةُ الوكيل المستقلّ). ولا `update` ولا `delete`؛
--  وحذفُ الحساب يجرّها (`on delete cascade` إلى `auth.users`،
--  و`delete_my_account` تحذف صفَّ `auth.users` وحده — هجرة ١٩٦).
--
--  إضافيّةٌ كلُّها: جدولٌ جديدٌ لا يمسّ غيرَه. والكودُ يتحمّل غيابَه
--  (فشلُ الإدراج يُسجَّل ولا يُفشل الاستيراد)، فترتيبُ النشر حرّ.
--
--  الرجوع: drop table if exists public.import_runs;
-- ============================================================

create table if not exists public.import_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null
    check (source in ('imdb', 'mal', 'letterboxd', 'simkl', 'bingers', 'tvtime', 'trakt', 'plex', 'auto')),
  platform text not null check (platform in ('web', 'app')),
  status text not null check (status in ('done', 'cancelled')),
  shows integer not null default 0 check (shows between 0 and 100000),
  episodes integer not null default 0 check (episodes between 0 and 1000000),
  movies integer not null default 0 check (movies between 0 and 100000),
  reviews integer not null default 0 check (reviews between 0 and 100000),
  unmatched integer not null default 0 check (unmatched between 0 and 100000),
  headers text[]
    check (
      headers is null
      or (source = 'auto' and cardinality(headers) <= 60 and char_length(array_to_string(headers, ',')) <= 3000)
    ),
  created_at timestamptz not null default now()
);

comment on table public.import_runs is
  'T507 — one row per finished import (source, surface, counts). Header names only for unknown files; never titles or file names.';

create index if not exists import_runs_user_created_idx
  on public.import_runs (user_id, created_at desc);

alter table public.import_runs enable row level security;

drop policy if exists "read own import runs" on public.import_runs;
create policy "read own import runs" on public.import_runs
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.import_runs from anon, authenticated;
grant select on public.import_runs to authenticated;

-- ============================================================
--  التحقُّق بعد التشغيل:
--  select relrowsecurity from pg_class where oid = 'public.import_runs'::regclass;   -- true
--  select count(*) from pg_policies where schemaname = 'public' and tablename = 'import_runs';   -- 1
--  select has_table_privilege('anon', 'public.import_runs', 'select');   -- false
--  select has_table_privilege('authenticated', 'public.import_runs', 'insert');   -- false
--  select has_table_privilege('authenticated', 'public.import_runs', 'select');   -- true
-- ============================================================

-- PostgREST يقرأ مخطّطَه من جديد فيعرف الجدولَ الجديد
notify pgrst, 'reload schema';
