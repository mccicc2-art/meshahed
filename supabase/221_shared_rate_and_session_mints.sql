-- =====================================================================
-- 221 — عدّادُ حدٍّ مشترك (A-14) · سجلُّ سكِّ جلسات التطبيق (A-04)
-- =====================================================================
-- المدقّق ٢١–٢٢ أكتوبر ٢٠٢٦ (A-04 · A-14)، وأحمد ٢٢ أكتوبر: «صحّح بنود المدقّق … ثم A-04 وA-14».
--
-- ١. `rate_hits` + `rate_hit(key, limit, window_s)`: حدُّ `core/ratelimit.ts` في ذاكرة كلِّ نسخةٍ على Vercel، فـ«٦ في الساعة»
--    على سكّ الجلسة كان ٦ لكلِّ نسخة. هنا نافذةٌ ثابتةٌ لكلِّ مفتاحٍ في صفٍّ واحد، والزيادةُ ذرّيّة (`on conflict … do update`).
--    يناديها `src/lib/sharedLimit.ts` لأبواب الجلسة وحدها (السكّ · أبل · رمزُ الودجت)، وغيابُها يرجع للذاكرة لا يفتح الباب.
-- ٢. `session_mints`: سطرٌ لكلِّ جلسةٍ يسكّها `POST /api/v1/session/mint` — المستخدم، جلسةُ الويب (`session_id`)، الباب، وعمرُ
--    الرمز بالثواني. يُقاس العمرُ قبل أن يُشترط (قرارٌ لاحقٌ لأحمد بعد أسبوعٍ من الأرقام).
-- كلاهما للخادم وحده: RLS بلا سياسة، ولا منحَ لـ`anon`/`authenticated`، والدالّةُ لـ`service_role` وحدَه.
-- ⚖️ أثرٌ معروفٌ في المستشار: «rls_enabled_no_policy» +٢ (كـ`widget_tokens` · `apple_tokens`) — مقصود.
-- إضافيّةٌ كلُّها: جدولان جديدان ودالّةٌ جديدة، لا يُلمس شيءٌ قائم.
--
-- ↩️ التراجع:
--   drop function if exists public.rate_hit(text, integer, integer);
--   drop table if exists public.rate_hits;
--   drop table if exists public.session_mints;

create table if not exists public.rate_hits (
  key          text        not null check (length(key) between 1 and 200),
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);
alter table public.rate_hits enable row level security;
revoke all on table public.rate_hits from anon, authenticated;
comment on table public.rate_hits is
  'A-14 (22 Oct 2026): fixed-window counters shared by every server instance, for the session doors (mint, apple, widget token). Written only through rate_hit() by the service role.';

create or replace function public.rate_hit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w   integer := greatest(1, least(coalesce(p_window_seconds, 60), 7 * 24 * 3600));
  ws  timestamptz := to_timestamp(floor(extract(epoch from now()) / w) * w);
  n   integer;
begin
  if p_key is null or length(p_key) not between 1 and 200 or p_limit is null or p_limit < 1 then
    raise exception 'rate_hit: bad arguments' using errcode = '22023';
  end if;
  insert into public.rate_hits as r (key, window_start, hits)
  values (p_key, ws, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  -- النوافذُ المنقضية لهذا المفتاح تُكنس هنا: الجدولُ لا ينمو بلا سقف ولا يحتاج مهمّةً مجدولة
  delete from public.rate_hits where key = p_key and window_start < ws;
  return jsonb_build_object(
    'allowed', n <= p_limit,
    'hits', n,
    'retry_after_s', greatest(1, ceil(extract(epoch from (ws + make_interval(secs => w) - now())))::integer)
  );
end;
$$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;
comment on function public.rate_hit(text, integer, integer) is
  'A-14: count one hit for p_key in the current fixed window of p_window_seconds; allowed = hits <= p_limit. Service role only (src/lib/sharedLimit.ts).';

create table if not exists public.session_mints (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  session_id  uuid,
  via         text        not null check (via in ('bearer', 'cookie')),
  token_age_s integer     check (token_age_s is null or token_age_s >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists session_mints_user_idx on public.session_mints (user_id, created_at desc);
alter table public.session_mints enable row level security;
revoke all on table public.session_mints from anon, authenticated;
comment on table public.session_mints is
  'A-04 (22 Oct 2026): one row per app session minted by POST /api/v1/session/mint — who, from which web session, through which door, and the access token age. Server only.';
