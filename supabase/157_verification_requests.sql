-- ============================================================================
-- 157_verification_requests.sql — آليّةُ طلب التوثيق (D-773 / D-775)
-- ============================================================================
--
-- **مسارُ أحمد بأربع خطواتٍ وستِّ قواعد**، وهذا تنفيذُه — **وما لا يستطيع
-- المنتجُ فحصَه لا يُرسم صحّاً أخضرَ بجانبه.**
--
-- ══════════════ ما سقط من قائمته، بحكمه، ولماذا ══════════════
-- «البريد والجوال موثّقان» و«تفعيل التحقّق بخطوتين» — **حُذفا بأمره**
-- («احذفها»). **ولا حقلَ جوّالٍ في Loopz ولا 2FA**: الدخولُ Google OAuth
-- وحدَه. **وشرطٌ لا يفحصه شيءٌ ليس شرطاً، هو زينةٌ تكذب على المتقدّم.**
--
-- ══════════════ وما حلَّ محلَّ الهويّة والسيلفي ══════════════
-- 🔑 **حكمُه: «طريقة التوثيق ربط حسابه والدخول عن طريق X أو فيسبوك أو
-- غيره».** **وهذا أقوى من صورة هويّةٍ لغرضِنا وأرخصُ منها مسؤوليّةً**:
-- الهويّةُ تُثبت **من هو**، **والسؤالُ عندنا «هل يملك @الحساب المشهور»**
-- — **وتسجيلُ الدخول بذلك الحساب هو البرهانُ عينُه، لا دليلاً عليه.**
-- **ولا نخزّن وثيقةً حكوميّةً ولا قياساً حيويّاً** — فتسقط مسؤوليّةُ
-- الاحتفاظ والأساسِ القانونيِّ من أوّلها (كانت أكبرَ ما يوقف الجولة).
--
-- ⚠️ **والفرقُ بين `links` و`proven`**: الأولى ما كتبه بيده — **دعوى**،
-- والثانية لقطةُ `auth.identities` لحظةَ التقديم — **ملكيّةٌ مبرهنة.**
-- **والمراجعُ يرى الاثنين ويعرف أيَّهما يزن.**
--
-- ⚠️ **ولا يعمل هذا حتى يُفعّل أحمدُ المزوّدَ بنفسه** في لوحة Supabase
-- (Authentication → Providers) بمفاتيح تطبيقه على X/Facebook.
-- **ولا أمسّ مفتاحاً ولا أسجّل دخولاً في حسابٍ له** (القاعدة ٦) —
-- **والواجهةُ تحتمل «المزوّد غير مفعّل» وتقولها بلا انكسار.**
-- ============================================================================

begin;

-- ─── ١) جدولُ الطلبات ──────────────────────────────────────────────────────
create table if not exists public.verification_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('person', 'org', 'media')),
  status      text not null default 'pending'
              check (status in ('pending', 'more_info', 'approved', 'rejected')),
  /* **دعوى**: روابطُ الحسابات كما كتبها */
  links       jsonb not null default '[]'::jsonb,
  website     text,
  sources     text,
  reason      text not null,
  /* **برهان**: لقطةُ المزوّدين المرتبطين لحظةَ التقديم — **لقطةٌ لا
     مرجع**: لو فكَّ الارتباطَ غداً بقي ما رآه المراجعُ كما رآه. */
  proven      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid,
  /* سببُ الرفض، أو ما ينقص في حالة `more_info` — **ويُعرض للمتقدّم** */
  note        text
);

create index if not exists verification_requests_user_idx
  on public.verification_requests (user_id, created_at desc);
create index if not exists verification_requests_open_idx
  on public.verification_requests (created_at)
  where status in ('pending', 'more_info');

alter table public.verification_requests enable row level security;

/* **سياسةُ قراءةٍ واحدةٌ لصفِّك** — ولا سياسةَ كتابةٍ البتّة:
   **الكتابةُ تمرّ بالدوالِّ وحدَها** (القاعدة ١١). */
drop policy if exists "read own verification request" on public.verification_requests;
create policy "read own verification request"
  on public.verification_requests for select
  using (auth.uid() = user_id);

