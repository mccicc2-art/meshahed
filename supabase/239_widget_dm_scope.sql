-- 239 — A-05: رمزُ الودجت لا يرسل رسائل — رمزٌ ثانٍ بنطاق «dm» لردود الإشعار (بناء 1.14.0، خطّةُ الأمن ٤ نوفمبر C1)
--
-- لماذا: رمزٌ واحدٌ (هجرة ٢٠١) كان يعلّم الحلقات **ويردّ في الرسائل ويختمها مقروءة** (`/api/v1/widget/dm-reply` و`dm-read`).
-- فمن وصل إلى رمز الودجت — وهو أكثرُ الرموز انتشاراً: في مجلّد الودجت على كلِّ جهاز — كتب باسم صاحبه لأصدقائه.
-- الآن لكلِّ رمزٍ نطاقٌ واحد: `widget` يعلّم ويقيّم ويضيف (مساراتُ الودجت)، و`dm` يردّ ويختم (مسارا الرسائل) — ولا يتبادلان.
--
-- الصفوفُ القائمةُ (رموزُ الودجت اليوم) تأخذ `widget` افتراضاً، فلا يتغيّر عملُها. ومرحلةُ انتقال في الكود لا هنا:
-- مسارا الرسائل يقبلان رمزَ `widget` حتى تاريخٍ مكتوبٍ في `src/core/widgetScope.ts` (نسخٌ قديمةٌ لم تأخذ رمزَ `dm` بعد)، ثمّ يرفضانه.
--
-- آمنةُ الإعادة، ولا عبارةَ هدمٍ فيها. لا منحَ تتغيّر: الجدولُ للخادم وحده كما كان (RLS بلا سياسة).

alter table public.widget_tokens
  add column if not exists scope text not null default 'widget';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.widget_tokens'::regclass and conname = 'widget_tokens_scope_check'
  ) then
    alter table public.widget_tokens
      add constraint widget_tokens_scope_check check (scope in ('widget', 'dm'));
  end if;
end $$;

comment on column public.widget_tokens.scope is
  'A-05: widget = mark/unmark/rate/start/to-watch from the widget; dm = reply and mark-read from a message notification. A token is accepted only on its own routes.';

-- تحقّق (للقراءة فقط):
--   select scope, count(*) from public.widget_tokens group by scope;   -- كلُّها widget قبل 1.14.0
