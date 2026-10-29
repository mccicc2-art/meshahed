-- =====================================================================
-- 225 — شخصيات لوبز AI: آدم · لينا · سامي · فارس · رامي (D-1563)
-- =====================================================================
-- أحمد ٢٩ أكتوبر ٢٠٢٦: «أبي نضيف في لوبز ٥ شخصيات AI بهوية احترافية…» ثمّ «ب · نفذ» (الحساباتُ بهجرة، الدفعة الأولى).
--
-- 🔑 **مراجعةُ الشخصيّة مراجعةٌ بلا درجة** — مفتاحُها مفتاحُ المراجعة نفسُه (صاحبُ الرأي · العمل · نوعه)، فالإعجابُ والردُّ
--   وصفحةُ الخيط تعمل عليها كما تعمل على مراجعة إنسان، **ولا تدخل `ratings` أبداً**: فلا متوسّطَ جمهورٍ ولا قوائمَ ولا ترتيبَ
--   أشخاص يلمسها (اثنتان وعشرون دالّةً تقرأ `ratings` لا يتغيّر فيها حرف).
-- 🔑 **الظهورُ حكمُ القاعدة لا مهمّةٌ تنشر**: الصفُّ يُكتب الآن ويظهر حين يحين `publish_at` (قرار أحمد: «يكتب ٦ الصباح وما تظهر
--   إلا ١٢ الظهر») — ولا شيء «يُنشر» في ساعته، فلا مهمّةَ تفوت ساعتَها ولا دفعةَ تنزل مرّةً واحدة.
-- 🔑 **الإيقافُ يحجب ما بعد لحظته** (`persona_settings.paused_at`): ما ظهر قبل الإيقاف يبقى، وما جدولُه بعده لا يظهر حتى يُستأنف.
-- 🔑 **والكاتبُ لا يملك غيرَ الإضافة**: `persona_review_add` لا يمنحها هذا الملفُّ لأحد — تُنادى من مالك القاعدة وحدَه (المهمّةُ
--   المجدولة عبر SQL) — ولا تعدّل ولا تحذف ولا تمسّ جدولاً آخر.
--
-- ⚠️ **ومفتاحُ `review_likes` الأجنبيُّ إلى `ratings` يصير حارساً** (`review_likes_target_guard`) يقبل المراجعةَ أو مراجعةَ
--   الشخصيّة الظاهرة، **وسلسلةُ الحذف تبقى كما كانت** بمشغّلٍ على `ratings` (`ratings_drop_likes`) يحذف إعجاباتِ التقييم المحذوف.
--
-- ↩️ التراجع (بالترتيب):
--   drop trigger review_likes_target on public.review_likes; drop function public.review_likes_target_guard();
--   drop trigger ratings_drop_likes on public.ratings; drop function public.review_likes_cascade_rating();
--   delete from public.review_likes l where not exists (select 1 from public.ratings r where r.user_id = l.review_user_id
--     and r.tmdb_id = l.tmdb_id and r.media_type = l.media_type);
--   alter table public.review_likes add constraint review_likes_review_user_id_tmdb_id_media_type_fkey foreign key
--     (review_user_id, tmdb_id, media_type) references public.ratings(user_id, tmdb_id, media_type) on delete cascade;
--   drop table public.persona_reviews, public.persona_settings, public.personas cascade;
--   delete from auth.users where id in (…الخمسة أدناه…);  -- يحذف ملفّاتهم بسلسلة profiles
--   (وقيدُ الصورة يعود بلا سطر loopztv.com)

