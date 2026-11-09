-- 242 — «ما يُسجَّل تلقائياً»: إشعارٌ وبطاقةٌ لما أضافه Loopz بنفسه (أحمد ١٠ نوفمبر: «١ أ و ج · ٢ ب · ٣ أ»)
--
-- لماذا: «سجّل بلا سؤال» (هجرة ٢٣٧) يعلّم ما خلّصه العضوُ على Kodi وPlex وJellyfin وEmby بصمت — فلا يعرف ما حدث،
-- ونخسر أفضلَ لحظةٍ للتقييم (تجربةُ خالد ٩ نوفمبر: Bohemian Rhapsody دخل المكتبةَ ولم يُقل له شيء).
--
-- ١) `watch_signals.auto_at`: متى سُجّلت الإشارةُ تلقائياً (لا سؤال)، و`noticed_at`: متى رآها صاحبُها في بطاقة الرئيسيّة
--    (قيّم أو «حسناً»). البطاقةُ تعرض ما سُجّل تلقائياً ولم يُرَ بعد. العضوُ يكتب `noticed_at` وحدَه، والخادمُ `auto_at`.
-- ٢) `push_prefs.muted` يقبل «auto»: مفتاحُ «ما يُسجَّل تلقائياً» في إعدادات الإشعارات.
--
-- آمنٌ للتكرار. الكودُ يعمل قبلها وبعدها: قبلها لا تُكتب `auto_at` (الكتابةُ صامتةٌ إن فشلت) فلا بطاقةَ ولا شيءَ ينكسر.

alter table public.watch_signals add column if not exists auto_at timestamptz;
alter table public.watch_signals add column if not exists noticed_at timestamptz;

-- ما ينتظر أن يُرى: قليلٌ دائماً (يُرى أو يمضي عليه أسبوعان)، فالفهرسُ جزئيٌّ صغير
create index if not exists watch_signals_auto_unseen_idx
  on public.watch_signals (user_id, auto_at desc)
  where auto_at is not null and noticed_at is null;

grant update (noticed_at) on table public.watch_signals to authenticated;

-- قيدُ المفاتيح: يُستبدل بنظيره مع «auto» — اسمُه كما أنشأه Postgres، ويُبحث عنه فلا نفترضه
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.push_prefs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%muted%'
  loop
    execute format('alter table public.push_prefs drop constraint %I', c);
  end loop;
end $$;
alter table public.push_prefs add constraint push_prefs_muted_check
  check (muted <@ array['messages', 'follows', 'likes', 'replies', 'episodes', 'auto']::text[]);

-- التحقّق
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'watch_signals' and column_name in ('auto_at', 'noticed_at')) = 2 as signal_columns,
  to_regclass('public.watch_signals_auto_unseen_idx') is not null as unseen_index,
  position('auto' in (select pg_get_constraintdef(oid) from pg_constraint where conname = 'push_prefs_muted_check')) > 0 as prefs_accept_auto;
