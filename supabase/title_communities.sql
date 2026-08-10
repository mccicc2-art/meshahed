-- ============================================================
--  Loopz — غرف الأعمال (هجرة 53، D-140)
--  شغّلها في Supabase → SQL Editor بعد episode_ratings.sql (52)
--
--  الفكرة: غرفة نقاشٍ **لكل عمل**، لا يملكها أحد. غرف الناس كما هي
--  (`kind = 'user'`)، وغرف الأعمال نوعٌ ثانٍ (`kind = 'title'`) بلا مالك
--  ومفتاحُه (tmdb_id, media_type).
--
--  ⚠️ القيد البنيويّ الذي فرض هذه الهجرة: `owner_id` كان
--  `not null unique` — مجتمعٌ واحد لكل شخص، ولا مكانَ لغرفةٍ بلا مالك.
--  نفكّ الفرادة عن **غرف النظام وحدها** بفهرسٍ فريد جزئيّ
--  (`where kind = 'user'`)، فتبقى قاعدة «لكل شخصٍ مجتمعٌ واحد» قائمةً
--  حرفياً على غرف الناس.
--
--  ومتى تُولد الغرفة؟ **الاثنان معاً** (قرار أحمد):
--   - مهمّةٌ مجدولة تُنشئ غرفاً لأقوى **٥** أعمالٍ رائجةٍ **داخل لوبز**
--     (الأكثر إضافةً إلى المكتبات في آخر ١٤ يوماً) — لا لكل عمل: الغرفة
--     الفارغة أسوأ من غياب الغرفة.
--   - وما عداها **كسولٌ عند أوّل اهتمام**: أوّل من يضغط «غرفة النقاش» في
--     صفحة العمل يولدها.
--  وأرشفةٌ بعد **٣٠ يوماً** من الصمت، تُفكّ من تلقاء نفسها بأوّل رسالة.
-- ============================================================

-- ============================================================
--  ١) الأعمدة — نوعُ الغرفة، والعمل الذي تخصّه، وختمُ الأرشفة
-- ============================================================
alter table public.communities
  add column if not exists kind        text not null default 'user',
  add column if not exists tmdb_id     integer,
  add column if not exists media_type  text,
  add column if not exists archived_at timestamptz;

-- الاسم كان محدوداً بـ٥٠ حرفاً — وهو حدُّ حقلٍ يكتبه إنسان، لا حدُّ اسم
-- عملٍ يأتي من TMDB («The Lord of the Rings: The Fellowship of the Ring»
-- وحده ٤٩). نرفعه إلى ١٢٠ في القاعدة، ويبقى حقل الإنشاء في الواجهة ٥٠.
alter table public.communities drop constraint if exists communities_name_check;
alter table public.communities
  add constraint communities_name_check check (length(btrim(name)) between 2 and 120);

alter table public.communities drop constraint if exists communities_kind_check;
alter table public.communities
  add constraint communities_kind_check check (kind in ('user', 'title'));

-- شكلُ الصفّ يحرسه قيدٌ واحد لا ثلاثة تعليقات: غرفةُ شخصٍ لها مالكٌ ولا
-- عملَ لها، وغرفةُ عملٍ لها عملٌ ولا مالكَ لها وهي **عامّةٌ دائماً**
-- (غرفةُ عملٍ خاصّة تناقضُ سببَ وجودها).
alter table public.communities drop constraint if exists communities_shape_check;
alter table public.communities
  add constraint communities_shape_check check (
    (kind = 'user'
       and owner_id is not null and tmdb_id is null and media_type is null)
    or
    (kind = 'title'
       and owner_id is null and tmdb_id is not null
       and media_type in ('tv', 'movie') and is_private = false)
  );

-- ============================================================
--  ٢) فكُّ الفرادة عن غرف الأعمال دون أن تُمسّ غرف الناس
-- ============================================================
alter table public.communities alter column owner_id drop not null;

-- بالاسم المتوقَّع، ثم بالبحث عنه — القيد وُلد من `unique` مضمَّنٍ في
-- تعريف العمود، واسمُه اصطلاحيٌّ لا مضمون. الإسقاطُ بالاسم وحده كان
-- سيمرّ صامتاً ويترك الفرادة قائمةً فتفشل أوّل غرفةِ عمل.
alter table public.communities drop constraint if exists communities_owner_id_key;
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'communities'
      and con.contype = 'u'
      and con.conkey = array[(
        select attnum from pg_attribute
        where attrelid = rel.oid and attname = 'owner_id'
      )]
  loop
    execute format('alter table public.communities drop constraint %I', c.conname);
  end loop;
