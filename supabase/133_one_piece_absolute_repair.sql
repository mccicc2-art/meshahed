-- 133: إصلاح بيانات One Piece (37854) بعد إعادة هيكلة TMDB للمواسم
-- بترقيمٍ مطلق (D-603). نسخةٌ احتياطية أولاً، ثم:
--   أحمد: حذف ٨ أشباحٍ نسبية في الموسم ٢ (أرقام < 62 ونافذته 62–77)
--   خالد: إعادة ترقيم مواسمه 2–22 النسبية إلى المطلق (إزاحة أول الموسم)،
--          وحذف أشباح S23 (أرقام خارج نافذته 1156–1181)
-- بإذن أحمد المسمّى («الهجرة والفحوص نفذهم»، ٢٥ أغسطس).

-- النسخة الاحتياطية: كل صفوف العرض للحسابين قبل أي مساس
create table public.watched_episodes_backup_133 as
select w.* from public.watched_episodes w
join public.profiles p on p.id = w.user_id
where w.show_tmdb_id = 37854 and p.username in ('ahmed', 'khld');

-- مقفولة عن العملاء: RLS بلا سياسات (لا تُحسب في open_policies)
alter table public.watched_episodes_backup_133 enable row level security;

-- أحمد: أشباح الموسم ٢ النسبية
delete from public.watched_episodes w
using public.profiles p
where p.id = w.user_id and p.username = 'ahmed'
  and w.show_tmdb_id = 37854
  and w.season_number = 2
  and w.episode_number < 62;

-- خالد: النسبي إلى المطلق — الإزاحة = آخر حلقةٍ قبل الموسم، والحارس
-- episode_number <= len يترك أيَّ صفٍّ مطلقٍ قائمٍ بلا مساس
with offsets(season, off, len) as (
  values (2,61,16),(3,77,14),(4,91,39),(5,130,13),(6,143,52),(7,195,33),
         (8,228,35),(9,263,73),(10,336,45),(11,381,26),(12,407,14),
         (13,421,101),(14,522,58),(15,580,62),(16,642,50),(17,692,56),
         (18,748,55),(19,803,74),(20,877,14),(21,891,197),(22,1088,67)
)
update public.watched_episodes w
set episode_number = w.episode_number + o.off
from offsets o, public.profiles p
where p.id = w.user_id and p.username = 'khld'
  and w.show_tmdb_id = 37854
  and w.season_number = o.season
  and w.episode_number <= o.len;

-- خالد: أشباح S23 خارج نافذته المطلقة
delete from public.watched_episodes w
using public.profiles p
where p.id = w.user_id and p.username = 'khld'
  and w.show_tmdb_id = 37854
  and w.season_number = 23
  and (w.episode_number < 1156 or w.episode_number > 1181);
