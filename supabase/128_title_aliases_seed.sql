-- ============================================================
-- 128 — بذرةُ الكتابات الصوتيّة العربية · D-548 (يُكمل D-544)
--
-- **حكمُ أحمد: الخيار (ج)** — **بذرةٌ يدويّةٌ لا مفتاحُ خدمةٍ ولا دالّةُ
-- definer**: **لا سرَّ جديدٌ يدخل المشروع، ولا مسارَ كتابةٍ يُفتح للعميل
-- أصلاً** — **والجدولُ يبقى بلا سياسةِ كتابةٍ كما وُلد** (١٢٥).
--
-- **ولماذا اليدُ لا النموذج:** `verified` شرطُ العرض في السياسة نفسِها،
-- **وسطرٌ يكتبه نموذجٌ ثمّ يُوسَم موثوقاً بلا أن يراه أحدٌ يكذب على
-- الشرط.** **وهذه السطور مكتوبةٌ ومراجَعةٌ واحداً واحداً.**
--
-- **والمصدرُ `imdb_chart`** (جدولُنا العامّ، ٦٨٨ صفّاً): أُخذ أعلى ٢٥ في
-- كلِّ فئة، **ثمّ أُسقط منها:**
--   • صفوفٌ عنوانُها ليس عنوانَ عملٍ حقيقيّ (`EARLY STREAM!`)،
--   • **وأعمالٌ أصلُها ليس إنجليزيّاً ولا يابانيّاً** (تركيّةٌ وهنديّة):
--     **كتابتُها الصوتيّةُ تحتاج من يعرف نطقَها بلغتها**، **وتخمينُها
--     من ترجمتها الإنجليزيّة يكتب اسماً لا يقوله أحد.**
--
-- ⚠️ **والصورةُ المكتوبة هي المتداوَلة عربيّاً** — «جيم أوف ثرونز» كما
-- كتبها أحمد في مواصفته، **لا نقلٌ حرفيٌّ من اليابانيّة للأنمي**:
-- الجمهورُ العربيُّ يقول «ديث نوت» لا «ديسو نوto».
--
-- ⚠️ **ولا يُمسّ صفٌّ قائم**: `on conflict do nothing` — **الجدولُ فارغٌ
-- اليوم، والحارسُ لتشغيلٍ ثانٍ.**
--
-- rollback:
--   delete from public.title_aliases
--   where alias_type = 'translit' and source = 'manual-seed-128';
-- ============================================================

