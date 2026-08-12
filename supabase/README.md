# ملفات قاعدة البيانات — ترتيب التشغيل

كل ملف يُشغَّل في Supabase → SQL Editor مرة واحدة، **بهذا الترتيب حصراً**.
إعادة تشغيل أي ملف آمنة (idempotent)، لكن `security.sql` و `security2.sql`
هما المصدر الوحيد لسياسات القراءة ودوال العرض — لا تعيدوا إنشاءها في غيرهما.

| # | الملف | ماذا يفعل |
|---|---|---|
| 01 | `schema.sql` | الجداول الأساسية: المتابعات والمشاهدات + RLS |
| 02 | `profile.sql` | البروفايل + مخزن الصور |
| 03 | `username.sql` | عمود المعرّف @handle (توليد عشوائي) |
| 04 | `appearance.sql` | الغلاف والثيم واللغة |
| 05 | `homeprefs.sql` | تفضيلات الرئيسية |
| 06 | `show_stats.sql` | تخزين إحصاءات المسلسل مع صف المتابعة |
| 07 | `storage_limits.sql` | حدّ حجم/نوع الصور على الخادم |
| 08 | `progress.sql` | موضع التوقف في الأفلام |
| 09 | `social.sql` | التقييمات (كتابة فقط) + متابعة المستخدمين |
| 10 | `social2.sql` | إخفاء الاسم + زوّار الملف |
| 11 | `news.sql` | تفاعلات الأخبار (كتابة فقط) |
| 12 | `likes.sql` | إعجابات المراجعات (كتابة فقط) |
| 13 | `lists.sql` | القوائم الشخصية |
| 14 | `performance.sql` | فهرس «آخر ما شاهدت» |
| 15 | `leaderboard.sql` | فهارس اللوحة + الأكثر مشاهدة |
| 16 | `rewatch.sql` | إعادة المشاهدة + **watch_summary القانونية** |
| 17 | `public_profiles.sql` | إغلاق قراءة جدول الملفات |
| 18 | `security.sql` | **حزمة الأمن**: كل سياسات القراءة ودوال definer + حذف الحساب |
| 19 | `security2.sql` | فهارس الصفحات الساخنة + إخفاء المعرّف + إحصاءات الملف العام |
| 20 | `lists2.sql` · `lists3.sql` · `lists4.sql` | نوع القائمة والترتيب، السطر الشارح، بطاقات الغلاف والعدّادات |
| 21 | `image_positions.sql` | تموضع الغلاف والصورة الشخصية |
| 22 | `search_people_v2.sql` | بحث الأشخاص (مستخدمو التطبيق) |

## ✅ شُغِّلت كلها في الإنتاج — ٨ أغسطس ٢٠٢٦