/* ⚠️ **ونزعُ منحةِ الكتابة صراحةً** — درسُ الهجرة ١٥٦: **كلُّ جدولٍ يولد
   في `public` يولد ومعه `all`**، **وRLS بلا سياسةِ كتابةٍ يكفي**، لكنّ
   التصريحَ يجعل الخللَ مستحيلاً لا مستبعَداً. */
revoke insert, update, delete on public.verification_requests from anon, authenticated;


-- ─── ٢) المزوّدون المرتبطون — القراءةُ من `auth` تحتاج definer ────────────
/* **يعيد ما يثبت الملكيّةَ لا أكثر**: اسمُ المزوّد والمعرّفَ الظاهر.
   **ولا بريدَ ولا رمزَ وصولٍ ولا `identity_data` كاملاً** — **ودالّةٌ
   تعيد أكثرَ ممّا تحتاجه الشاشةُ بابٌ يُفتح على ما لا يُقصد.** */
create or replace function public.linked_providers()
returns table (provider text, handle text, linked_at timestamptz)
language sql
security definer
set search_path = public, auth
stable
as $$
  select i.provider,
         coalesce(
           i.identity_data ->> 'user_name',
           i.identity_data ->> 'preferred_username',
           i.identity_data ->> 'screen_name',
           i.identity_data ->> 'name'
         ) as handle,
         i.created_at
    from auth.identities i
   where i.user_id = auth.uid()
   order by i.created_at;
$$;

revoke all on function public.linked_providers() from public, anon;
grant execute on function public.linked_providers() to authenticated;


-- ─── ٣) الأهليّة — ثلاثةُ شروطٍ تُفحص بصدق ────────────────────────────────
/* ⚖️ **و«لا مخالفاتٍ نشطة» تحتاج تعريفاً لأنّ `user_reports` بلا عمود
   حالة**: **صفرُ بلاغاتٍ خلال ٩٠ يوماً**. **وبلاغٌ عمرُه سنةٌ ليس
   «نشطاً»**، **وانتظارُ عمودٍ لم يُبنَ يعني شرطاً لا يُفحص أبداً.**
   ⚖️ **و«نشاطٌ حقيقيٌّ خلال ٣٠ يوماً» = ثلاثةُ أيّامٍ مختلفة**:
   **النافذةُ نافذةُ أحمد** (٣٠ يوماً بنصّه)، **والعددُ هو معيارُ النشاط
   القائمُ في الهجرة ١٥٥** («نشاطٌ في ٣ أيّامٍ مختلفة») — **ومعياران
   للنشاط في منتجٍ واحدٍ خطأٌ لا دقّة.**
   ⚠️ **وكان خمسةً في أوّل كتابةٍ فخُفِّض بدليل**: `user_active_days`
   وُلد في ٢٨ أغسطس، **وأكثرُ حسابٍ فيه يومان** — **فشرطُ الخمسة كان
   يقفل البابَ على الجميع بمن فيهم صاحبُ المنتج**، **لا لأنّهم خاملون
   بل لأنّ العدّادَ حديثُ الولادة.** */
create or replace function public.verification_eligibility()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  me       uuid := auth.uid();
  p        public.profiles%rowtype;
  complete boolean := false;
  active   boolean := false;
  clean    boolean := false;
  days     int := 0;
  need     int := 3;
begin
  if me is null then
    return jsonb_build_object('signedIn', false);
  end if;

  select * into p from public.profiles where id = me;

  complete := coalesce(p.is_private, false) = false
              and coalesce(p.username, '') <> ''
              and coalesce(p.nickname, '') <> ''
              and coalesce(p.avatar_url, '') <> '';

  select count(*) into days
    from public.user_active_days d
   where d.user_id = me and d.day > (current_date - 30);
  active := days >= need;

  select not exists (
    select 1 from public.user_reports r
     where r.target_id = me and r.created_at > now() - interval '90 days'
  ) into clean;

  return jsonb_build_object(
    'signedIn',  true,
    'complete',  complete,
    'active',    active,
    'activeDays', days,
    'needDays',  need,
    'clean',     clean,
    'verified',  p.verified_at is not null,
    'eligible',  complete and active and clean
  );
end;
$$;

revoke all on function public.verification_eligibility() from public, anon;
grant execute on function public.verification_eligibility() to authenticated;


-- ─── ٤) حالةُ الطلب + متى يجوز إعادةُ التقديم ─────────────────────────────
/* **قاعدةُ الستّين يوماً من تاريخ القرار لا من تاريخ التقديم** — **ومن
   طال انتظارُه لا يُعاقب بطول انتظاره.** */
