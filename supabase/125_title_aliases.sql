-- ============================================================
-- 125 — أسماءُ الأعمالِ البديلة (الكتابةُ الصوتيّةُ العربية) · D-544
--
-- **لماذا جدولٌ جديد:** مسحُ `information_schema` قبل الكتابة أعاد
-- عشرةَ جداولٍ باسم `title_*` **وليس فيها اسمٌ بديلٌ واحد**:
-- `title_snapshots` بياناتُ حالةٍ (تواريخُ عرضٍ ومواسمُ ومزوّدون)،
-- والبقيّةُ نقاشٌ وتثبيتاتٌ وفنّ. **فلا جدولَ يصلح، فيُنشأ واحد.**
--
-- **ولا يُخزَّن هنا الاسمُ المحلّيُّ ولا الأصليّ**: كلاهما يأتي من TMDB
-- مخبَّأً ساعةً (D-048)، **وتخزينُ ما يُعطى مجّاناً نسخةٌ ثانيةٌ تتقادم**
-- (D-145). **الصوتيّةُ وحدَها لا مصدرَ لها** — ولذلك تسكن هنا.
--
-- ⚠️ **والقراءةُ مشروطةٌ بـ`verified` لا مفتوحة** — وهذا قرارٌ مزدوج:
--   ١) **بنصِّ المواصفة**: «إذا لم تتوفّر كتابة صوتية **موثوقة**، اعرض
--      الاسم الأصلي» — **فالتوثيقُ شرطُ العرض، ومكانُ فرضِه القاعدةُ
--      لا كودُ الواجهة** (حارسٌ على طرفٍ واحد ليس حارساً).
--   ٢) **واستعلامُ الصحّة يبقى أربعاً**: `qual='true'` مفتوحةً هي
--      user_follows · communities · imdb_ratings · imdb_chart —
--      **وسياسةٌ خامسةٌ مفتوحةٌ كانت ستكسر الفحصَ المكتوب في 12.**
--
-- ⚠️ **ولا سياسةَ كتابةٍ إطلاقاً**: RLS مفعَّلٌ وبلا `insert/update/
-- delete` **فالعميلُ لا يكتب سطراً** — **والتعبئةُ من الخادم وحدَه**
-- (قرارٌ معلَّقٌ على أحمد: مفتاحُ خدمةٍ أم دالّةُ definer).
--
-- rollback: drop table public.title_aliases;
-- ============================================================

create table if not exists public.title_aliases (
  media_type  text        not null check (media_type in ('movie','tv')),
  tmdb_id     integer     not null,
  -- لغةُ الاسمِ البديل نفسِه ('ar' للكتابة الصوتيّة العربية)
  locale      text        not null check (locale in ('ar','en')),
  alias_type  text        not null check (alias_type in ('translit')),
  title       text        not null check (length(btrim(title)) between 1 and 300),
  -- من كتبه: 'gemini' | 'manual' | اسمُ مصدرٍ آخرَ لاحقاً
  source      text        not null default 'manual',
  -- **شرطُ العرض** — انظر السياسةَ أدناه
  verified    boolean     not null default false,
  updated_at  timestamptz not null default now(),

  -- **القيدُ الفريدُ المطلوب**: عملٌ واحدٌ بلغةٍ واحدةٍ ونوعِ بديلٍ
  -- واحدٍ لا يحمل سطرين
  constraint title_aliases_pkey primary key (media_type, tmdb_id, locale, alias_type)
);

-- **فهرسُ القراءةِ المجمَّعة**: الصفحةُ تسأل مرّةً عن عشرين معرّفاً
-- بلغةٍ ونوعٍ ثابتين (`in (...)`) — **لا استعلامَ لكلِّ بطاقة** (D-205)
create index if not exists title_aliases_lookup_idx
  on public.title_aliases (locale, alias_type, tmdb_id);

alter table public.title_aliases enable row level security;

-- **قراءةٌ عامّةٌ للموثَّق وحدَه** — وللزائر غيرِ المسجَّل أيضاً
-- (`anon`)، فالتفضيلُ كوكيٌّ يعمل بلا حساب
drop policy if exists "read verified title aliases" on public.title_aliases;
create policy "read verified title aliases"
  on public.title_aliases
  for select
  to anon, authenticated
  using (verified);

-- **ولا منحَ كتابةٍ لأحد** — الافتراضُ في Postgres هو المنع، ويُصرَّح
-- به هنا كي لا يُظنَّ سهواً
revoke insert, update, delete on public.title_aliases from anon, authenticated;