end $$;

-- «لكل شخصٍ مجتمعٌ واحد» — القاعدة نفسها، بفهرسٍ جزئيّ بدل قيدٍ شامل
create unique index if not exists communities_owner_user_idx
  on public.communities (owner_id) where kind = 'user';

-- «لكل عملٍ غرفةٌ واحدة» — والفهرس نفسه هو ما يستنده `on conflict` أدناه
create unique index if not exists communities_title_idx
  on public.communities (tmdb_id, media_type) where kind = 'title';

create index if not exists communities_kind_idx
  on public.communities (kind, archived_at);

-- ملاحظة على السياسات القائمة: كلُّها تقارن `auth.uid() = owner_id`.
-- وغرفة العمل بلا مالك، فالمقارنة `null` — أي **لا أحد** يعدّلها أو
-- يحذفها أو يُنشئها من العميل. لا سياسة جديدة، والبابُ الوحيد إليها
-- هو `title_community` أدناه (definer).

-- ============================================================
--  ٣) القراءة قبل الانضمام — لغرف الأعمال وحدها
-- ============================================================
-- غرفة العمل نقاشٌ عامٌّ عن عملٍ عامّ: من يفتحها يجب أن **يرى** ما فيها
-- ثم يقرّر. الانضمام يبقى شرطَ **الكتابة** (سياسة النشر لم تُمسّ)، وغرف
-- الناس على حالها حرفياً — لا تُقرأ إلا بعضوية.
create or replace function public.is_open_title_room(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.communities c
    where c.id = p_community and c.kind = 'title'
  );
$$;
revoke all on function public.is_open_title_room(uuid) from public;
grant execute on function public.is_open_title_room(uuid) to authenticated;

drop policy if exists "members read messages" on public.community_messages;
create policy "members read messages" on public.community_messages
  for select to authenticated
  using (
    public.is_community_member(community_id, auth.uid())
    or public.is_open_title_room(community_id)
  );

