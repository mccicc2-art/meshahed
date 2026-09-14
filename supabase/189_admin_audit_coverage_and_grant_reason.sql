-- ============================================================
--  ١٨٩ — السجلُّ يرى كلَّ ما يقع في اللوحة، والمنحُ يُعلَّل (D-962)
-- ============================================================
-- 🔴 **البندان (أ) و(هـ) من مراجعة ١٤ سبتمبر**، وكلاهما مقيسٌ من `pg_proc`
--    لا من الذاكرة:
--
--    (أ) **ثلاثُ صفحاتٍ تُقرّر ولا تترك أثراً**: `admin_decide_verification`
--        و`admin_decide_partner` و`admin_set_provider_link` **لا تحتوي
--        `log_admin` البتّة.** فتوثيقُ حسابٍ (شارةٌ دائمةٌ على هويّة)،
--        وقبولُ شريكٍ (**يولّد كودَ `/p/<CODE>` ويُدخله في قناةِ عمولة** —
--        أقربُ فعلٍ في اللوحة إلى المال)، وتحويلُ رابطِ منصّةٍ إلى
--        `verified` (رابطٌ خارجيٌّ يظهر لكلِّ زائرٍ باسم Loopz) — كلُّها
--        تقع بلا أثرٍ يُقرأ.
--        🔑 **وحجّةُ D-923 نفسُها تُدين هذا**: «من فعل ماذا ومتى **سؤالُ
--        فريقٍ** لا سؤالُ مالكٍ وحيد» — وفي اللوحة مديران منذ ٥ سبتمبر.
--        **وسجلٌّ يرى الإيقافَ ولا يرى قبولَ شريكٍ سجلٌّ ناقص.**
--
--    (هـ) **أخطرُ زرٍّ في المنتج هو أرخصُها ضغطة**: الإيقافُ يفرض سبباً
--        إلزاميّاً منذ D-901 (**«أوقفتُ حسابك» بلا سببٍ بلاغٌ لا قرار**)،
--        **ومنحُ الإدارة ضغطةٌ واحدةٌ بلا سببٍ ولا تأكيد** — وهو يعطي
--        صاحبَه فكَّ إيقافِ نفسِه وكشفَ البُرد ومسحَ البلاغات.
--        **والانقلابُ في غير محلّه**: الأوسعُ أثراً يجب أن يكون الأغلى ثمناً.
--
-- ⚖️ **ولا شاشةَ جديدةً ولا جدولَ ولا سياسة**: خمسُ دوالَّ قائمةٍ تُحسَّن في
--    مكانها. **الإضافةُ محضةٌ في §١–§٤** (نداءُ `log_admin` في نهاية الفعل
--    بعد نجاحه، فالفشلُ يرتدّ بالمعاملة كما كان) — **و§٥ وحدَها تغيّر
--    توقيعاً.**
--
-- 🔴 **و§٥ تُسقط التوقيعَ القديم ولا تتركه**: `p_reason` بقيمةٍ افتراضيّةٍ
--    تُبقي البابَ الرخيص مفتوحاً (نداءٌ بمعاملين يمرّ بلا سبب)، **وتوقيعان
--    لفعلٍ واحدٍ التباسٌ على PostgREST ونسخةٌ ثانيةٌ من شيءٍ واحد** —
--    وهو عيبُ D-926 نفسُه. **فالإسقاطُ صريح.**
--    ⚠️ **وثمنُه نافذةٌ قصيرة**: بين تشغيل الهجرة ونشرِ الشيفرة، **زرُّ منح
--    الإدارة وحدَه** يردّ خطأً (الدالّةُ ذاتُ المعاملين لم تعد موجودة).
--    دقائقُ على زرٍّ يُضغط مرّةً في الشهر — **والهجرةُ تُشغَّل قبل الشيفرة
--    كأخواتها** (نمطُ ١٨٧).
--
-- 🔑 **ومنحُ `anon` يُسحب من الثلاثة الملموسة**: `admin_decide_partner`
--    **دالّةُ كتابةٍ ممنوحةٌ للزائر** اليوم — الحكمُ في جسمها صحيحٌ
--    (`am_admin`) **لكنّ الدفاعَ طبقةٌ واحدةٌ لا طبقتان**. ⚖️ **ولا يُعمَّم
--    هنا**: الجردُ الكاملُ (١١٩ دالّة) سَحبةٌ واحدةٌ مولَّدةٌ بذاتها، **ونصفُ
--    سحبةٍ يُقرأ سحبةً تامّةً فيُنسى الباقي.**
--
-- 🔑 **و`pg_temp` تُضاف إلى مسار البحث في كلِّ دالّةٍ تُلمس هنا**: كنَّ
--    `set search_path = public` وحدَها — **وهي دوالُّ `definer`**.