-- ── ١ · صورُ الشخصيّات من الموقع نفسِه (`/api/v1/persona/{slug}/avatar`) — رابطٌ مطلقٌ تحت `/api/v1` ليمرّ به التطبيقُ ─────
--    من جدار Vercel كما يمرّ الويب (صورةٌ في `public/` تعود للعميل الأصليّ صفحةَ تحدٍّ — D-945)
alter table public.profiles drop constraint if exists profiles_avatar_url_safe;
alter table public.profiles add constraint profiles_avatar_url_safe check (
  avatar_url is null
  or avatar_url ~ '^https://uvgmvrdrxzpudoldjxaa\.supabase\.co/storage/v1/object/public/'
  or avatar_url ~ '^https://lh3\.googleusercontent\.com/'
  or avatar_url ~ '^/[A-Za-z0-9._-]+$'
  or avatar_url ~ '^https://loopztv\.com/api/v1/persona/[a-z]{3,8}/avatar$'
);

-- ── ٢ · الحساباتُ الخمسة — مستخدمو auth بلا كلمة مرور ولا هويّة دخول، فلا يدخل بها أحد ─────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('9bb35dfa-b29e-4c46-9be8-20f725a6f114', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona-adam@loopztv.com',  '{"provider":"persona","providers":[]}', '{"full_name":"آدم"}',  now(), now(), false, false),
  ('9eeed6d2-7c36-494f-9952-d8b64beb71be', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona-lina@loopztv.com',  '{"provider":"persona","providers":[]}', '{"full_name":"لينا"}', now(), now(), false, false),
  ('94b88814-97b0-433c-8639-25f3037eff07', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona-sami@loopztv.com',  '{"provider":"persona","providers":[]}', '{"full_name":"سامي"}', now(), now(), false, false),
  ('d840a56f-8d55-43d9-9d49-7387925715d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona-faris@loopztv.com', '{"provider":"persona","providers":[]}', '{"full_name":"فارس"}', now(), now(), false, false),
  ('23bf22a6-d74c-4d91-a320-47ea03501f9e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona-rami@loopztv.com',  '{"provider":"persona","providers":[]}', '{"full_name":"رامي"}', now(), now(), false, false)
on conflict (id) do nothing;

-- مشغّلُ `handle_new_user` أنشأ الملفّات؛ هنا هويّتُها. الرسائلُ مقفلة (`dm_policy = 'none'`): الشخصيّةُ لا تردّ على أحد.
update public.profiles p set
  username   = v.username,
  nickname   = v.nickname,
  avatar_url = 'https://loopztv.com/api/v1/persona/' || v.username || '/avatar',
  dm_policy  = 'none',
  bio        = null,
  joined_at  = coalesce(p.joined_at, now()),
  onboarded_at = coalesce(p.onboarded_at, now())
from (values
  ('9bb35dfa-b29e-4c46-9be8-20f725a6f114'::uuid, 'adam',  'آدم'),
  ('9eeed6d2-7c36-494f-9952-d8b64beb71be'::uuid, 'lina',  'لينا'),
  ('94b88814-97b0-433c-8639-25f3037eff07'::uuid, 'sami',  'سامي'),
  ('d840a56f-8d55-43d9-9d49-7387925715d1'::uuid, 'faris', 'فارس'),
  ('23bf22a6-d74c-4d91-a320-47ea03501f9e'::uuid, 'rami',  'رامي')
) as v(id, username, nickname)
where p.id = v.id;

-- ── ٣ · سجلُّ الشخصيّات — المرجعُ الذي يقبله جدولُ المراجعات (لا قراءةَ مباشرة: الهويّةُ في `src/core/personas.ts`) ─────
create table if not exists public.personas (
  id   uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z]{3,8}$')
);
alter table public.personas enable row level security;
revoke all on public.personas from anon, authenticated;

insert into public.personas (id, slug) values
  ('9bb35dfa-b29e-4c46-9be8-20f725a6f114', 'adam'),
  ('9eeed6d2-7c36-494f-9952-d8b64beb71be', 'lina'),
  ('94b88814-97b0-433c-8639-25f3037eff07', 'sami'),
  ('d840a56f-8d55-43d9-9d49-7387925715d1', 'faris'),
  ('23bf22a6-d74c-4d91-a320-47ea03501f9e', 'rami')
on conflict (id) do nothing;

-- ── ٤ · المراجعات — نصّان لمنشورٍ واحد، وتفرّدُ (الشخصيّة · العمل): لا يعود العملُ للشخصيّة نفسِها مرّتين ─────────────
create table if not exists public.persona_reviews (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.personas(id) on delete cascade,
  media_type  text not null check (media_type in ('tv', 'movie')),
  tmdb_id     integer not null check (tmdb_id > 0),
  title       text,
  poster_path text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]+$'),
  scope_ar    text check (scope_ar is null or char_length(scope_ar) <= 60),
  scope_en    text check (scope_en is null or char_length(scope_en) <= 60),
  body_ar     text not null check (char_length(btrim(body_ar)) between 40 and 1600),
  body_en     text not null check (char_length(btrim(body_en)) between 40 and 1600),
  has_spoiler boolean not null default false,
  sources     jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  status      text not null default 'live' check (status in ('live', 'hidden')),
  publish_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (persona_id, media_type, tmdb_id)
);
create index if not exists persona_reviews_title_idx on public.persona_reviews (media_type, tmdb_id);
create index if not exists persona_reviews_persona_idx on public.persona_reviews (persona_id, publish_at desc);
create index if not exists persona_reviews_publish_idx on public.persona_reviews (publish_at desc);
alter table public.persona_reviews enable row level security;
revoke all on public.persona_reviews from anon, authenticated;

-- ── ٥ · الإعدادات — صفٌّ واحد: الإيقافُ ولحظتُه، وكمُّ الساعة (يقرؤه الكاتبُ المجدول) ───────────────────────────────────
create table if not exists public.persona_settings (
  id           smallint primary key default 1 check (id = 1),
  paused       boolean not null default false,
  paused_at    timestamptz,
  per_hour_min smallint not null default 3 check (per_hour_min between 0 and 20),
  per_hour_max smallint not null default 5 check (per_hour_max between 0 and 20),
  updated_at   timestamptz not null default now(),
  check (per_hour_min <= per_hour_max)
);
insert into public.persona_settings (id) values (1) on conflict (id) do nothing;
alter table public.persona_settings enable row level security;
revoke all on public.persona_settings from anon, authenticated;

-- ── ٦ · حكمُ الظهور — في مكانٍ واحد تقرؤه كلُّ الدوالّ ───────────────────────────────────────────────────────────────────
create or replace function public.persona_review_visible(p_status text, p_publish timestamptz)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select p_status = 'live'
     and p_publish <= now()
     and not exists (
       select 1 from public.persona_settings s
        where s.paused and p_publish > coalesce(s.paused_at, '-infinity'::timestamptz)
     );
$$;
revoke all on function public.persona_review_visible(text, timestamptz) from public, anon, authenticated;

-- ── ٧ · القراءة — مراجعاتُ عمل، ومراجعاتُ شخصيّة (للزائر أيضاً كـ`title_reviews`) ────────────────────────────────────────
create or replace function public.title_persona_reviews(t_id integer, m_type text)
returns table (persona_id uuid, username text, avatar_url text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, publish_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.persona_id, p.username, p.avatar_url, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler, r.publish_at
    from public.persona_reviews r
    join public.profiles p on p.id = r.persona_id
   where r.tmdb_id = t_id and r.media_type = m_type
     and public.persona_review_visible(r.status, r.publish_at)
   order by r.publish_at desc
   limit 10;
$$;
revoke all on function public.title_persona_reviews(integer, text) from public;
grant execute on function public.title_persona_reviews(integer, text) to anon, authenticated;

create or replace function public.persona_reviews_of(p_persona uuid, p_limit integer default 60)
returns table (media_type text, tmdb_id integer, title text, poster_path text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, publish_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.media_type, r.tmdb_id, r.title, r.poster_path, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler, r.publish_at
    from public.persona_reviews r
   where r.persona_id = p_persona
     and public.persona_review_visible(r.status, r.publish_at)
   order by r.publish_at desc
   limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.persona_reviews_of(uuid, integer) from public;
grant execute on function public.persona_reviews_of(uuid, integer) to anon, authenticated;

-- ── ٨ · الإعجاب: المفتاحُ الأجنبيُّ يصير حارساً يقبل الصنفين، والحذفُ المتسلسلُ يبقى ───────────────────────────────────────
alter table public.review_likes drop constraint if exists review_likes_review_user_id_tmdb_id_media_type_fkey;

create or replace function public.review_likes_target_guard()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.ratings r
              where r.user_id = new.review_user_id and r.tmdb_id = new.tmdb_id and r.media_type = new.media_type) then
    return new;
  end if;
  if exists (select 1 from public.persona_reviews p
              where p.persona_id = new.review_user_id and p.tmdb_id = new.tmdb_id and p.media_type = new.media_type
                and public.persona_review_visible(p.status, p.publish_at)) then
    return new;
  end if;
  raise exception 'review_likes: no review for this key' using errcode = '23503';
end;
$$;
revoke all on function public.review_likes_target_guard() from public, anon, authenticated;
drop trigger if exists review_likes_target on public.review_likes;
create trigger review_likes_target before insert or update on public.review_likes
  for each row execute function public.review_likes_target_guard();

create or replace function public.review_likes_cascade_rating()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  delete from public.review_likes l
   where l.review_user_id = old.user_id and l.tmdb_id = old.tmdb_id and l.media_type = old.media_type;
  return old;
end;
$$;
revoke all on function public.review_likes_cascade_rating() from public, anon, authenticated;
drop trigger if exists ratings_drop_likes on public.ratings;
create trigger ratings_drop_likes after delete on public.ratings
  for each row execute function public.review_likes_cascade_rating();

create or replace function public.persona_reviews_drop_likes()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  delete from public.review_likes l
   where l.review_user_id = old.persona_id and l.tmdb_id = old.tmdb_id and l.media_type = old.media_type;
  return old;
end;
$$;
revoke all on function public.persona_reviews_drop_likes() from public, anon, authenticated;
drop trigger if exists persona_reviews_drop_likes on public.persona_reviews;
create trigger persona_reviews_drop_likes after delete on public.persona_reviews
  for each row execute function public.persona_reviews_drop_likes();

-- ── ٩ · الكاتب — إضافةٌ وحدَها، ولا منحَ لأحد (المالكُ ينادي) ─────────────────────────────────────────────────────────────
create or replace function public.persona_review_add(
  p_slug text, p_media text, p_tmdb integer, p_title text, p_poster text,
  p_scope_ar text, p_scope_en text, p_body_ar text, p_body_en text,
  p_sources jsonb, p_spoiler boolean, p_publish_at timestamptz)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  pid uuid;
  rid uuid;
begin
  select id into pid from public.personas where slug = p_slug;
  if pid is null then raise exception 'persona_review_add: unknown persona %', p_slug; end if;
  insert into public.persona_reviews (persona_id, media_type, tmdb_id, title, poster_path, scope_ar, scope_en,
                                      body_ar, body_en, sources, has_spoiler, publish_at)
  values (pid, p_media, p_tmdb, nullif(btrim(p_title), ''), nullif(btrim(p_poster), ''), nullif(btrim(p_scope_ar), ''),
          nullif(btrim(p_scope_en), ''), btrim(p_body_ar), btrim(p_body_en), coalesce(p_sources, '[]'::jsonb),
          coalesce(p_spoiler, false), coalesce(p_publish_at, now()))
  on conflict (persona_id, media_type, tmdb_id) do nothing
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.persona_review_add(text, text, integer, text, text, text, text, text, text, jsonb, boolean, timestamptz)
  from public, anon, authenticated;

-- ── ١٠ · الإدارة — الطابور، والتعديلُ والإخفاء، والإيقاف (حارسُها `am_admin` كبقيّة اللوحة) ─────────────────────────────
create or replace function public.admin_persona_reviews(p_limit integer default 200)
returns table (id uuid, slug text, media_type text, tmdb_id integer, title text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, status text, publish_at timestamptz,
               created_at timestamptz, visible boolean, likes integer)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, pe.slug, r.media_type, r.tmdb_id, r.title, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler,
           r.status, r.publish_at, r.created_at, public.persona_review_visible(r.status, r.publish_at),
           (select count(*)::integer from public.review_likes l
             where l.review_user_id = r.persona_id and l.tmdb_id = r.tmdb_id and l.media_type = r.media_type)
      from public.persona_reviews r
      join public.personas pe on pe.id = r.persona_id
     order by r.publish_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;
revoke all on function public.admin_persona_reviews(integer) from public, anon;
grant execute on function public.admin_persona_reviews(integer) to authenticated;

create or replace function public.admin_persona_review_update(p_id uuid, p_status text, p_body_ar text, p_body_en text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.persona_reviews set
    status     = coalesce(p_status, status),
    body_ar    = coalesce(nullif(btrim(p_body_ar), ''), body_ar),
    body_en    = coalesce(nullif(btrim(p_body_en), ''), body_en),
    updated_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.admin_persona_review_update(uuid, text, text, text) from public, anon;
grant execute on function public.admin_persona_review_update(uuid, text, text, text) to authenticated;

create or replace function public.admin_persona_settings()
returns table (paused boolean, paused_at timestamptz, per_hour_min smallint, per_hour_max smallint,
               waiting integer, live integer, hidden integer)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select s.paused, s.paused_at, s.per_hour_min, s.per_hour_max,
           (select count(*)::integer from public.persona_reviews r where r.status = 'live' and not public.persona_review_visible(r.status, r.publish_at)),
           (select count(*)::integer from public.persona_reviews r where public.persona_review_visible(r.status, r.publish_at)),
           (select count(*)::integer from public.persona_reviews r where r.status = 'hidden')
      from public.persona_settings s where s.id = 1;
end;
$$;
revoke all on function public.admin_persona_settings() from public, anon;
grant execute on function public.admin_persona_settings() to authenticated;

create or replace function public.admin_persona_pause(p_paused boolean)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.persona_settings set
    paused     = coalesce(p_paused, false),
    paused_at  = case when coalesce(p_paused, false) then now() else null end,
    updated_at = now()
  where id = 1;
end;
$$;
revoke all on function public.admin_persona_pause(boolean) from public, anon;
grant execute on function public.admin_persona_pause(boolean) to authenticated;

-- ── ١١ · البداية — نماذجُ اللوحة التي عُرضت على أحمد (٢٩ أكتوبر)، ظاهرةً من الآن ────────────────────────────────────────
select public.persona_review_add('adam', 'movie', 157336, null, null, null, null,
  'الفيلم مبني مثل لغز: تفاصيل صغيرة في الساعة الأولى ترجع لاحقًا بمعنى مختلف تمامًا. نولان ما يشرح كل شيء، يخليك تربط بنفسك. لو تحب الأفلام اللي تكافئ الانتباه، هذا من أفضلها — بس لا تستعجل على المشاهد الأولى.',
  'Built like a puzzle: small details in the first hour come back later meaning something completely different. Nolan doesn''t explain everything — he lets you connect it yourself. If you like films that reward attention, this is one of the best. Just don''t rush the opening.',
  '[]'::jsonb, false, now() - interval '3 hours');
select public.persona_review_add('lina', 'movie', 157336, null, null, null, null,
  'تحت كل هالفضاء والثقوب السوداء، القصة الحقيقية عن أب وبنته ووعد بينهم. علاقة كوبر ومورف هي اللي تشيل الفيلم عاطفيًا، والموسيقى تضاعف الإحساس. ممكن تضيع في بعض الشرح العلمي، بس المشاعر واضحة وصادقة.',
  'Under all the space and black holes, the real story is a father, his daughter and a promise between them. Cooper and Murph carry the film emotionally, and the score doubles every feeling. Some of the science may lose you; the emotion never does.',
  '[]'::jsonb, false, now() - interval '5 hours');
select public.persona_review_add('sami', 'movie', 157336, null, null, null, null,
  'يستاهل؟ إيه، بس اعرف إنك داخل على قرابة ثلاث ساعات. أول ساعة هادية وتبني القصة على راحتها، وبعدها ما يفلتك. الشرح العلمي يثقل أحيانًا، لكن المشاهد الكبيرة تعوّض. نصيحتي: شاشة كبيرة وصوت عالي، ولا تبدأه وانت تعبان.',
  'Worth it? Yes — but know you''re signing up for nearly three hours. The first hour takes its time; after that it doesn''t let go. The science talk gets heavy now and then, and the big set pieces make up for it. My advice: big screen, loud sound, and don''t start it tired.',
  '[]'::jsonb, false, now() - interval '20 hours');
select public.persona_review_add('adam', 'tv', 70523, null, null, 'الموسم الأول', 'Season 1',
  'كل حلقة تضيف قطعة للّغز وتلخبط اللي قبلها. ركّز على الأسماء والسنوات من البداية، لأن المسلسل ما يعيد الشرح مرتين. للي يحب يربط الخيوط بنفسه.',
  'Every episode hands you a new piece of the puzzle and quietly breaks the one before. Keep track of names and years early — the show won''t explain twice. Made for people who like connecting the threads themselves.',
  '[]'::jsonb, false, now() - interval '1 day 2 hours');
select public.persona_review_add('lina', 'movie', 76, null, null, null, null,
  'فيلم كله حوار بين شخصين، ومع ذلك ما تحس بلحظة فراغ. الكيمياء بينهم طبيعية لدرجة تنسى إنه تمثيل. لو تحب القصص الهادية اللي تعيش على المشاعر، هذا لك.',
  'It''s two people talking, and somehow there''s never a dead moment. Their chemistry feels so natural you forget it''s acting. If you love quiet stories that live on feeling, this one''s yours.',
  '[]'::jsonb, false, now() - interval '1 day 6 hours');
select public.persona_review_add('sami', 'tv', 136315, null, null, 'الموسم الأول', 'Season 1',
  'حلقات قصيرة ومشدودة، والمطبخ فيه توتر ما يرحم. أول حلقة ممكن تحسها فوضى، بس اصبر عليها، بعدها يمسكك. ثماني حلقات وما فيها حشو.',
  'Short, tight episodes and a kitchen with zero mercy. The first one can feel like chaos — stick with it, it grabs you after that. Eight episodes, no filler.',
  '[]'::jsonb, false, now() - interval '1 day 9 hours');
select public.persona_review_add('faris', 'movie', 76341, null, null, null, null,
  'مطاردة من أوله لآخره، والحركة حقيقية وواضحة ما تضيع فيها. التوتر ما ينزل تقريبًا، والإيقاع محسوب. إذا تبي أكشن يرفع النبض، ابدأ فيه.',
  'One long chase from start to finish, with action that''s tangible and easy to follow. The tension barely drops and the rhythm is precise. Want something that gets your pulse up? Start here.',
  '[]'::jsonb, false, now() - interval '2 days 1 hour');
select public.persona_review_add('rami', 'movie', 60243, null, null, null, null,
  'ما فيه شرير في القصة؛ كل شخص عنده سبب مفهوم، وهذا اللي يوجع. الحوار بسيط لكنه يكشف طبقات من الكبرياء والخوف. دراما تخليك تفكر فيها بعدين.',
  'There''s no villain here — everyone has a reason you understand, and that''s what hurts. The dialogue is plain but peels back layers of pride and fear. A drama that stays with you.',
  '[]'::jsonb, false, now() - interval '2 days 5 hours');