-- عددُ الأعضاء الحقيقي: قائمة الأعضاء محروسةٌ بالعضوية (وتبقى كذلك)،
-- فكان غيرُ العضو يقرأ «٠ أعضاء» — رقمٌ كاذب. العدد وحده definer.
create or replace function public.community_member_count(p_community uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.community_members m
  where m.community_id = p_community;
$$;
revoke all on function public.community_member_count(uuid) from public;
grant execute on function public.community_member_count(uuid) to authenticated;

-- ============================================================
--  ٤) الميلاد الكسول — أوّل اهتمامٍ يولد الغرفة
-- ============================================================
-- الاسم والملصق يأتيان من **الخادم** (getTv/getMovie في الفعل) لا من
-- العميل: غرفةُ العمل صفٌّ يراه كل الناس، واسمُه لو جاء من المتصفّح
-- لصار بابَ تشويهٍ مفتوحاً على عملٍ لا يملكه أحد.
create or replace function public.title_community(
  p_tmdb   integer,
  p_type   text,
  p_name   text,
  p_poster text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare cid uuid; nm text := left(btrim(coalesce(p_name, '')), 120);
begin
  if auth.uid() is null then return null; end if;
  if p_tmdb is null or p_tmdb <= 0 or p_type not in ('tv', 'movie') then return null; end if;

  select id into cid from public.communities
  where kind = 'title' and tmdb_id = p_tmdb and media_type = p_type;

  if cid is null then
    if length(nm) < 2 then return null; end if;
    insert into public.communities (kind, name, is_private, tmdb_id, media_type, photo_url)
    values ('title', nm, false, p_tmdb, p_type, p_poster)
    on conflict (tmdb_id, media_type) where kind = 'title' do nothing
    returning id into cid;
    -- سباقُ نداءَين على العمل نفسه: الخاسر يقرأ صفَّ الفائز
    if cid is null then
      select id into cid from public.communities
      where kind = 'title' and tmdb_id = p_tmdb and media_type = p_type;
    end if;
  else
    -- الاهتمام نفسه يفكّ الأرشفة
    update public.communities set archived_at = null
    where id = cid and archived_at is not null;
  end if;

  return cid;
end;
$$;
revoke all on function public.title_community(integer, text, text, text) from public;
grant execute on function public.title_community(integer, text, text, text) to authenticated;

-- غرفةُ عملٍ **إن وُجدت** — صفحة العمل تسأل قبل أن تَعِد: زرُّ «افتح
-- الغرفة (١٢ عضواً)» و«ابدأ غرفة النقاش» ليسا وعداً واحداً.
create or replace function public.title_room_of(p_tmdb integer, p_type text)
returns table (id uuid, member_count integer, archived boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         (select count(*)::int from public.community_members m where m.community_id = c.id),
         c.archived_at is not null
  from public.communities c
  where c.kind = 'title' and c.tmdb_id = p_tmdb and c.media_type = p_type;
$$;
revoke all on function public.title_room_of(integer, text) from public;
grant execute on function public.title_room_of(integer, text) to authenticated;

-- ============================================================
--  ٥) دوالّ الدليل — العمود الجديد في **ذيل** جدول الإرجاع (D-037)
--     تغييرُ نوع الإرجاع يستلزم إسقاطاً أوّلاً: create or replace لا يقبله
-- ============================================================
drop function if exists public.search_communities(text);
create function public.search_communities(q text)
returns table (
  id           uuid,
  name         text,
  is_private   boolean,
  owner_id     uuid,
  member_count integer,
  my_status    text,
  photo_url    text,
  kind         text,
  tmdb_id      integer,
  media_type   text,
  archived     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    case
      when exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()) then 'member'
      when exists (select 1 from public.community_join_requests r where r.community_id = c.id and r.user_id = auth.uid()) then 'requested'
      else 'none'
    end,
    c.photo_url, c.kind, c.tmdb_id, c.media_type, c.archived_at is not null
  from public.communities c
  where (btrim(q) = '' or c.name ilike '%' || btrim(q) || '%')
    -- غرفةُ عملٍ مهجورةٌ لا تُعرض في البحث؛ بابُها صفحةُ العمل وحدها
    and (c.kind <> 'title' or c.archived_at is null)
  order by (select count(*) from public.community_members m where m.community_id = c.id) desc
  limit 30;
$$;
revoke all on function public.search_communities(text) from public;
grant execute on function public.search_communities(text) to authenticated;

drop function if exists public.my_communities();
create function public.my_communities()
returns table (
  id uuid, name text, is_private boolean, owner_id uuid,
  member_count integer, photo_url text,
  kind text, tmdb_id integer, media_type text, archived boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m2 where m2.community_id = c.id),
    c.photo_url, c.kind, c.tmdb_id, c.media_type, c.archived_at is not null
  from public.communities c
  join public.community_members m on m.community_id = c.id and m.user_id = auth.uid()
  order by c.created_at desc;
$$;
revoke all on function public.my_communities() from public;
grant execute on function public.my_communities() to authenticated;

drop function if exists public.my_community_invites();
create function public.my_community_invites()
returns table (
  id uuid, name text, is_private boolean, owner_id uuid,
  member_count integer, photo_url text,
  kind text, tmdb_id integer, media_type text, archived boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    c.photo_url, c.kind, c.tmdb_id, c.media_type, c.archived_at is not null
  from public.communities c
  join public.community_invites i on i.community_id = c.id and i.user_id = auth.uid()
  order by i.created_at desc;
$$;
revoke all on function public.my_community_invites() from public;
grant execute on function public.my_community_invites() to authenticated;

-- غرف الأعمال الحيّة — صفٌّ في الدليل. الترتيب **بالكلام لا بالعدد**:
-- رسائل آخر سبعة أيام أوّلاً، ثم الأعضاء. غرفةٌ بمئة عضوٍ صامتة ليست
-- أحيا من غرفةٍ بعشرةٍ يتكلّمون.
create or replace function public.title_rooms(p_limit integer default 12)
returns table (
  id           uuid,
  name         text,
  is_private   boolean,
  owner_id     uuid,
  member_count integer,
  my_status    text,
  photo_url    text,
  kind         text,
  tmdb_id      integer,
  media_type   text,
  archived     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    case
      when exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()) then 'member'
      else 'none'
    end,
    c.photo_url, c.kind, c.tmdb_id, c.media_type, false
  from public.communities c
  where c.kind = 'title' and c.archived_at is null
  order by
    (select count(*) from public.community_messages g
      where g.community_id = c.id and g.created_at > now() - interval '7 days') desc,
    (select count(*) from public.community_members m where m.community_id = c.id) desc,
    c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;
revoke all on function public.title_rooms(integer) from public;
grant execute on function public.title_rooms(integer) to authenticated;

-- ============================================================
--  ٦) المهمّة المجدولة — كنسٌ ثم ميلاد
-- ============================================================
-- ليست مكشوفةً لأحد: لا `grant` إلى `authenticated`. يشغّلها المالك أو
-- pg_cron وحدهما. «الرائج» هنا رائجُ **لوبز** لا رائجُ TMDB — الغرفة
-- تولد حيث الناس فعلاً، ولأن الاسم والملصق في `follows` أصلاً فلا نداءَ
-- خارجيّ ولا مفتاحَ جديد.
create or replace function public.maintain_title_communities()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare r record;
begin
  -- ١) الكنس: صمتُ ٣٠ يوماً يؤرشف، والكلامُ يفكّ الأرشفة. الحسبة تصحّح
  --    نفسها في كل تشغيل، فلا حالةٌ عالقة. (`where` صريح — مصيدة safeupdate.)
  update public.communities c
  set archived_at = x.next_val
  from (
    select c2.id,
      case
        when coalesce(
               (select max(g.created_at) from public.community_messages g where g.community_id = c2.id),
               c2.created_at
             ) > now() - interval '30 days'
        then null
        else coalesce(c2.archived_at, now())
      end as next_val
    from public.communities c2
    where c2.kind = 'title'
  ) x
  where c.id = x.id and c.archived_at is distinct from x.next_val;

  -- ٢) أقوى خمسة أعمالٍ رائجة داخل لوبز — إضافاتُ آخر ١٤ يوماً.
  --    حاجز ٣ إضافات: عملٌ أضافه شخصٌ واحد ليس رائجاً، وغرفتُه ستولد
  --    فارغةً — وهو ما قرّرنا ألّا نفعله.
  for r in
    select f.tmdb_id,
           f.media_type,
           left(btrim((array_agg(f.title order by f.added_at desc))[1]), 120) as title,
           (array_agg(f.poster_path order by f.added_at desc))[1]             as poster
    from public.follows f
    where f.added_at > now() - interval '14 days'
    group by f.tmdb_id, f.media_type
    having count(*) >= 3
       and length(btrim((array_agg(f.title order by f.added_at desc))[1])) >= 2
    order by count(*) desc, max(f.added_at) desc
    limit 5
  loop
    insert into public.communities (kind, name, is_private, tmdb_id, media_type, photo_url)
    values (
      'title', r.title, false, r.tmdb_id, r.media_type,
      case when r.poster is null then null
           else 'https://image.tmdb.org/t/p/w185' || r.poster end
    )
    on conflict (tmdb_id, media_type) where kind = 'title' do nothing;

    -- الرواجُ يغلب الصمت: غرفةٌ رائجةٌ اليوم لا تبقى مؤرشفة
    update public.communities
    set archived_at = null
    where kind = 'title' and tmdb_id = r.tmdb_id and media_type = r.media_type
      and archived_at is not null;
  end loop;
