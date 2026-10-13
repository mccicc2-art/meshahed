-- 201 — رمزُ الودجت: «✓ شاهدتُ الحلقة» من الشاشة الرئيسيّة بلا جلسة (خطّةُ الودجتات W14 · الدفعة الثانية)
--
-- لماذا: الودجتُ لا يحمل جلسةَ العضو (D-929 — نسخةُ الجلسة لا تخرج من التطبيق، وتجديدُها يُبدِّل الرمزَ فيُخرج صاحبَه).
-- فيأخذ رمزاً خاصّاً لا يقدر إلّا على «علّم حلقةً» و«تراجع عنها» لمسلسلٍ يتابعه صاحبُه — لا قراءة، لا إعدادات، لا تجديد.
--
-- 🔒 **لا يُحفظ الرمزُ نفسُه** — بصمتُه (sha-256) وحدَها: من قرأ الجدولَ لا يملك رمزاً.
-- **رمزٌ لكلِّ جهاز** لا لكلِّ عضو: من يحمل أندرويد وآيفون لا يُبطل أحدُهما رمزَ الآخر حين يُصدر رمزَه.
-- والخادمُ يُبقي أحدثَ خمسةٍ لكلِّ عضو، ويذهب الرمزُ مع صاحبه (`on delete cascade`).
-- لا يقرؤه ولا يكتبه إلّا الخادمُ بمفتاح الخدمة: RLS مفعّلةٌ **بلا سياسة**، والمنحُ مسحوبةٌ عن الدورين العامّين.
--
-- آمنةُ الإعادة، ولا عبارةَ هدمٍ فيها.

create table if not exists public.widget_tokens (
  token_hash   text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  -- لغةُ سطر «الحلقة · باقي N» في ردّ ✓: الودجتُ لا يحمل كوكي اللغة، فتُحفظ هنا وتُحدَّث مع كلِّ جلبٍ للودجت
  lang         text not null default 'ar' check (lang in ('ar', 'en'))
);

create index if not exists widget_tokens_user_idx on public.widget_tokens (user_id);

alter table public.widget_tokens enable row level security;

revoke all on table public.widget_tokens from anon, authenticated;

comment on table public.widget_tokens is
  'Widget-only token per member device (sha-256 of the token, never the token): mark or unmark an episode of a followed show from the home-screen widget. Read and written only by the server (service role). Widgets plan W14.';