| # | الملف | ماذا أضاف | حالة الواجهة |
|---|---|---|---|
| 23 | `profile_bio.sql` | عمود `bio` + إظهاره في `public_profiles` تابعاً لإخفاء الاسم | **مشحونة** |
| 24 | `review_reports.sql` | جدول البلاغات + `ratings.hidden` + مُشغِّل الإخفاء عند البلاغ العاشر | **مشحونة** |
| 25 | `referrals.sql` | رموز الدعوة والدعوات المحقَّقة + أربع دوال definer | لم تُبنَ بعد |
| 26 | `shares.sql` | `title_shares` + `share_replies` + `are_mutual` + `unread_shares` | لم تُبنَ بعد |
| 27 | `community_feed.sql` | `community_activity()` — خطّ آراء الجميع؛ عليه تقوم رقاقة «الكل» في تبويب «الأعمال» (D-187) | **RUN 12 Aug** — مُتحقَّق: `definer` · `execute` لـ`authenticated` وحدها · `ratings_updated_idx` · **والسياساتُ المفتوحة أربعٌ ولا `public.ratings` فيها** |
| 28 | `person_follows.sql` | متابعة الفنانين | **مشحونة** |
| 29 | `profile_visibility.sql` | **أُعيد كتابته ٩ أغسطس:** الحساب الخاص يخفي محتواه — `can_view_profile` + بوّابة دوال الملف الخمس + `is_private` في العرض. ⚠️ يُشغَّل **بعد** ٢٤ و٣٢ رغم رقمه | **مشحونة** |
| 30 | `security3.sql` | إغلاق قراءة `follows` و`watched_*` | لا واجهة لها |
| 31 | `blocks.sql` | جدول الحظر + `is_blocked` مطويّة داخل `are_mutual` + `block_user` + `my_blocks` | **مشحونة** |
| 32 | `follow_requests.sql` | `profiles.is_private` + طلبات المتابعة + `request_or_follow` وقبولٌ وإزالةُ متابِع | **مشحونة** |
| 33 | `dismissed_titles.sql` | جدول «غير مهتم» لاستبعاد أعمالٍ من «مقترح لك» | **مشحونة** |
| 34 | `communities.sql` | المجتمعات: غرفٌ بعضويةٍ ودردشة — دليلها مقروءٌ للجميع عمداً | **مشحونة** |
| 35 | `communities2.sql` | إصلاح تكرار RLS: فحص العضوية عبر `is_community_member` (definer) | **مشحونة** |
| 36 | `user_reports.sql` | الإبلاغ عن حساب — شقيق `review_reports` بلا إخفاءٍ تلقائيّ | **مشحونة** |
| 37 | `list_shares.sql` | مشاركة قائمةٍ لصديق في الرسائل (صفٌّ منظَّم، D-051) + `unread_shares` يشمل القوائم | **مشحونة** |
| 38 | `list_saves.sql` | حفظ قائمة غيرك مرجعاً حيّاً — «أضِفها إلى قوائمي» | **مشحونة** |
| 39 | `realtime_messages.sql` | publication الرسائل الأربعة للـ Realtime (فورية المحادثات) | **مشحونة** |
| 40 | `library_grants.sql` | «من يرى مكتبتي»: منحة فردية تُطوى في `can_view_profile` (يستبدل نسخة 29) | **مشحونة** |
| 41 | `community_photo.sql` | صورة المجتمع: `photo_url` + إرجاعها في دالتَي الدليل | **مشحونة** |
| 42 | `community_invites.sql` | دعوات المجتمعات: جدول + قبولٌ definer يمرّ بوابة الخصوصية | **مشحونة** |
| 43 | `follow_privacy.sql` | `hide_follow_lists` + العرض بذيله الجديد + دالتا أسماء المتابعة (definer) | **مشحونة** |
| 44 | `imdb_ratings.sql` | مخزن تقييمات IMDb عبر النشرات + `set_imdb_ratings` definer (D-113) | **مشحونة** |
| 45 | `activity_v2.sql` | `following_activity_v2`: خطّ النشاط بأربعة أنواع، صفٌّ واحد لكل (شخص+عمل+يوم) + أربعة فهارس زمنية (D-123) | **مشحونة** |
| 46 | `activity_likes.sql` | إعجابٌ بحدث مشاهدة: جدول بمفتاحٍ فيه يوم + `feed_activity_likes` definer (D-124) | **مشحونة** |
| 47 | `notifications.sql` | جرس الإشعارات بلا جدول: عمود `notif_seen_at` + `my_signals`/`unread_signals`/`mark_signals_seen` (D-125) | **مشحونة** |
| 48 | `social_discovery.sql` | `people_to_follow` (اقتراح متابعةٍ بتقاطع الذوق) + `title_circle` (نشاط دائرتك في صفحة العمل، مكتومٌ تحت ٣) + فهرسان (D-126/D-127) | **مشحونة** |
| 49 | `imdb_votes.sql` | `imdb_ratings.imdb_votes` + `set_imdb_ratings` تحفظه — شرطُ ترتيب IMDb البايزيّ وحاجزِ الأهليّة (D-132) | **مشحونة** |
| 50 | `imdb_chart.sql` | `imdb_pool` + `imdb_chart` + `set_imdb_pool`/`build_imdb_chart` — قائمة IMDb الحقيقية من ملفّاتها المفتوحة (D-135). ⚠️ **سياسة قراءةٍ مفتوحة رابعة** | **مشحونة** |
| 51 | `profile_prefs.sql` | `profiles.profile_prefs` + إظهاره في العرض العام + `profile_artists` definer — تخصيص البروفايل (D-129) | **مشحونة** |
| 52 | `episode_ratings.sql` | `episode_ratings` + `set_episode_rating`/`clear_episode_rating` definer — التقييم يعلّم المشاهدة داخل القاعدة (D-139) | **مشحونة** |
| 53 | `title_communities.sql` | غرف الأعمال: `kind`/`tmdb_id`/`media_type`/`archived_at`، فكُّ فرادة `owner_id` بفهرسٍ جزئيّ، `title_community`/`title_room_of`/`title_rooms`/`maintain_title_communities` + قراءةُ غرفة العمل بلا انضمام (D-140) | **مشحونة** |
| 54 | `title_art.sql` | أغلفة وبوسترات شخصية: `title_art` بـRLS للمالك + `profile_title_art` definer خلف `can_view_profile` (D-131) | **مشحونة** |
| 55 | `favorites.sql` | المفضّلات بلا جدول جديد: `kind='favorites'` + فهرسٌ فريد جزئيّ + `toggle_favorite`/`my_favorites` (D-130) | **مشحونة** |
| 56 | `account_deletion.sql` | حذف الحساب يحذف الحساب فعلاً: `delete_my_account` صارت **صفّاً واحداً** يحذف من `auth.users` فيجرّ الأربعة والأربعين مفتاحاً cascade — بدل قائمةٍ من أحد عشر جدولاً بقيت وراءها الرسائل والمجتمعات والحظر والأغلفة (D-146). **⚠️ نسخة `security.sql` §٦ حُدّثت لتطابقها** | **مشحونة** |
| 57 | `feed_seen.sql` | الجديد يعلو مرّةً ثم ينزل: `profiles.feed_seen_at` + `my_feed_seen`/`mark_feed_seen` — بلا جدولِ «مقروء» لكل صفّ (D-149). تحقُّق: `col=1 · funcs=2 · open_policies=4` | **مشحونة** |
| 58 | `feed_new_count.sql` | عدّادُ «وصل جديد وأنت جالس»: `new_feed_count()` definer فوق `following_activity_v2` — رقمٌ لا أسطر (D-151) | **معلّقة** |
| 59 | `profile_favorites.sql` | «مفضّلاتي» قسماً في البروفايل: `profile_favorites(uuid)` definer خلف `can_view_profile` — نمط `profile_title_art` نفسه، بلا جدولٍ وبلا سياسة (D-152) | **معلّقة** |
| 60 | `imdb_pool_flags.sql` | علَما البِركة: `is_doc` (يُلغي ~٨٠ نداء TMDB لكل رفّ «أفضل ٥٠»، D-165) + **رفعُ شرط الأفلام عن `is_anime` في `build_imdb_chart`** فيصير لأفلام الأنمي صنفُها (D-169/D-170) | **شُغّلت ١٢ أغسطس** |
| 61 | `follows_anime.sql` | `follows.is_anime` — علَمٌ يقبل `null` («لم يُصنَّف بعد»)، عليه يقوم تبويبُ الأنمي في المكتبة (D-182) | **RUN 12 Aug** |
| 62 | `review_replies.sql` | **الردودُ على الآراء** (D-193): جدولُ `review_replies` بعمقٍ واحد · `title_replies()` تقرأ باحترام الإخفاء والحظر · `title_talk_stats()` لعدّادَي الردود والمشاهدين · و`reply_reports` بعتبة العشرة نفسها. **لا سياسة قراءةٍ مفتوحة — تبقى أربعاً** | **شُغّلت ١٢ أغسطس** |
| 63 | `list_cover.sql` | **غلافُ القائمة** (D-208): `cover_tmdb_id` + `cover_media_type` + `cover_backdrop` على `user_lists` بقيدَي نوعٍ ومسار · و`my_lists`/`public_list` تُعيدان الغلاف — **الملصقاتُ تبقى، والغلافُ يزيد ولا يستبدل**. لا جدولَ ولا سياسة: الأعمدة ترث سياسات `user_lists` الأربع | **معلّقة** |
| 64 | `news_items.sql` | **الأخبار الحقيقية** (D-209): جدولُ `news_items` بمفتاحِ الرابط · **بلا سياسةٍ واحدة** والبابانِ definer (`news_feed` بلغة الواجهة · `set_news_items` تتحقّق من النطاق والمصدر وتفرض برودةَ خمس دقائق و`on conflict do nothing` وسقفَ ألف خبر) · و`news_host_ok`/`news_is_stale`/`news_last_at`. **لا صورَ ولا سياسةَ قراءةٍ مفتوحة — تبقى أربعاً** | **شُغّلت ١٢ أغسطس** |
| 65 | `news_posts.sql` | **أخبارُنا نحن** (D-211): `title_snapshots` (لقطةُ كل عملٍ نراقبه) + `news_posts` (**حقائقُ لا جُمَل** — الجملةُ تُركَّب من قوالب `i18n` فيُقرأ الخبرُ بلغتين بلا عمودٍ ثانٍ) · و`news_watch_slice` تختار الشريحةَ في القاعدة (أقدمُ لقطةً أوّلاً) · و`set_*`/`loopz_news`/`news_gen_stale`. **بلا سياسةٍ واحدة على الجدولين — تبقى أربعاً** | **شُغّلت ١٢ أغسطس** |
| 66 | `news_heavier.sql` | **أخبارٌ أثقل** (D-212، بلاغُ أحمد: «كلّها موعد نزول الحلقة القادمة وهو أصلاً في Upcoming»): **حذفُ نوع `episode` صفوفاً وقيداً** · وأربعةُ حقولٍ في اللقطة (`last_air_date` · `next_season_date` · `next_season_num` · `theatrical_date`) · وثلاثةُ أنواعٍ ثقيلة: `season_date` · `theatrical` · `released` | **شُغّلت ١٢ أغسطس** |
| 67 | `news_reports.sql` | **أخبارٌ أوسع وخبرٌ بنسبةٍ لمصدره** (D-213): `chart_rank` و`providers` في اللقطة · وثلاثةُ أنواع: `chart` (**بلا نداء**) · `provider` · **`report`** (الحدثُ من الصحافة والجملةُ من عندنا) · **وحارسا `report` في القاعدة**: `event` من قائمةٍ مغلقة، **والرابطُ يمرّ على `news_host_ok`** · و`news_watch_slice` تحمل الرتبة معها | **شُغّلت ١٢ أغسطس** |