-- ═══ §١ — التوثيق يُكتب ═════════════════════════════════════
create or replace function public.admin_decide_verification(p_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.verification_requests%rowtype;
begin
  if not public.am_admin() then raise exception 'admin only'; end if;
  if p_decision not in ('approved', 'rejected', 'more_info') then
    raise exception 'bad decision'; end if;
  select * into r from public.verification_requests where id = p_id;
  if r.id is null then raise exception 'not found'; end if;
  update public.verification_requests
     set status = p_decision,
         note = nullif(btrim(coalesce(p_note, '')), ''),
         decided_at = case when p_decision = 'more_info' then null else now() end,
         decided_by = auth.uid()
   where id = p_id;
  if p_decision = 'approved' then
    update public.profiles set verified_at = now(), verified_kind = r.kind
     where id = r.user_id;
  end if;
  -- 🆕 D-962 — **الهدفُ صاحبُ الطلب لا الطلب**: السجلُّ يُقرأ باسمِ إنسانٍ
  --    (`admin_audit_log` تضمّ الأسماءَ على `target`)، **ومعرِّفُ طلبٍ في
  --    عمودِ الهدف يُطبع فارغاً في الشاشة.** والطلبُ في التفصيل.
  perform public.log_admin('decide_verification', r.user_id,
    jsonb_build_object('request', p_id, 'decision', p_decision, 'kind', r.kind));
  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

revoke all on function public.admin_decide_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_verification(uuid, text, text) to authenticated;

-- ═══ §٢ — الشراكة تُكتب، والكودُ معها ═══════════════════════
-- ⚠️ **والبنيةُ تغيّرت قدرَ ما يلزم لا أكثر**: كان في جسم الحلقة `return`
--    **فالخروجُ يقع قبل أيِّ سطرٍ بعده** — وسجلٌّ يُكتب بعد `return` سجلٌّ
--    لا يُكتب. صار `exit` براية، **والاستثناءُ عند استنفاد العشر باقٍ كما كان.**
create or replace function public.admin_decide_partner(p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  candidate text;
  v_code    text;
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  update public.partner_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now()
   where user_id = p_user and status = 'pending';
  if not found then return; end if;
  if p_approve then
    for i in 1..10 loop
      candidate := (
        select string_agg(
          substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                 (floor(random() * 32) + 1)::int, 1), '')
        from generate_series(1, 8)
      );
      if not exists (select 1 from public.referral_codes where code = candidate)
         and not exists (select 1 from public.partners where code = candidate) then
        insert into public.partners (user_id, code) values (p_user, candidate)
        on conflict (user_id) do nothing;
        -- 🆕 D-857: الشارةُ فور الموافقة
        update public.profiles set plan = 'partner' where id = p_user;
        v_code := candidate;
        exit;
      end if;
    end loop;
    if v_code is null then
      raise exception 'could not allocate a partner code';
    end if;
  end if;
  perform public.log_admin('decide_partner', p_user,
    jsonb_build_object('approve', coalesce(p_approve, false), 'code', v_code));
end;
$$;

revoke all on function public.admin_decide_partner(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_partner(uuid, boolean) to authenticated;

-- ═══ §٣ — رابطُ المنصّة يُكتب بوجهته ════════════════════════
-- 🔑 **والوجهةُ في التفصيل لا العنوانُ وحدَه**: بندُ السجلِّ الذي لا يقول
--    **إلى أين** وُجِّه الرابطُ لا يُراجَع.
create or replace function public.admin_set_provider_link(p_tmdb integer, p_media text, p_provider integer, p_country text, p_url text, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('verified','pending','disabled') then
    raise exception 'bad status';
  end if;

  insert into public.provider_content_links as l
    (tmdb_id, media_type, provider_id, country_code, destination_url, status, verified_at)
  values
    (p_tmdb, p_media, p_provider, upper(p_country), p_url, p_status,
     case when p_status = 'verified' then now() else null end)
  on conflict (tmdb_id, media_type, provider_id, country_code)
  do update set
    destination_url = excluded.destination_url,
    status          = excluded.status,
    verified_at     = case when excluded.status = 'verified' then now() else l.verified_at end,
    updated_at      = now();

  perform public.log_admin('set_provider_link', null,
    jsonb_build_object('tmdb', p_tmdb, 'media', p_media, 'provider', p_provider,
                       'country', upper(p_country), 'status', p_status, 'url', p_url));
end;
$$;

revoke all on function public.admin_set_provider_link(integer, text, integer, text, text, text) from public, anon;
grant execute on function public.admin_set_provider_link(integer, text, integer, text, text, text) to authenticated;

-- ═══ §٤ — «تعليمُ الدعوة» يُكتب كأختيه ══════════════════════
-- ⚠️ **ومفتاحُ `tester_invited` كان في خريطةِ الواجهة العربيّة منذ D-909
--    ولا دالّةَ تكتبه** — **ترجمةٌ لفعلٍ لا يقع.** فإمّا يُحذف المفتاحُ أو
--    يصدق: **وأختاه (`tester_add`/`tester_remove`) تُكتبان، فالشذوذُ في
--    الصمت لا في الكتابة.**
-- ⚖️ **ولا يُكتب إلا إذا وقع فعلاً** (`if found`): بريدٌ ليس في القائمة
--    لا يغيّر شيئاً، **وسجلٌّ يمتلئ بأفعالٍ لم تقع سجلٌّ لا يُقرأ.**
create or replace function public.admin_tester_invited(p_email text, p_on boolean)
returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  v := lower(btrim(coalesce(p_email, '')));
  update public.play_testers
     set invited_at = case when coalesce(p_on, false) then now() else null end
   where email = v;
  if found then
    perform public.log_admin('tester_invited', null,
      jsonb_build_object('email', v, 'on', coalesce(p_on, false)));
  end if;
end;
$$;

revoke all on function public.admin_tester_invited(text, boolean) from public, anon;
grant execute on function public.admin_tester_invited(text, boolean) to authenticated;

-- ═══ §٥ — منحُ الإدارة يُعلَّل كما يُعلَّل الإيقاف ═══════════
-- 🔴 **الإسقاطُ أوّلاً** (التوقيعُ يتغيّر، فلا `create or replace`):
drop function if exists public.admin_set_admin(uuid, boolean);

create or replace function public.admin_set_admin(p_user uuid, p_on boolean, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_was    boolean;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  if p_user is null then raise exception 'bad_user'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  -- 🆕 **السببُ إلزاميٌّ في القاعدة لا في الواجهة وحدَها** (نمطُ
  --    `admin_suspend_user`): **حقلٌ تمنعه الشاشةُ وحدَها حقلٌ يُتجاوَز
  --    بنداءٍ مباشر**، والسجلُّ هو الذي يُقرأ بعد شهر.
  if char_length(v_reason) < 3 then raise exception 'reason_required'; end if;

  select is_admin into v_was from public.profiles where id = p_user;
  if v_was is null then raise exception 'no_such_user'; end if;
  -- ⚖️ **ولا سطرَ سجلٍّ لفعلٍ لم يغيّر شيئاً**: منحُ مديرٍ هو مديرٌ أصلاً
  --    لا شيءَ يُحاسَب عليه (سلوكُ ١٨٧ نفسُه).
  if v_was = coalesce(p_on, false) then return; end if;

  update public.profiles set is_admin = coalesce(p_on, false) where id = p_user;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(),
          case when p_on then 'grant_admin' else 'revoke_admin' end,
          p_user, jsonb_build_object('was', v_was, 'reason', v_reason));
end;
$$;

revoke all on function public.admin_set_admin(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, text) to authenticated;

-- ═══ التحقُّق (يُشغَّل بعدها، ويُقرأ بالعين) ═════════════════
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--        p.prosrc ilike '%log_admin%' as logs,
--        (select string_agg(distinct r.rolname, ',') from aclexplode(p.proacl) x
--           join pg_roles r on r.oid = x.grantee where x.privilege_type = 'EXECUTE') as grantees
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('admin_decide_verification','admin_decide_partner',
--                      'admin_set_provider_link','admin_tester_invited','admin_set_admin')
--  order by 1;
-- المتوقَّع: خمسةُ صفوفٍ · `logs = true` في كلٍّ · لا `anon` في أيِّ منحٍ ·
--           و`admin_set_admin` بثلاثة معاملاتٍ **وصفٌّ واحدٌ لا صفّان.**
-- وبعد أوّل فعلٍ حقيقيّ: select action, detail from public.admin_audit order by at desc limit 5;
