-- 241 — A-44 (المدقّق ٥ نوفمبر): دعوتان متزامنتان لا تتجاوزان سقفَ القائمة المشتركة (عشرة)
--
-- لماذا: دالّةُ الدعوة (هجرة ٢٣٤) تعدّ المقاعدَ المأخوذةَ ثمّ تُدرج، بلا قفل — فدعوتان في اللحظة نفسها تعدّان العددَ نفسَه
-- وتنجحان معاً فوق العشرة. الآن يُقفل صفُّ القائمة أوّلَ الدالّة (`for no key update`): الثانيةُ تنتظر الأولى ثمّ تعدّ بعدها.
-- لا يتغيّر شيءٌ غيرُ ذلك: الجسمُ نفسُه سطراً بسطر، و`create or replace` يُبقي المنحَ كما ضبطتها ٢٣٤.
--
-- آمنةُ الإعادة، ولا عبارةَ هدمٍ فيها.

create or replace function public.invite_list_members(p_list uuid, p_users uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  l public.user_lists;
  v_taken integer;
  v_new uuid[];
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  -- A-44: قفلُ صفِّ القائمة — دعوتان معاً تنتظر الثانيةُ الأولى، فيرى عدُّ المقاعد ما أدرجته قبلها.
  -- `no key update` لا `update`: يرتّب الدعوات ولا يحبس إضافةَ عنصرٍ إلى القائمة أثناءها (مفتاحُها الخارجيُّ لا يتعارض معه)
  select * into l from public.user_lists where id = p_list for no key update;
  if not found or l.user_id <> v_uid then raise exception 'list_not_owner' using errcode = '42501'; end if;
  if l.kind = 'smart' or l.source_slug is not null then raise exception 'list_not_shareable' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct u), '{}') into v_new
    from unnest(coalesce(p_users, '{}')) u
   where u <> v_uid
     and exists (select 1 from public.user_follows f where f.follower_id = v_uid and f.following_id = u)
     and not public.is_blocked(v_uid, u)
     and not exists (select 1 from public.list_members m where m.list_id = p_list and m.user_id = u);
  if cardinality(v_new) = 0 then return 0; end if;

  select count(*) into v_taken from public.list_members where list_id = p_list;
  if 1 + v_taken + cardinality(v_new) > 10 then
    raise exception 'list_members_full' using errcode = '22023';
  end if;

  insert into public.list_members (list_id, user_id, invited_by, status)
  select p_list, u, v_uid, 'pending' from unnest(v_new) u
  on conflict do nothing;
  return cardinality(v_new);
end;
$$;
