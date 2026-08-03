-- تخزين إحصاءات المسلسل مع صف المتابعة، حتى لا تُطلب TMDB من جديد
-- في كل زيارة للمكتبة. الرئيسية (وصفحة المسلسل) تحدّثها عند الحاجة فقط.

alter table public.follows
  add column if not exists total_episodes  int,
  add column if not exists aired_episodes  int,
  add column if not exists next_air_date   date,
  add column if not exists stats_updated_at timestamptz;

-- قراءة المكتبة تمرّ على صفوف المستخدم فقط
create index if not exists follows_user_media_idx
  on public.follows (user_id, media_type);