end;
$$;
revoke all on function public.maintain_title_communities() from public;

-- ============================================================
--  ٧) الجدولة — pg_cron داخل Supabase (لا مفتاح، لا مسارٌ مكشوف)
--     شغّل هذين السطرين مرّةً واحدة بعد ما سبق.
-- ============================================================
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'loopz-title-communities',
--   '17 3 * * *',                                -- يومياً ٣:١٧ فجراً UTC
--   $cron$ select public.maintain_title_communities(); $cron$
-- );
--
-- للتحقّق:  select jobname, schedule from cron.job;
-- للإلغاء:  select cron.unschedule('loopz-title-communities');

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select column_name, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='communities'
--     and column_name in ('kind','tmdb_id','media_type','archived_at','owner_id');
--
-- select indexname from pg_indexes where tablename='communities';
--   -- المتوقَّع: communities_owner_user_idx · communities_title_idx · communities_kind_idx
--
-- select proname from pg_proc where proname in
--   ('title_community','title_room_of','title_rooms','maintain_title_communities',
--    'is_open_title_room','community_member_count');
--
-- ⚠️ السياسات المفتوحة يجب أن تبقى **أربعاً** — هذه الهجرة لا تضيف خامسة:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
--
-- ولتوليد غرف الرائج فوراً بدل انتظار الفجر:
-- select public.maintain_title_communities();
