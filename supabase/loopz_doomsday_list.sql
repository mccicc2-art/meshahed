-- ============================================================
--  ١٠١ — loopz_doomsday_list · **قائمةُ «طريقك إلى Avengers: Doomsday»** (D-317)
--  تُشغَّل بعد review_spoiler.sql (100)
--
--  طلبُ أحمد بلقطةِ قائمة ديزني: «اعمل قايمة وضيف فيها هذي الأفلام»
--  — وهو الإذنُ الصريحُ بتعديل البيانات (الإذنُ الدائم لا يشمله).
--
--  **القائمةُ باسم حساب Loopz لا باسم أحمد** (D-220: أدواتُ الجلسة
--  لا تكتب صفّاً باسمه) — وقوائمُ Loopz مواطنةٌ كاملة منذ D-290.
--
--  **و`kind = 'watch_order'`**: هذا حرفيّاً المثالُ الذي كُتب العمودُ
--  لأجله («ترتيبُ مشاهدةٍ زمنيّ — خطّ مارفل مثلاً»، lists2.sql) —
--  فالأرقامُ على الملصقات صادقةٌ لا زخرفة.
--
--  **والترتيبُ ترتيبُ ديزني في اللقطة حرفاً** (١ → ١٥ كما أرسلها)،
--  حتى حيث يخالف الزمن (Deadpool & Wolverine قبل Multiverse of
--  Madness) — اللقطةُ مصدرُ الحقيقة، والقائمةُ منسوبةٌ لناشرها.
--
--  **والمعرّفاتُ من TMDB عبر بحث التطبيق نفسه** (/api/suggest) لا من
--  الذاكرة — كلُّ صفٍّ تحقّق بمعرّفه وسنته وملصقه (D-152).
--
--  **ومعرّفُ القائمة ثابتٌ** فالإعادةُ آمنة، و`on conflict` على
--  العناصر يصحّح الترتيبَ ولا يكرّر صفّاً.
-- ============================================================

begin;

insert into public.user_lists (id, user_id, name, subtitle, is_public, kind)
values (
  'a0d00000-0000-4000-8000-000000000101',
  '100b2000-0000-4000-8000-000000000001',
  'طريقك إلى Avengers: Doomsday',
  'ترتيب المشاهدة الذي أوصت به ديزني قبل الفيلم',
  true,
  'watch_order'
)
on conflict (id) do nothing;

insert into public.user_list_items (list_id, tmdb_id, media_type, title, poster_path, sort_order) values
('a0d00000-0000-4000-8000-000000000101', 36657,  'movie', 'X-Men',                                       '/bRDAc4GogyS9ci3ow7UnInOcriN.jpg', 1),
('a0d00000-0000-4000-8000-000000000101', 36658,  'movie', 'X2',                                          '/bst4alFUXCxISwdRUKSMhhkrX1M.jpg', 2),
('a0d00000-0000-4000-8000-000000000101', 1771,   'movie', 'Captain America: The First Avenger',          '/vSNxAJTlD0r02V9sPYpOjqDZXUK.jpg', 3),
('a0d00000-0000-4000-8000-000000000101', 24428,  'movie', 'The Avengers',                                '/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',  4),
('a0d00000-0000-4000-8000-000000000101', 299536, 'movie', 'Avengers: Infinity War',                      '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', 5),
('a0d00000-0000-4000-8000-000000000101', 299534, 'movie', 'Avengers: Endgame',                           '/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg', 6),
('a0d00000-0000-4000-8000-000000000101', 84958,  'tv',    'Loki',                                        '/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg', 7),
('a0d00000-0000-4000-8000-000000000101', 566525, 'movie', 'Shang-Chi and the Legend of the Ten Rings',   '/9f2Q0U3IOsLgrI2HkvldwSABZy5.jpg', 8),
('a0d00000-0000-4000-8000-000000000101', 634649, 'movie', 'Spider-Man: No Way Home',                     '/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', 9),
('a0d00000-0000-4000-8000-000000000101', 505642, 'movie', 'Black Panther: Wakanda Forever',              '/sv1xJUazXeYqALzczSZ3O6nkH75.jpg', 10),
('a0d00000-0000-4000-8000-000000000101', 822119, 'movie', 'Captain America: Brave New World',            '/pzIddUEMWhWzfvLI3TwxUG2wGoi.jpg', 11),
('a0d00000-0000-4000-8000-000000000101', 533535, 'movie', 'Deadpool & Wolverine',                        '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', 12),
('a0d00000-0000-4000-8000-000000000101', 453395, 'movie', 'Doctor Strange in the Multiverse of Madness', '/ddJcSKbcp4rKZTmuyWaMhuwcfMz.jpg', 13),
('a0d00000-0000-4000-8000-000000000101', 986056, 'movie', 'Thunderbolts*',                               '/hqcexYHbiTBfDIdDWxrxPtVndBX.jpg', 14),
('a0d00000-0000-4000-8000-000000000101', 617126, 'movie', 'The Fantastic 4: First Steps',                '/nf5qaSEvyYSNeFH0YhSs5EsBLX9.jpg', 15)
on conflict (list_id, tmdb_id, media_type) do update set sort_order = excluded.sort_order, title = excluded.title, poster_path = excluded.poster_path;

commit;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل — يُتوقَّع: lists = 1 · items = 15 ·
--  kind = watch_order · pub = true
--  (✅ وتحقَّق)
-- ============================================================
-- select
--   (select count(*)::int from public.user_lists
--     where id = 'a0d00000-0000-4000-8000-000000000101')            as lists,
--   (select count(*)::int from public.user_list_items
--     where list_id = 'a0d00000-0000-4000-8000-000000000101')      as items,
--   (select kind from public.user_lists
--     where id = 'a0d00000-0000-4000-8000-000000000101')           as kind,
--   (select is_public from public.user_lists
--     where id = 'a0d00000-0000-4000-8000-000000000101')           as pub;
