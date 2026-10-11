-- 199 — رمزُ تجديد أبل لكلِّ عضوٍ دخل بها (D-1350 · Phase 11-U · U4)
--
-- لماذا: أبل تشترط إلغاءَ إذن «الدخول بأبل» عندها حين يحذف العضوُ حسابَه. الإلغاءُ يحتاج رمزَ تجديدٍ يُحفظ عند
-- الدخول (`src/lib/apple.ts`) — لا تعطيه أبل لاحقاً.
--
-- 🔒 لا يقرؤه ولا يكتبه إلّا الخادمُ بمفتاح الخدمة: RLS مفعّلةٌ **بلا سياسة**، والمنحُ مسحوبةٌ عن الدورين
-- العامّين. والصفُّ يذهب مع صاحبه (`on delete cascade`) — `delete_my_account` لا تحتاج سطراً له.
--
-- آمنةُ الإعادة، ولا عبارةَ هدمٍ فيها.

create table if not exists public.apple_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);

alter table public.apple_tokens enable row level security;

revoke all on table public.apple_tokens from anon, authenticated;

comment on table public.apple_tokens is
  'Apple refresh token per member who signed in with Apple — read and written only by the server (service role) to revoke the grant on account deletion. D-1350.';
