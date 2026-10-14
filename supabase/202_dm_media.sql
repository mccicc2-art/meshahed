-- ============================================================
--  Loopz — 202: صورةٌ أو GIF في الرسائل المباشرة (أحمد ١٤ أكتوبر: «٢ أ · ٣ أ · ٤ أ» و«مع بعض»)
--  شغّله في Supabase → SQL Editor **قبل** نشر الواجهة. آمنٌ لإعادة التشغيل.
--
--  - الـGIF: معرّفُ Giphy وحدَه (D-362) — الرابطُ يُبنى من قالب `gifUrl`.
--  - الصورة: مسارُها في مخزنٍ **خاصّ** `dm-media` («٢ أ») — لا رابطَ عامّاً؛ الخادمُ يصنع رابطاً مؤقّتاً
--    بجلسة القارئ، والمخزنُ لا يعطيه إلّا لطرفَي الرسالة.
--  - التعليقُ اختياريٌّ مع الصورة («٣ أ»)؛ الـGIF رسالةٌ وحدَه. ومجّانيٌّ للكلّ («٤ أ»).
-- ============================================================

-- ١) العمودان
alter table public.direct_messages add column if not exists gif_id text;
alter table public.direct_messages add column if not exists image_path text;

-- ٢) النصُّ صار اختياريّاً حين تحمل الرسالةُ صورةً أو GIF
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
do $$ begin
  alter table public.direct_messages add constraint direct_messages_content_check check (
    length(body) <= 1000
    and (length(btrim(body)) >= 1 or gif_id is not null or image_path is not null)
    and not (gif_id is not null and image_path is not null)
    and (gif_id is null or (gif_id ~ '^[A-Za-z0-9]{1,64}$' and length(btrim(body)) = 0))
    -- المسارُ في مجلّد المرسِل نفسِه: <sender_id>/<uuid>.<ext>
    and (image_path is null or image_path ~ ('^' || sender_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
  );
exception when duplicate_object then null; end $$;

-- ٣) المخزنُ الخاصّ — ٤ ميجابايت (الصورةُ تُصغَّر على الجهاز إلى ١٩٢٠ طرفاً قبل الرفع)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-media', 'dm-media', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- الرفعُ في مجلّد صاحبه وحدَه
drop policy if exists "dm media upload own folder" on storage.objects;
create policy "dm media upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dm-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- الحذفُ من مجلّده وحدَه — «حذفُ الحساب» يمسح صورَه بجلسته (`deleteMyAccount` · `OWN_BUCKETS`)
drop policy if exists "dm media delete own folder" on storage.objects;
create policy "dm media delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dm-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- القراءةُ (ومنها صنعُ الرابط المؤقّت): المرسِلُ في مجلّده، والمستقبِلُ لصورةٍ في رسالةٍ إليه
drop policy if exists "dm media read by the two" on storage.objects;
create policy "dm media read by the two" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dm-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.direct_messages m
                  where m.image_path = storage.objects.name and m.recipient_id = auth.uid())
    )
  );

create index if not exists direct_messages_image_path_idx
  on public.direct_messages (image_path) where image_path is not null;