insert into public.title_aliases (media_type, tmdb_id, locale, alias_type, title, source, verified)
values
  -- ===== أفلام =====
  ('movie',    278, 'ar', 'translit', 'ذا شاوشانك ريدمبشن',                          'manual-seed-128', true),
  ('movie',    238, 'ar', 'translit', 'ذا غودفاذر',                                   'manual-seed-128', true),
  ('movie',    155, 'ar', 'translit', 'ذا دارك نايت',                                 'manual-seed-128', true),
  ('movie',    122, 'ar', 'translit', 'ذا لورد أوف ذا رينغز: ذا ريتيرن أوف ذا كينغ',  'manual-seed-128', true),
  ('movie',    424, 'ar', 'translit', 'شيندلرز ليست',                                 'manual-seed-128', true),
  ('movie',    240, 'ar', 'translit', 'ذا غودفاذر بارت تو',                           'manual-seed-128', true),
  ('movie',    389, 'ar', 'translit', 'تويلف آنغري مِن',                              'manual-seed-128', true),
  ('movie',    120, 'ar', 'translit', 'ذا لورد أوف ذا رينغز: ذا فيلوشيب أوف ذا رينغ', 'manual-seed-128', true),
  ('movie',  27205, 'ar', 'translit', 'إنسبشن',                                       'manual-seed-128', true),
  ('movie',    550, 'ar', 'translit', 'فايت كلوب',                                    'manual-seed-128', true),
  ('movie',     13, 'ar', 'translit', 'فورست غامب',                                   'manual-seed-128', true),
  ('movie',    680, 'ar', 'translit', 'بالب فيكشن',                                   'manual-seed-128', true),
  ('movie',    121, 'ar', 'translit', 'ذا لورد أوف ذا رينغز: ذا تو تاورز',            'manual-seed-128', true),
  ('movie',    429, 'ar', 'translit', 'ذا غود، ذا باد آند ذي أغلي',                   'manual-seed-128', true),
  ('movie', 157336, 'ar', 'translit', 'إنترستيلار',                                   'manual-seed-128', true),
  ('movie',    603, 'ar', 'translit', 'ذا ماتريكس',                                   'manual-seed-128', true),
  ('movie',   1891, 'ar', 'translit', 'ذي إمباير سترايكس باك',                        'manual-seed-128', true),
  ('movie',    769, 'ar', 'translit', 'غودفيلاز',                                     'manual-seed-128', true),
  ('movie',    807, 'ar', 'translit', 'سِفِن',                                        'manual-seed-128', true),
  ('movie',    274, 'ar', 'translit', 'ذا سايلنس أوف ذا لامبز',                       'manual-seed-128', true),
  ('movie',    129, 'ar', 'translit', 'سبيريتد أواي',                                 'manual-seed-128', true),

  -- ===== مسلسلات =====
  ('tv',      1396, 'ar', 'translit', 'بريكينغ باد',                                  'manual-seed-128', true),
  ('tv',      4613, 'ar', 'translit', 'باند أوف براذرز',                              'manual-seed-128', true),
  ('tv',      1044, 'ar', 'translit', 'بلانِت إيرث',                                  'manual-seed-128', true),
  ('tv',     68595, 'ar', 'translit', 'بلانِت إيرث تو',                               'manual-seed-128', true),
  ('tv',     87108, 'ar', 'translit', 'تشيرنوبل',                                     'manual-seed-128', true),
  ('tv',       246, 'ar', 'translit', 'أفاتار: ذا لاست إيربندر',                      'manual-seed-128', true),
  ('tv',      1438, 'ar', 'translit', 'ذا واير',                                      'manual-seed-128', true),
  ('tv',     74313, 'ar', 'translit', 'بلو بلانِت تو',                                'manual-seed-128', true),
  ('tv',      1430, 'ar', 'translit', 'كوزموس: أ بيرسونال فويج',                      'manual-seed-128', true),
  ('tv',      1399, 'ar', 'translit', 'جيم أوف ثرونز',                                'manual-seed-128', true),
  ('tv',     82728, 'ar', 'translit', 'بلوي',                                         'manual-seed-128', true),
  ('tv',      1398, 'ar', 'translit', 'ذا سوبرانوز',                                  'manual-seed-128', true),
  ('tv',     58474, 'ar', 'translit', 'كوزموس',                                       'manual-seed-128', true),
  ('tv',     83880, 'ar', 'translit', 'آور بلانِت',                                   'manual-seed-128', true),
  ('tv',       751, 'ar', 'translit', 'ذا وورلد آت وور',                              'manual-seed-128', true),
  ('tv',     85077, 'ar', 'translit', 'ذا تشوزن',                                     'manual-seed-128', true),
  ('tv',     16946, 'ar', 'translit', 'لايف',                                         'manual-seed-128', true),
  ('tv',     19885, 'ar', 'translit', 'شيرلوك',                                       'manual-seed-128', true),
  ('tv',     60059, 'ar', 'translit', 'بيتر كول سول',                                 'manual-seed-128', true),
  ('tv',      2316, 'ar', 'translit', 'ذي أوفيس',                                     'manual-seed-128', true),
  ('tv',     60625, 'ar', 'translit', 'ريك آند مورتي',                                'manual-seed-128', true),
  ('tv',     94605, 'ar', 'translit', 'آركين',                                        'manual-seed-128', true),

  -- ===== أنمي =====
  ('tv',      1429, 'ar', 'translit', 'أتاك أون تايتن',                               'manual-seed-128', true),
  ('tv',     31911, 'ar', 'translit', 'فولميتال ألكيميست: براذرهود',                  'manual-seed-128', true),
  ('tv',     37854, 'ar', 'translit', 'وان بيس',                                      'manual-seed-128', true),
  ('tv',     46298, 'ar', 'translit', 'هنتر × هنتر',                                  'manual-seed-128', true),
  ('tv',     13916, 'ar', 'translit', 'ديث نوت',                                      'manual-seed-128', true),
  ('tv',     30991, 'ar', 'translit', 'كاوبوي بيبوب',                                 'manual-seed-128', true),
  ('tv',     88803, 'ar', 'translit', 'فينلاند ساغا',                                 'manual-seed-128', true),
  ('tv',    209867, 'ar', 'translit', 'فرايرن: بيوند جورنيز إند',                     'manual-seed-128', true),
  ('tv',     12971, 'ar', 'translit', 'دراغون بول زد',                                'manual-seed-128', true),
  ('tv',     42509, 'ar', 'translit', 'شتاينز غيت',                                   'manual-seed-128', true),
  ('tv',     35935, 'ar', 'translit', 'بيرسيرك',                                      'manual-seed-128', true),
  ('tv',     30981, 'ar', 'translit', 'مونستر',                                       'manual-seed-128', true),
  ('tv',     31910, 'ar', 'translit', 'ناروتو شيبودن',                                'manual-seed-128', true),
  ('tv',     31724, 'ar', 'translit', 'كود غياس: لولوش أوف ذا ريبيليون',              'manual-seed-128', true),
  ('tv',     42705, 'ar', 'translit', 'فايتينغ سبيريت',                               'manual-seed-128', true),
  ('tv',     60863, 'ar', 'translit', 'هايكيو!!',                                     'manual-seed-128', true),
  ('tv',     57041, 'ar', 'translit', 'غينتاما',                                      'manual-seed-128', true),
  ('tv',     63926, 'ar', 'translit', 'وان بانش مان',                                 'manual-seed-128', true),
  ('tv',     45790, 'ar', 'translit', 'جوجوز بيزار أدفنتشر',                          'manual-seed-128', true),
  ('tv',     61663, 'ar', 'translit', 'يور لاي إن أبريل',                             'manual-seed-128', true),
  ('movie',1333100, 'ar', 'translit', 'أتاك أون تايتن: ذا لاست أتاك',                 'manual-seed-128', true),
  ('movie', 802401, 'ar', 'translit', 'ديمون سلاير: كيميتسو نو يايبا',                'manual-seed-128', true),
  ('movie',1357633, 'ar', 'translit', 'سولو ليفلينغ',                                 'manual-seed-128', true)
on conflict (media_type, tmdb_id, locale, alias_type) do nothing;