كلها تحقَّقت بالاستعلام المكتوب في ذيل ملفّها — **لا استثناءات: كل ملفات
الجدول شُغِّلت حتى ٥٧** (٥٢–٥٧ في ١٠ أغسطس). **٥٨ و٥٩ معلّقتان** حتى تُشغَّلا،
و**الشيفرة تحتملهما غائبتين**: ٥٨ ترجع صفراً فتختفي الشارة، و٥٩ ترجع صفّاً
فارغاً فيغيب قسم المفضّلات — بلا شاشة خطأ في الحالتين. تحقُّق ٥٦: `non_cascade_fks=0` ·
`is_definer=true` · `owner=postgres` · `deletes_auth_row=true`.
تحقُّق ٥٥ على الإنتاج:
`kind_check` يضمّ `favorites` · `fav_idx=1` · `new_funcs=2` ·
**`open_policies=4`** — لا سياسة مفتوحة خامسة.

## مصيدةٌ وقعنا فيها فعلاً — `safeupdate`

Supabase تُحمّل إضافة `safeupdate` لدور `authenticated`، فأيّ
`delete`/`update` **بلا `where`** يُرفض بـ«DELETE requires a WHERE
clause» — **حتى داخل دالّة `security definer`**. وقع هذا في
`build_imdb_chart` بعد أن كانت المسوّدة قد امتلأت بأربعة آلاف نداء.
اكتب `where true` صراحةً في أي حذفٍ شامل.

للتأكد أن قاعدة الإنتاج مطابقة:
```sql
select tablename, policyname from pg_policies
where schemaname = 'public' and qual = 'true';
-- المتوقَّع **أربعٌ**: user_follows · communities (دليل المجتمعات، مقصود
-- منذ ٣٤) · imdb_ratings (٤٤) · imdb_chart (٥٠).
-- ⚠️ شغّله فعلاً ولا تكتفِ بوجوده: في ٨ أغسطس ٢٠٢٦ كشف أوّلُ تشغيلٍ له
-- ثلاث سياسات مفتوحة على المكتبة وسجلّ المشاهدة، عمرها أشهر — انظر
-- security3.sql.
```
