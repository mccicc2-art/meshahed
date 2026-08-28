-- ============================================================
--  Loopz — هجرة ١٥٣: مقروئيةُ الردود + آخرُ ظهور (D-765)
--  شغّلها في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  بلاغ أحمد (٢٨ أغسطس، لقطة iPhone): «مايصل أشعار ولا علامة نقطة أن
--  في رسالة» — والسبب أن العدّاد كان يعدّ المشاركات وحدها، والردود
--  النصية (الرسائل الفعلية) بلا علامة قراءةٍ أصلاً فلا تُعدّ أبداً.
--  و«دائماً مكتوب live» — كان حالَ قناة Realtime لا حالَ الشخص،
--  والمطلوب آخرُ ظهورٍ حقيقيّ («قبل ساعة، قبل يوم»).
--
--  بنيةٌ + تصفيرٌ واحدٌ للبيانات القائمة (البند ٢ أدناه) أُذن له
--  بالاسم: «نعم صفّرها» (٢٨ أغسطس) — فلا شاراتِ وهمَ تاريخيّةً تظهر
--  دفعةً واحدة. لا سياساتَ جديدة: الأبوابُ الجديدة كلُّها دوالُّ definer
--  (نمط ١٢٩/١٣٨) — وopen_policies يبقى أربعاً.
-- ============================================================

-- ١) علامةُ قراءةٍ على الردود — كانت المقروئيةُ للمشاركات وحدها
alter table public.share_replies
  add column if not exists read_at timestamptz;

-- ٢) ⚠️ تعديلُ بياناتٍ بإذنٍ مسمًّى («نعم صفّرها»): الردودُ السابقة
--    للهجرة تُعلَّم مقروءةً بتاريخ إنشائها — العدُّ يبدأ ممّا يصل بعدها،
--    ولا يفتح المستخدمون شاراتٍ عن رسائلَ قرؤوها قبل شهور
update public.share_replies set read_at = created_at where read_at is null;

-- ٣) آخرُ ظهور — تُحدَّث بنبضةِ حضورٍ مخنوقةٍ في جسم الدالة (البند ٦)
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- ٤) العدّادُ يشمل الردودَ غيرَ المقروءة (بُني فوق الجسم الحيّ حرفاً —
--    القاعدة ٨: قُرئ pg_get_functiondef قبل الاستبدال وطابقَ
--    list_shares.sql؛ الجمعان الأوّلان كما كانا والثالثُ مُلحق)
create or replace function public.unread_shares()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::int from public.title_shares
    where recipient_id = auth.uid() and recipient_hid = false and read_at is null
  ) + (
    select count(*)::int from public.list_shares
    where recipient_id = auth.uid() and recipient_hid = false and read_at is null
  ) + (
    select count(*)::int
    from public.share_replies r
    join public.title_shares s on s.id = r.share_id
    where r.author_id <> auth.uid()
      and r.read_at is null
      and ((s.sender_id = auth.uid() and s.sender_hid = false)
        or (s.recipient_id = auth.uid() and s.recipient_hid = false))
  );
$$;

revoke all on function public.unread_shares() from public;
grant execute on function public.unread_shares() to authenticated;

-- ٥) تعليمُ محادثةِ شخصٍ مقروءةً — بابٌ واحدٌ للجداول الثلاثة.
--    دالّةُ definer لا سياسةُ update جديدة على الردود (نمط ١٢٩/١٣٨):
--    سياسةٌ كانت ستفتح تعديلَ صفوفِ الغير، والدالّةُ تحصر التعديلَ في
--    عمود القراءة ولطرفِ الخيط وحدَه. auth.uid() فارغة؟ الشروطُ تكذب
--    كلُّها فلا صفَّ يُمسّ.
create or replace function public.mark_conversation_read(p_peer uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.title_shares
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
  update public.list_shares
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
  update public.share_replies r
     set read_at = now()
   where r.author_id = p_peer
     and r.read_at is null
     and exists (
       select 1 from public.title_shares s
       where s.id = r.share_id
         and (s.sender_id = auth.uid() or s.recipient_id = auth.uid())
     );
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ٦) نبضةُ الحضور — الخنقُ (٦٠ ثانية) في جسم الدالة لا في المسار
--    (D-011/D-314: التنقيةُ حيث الباب)، فلا تصير كتابةً لكلِّ طلب
create or replace function public.touch_last_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- ٧) قراءةُ آخرِ ظهورِ شخصٍ — محروسةٌ بـare_mutual لا can_view_profile:
--    قارئُها الوحيدُ ترويسةُ محادثةٍ، والمحادثةُ لا تقوم إلا بين
--    متتابعَين — فالبابُ يُفتح بقدر حاجته لا بقدر عموم الملفّ (D-138
--    روحاً). من فُكَّت متابعتُه يرى الخيطَ القديم بلا آخرِ ظهور.
create or replace function public.last_seen_of(target uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select p.last_seen_at
  from public.profiles p
  where p.id = target
    and public.are_mutual(auth.uid(), target);
$$;

revoke all on function public.last_seen_of(uuid) from public;
grant execute on function public.last_seen_of(uuid) to authenticated;

-- التحقّق بعد التشغيل:
--   select count(*) from pg_policies where schemaname='public' and qual='true';
--   -- = 4 كما كانت (لا سياسة جديدة)
--   select proname from pg_proc where proname in
--     ('mark_conversation_read','touch_last_seen','last_seen_of');
--   -- = الثلاث حاضرة
--   select count(*) from public.share_replies where read_at is null;
--   -- = 0 لحظةَ التشغيل (التصفير شمل الكلّ)
