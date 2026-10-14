-- ============================================================
--  Loopz — 203: الردُّ على رسالةٍ بعينها في الرسائل المباشرة (أحمد ١٥ أكتوبر: «الدفعتين مع بعض … وأذن لك بالهجرة»)
--  شغّله في Supabase → SQL Editor **قبل** نشر الواجهة. آمنٌ لإعادة التشغيل.
--
--  - `reply_to`: الرسالةُ المقتبَسة (نصٌّ أو صورةٌ أو GIF) — اقتباسٌ فوق الردّ كالواتس، ولمستُه تنزل إلى الأصل.
--  - حذفُ الأصل لا يحذف الردّ (`on delete set null`): الردُّ يبقى، والاقتباسُ يقول «رسالة غير متاحة».
--  - المقتبَسُ من **المحادثة نفسِها** وحدها (المشغِّل أدناه): لا يُلصق بردٍّ رسالةٌ من محادثةٍ أخرى ولو عُرف معرّفُها.
--  - لا عمودَ جديدَ في صلاحيات التعديل: `reply_to` يُكتب مع الرسالة ولا يتغيّر بعدها (الهجرة ٢٠٠ تمنح التعديلَ
--    لـ`read_at` والإخفاء وحدهما).
-- ============================================================

-- ١) العمود — والفهرسُ لجلب الأصول الغائبة عن الصفحة دفعةً واحدة
alter table public.direct_messages
  add column if not exists reply_to uuid references public.direct_messages (id) on delete set null;
create index if not exists direct_messages_reply_to_idx
  on public.direct_messages (reply_to) where reply_to is not null;

-- ٢) المقتبَسُ بين الشخصين أنفسِهما — `security definer` ليرى الأصلَ ولو أخفاه أحدُهما من عنده؛ يعيد «نعم/لا» وحدها
create or replace function public.dm_reply_same_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to is null then
    return new;
  end if;
  if not exists (
    select 1 from public.direct_messages m
     where m.id = new.reply_to
       and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id)
         or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then
    raise exception 'reply_to must belong to the same conversation' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.dm_reply_same_pair() from public;

drop trigger if exists dm_reply_same_pair on public.direct_messages;
create trigger dm_reply_same_pair
  before insert on public.direct_messages
  for each row execute function public.dm_reply_same_pair();

-- تحقّق بعد التشغيل:
--   select column_name from information_schema.columns where table_name = 'direct_messages' and column_name = 'reply_to';
--   select tgname from pg_trigger where tgrelid = 'public.direct_messages'::regclass and not tgisinternal;
