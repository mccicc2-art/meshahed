-- ═══════════════════════════════════════════════════════════════════════
-- الهجرة ٢١٨ — **القلبُ على مشاركتك مسموح، والصوتُ لا** (D-1512، R55)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أحمد ٢١ أكتوبر: «نفس نظام تويتر عادي اسوي لنفسي لايك». الواجهةُ فتحت القلبَ
-- في R54 فرفضه الخادم («Something went wrong» في تسجيله ١٣:٣٥) — لأن سياسةَ
-- الإدخال على `title_post_likes` تسأل `can_touch_post` (الهجرة ١١٠)، وهي تشترط
-- `p.user_id is distinct from auth.uid()`: حارسٌ واحدٌ للصوت والقلب معاً.
--
-- **فالسؤالان افترقا**: الصوتُ على نفسك يفسد معنى الترتيب فيبقى ممنوعاً بحارسه
-- القديم؛ والقلبُ علامةُ رضا لا ترتيب، فيكفيه «المشاركةُ موجودةٌ وظاهرة».
-- دالّةٌ `definer` ثانيةٌ (لا شرطٌ في السياسة) لأنّ `title_posts` محروسةٌ بـRLS
-- ولا يقرؤها صاحبُ الطلب إلا لنفسه — السببُ نفسُه في رأس الهجرة ١١٠.
--
-- ⚠️ `drop policy` حذفُ تعريفٍ لا بيانات، في معاملةٍ واحدة، بإذن أحمد الصريح
-- («ولك اذن لتشغيل نص SQL في الانتاج»، ٢١ أكتوبر). لا سياسةَ مفتوحةً جديدة.
--
-- الإرجاع (rollback):
--   begin;
--   drop policy if exists "insert own post like" on public.title_post_likes;
--   create policy "insert own post like" on public.title_post_likes for insert to authenticated
--     with check ((select auth.uid()) = user_id and public.can_touch_post(post_id));
--   drop function if exists public.can_like_post(uuid);
--   commit;

begin;

create or replace function public.can_like_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists ( select 1 from public.title_posts p where p.id = p_post and p.hidden = false ); $$;

revoke all on function public.can_like_post(uuid) from public, anon;
grant execute on function public.can_like_post(uuid) to authenticated;

drop policy if exists "insert own post like" on public.title_post_likes;
create policy "insert own post like" on public.title_post_likes for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_like_post(post_id));

commit;
