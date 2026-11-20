-- ============================================================
--  ٢٥٤ — event_lists_dune_reaping · **قائمتا حدثٍ تحريريّتان** (T490)
--
--  اقتراحُ مهمّة مراجعة القوائم الأسبوعيّة (٢٠ نوفمبر ٢٠٢٦)، وأحمد: «1 و3 نفذ»
--  — وهو الإذنُ الصريحُ بإدراج البيانات (DML بكلمته، لا DDL هنا).
--
--  **على سابقة الهجرة ١٠١ حرفاً**: القائمةُ باسم حساب Loopz (D-220)،
--  و`kind = 'watch_order'` لأن الأرقامَ على الملصقات ترتيبُ مشاهدة،
--  **و`source_slug` يُكتب من الولادة** (درسُ الهجرة ١٢٠: قائمةٌ بلا هويّةٍ
--  تمرّ باسمها العربيّ في حسابٍ إنجليزيّ) — وقاموسُ `EDITORIAL` في
--  `universes.ts` يعطيه الاسمَ والنبذةَ بلغتين ويثبّته في «تناسبك».
--
--  **والمعرّفاتُ والملصقاتُ من بحث التطبيق نفسه** (`/api/v1/search`) لا من
--  الذاكرة (D-152). **والفيلمُ الحدثُ عنصرٌ في قائمته** كما دخل Doomsday
--  قائمتَه (البند ١٦).
--
--  **ومعرّفا القائمتين ثابتان** فالإعادةُ آمنة، و`on conflict` على العناصر
--  يصحّح الترتيبَ ولا يكرّر صفّاً. **لا حذفَ ولا تعديلَ لصفٍّ قائم.**
-- ============================================================

begin;

insert into public.user_lists (id, user_id, name, subtitle, is_public, kind, source_slug)
values
  ('a0d00000-0000-4000-8000-000000000102', '100b2000-0000-4000-8000-000000000001',
   'طريقك إلى Dune: Part Three', 'كلُّ «كثيب» على الشاشة قبل خاتمة ثلاثيّة فيلنوف',
   true, 'watch_order', 'dune-road'),
  ('a0d00000-0000-4000-8000-000000000103', '100b2000-0000-4000-8000-000000000001',
   'طريقك إلى Sunrise on the Reaping', 'ألعاب الجوع بترتيب أحداث بانيم',
   true, 'watch_order', 'reaping-road')
on conflict (id) do nothing;

insert into public.user_list_items (list_id, tmdb_id, media_type, title, poster_path, sort_order) values
('a0d00000-0000-4000-8000-000000000102', 841,     'movie', 'Dune',                              '/4kJmUCE7mkVJjXa7A0g2rY4IGTm.jpg', 1),
('a0d00000-0000-4000-8000-000000000102', 19566,   'tv',    'Frank Herbert''s Dune',             '/iIf5XeuuBKPtG6H7MfWLirbJGrQ.jpg', 2),
('a0d00000-0000-4000-8000-000000000102', 9156,    'tv',    'Frank Herbert''s Children of Dune', '/yCP8lKXBMtcG1CU9K3NsWlu1RgF.jpg', 3),
('a0d00000-0000-4000-8000-000000000102', 191720,  'movie', 'Jodorowsky''s Dune',                '/maxjevZcGbfrp55XRk4gcZGeJVd.jpg', 4),
('a0d00000-0000-4000-8000-000000000102', 438631,  'movie', 'Dune',                              '/pA9WRL9j6eigtwK0majwT0lDh9G.jpg', 5),
('a0d00000-0000-4000-8000-000000000102', 90228,   'tv',    'Dune: Prophecy',                    '/k74582cs4J7RHae8QFNsbq4ibVy.jpg', 6),
('a0d00000-0000-4000-8000-000000000102', 693134,  'movie', 'Dune: Part Two',                    '/3fZc7kZ09aZB0rtYBVK2hPojZec.jpg', 7),
('a0d00000-0000-4000-8000-000000000102', 1170608, 'movie', 'Dune: Part Three',                  '/1ysvaWCa13BtMcjlWxPPcXuWHWa.jpg', 8),
('a0d00000-0000-4000-8000-000000000103', 695721,  'movie', 'The Hunger Games: The Ballad of Songbirds & Snakes', '/mBaXZ95R2OxueZhvQbcEWy2DqyO.jpg', 1),
('a0d00000-0000-4000-8000-000000000103', 1300968, 'movie', 'The Hunger Games: Sunrise on the Reaping',           '/jNcZH8yplxttRlf0wwqfGGMKHxX.jpg', 2),
('a0d00000-0000-4000-8000-000000000103', 70160,   'movie', 'The Hunger Games',                                   '/apa5G43Hha7kH7wJG0gkkHT7FA9.jpg', 3),
('a0d00000-0000-4000-8000-000000000103', 101299,  'movie', 'The Hunger Games: Catching Fire',                    '/vrQHDXjVmbYzadOXQ0UaObunoy2.jpg', 4),
('a0d00000-0000-4000-8000-000000000103', 131631,  'movie', 'The Hunger Games: Mockingjay - Part 1',              '/meSGXQ8MXqiC8bXxkKu7lPqnu0L.jpg', 5),
('a0d00000-0000-4000-8000-000000000103', 131634,  'movie', 'The Hunger Games: Mockingjay - Part 2',              '/lImKHDfExAulp16grYm8zD5eONE.jpg', 6)
on conflict (list_id, tmdb_id, media_type) do update set sort_order = excluded.sort_order, title = excluded.title, poster_path = excluded.poster_path;

commit;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل — يُتوقَّع: dune = 8 · reaping = 6 ·
--  slugs = dune-road, reaping-road · kind = watch_order · pub = true
-- ============================================================
-- select l.source_slug, l.kind, l.is_public, count(i.*)::int as items
--   from public.user_lists l left join public.user_list_items i on i.list_id = l.id
--  where l.id in ('a0d00000-0000-4000-8000-000000000102', 'a0d00000-0000-4000-8000-000000000103')
--  group by 1, 2, 3 order by 1;
