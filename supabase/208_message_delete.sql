-- ============================================================
--  Loopz — 208: حذفُ الرسائل (D-1441)
--  أحمد ١٦ أكتوبر: «أحتاج أقدر أحذف محادثة أو رسالة داخل محادثة أنا راسلها» — «١ ب ٢ أ ٣ أ».
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. **الواجهةُ تعمل قبله وبعده**: قبله يُرفض «حذف للجميع» رفضاً
--  مقروءاً، و«حذف عندي» في الخاص يعمل بعَلَمَي الإخفاء القديمين (الهجرة ٢٠٠).
--
--  - **«حذف للجميع»**: لرسائلي أنا وحدي، **خلال ساعتين من إرسالها** (كالواتس). الرسالةُ لا تُمحى صفّاً — يبقى مكانُها
--    سطرَ «حُذفت هذه الرسالة» (`deleted_at`) **ويُمحى محتواها كلُّه** (النصُّ · GIF · الصورة · العمل · الاقتباس)، فلا يقرؤه
--    أحدٌ ولو قرأ الجدولَ بجلسته مباشرة. مشاركاتُ الأعمال والقوائم في الخاص تُخفى من الطرفين (لا سطرَ لها).
--  - الكتابةُ بدالّةٍ واحدةٍ `message_unsend` (definer): المرسِلُ والنافذةُ تُفحصان فيها لا في الواجهة؛ والعمودُ لا يُمنح
--    للتعديل المباشر. تعيد مسارَ الصورة ليمحوها الخادمُ من المخزن بجلسة صاحبها (سياسةُ «مجلّدُك وحدَك» في ٢٠٢).
--  - **«حذف عندي» في القروب**: جدولُ `dm_group_hidden` (لي وحدي). في الخاص يكفي `sender_hid`/`recipient_hid`.
-- ============================================================

-- ١) الخاص
alter table public.direct_messages add column if not exists deleted_at timestamptz;
alter table public.direct_messages drop constraint if exists direct_messages_content_check;
alter table public.direct_messages add constraint direct_messages_content_check check (
  (deleted_at is not null and body = '' and gif_id is null and image_path is null)
  or (
    deleted_at is null
    and length(body) <= 1000
    and (length(btrim(body)) >= 1 or gif_id is not null or image_path is not null)
    and not (gif_id is not null and image_path is not null)
    and (gif_id is null or (gif_id ~ '^[A-Za-z0-9]{1,64}$' and length(btrim(body)) = 0))
    and (image_path is null or image_path ~ ('^' || sender_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
  )
);

-- ٢) القروب
alter table public.dm_group_messages add column if not exists deleted_at timestamptz;
alter table public.dm_group_messages drop constraint if exists dm_group_messages_content_check;
alter table public.dm_group_messages add constraint dm_group_messages_content_check check (
  (
    kind = 'text' and deleted_at is not null and sys is null and body = ''
    and gif_id is null and image_path is null and reply_to is null
    and tmdb_id is null and media_type is null and title is null and poster_path is null
  )
  or (
    deleted_at is null
    and length(body) <= 1000
    and (
      (
        kind = 'system' and sys is not null and gif_id is null and image_path is null and reply_to is null
        and tmdb_id is null and media_type is null and title is null and poster_path is null
      )
      or (
        kind = 'text' and sys is null and sys_target is null
        and (length(btrim(body)) >= 1 or gif_id is not null or image_path is not null or tmdb_id is not null)
        and not (gif_id is not null and image_path is not null)
        and not (tmdb_id is not null and (gif_id is not null or image_path is not null))
        and (gif_id is null or (gif_id ~ '^[A-Za-z0-9]{1,64}$' and length(btrim(body)) = 0))
        and (image_path is null or image_path ~ ('^' || sender_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
        and (
          (tmdb_id is null and media_type is null and title is null and poster_path is null)
          or (
            tmdb_id is not null and tmdb_id > 0 and media_type is not null and media_type in ('tv', 'movie')
            and (title is null or length(title) <= 300)
            and (poster_path is null or poster_path ~ '^/[A-Za-z0-9_.-]{1,100}$')
          )
        )
      )
    )
  )
);

-- ٣) «حذف عندي» في القروب — صفٌّ لي وحدي، ولا يراه غيري
create table if not exists public.dm_group_hidden (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id uuid not null references public.dm_group_messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.dm_group_hidden enable row level security;
drop policy if exists "read own hidden" on public.dm_group_hidden;
create policy "read own hidden" on public.dm_group_hidden
  for select to authenticated using (auth.uid() = user_id);
-- رسالةٌ أقرؤها أنا (سياسةُ القراءة نفسُها تحكم الاستعلامَ الداخليّ)
drop policy if exists "hide what I can read" on public.dm_group_hidden;
create policy "hide what I can read" on public.dm_group_hidden
  for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.dm_group_messages m where m.id = message_id));
drop policy if exists "unhide own" on public.dm_group_hidden;
create policy "unhide own" on public.dm_group_hidden
  for delete to authenticated using (auth.uid() = user_id);
revoke all on public.dm_group_hidden from anon;
grant select, insert, delete on public.dm_group_hidden to authenticated;

-- ٤) «حذف للجميع» — الفاحصُ الوحيد: أنا المرسِل، وخلال ساعتين، ولم تُحذف بعد
create or replace function public.message_unsend(p_kind text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  win interval := interval '2 hours';
  v_path text;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_kind = 'dm' then
    select image_path into v_path from public.direct_messages
      where id = p_id and sender_id = me and deleted_at is null and created_at > now() - win
      for update;
    if not found then
      raise exception 'not allowed' using errcode = '42501', hint = 'window';
    end if;
    update public.direct_messages
      set deleted_at = now(), body = '', gif_id = null, image_path = null, reply_to = null
      where id = p_id;
    return coalesce(v_path, '');
  elsif p_kind = 'group' then
    select image_path into v_path from public.dm_group_messages
      where id = p_id and sender_id = me and kind = 'text' and deleted_at is null and created_at > now() - win
      for update;
    if not found then
      raise exception 'not allowed' using errcode = '42501', hint = 'window';
    end if;
    update public.dm_group_messages
      set deleted_at = now(), body = '', gif_id = null, image_path = null, reply_to = null,
          tmdb_id = null, media_type = null, title = null, poster_path = null
      where id = p_id;
    return coalesce(v_path, '');
  elsif p_kind = 'share' then
    update public.title_shares set sender_hid = true, recipient_hid = true
      where id = p_id and sender_id = me and created_at > now() - win;
    if not found then
      raise exception 'not allowed' using errcode = '42501', hint = 'window';
    end if;
    return '';
  elsif p_kind = 'list' then
    update public.list_shares set sender_hid = true, recipient_hid = true
      where id = p_id and sender_id = me and created_at > now() - win;
    if not found then
      raise exception 'not allowed' using errcode = '42501', hint = 'window';
    end if;
    return '';
  end if;
  raise exception 'bad kind' using errcode = '22023';
end;
$$;
revoke all on function public.message_unsend(text, uuid) from public, anon;
grant execute on function public.message_unsend(text, uuid) to authenticated;

-- تحقّق:
--   select column_name from information_schema.columns where table_name in ('direct_messages','dm_group_messages') and column_name = 'deleted_at';
--   select to_regclass('public.dm_group_hidden'), to_regprocedure('public.message_unsend(text,uuid)');
