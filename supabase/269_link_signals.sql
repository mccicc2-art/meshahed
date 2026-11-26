-- 269 — الجرسُ يقول ما وصل من الربوط (T561، أحمد ٢٦ نوفمبر ٢٠٢٦)
--
-- قرارُ أحمد: «الجرس قليل جدا … المفترض يجي تنبيه فيه حين اضافت عمل من اي ربط، سواء نيتفليكس او OSN ستريميو نوفيو كودي».
-- «١أ» — Stremio وNuvio سؤالٌ «شاهدتها؟» يُجاب من الجرس · «٢ب» — مزامنةُ نتفليكس وOSN+ إشعارُ جوالٍ لا شريط.
--
-- ثلاثةُ أشياء، إضافاتٌ فقط — لا عمودَ يُمسّ ولا دالّةَ جرسٍ قائمةً (`my_signals_v4`) تتغيّر:
--
--   link_adds          — سطرٌ لكلِّ دفعةٍ تصل من مزامنة منصّة (نتفليكس · OSN+). 🔴 لماذا جدولٌ لا قراءةٌ من `watched_*`:
--                        وقتُ الصفّ هناك وقتُ المشاهدة على المنصّة (أمس، أو قبل سنة في الاستيراد) لا وقتُ وصوله، فلا يُعرف
--                        «جديدٌ بعد آخر فتحةٍ للجرس». والكتابةُ للخادم وحدَه (مفتاحُ الخدمة) بعد مزامنةٍ ناجحة.
--   my_link_signals()  — أسطرُ الجرس من الربوط، **دالّةٌ منفصلةٌ تُضاف إلى الحمولة بجانب `rows`** فلا تراها نسخةٌ قديمة:
--                          · `link_added` من `link_adds` (نتفليكس · OSN+)
--                          · `link_added` مما سجّله Loopz بنفسه من سيرفر البيت (`watch_signals.auto_at`) — سطرٌ لكلِّ عملٍ في اليوم
--                          · `link_ask` سؤالٌ منتظرٌ شُغِّل (`played_at`) من أيِّ ربط — يُجاب من الجرس، أسبوعاً ثمّ يسقط منه
--
-- ⚖️ **`unread_signals` لا تُمسّ**: الشارةُ تجمع العدّين في الخادم (`getUnreadSignals`) فتصل مع الكود الذي يرسم الأسطر — عدٌّ
--    يسبق رسمَها كان سيُظهر رقماً على جرسٍ لا جديدَ فيه حتى الرفع (جُرّب وأُرجع على الإنتاج في الدقيقة نفسِها).
--
-- جُرّبت على `loopz-preview` ثمّ شُغّلت على الإنتاج بإذن أحمد ٢٦ نوفمبر («ااذن لك بتشغيل الجره»).

create table if not exists public.link_adds (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  source     text not null check (source in ('netflix', 'osn')),
  episodes   integer not null default 0 check (episodes between 0 and 100000),
  movies     integer not null default 0 check (movies between 0 and 100000),
  -- اسمُ العمل كما جاء من المنصّة (الأوّلُ في الدفعة) — والحلقةُ حين تكون الدفعةُ حلقةً واحدة
  title      text check (char_length(title) <= 200),
  works      integer not null default 1 check (works between 0 and 100000),
  season     integer check (season between 0 and 1000),
  episode    integer check (episode between 0 and 20000),
  at         timestamptz not null default now()
);

create index if not exists link_adds_user_at_idx on public.link_adds (user_id, at desc);

alter table public.link_adds enable row level security;

drop policy if exists "own link adds (read)" on public.link_adds;
create policy "own link adds (read)"
  on public.link_adds for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.link_adds from anon;
revoke insert, update, delete, truncate on public.link_adds from authenticated;

create or replace function public.my_link_signals()
returns table (kind text, source text, media_type text, tmdb_id integer, title text, works integer, season integer, episode integer, episodes integer, movies integer, signal_id bigint, at timestamp with time zone, is_new boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as uid,
         (select p.notif_seen_at from public.profiles p where p.id = auth.uid()) as seen
),
r as (
  select 'link_added'::text as kind, a.source, null::text as media_type, null::integer as tmdb_id, a.title, a.works,
         a.season, a.episode, a.episodes, a.movies, null::bigint as signal_id, a.at
    from public.link_adds a, me
   where a.user_id = me.uid
     and a.at >= now() - interval '30 days'
  union all
  -- ما سجّله Loopz بنفسه من Kodi وأخواته: سطرٌ لكلِّ عملٍ في اليوم، والحلقةُ حين تكون واحدة
  select 'link_added', w.source, w.media_type, w.tmdb_id, max(f.title), 1,
         case when count(*) = 1 then min(w.season) end,
         case when count(*) = 1 then min(w.episode) end,
         (count(*) filter (where w.media_type = 'tv'))::integer,
         (count(*) filter (where w.media_type = 'movie'))::integer,
         null, max(w.auto_at)
    from public.watch_signals w
    left join public.follows f
      on f.user_id = w.user_id and f.tmdb_id = w.tmdb_id and f.media_type = w.media_type
   cross join me
   where w.user_id = me.uid
     and w.auto_at is not null
     and w.auto_at >= now() - interval '30 days'
   group by w.source, w.media_type, w.tmdb_id, (w.auto_at at time zone 'UTC')::date
  union all
  -- سؤالٌ منتظرٌ شُغِّل: من الجرس يُجاب — أسبوعاً، وما قبله في بطاقة الرئيسيّة كما كان
  select 'link_ask', w.source, w.media_type, w.tmdb_id, f.title, 1, w.season, w.episode, null, null, w.id, w.played_at
    from public.watch_signals w
    left join public.follows f
      on f.user_id = w.user_id and f.tmdb_id = w.tmdb_id and f.media_type = w.media_type
   cross join me
   where w.user_id = me.uid
     and w.state = 'pending'
     and w.auto_at is null
     and w.played_at is not null
     and w.played_at >= now() - interval '7 days'
)
select r.kind, r.source, r.media_type, r.tmdb_id, r.title, r.works, r.season, r.episode, r.episodes, r.movies, r.signal_id, r.at,
       (me.seen is null or r.at > me.seen) as is_new
  from r, me
 order by r.at desc
 limit 40;
$function$;

revoke all on function public.my_link_signals() from public, anon;
grant execute on function public.my_link_signals() to authenticated, service_role;

comment on table public.link_adds is 'T561 (269) — one row per platform sync batch that added watches (Netflix, OSN+): read by my_link_signals() for the bell; written by the server only.';