create or replace function public.my_verification_state()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  me   uuid := auth.uid();
  r    public.verification_requests%rowtype;
  next timestamptz;
begin
  if me is null then return jsonb_build_object('signedIn', false); end if;

  select * into r from public.verification_requests
   where user_id = me order by created_at desc limit 1;

  if r.id is null then
    return jsonb_build_object('signedIn', true, 'status', null, 'canApply', true);
  end if;

  next := case when r.status = 'rejected'
               then coalesce(r.decided_at, r.created_at) + interval '60 days' end;

  return jsonb_build_object(
    'signedIn',  true,
    'status',    r.status,
    'kind',      r.kind,
    'note',      r.note,
    'createdAt', r.created_at,
    'decidedAt', r.decided_at,
    'nextApplyAt', next,
    /* **المرفوضُ ينتظر، والمقبولُ لا يقدّم، وصاحبُ الطلب المفتوح ينتظر
       — و`more_info` وحدَها تُعيد الباب مفتوحاً فوراً** (طُلبت منه
       معلوماتٌ، فمنعُه من إرسالها عبث). */
    'canApply',  case
                   when r.status = 'more_info' then true
                   when r.status = 'rejected'  then now() >= next
                   else false
                 end
  );
end;
$$;

revoke all on function public.my_verification_state() from public, anon;
grant execute on function public.my_verification_state() to authenticated;


-- ─── ٥) التقديم ───────────────────────────────────────────────────────────
create or replace function public.request_verification(
  p_kind    text,
  p_links   jsonb,
  p_website text,
  p_sources text,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me    uuid := auth.uid();
  elig  jsonb;
  st    jsonb;
  snap  jsonb;
  newid uuid;
begin
  if me is null then raise exception 'auth required'; end if;

  if p_kind not in ('person', 'org', 'media') then
    raise exception 'bad kind';
  end if;

  /* **والحرّاسُ في الجسم لا في الواجهة** (القاعدة D-011): الشاشةُ تُخفي
     الزرَّ، **والدالّةُ تمنع الطلبَ** — ومن نادى بلا شاشةٍ لم يمرّ. */
  elig := public.verification_eligibility();
  if not (elig ->> 'eligible')::boolean then
    raise exception 'not eligible';
  end if;

  st := public.my_verification_state();
  if not (st ->> 'canApply')::boolean then
    raise exception 'cannot apply yet';
  end if;

  /* **لقطةُ البرهان** — تُخزَّن مع الطلب فلا تتغيّر تحت يد المراجع */
  select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'handle', handle)), '[]'::jsonb)
    into snap
    from public.linked_providers();

  /* **وطلبٌ مفتوحٌ سابقٌ يُغلق لا يُترك**: `more_info` تُستبدل بالجديد،
     **وطابوران لشخصٍ واحدٍ يجعلان المراجعَ يقرأ نسخةً ميّتة.** */
  update public.verification_requests
     set status = 'rejected', decided_at = now(), note = 'superseded'
   where user_id = me and status = 'more_info';

  insert into public.verification_requests
    (user_id, kind, links, website, sources, reason, proven)
  values
    (me, p_kind,
     coalesce(p_links, '[]'::jsonb),
     nullif(btrim(coalesce(p_website, '')), ''),
     nullif(btrim(coalesce(p_sources, '')), ''),
     left(btrim(coalesce(p_reason, '')), 600),
     snap)
  returning id into newid;

  return jsonb_build_object('id', newid, 'status', 'pending');
end;
$$;

revoke all on function public.request_verification(text, jsonb, text, text, text) from public, anon;
grant execute on function public.request_verification(text, jsonb, text, text, text) to authenticated;


