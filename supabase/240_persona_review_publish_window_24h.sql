-- 240 — persona_review_publish_window_24h: نافذةُ نشر مراجعات الشخصيّات ٢٤ ساعة بدل ٦ (أحمد ٦ نوفمبر)
--
-- لماذا هذا الملفّ: التعديلُ شُغّل على الإنتاج من لوحة Supabase يوم ٦ نوفمبر ١٤:٢٤ UTC وسُجّل في سجلّ الهجرات بهذا الاسم
-- (النسخة 20261106142402)، ولم يكن له ملفٌّ هنا (A-49، المدقّق ٧ نوفمبر). الملفُّ يعيد ما شُغّل حرفاً بحرف — جسمُ الدالّة
-- مطابقٌ لما على الإنتاج (قورن ٨ نوفمبر) — فلا يحتاج تشغيلاً، وإعادتُه لا تغيّر شيئاً (`create or replace` يُبقي المنح).
--
-- الوتيرةُ صارت مرّةً يوميّاً (٢٠ مراجعةً موزّعةً على ٢٤ ساعة)، فنافذةُ النشر توسّعت من ٦ ساعات إلى ٢٤.

CREATE OR REPLACE FUNCTION public.persona_review_add_checked(p_slug text, p_media text, p_tmdb integer, p_title text, p_poster text, p_scope_ar text, p_scope_en text, p_body_ar text, p_body_en text, p_sources jsonb, p_spoiler boolean, p_publish_at timestamp with time zone, p_rating smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  pid uuid;
  s public.persona_settings%rowtype;
  ar text := btrim(coalesce(p_body_ar, ''));
  en text := btrim(coalesce(p_body_en, ''));
  banned text[] := array['شفته', 'شفتها', 'شاهدته', 'شاهدتها', 'حضرته', 'حضرتها', 'بكيت', 'دموعي',
                         'i watched', 'i saw it', 'i cried', 'when i saw', 'my tears', 'i rewatched'];
  w text;
  hour_n integer;
  day_n integer;
  rid uuid;
begin
  select id into pid from public.personas where slug = p_slug;
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'unknown_persona'); end if;
  select * into s from public.persona_settings where id = 1;
  if coalesce(s.paused, false) then return jsonb_build_object('ok', false, 'reason', 'paused'); end if;
  if p_media not in ('tv', 'movie') or coalesce(p_tmdb, 0) <= 0 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if char_length(ar) not between 80 and 700 then return jsonb_build_object('ok', false, 'reason', 'length_ar'); end if;
  if char_length(en) not between 80 and 700 then return jsonb_build_object('ok', false, 'reason', 'length_en'); end if;
  foreach w in array banned loop
    if position(w in lower(ar || ' ' || en)) > 0 then return jsonb_build_object('ok', false, 'reason', 'banned_phrase', 'phrase', w); end if;
  end loop;
  if p_rating is null or p_rating not between 1 and 10 then return jsonb_build_object('ok', false, 'reason', 'rating'); end if;
  if p_publish_at is null or p_publish_at < now() - interval '5 minutes' or p_publish_at > now() + interval '24 hours 15 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'publish_window');
  end if;
  select count(*) into hour_n from public.persona_reviews
   where publish_at >= date_trunc('hour', p_publish_at) and publish_at < date_trunc('hour', p_publish_at) + interval '1 hour';
  if hour_n >= coalesce(s.per_hour_max, 5) then return jsonb_build_object('ok', false, 'reason', 'hour_full'); end if;
  select count(*) into day_n from public.persona_reviews where persona_id = pid and created_at > now() - interval '24 hours';
  if day_n >= 30 then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;
  rid := public.persona_review_add(p_slug, p_media, p_tmdb, p_title, p_poster, p_scope_ar, p_scope_en, ar, en,
                                   p_sources, p_spoiler, p_publish_at, p_rating);
  if rid is null then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  return jsonb_build_object('ok', true, 'id', rid);
end;
$function$;
