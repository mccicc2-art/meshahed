-- ============================================================
--  ٢٥٨ — ratings_imported_from · **الرأيُ المستورد لا يدخل نشاطَ الأصدقاء** (T507)
--
--  أحمد ٢٢ نوفمبر ٢٠٢٦: المراجعاتُ المستوردة (Letterboxd · Trakt · ملفٌّ
--  بعمود «مراجعة») «تظهر في صفحة العمل والملف الشخصي بتاريخها الأصلي، ولا
--  تدخل نشاط الأصدقاء» («١ أ»)؛ ثمّ — بعد أن كشفت مراجعةُ الوكيل المستقلّ أنّ
--  التاريخ الأصليّ وحده لا يكفي — «١ أ ااذن لك» على هذا العمود وتعديل الدوالّ.
--
--  لماذا لا يكفي التاريخ (مراجعةُ الوكيل، البند ٣):
--   • «أفضل الأسبوع» (`award_weekly_top`) يعدّ المراجعاتِ بـ`updated_at` في
--     الأسبوع ويمنح Loopz+ (٣٠/١٤/٧ أيّام) — ملفٌّ بثلاثمئة مراجعةٍ كُتبت
--     هذا الأسبوع يفوز به.
--   • المجتمعُ صغير (١٠٨ مراجعاتٍ يومَ كُتب هذا الملفّ، والصفحةُ الأولى
--     تبلغ أغسطس) — فمراجعاتُ الأشهر الأخيرة المستوردة تملأ صفحته الأولى.
--   • نشاطُ الأصدقاء يقرأ آخرَ ثلاثين يوماً — ومراجعةٌ كُتبت هناك أمس تدخله.
--
--  ما تغيّر:
--   ١) عمودٌ `ratings.imported_from` (فارغٌ = كُتب في Loopz). يكتبه الاستيرادُ
--      لصفٍّ حمل رأياً مستورداً، ويمحوه `saveRating` حين يحفظ صاحبُه رأيَه
--      بيده — فيصير رأيَه في Loopz ويدخل حيث تدخل آراؤه.
--   ٢) سبعُ دوالّ تستثني الصفَّ المستورد بشرطٍ واحدٍ يُضاف إلى فرع `ratings`:
--      `community_activity` (النسختان) · `following_activity_v2` (النسختان) ·
--      `award_weekly_top` · و(أحمد «١أ نفذ» بعد مراجعة الوكيل الثاني)
--      `people_featured` («أشخاصٌ مميّزون») و`people_leaderboard` («الأكثر نشاطاً»):
--      كلتاهما تعدّ المراجعاتِ بتاريخها، فمراجعاتٌ مستوردةٌ حديثةُ التاريخ ترفع صاحبها. **التعديلُ يُطبَّق على تعريف الدالّة كما هو في
--      القاعدة** (`pg_get_functiondef` ثمّ استبدالُ سطرٍ واحد) لا على نسخةٍ
--      منسوخةٍ هنا — فلا يُعاد تعريفٌ قديمٌ فوق ما عدّلته هجرةٌ لاحقة، والكتلةُ
--      تتوقّف إن لم تجد السطرَ مرّةً واحدةً بالضبط. `create or replace` يُبقي
--      المنحَ والمالكَ كما هما.
--   ما لا يتغيّر: صفحةُ العمل (`title_reviews`) والملفُّ الشخصيّ
--   (`profile_activity` · `user_ratings`) — هناك يُرى الرأيُ المستورد بتاريخه.
--
--  الرجوع: إعادةُ الدوالّ السبع بحذف «and r.imported_from is null» /
--  «and g.imported_from is null»، ثمّ:
--    alter table public.ratings drop column if exists imported_from;
-- ============================================================

-- معاملةٌ واحدة (مراجعةُ الوكيل الثاني، البند ٦): إن رفعت الكتلةُ استثناءً لا يبقى العمودُ مضافاً والدوالُّ نصفَ معدَّلة
begin;

alter table public.ratings
  add column if not exists imported_from text
  check (imported_from is null or imported_from in ('letterboxd', 'trakt', 'auto'));

comment on column public.ratings.imported_from is
  'T507 — set when the review on this row was imported (letterboxd | trakt | auto). Excluded from friends activity, community feed and weekly top. Cleared when the owner saves the rating in Loopz.';

do $mig$
declare
  fn  regprocedure;
  d   text;
  pat text;
  rep text;
  want int;
begin
  foreach fn in array array[
    'public.community_activity()'::regprocedure,
    'public.community_activity(timestamp with time zone, integer)'::regprocedure,
    'public.following_activity_v2()'::regprocedure,
    'public.following_activity_v2(timestamp with time zone, integer)'::regprocedure,
    'public.award_weekly_top()'::regprocedure,
    'public.people_featured(integer, integer)'::regprocedure,
    'public.people_leaderboard(integer)'::regprocedure
  ] loop
    d := pg_get_functiondef(fn);
    if position('imported_from' in d) > 0 then
      continue;  -- شُغِّلت قبلُ: لا يُضاف الشرطُ مرّتين
    end if;
    if fn in ('public.community_activity()'::regprocedure,
              'public.community_activity(timestamp with time zone, integer)'::regprocedure,
              'public.following_activity_v2()'::regprocedure,
              'public.following_activity_v2(timestamp with time zone, integer)'::regprocedure) then
      pat := 'coalesce(r.hidden, false) = false';
      rep := 'coalesce(r.hidden, false) = false and r.imported_from is null';
      want := 1;
    else
      -- «أفضل الأسبوع» و«أشخاصٌ مميّزون» و«الأكثر نشاطاً» (النافذةُ الحاليّة والسابقة: موضعان)
      pat := 'length(btrim(g.review)) > 0';
      rep := 'length(btrim(g.review)) > 0 and g.imported_from is null';
      want := case when fn = 'public.people_leaderboard(integer)'::regprocedure then 2 else 1 end;
    end if;
    if (length(d) - length(replace(d, pat, ''))) / length(pat) <> want then
      raise exception '258: % — expected % × "%"', fn, want, pat;
    end if;
    execute replace(d, pat, rep);
  end loop;
end
$mig$;

commit;

-- PostgREST يقرأ مخطّطَه من جديد فيعرف العمودَ الجديد قبل أوّل كتابة (وإلّا PGRST204 حتى تُعاد قراءتُه)
notify pgrst, 'reload schema';

-- ============================================================
--  التحقُّق بعد التشغيل (كلُّها true):
--  select bool_and(position('imported_from is null' in pg_get_functiondef(p.oid)) > 0)
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('community_activity', 'following_activity_v2', 'award_weekly_top', 'people_featured', 'people_leaderboard');
--  select count(*) = 7 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('community_activity', 'following_activity_v2', 'award_weekly_top', 'people_featured', 'people_leaderboard');
--  select exists (select 1 from information_schema.columns
--   where table_schema = 'public' and table_name = 'ratings' and column_name = 'imported_from');
-- ============================================================