-- ─── ٦) طابورُ المراجعة الإداريّ ──────────────────────────────────────────
create or replace function public.admin_verification_queue()
returns table (
  id uuid, user_id uuid, kind text, status text,
  links jsonb, website text, sources text, reason text, proven jsonb,
  created_at timestamptz, note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.am_admin() then raise exception 'admin only'; end if;
  return query
    select r.id, r.user_id, r.kind, r.status, r.links, r.website, r.sources,
           r.reason, r.proven, r.created_at, r.note
      from public.verification_requests r
     where r.status in ('pending', 'more_info')
     order by r.created_at;
end;
$$;

revoke all on function public.admin_verification_queue() from public, anon;
grant execute on function public.admin_verification_queue() to authenticated;


-- ─── ٧) القرار — **والكاتبُ الوحيدُ لختم التوثيق** ────────────────────────
/* 🔑 **وهذه هي الدالّةُ التي تجعل الشارةَ نادرةً**: `profiles.verified_at`
   لا يملك أحدٌ منحةَ الكتابة عليها (الهجرة ١٥٦)، **وهذه definer فتتجاوز
   ذلك** — **فالطريقُ الوحيدُ إلى الختم يمرّ بمراجعٍ إنسان.** */
create or replace function public.admin_decide_verification(
  p_id       uuid,
  p_decision text,   -- approved · rejected · more_info
  p_note     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.verification_requests%rowtype;
begin
  if not public.am_admin() then raise exception 'admin only'; end if;
  if p_decision not in ('approved', 'rejected', 'more_info') then
    raise exception 'bad decision';
  end if;

  select * into r from public.verification_requests where id = p_id;
  if r.id is null then raise exception 'not found'; end if;

  update public.verification_requests
     set status     = p_decision,
         note       = nullif(btrim(coalesce(p_note, '')), ''),
         decided_at = case when p_decision = 'more_info' then null else now() end,
         decided_by = auth.uid()
   where id = p_id;

  if p_decision = 'approved' then
    update public.profiles
       set verified_at = now(), verified_kind = r.kind
     where id = r.user_id;
  end if;

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

revoke all on function public.admin_decide_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_verification(uuid, text, text) to authenticated;


-- ─── ٨) إعادةُ الفحص عند تبدّل الهويّة ────────────────────────────────────
/* **قاعدةُ أحمد: «عند تغيير الاسم جذريّاً أو انتقال ملكيّة الحساب يُعاد
   فحصُ التوثيق».**
   ⚖️ **و«جذريّاً» لا تُبرمَج، أمّا المعرّفُ فيُبرمَج**: `username` هو
   العنوانُ الذي وثّقناه («هذا الحسابُ يمثّل فلاناً») — **فتبديلُه تبديلُ
   ما شهدنا عليه**، والختمُ يسقط ويُعاد التقديم.
   ⚠️ **والاسمُ المعروض (`nickname`) لا يُسقط الختم**: يتبدّل للتجميل
   عشرَ مرّاتٍ في الشهر، **وإسقاطُ الختم عليه عقوبةٌ على تحرير ملفّ.**
   🔑 **والمشغِّلُ يكتب `verified_at` رغم نزع المنح** لأنّه يعمل بصلاحيّة
   مالك الجدول — **وهذا هو الباب الثاني المشروع، ولا ثالثَ له.** */
create or replace function public.reverify_on_handle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified_at is not null
     and new.username is distinct from old.username then
    new.verified_at := null;
    new.verified_kind := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reverify_on_handle_change on public.profiles;
create trigger profiles_reverify_on_handle_change
  before update of username on public.profiles
  for each row execute function public.reverify_on_handle_change();

commit;

-- ============================================================================
-- التحقّق (المتوقَّع بين القوسين)
-- ============================================================================
-- ١) السياساتُ المفتوحةُ خمسٌ كما هي:                          (٥)
--    select count(*) from pg_policies where schemaname='public' and qual='true';
-- ٢) سياسةُ الجدول الجديد واحدةٌ للقراءة فقط:                  (select · 1)
--    select cmd, qual from pg_policies where tablename='verification_requests';
-- ٣) لا منحةَ كتابةٍ عليه:                                     (صفر صفوف)
--    select grantee, privilege_type from information_schema.table_privileges
--     where table_name='verification_requests' and grantee in ('anon','authenticated')
--       and privilege_type in ('INSERT','UPDATE','DELETE');
-- ٤) الدوالُّ الستُّ definer وتنفيذُها لـ`authenticated` وحدَها:  (٦)
--    select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname in ('linked_providers','verification_eligibility',
--       'my_verification_state','request_verification','admin_verification_queue',
--       'admin_decide_verification');
-- ٥) المشغّلُ قائم:                                            (صفٌّ واحد)
--    select tgname from pg_trigger where tgname='profiles_reverify_on_handle_change';
-- ============================================================================
