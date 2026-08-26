import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getUser,
  getList,
  getPublicList,
  getMyListSave,
  getListCardStats,
  getListReviews,
  getListReviewStats,
  getMyListReview,
  getListReviewSocial,
  getListReviewReplies,
  getMyProfileLite,
  getCuratedSlug,
} from "@/lib/data";
import { curatedName, curatedBlurb } from "@/lib/universes";
import { ListReviews } from "@/components/ListReviews";
import { getT } from "@/lib/locale";
import { BackCrumb } from "@/components/BackButton";
import { ListDetail } from "@/components/ListDetail";
import { getLibState, type TitleState } from "@/lib/libState";
import { localizeRows } from "@/lib/localize";
import { buttonClass } from "@/components/ui/Button";

/**
 * قائمة واحدة.
 *
 * العناوين والملصقات مخزّنة مع عناصر القائمة، فالقراءة استعلامٌ واحد مهما
 * طالت القائمة. ويُطلب TMDB **فقط** لما خالف خطُّ اسمه لغة الواجهة (D-048)،
 * بسقف أربعةٍ وعشرين عملاً متمايزاً وبتخبئة ساعة — أي أن القائمة المكتوبة
 * بلغة الواجهة تبقى بلا طلبٍ واحد كما كانت.
 *
 * وللزائر بلا حساب: القائمة المعلنة تُفتح كما هي بلا تسجيل دخول. كانت
 * الصفحة تحوّل كل زائرٍ إلى `/login`، فرابطُ القائمة «المعلنة» لم يكن
 * معلناً لأحد — والمشاركة بلا ذلك بلا معنى. القراءة تمرّ عبر `public_list`
 * وحدها فلا تنكشف القائمة الخاصّة ولا عمودٌ لا تحتاجه الصفحة.
 */

/** بطاقة المعاينة عند المشاركة — الاسم والوصف وصورة ١٢٠٠×٦٣٠ */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [pub, slug, { locale }] = await Promise.all([
    getPublicList(id),
    getCuratedSlug(id),
    getT(),
  ]);
  if (!pub) return {};

  /* 🔧 **وبطاقةُ المشاركة تُعرَّب أيضاً** (دَينٌ مُعلَنٌ من D-343): كانت
     الصفحةُ تُترجم اسمَ قائمة لوبز **وبطاقتُها في واتساب لا** — فيصل
     الرابطُ بعنوانٍ عربيٍّ إلى قارئٍ إنجليزيّ. **ونصفُ ترجمةٍ يُقرأ عطلاً
     لا تدرّجاً** (D-155). */
  const title = curatedName(slug, pub.name, locale === "en" ? "en" : "ar");
  const description =
    pub.subtitle ??
    (pub.items.length
      ? pub.items
          .slice(0, 4)
          .map((i) => i.title)
          .filter(Boolean)
          .join(" · ")
      : "Loopz");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: `/api/list-og/${id}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale, t } = await getT();
  const { id } = await params;
  const user = await getUser();

  /* 🆕 **واسمُ قائمةِ لوبز بلغة القارئ في كلِّ سطح** (دَينُ D-328):
     الاسمُ المخزَّن عربيٌّ دائماً (`upsert_curated_list`) **والهويّةُ في
     الـslug** — فتُترجَم عند العرض ولا تُخزَّن بلغتين (D-147/D-273). */
  const loc = locale === "en" ? ("en" as const) : ("ar" as const);

  /* ⚖️ 🆕 **وفرعُ الزائر المستقلُّ سقط** (D-631، بلاغُ أحمد: «ما أقدر
     أقرأ التعليقات اللي على اللستة»): كان للزائر **رسمٌ ثانٍ أنحف**
     كُتب يومَ كانت القائمةُ المعلنة نافذتَه الوحيدة (D-053) — **بلا
     تبويب مراجعات إطلاقاً**، فيرى الملصقاتِ ولا يرى كلمةً كُتبت عنها.
     **وسطحان لنفس الصفحة يفترقان بمن يقرأ عطلٌ لا تصميم** (قاعدةُ
     النظام: رسمٌ واحد) — **والمسارُ الواحدُ يحتمل `user` فارغاً** كما
     في `/show` و`/u` بعد D-627: القراءاتُ الشخصيّةُ ذاتيّةُ الحراسة،
     والكتابةُ يردّها `requireUser`. */
  const data = await getList(id);
  if (!data) notFound();

  const isOwner = !!user && data.list.user_id === user.id;
  // صاحب القائمة يُقرأ من الباب العامّ نفسه — لا استعلام ثانٍ على الملفات؛
  // وحالة الحفظ لغير المالك وحده (D-068)
  const [
    pub,
    mySave,
    cardStats,
    reviews,
    reviewStats,
    myReview,
    /* 🆕 **قلوبُ الآراء وردودُها ووجهي** (D-370، الهجرة ١١٣) — **ثلاثةُ
       نداءاتٍ في نفس الرزمة المتوازية**، ولا ينتظر أحدُها ناتجَ الآخر.
       **وكلُّها للمعلنة وحدَها**: قائمةٌ خاصّة لا رأيَ فيها أصلاً. */
    social,
    replies,
    meProfile,
  ] = await Promise.all([
    isOwner ? Promise.resolve(null) : getPublicList(id),
    /* 🆕 **الحالتان من صفِّ الحفظ نفسِه** (D-677): «أحفظتُها؟»
       و«أشغّلتُها؟» (١٤٩) بقراءةٍ واحدة بدل قراءتين. */
    isOwner ? Promise.resolve(null) : getMyListSave(id),
    /* 🆕 **وعددُ من حفظها** (D-677) — لشريط الحال؛ للمعلنة وحدَها
       (الخاصّةُ لا تُحفظ — نصُّ ١٠٥). */
    data.list.is_public ? getListCardStats([id]) : Promise.resolve(new Map()),
    /* **ثلاثةُ نداءاتٍ متوازية** (D-327): كلامُ الناس ومتوسّطُهم ورأيي —
       **ولا يحتاج أحدُها ناتجَ الآخر** فلا يُنتظر أحدُها لأجل أخيه. */
    data.list.is_public ? getListReviews(id) : Promise.resolve([]),
    data.list.is_public ? getListReviewStats(id) : Promise.resolve({ avg: null, count: 0 }),
    data.list.is_public && !isOwner ? getMyListReview(id) : Promise.resolve(null),
    /* ⚖️ 🆕 **وسقط نداءا التثبيت والإدارة مع رفِّهما ودبّوسِهما** (D-386):
       **نداءٌ بلا قارئٍ يُحذف لا يُترك يدور** (D-214/D-257) — **وكانا
       يُفتحان مع كلِّ قائمةٍ عامّة.** */
    data.list.is_public ? getListReviewSocial([id]) : Promise.resolve(new Map()),
    data.list.is_public ? getListReviewReplies(id) : Promise.resolve([]),
    getMyProfileLite().catch(() => null),
  ]);

  /* العناوين مخزّنة بلغة يوم الإضافة — تُترجَم عند العرض وحده (D-048)،
     فلا تظهر قائمةٌ عربية داخل واجهةٍ إنجليزية */
  const items = await localizeRows(data.items, locale);

  /* 🆕 **حالةُ المكتبة لهذه القائمة — نداءٌ واحدٌ لا نداءٌ لكلِّ ملصق**
     (D-495/D-205): `getLibState` يقرأ المتابعاتِ والمشاهَداتِ مرّةً،
     **ونُسلسِل منها حالَ كلِّ عنصر** — المكوّنُ عميلٌ فلا يعبر الحدَّ
     إلا ما يُسلسَل (D-235).

     ⚖️ 🆕 **والحالُ كاملةٌ لا بوليان، وللمالك أيضاً** (D-542، طلبُ
     أحمد: «خط الأخضر والأزرق تحت البوستر»): **كان يُرمى كلُّ شيءٍ إلا
     `added` ولا يُحسب للمالك أصلاً** — **وحجّةُ استثنائه كانت زرَّ
     «+»** الذي لا يُرسم له، **والخيطُ ليس زرّاً.** **والنداءُ هو
     النداءُ نفسُه** فلا استعلامَ زائد. */
  const libState = await (async () => {
    const lib = await getLibState().catch(() => null);
    if (!lib) return undefined;
    const map: Record<string, TitleState> = {};
    for (const it of items) map[`${it.media_type}-${it.tmdb_id}`] = lib.of(it.tmdb_id, it.media_type);
    return map;
  })();

  return (
    <div>
      {/* 🆕 **الرجوعُ من حيث أتيت** (D-336، بلاغُ أحمد: فتح قائمةً من
          اكتشف فرماه «رجوع» في المكتبة): كان الرابطُ مسمَّراً إلى
          `/library?filter=list` — وصار `router.back()` بفتاتٍ من باب
          الرجوع الواحد، **والمكتبةُ وجهةَ من لا تاريخَ له وحدَه**
          (رابطُ مشاركةٍ عميق). */}
      <BackCrumb label={t.listsTitle} fallback="/library?filter=list" className="mb-3" />
      <ListDetail
        listId={data.list.id}
        name={curatedName(data.list.source_slug, data.list.name, loc)}
        /* 🆕 **ونبذةُ قائمةِ لوبز** (D-373، بلاغُ أحمد: «ليستات لوبز
           لازم يكون لها شرح ونبذة مثل ليستة مشعل») — **مصاغةٌ من
           القاموس بلغة القارئ لا مخزَّنةً بلغةٍ واحدة** (D-147/D-343). */
        subtitle={curatedBlurb(data.list.source_slug, loc) ?? data.list.subtitle}
        isPublic={data.list.is_public}
        kind={data.list.kind}
        items={items}
        ratings={data.ratings}
        isOwner={isOwner}
        owner={
          pub
            ? {
                /* 🆕 **والمعرّفُ يمرّ معه** (D-655، ذيلٌ سُدّ): كان
                   البابُ مشروطاً باسمِ مستخدمٍ لا يملكه أكثرُ الأعضاء —
                   **والمعرّفُ في `data.list.user_id` في اليد أصلاً**،
                   فلا نداءَ ولا كتابة. */
                id: data.list.user_id,
                nickname: pub.owner_nickname,
                username: pub.owner_username,
                avatar: pub.owner_avatar,
              }
            : null
        }
        locale={locale}
        initialSaved={isOwner ? null : mySave === null ? null : mySave.saved}
        saves={cardStats.get(id)?.saves ?? 0}
        initialSavedPlaylist={isOwner ? null : mySave === null ? null : mySave.playlist}
        /* 🆕 رايةُ قائمة التشغيل (D-505) — للمالك وحدَه، وغيابُ العمود
           (قبل هجرة ١٢٢) يصل `undefined` فلا يُرسم الصفُّ أصلاً */
        initialPlaylist={
          isOwner && data.list.is_playlist !== undefined ? !!data.list.is_playlist : null
        }
        libState={libState}
        cover={{
          backdrop: data.list.cover_backdrop ?? null,
          tmdbId: data.list.cover_tmdb_id ?? null,
          mediaType: data.list.cover_media_type ?? null,
        }}
        /* 🆕 **خلاصةُ التقييم لسطر الرأس** (D-332) — نفسُ النداء الذي
           يقرؤه التبويب، لا نداءَ ثانياً */
        reviews={data.list.is_public ? reviewStats : null}
        /* 🆕 **التقييماتُ تبويبٌ لا ذيلٌ** (D-333، طلبُ أحمد: «شي يشبه
           صفحة العمل — تبويب قائمة الأفلام وتبويب التعليقات»): كانت تحت
           آخر ملصقٍ فكانت في «TOP 250» خلف مئتين وخمسين صورة.
           ⚠️ **ولا تُرسم لقائمةٍ خاصّة**: لا تُقرأ أصلاً فلا رأيَ فيها،
           **وصندوقٌ لا يستطيع أحدٌ رؤيةَ ناتجه وعدٌ كاذب** (D-217) —
           وغيابُها يُسقط التبويبات كلَّها فتبقى الشبكةُ وحدَها. */
        reviewsSlot={
          data.list.is_public ? (
            <ListReviews
              listId={data.list.id}
              locale={locale}
              isOwner={isOwner}
              canReview={!isOwner}
              reviews={reviews}
              mine={myReview}
              stats={reviewStats}
              /* 🆕 **أنا — للقلب وللنسخة التفاؤلية في الخيط** (D-370) */
              meId={user?.id ?? ""}
              me={meProfile}
              social={social}
              replies={replies}
            />
          ) : undefined
        }
      />

      {/* 🆕 **ودعوةُ القاع باقيةٌ للزائر** (D-631 — كانت في الفرع الساقط):
          جاء ليرى القائمة، **فتُعرض كاملةً بمراجعاتها ثمّ يُعرض عليه أن
          يبني مثلها** — لافتةٌ في القاع لا حاجزٌ فوق المحتوى. */}
      {!user && (
        <div className="mt-12 pt-6 border-t border-[color:var(--divider)] text-center">
          <p className="text-sm text-muted mb-3">
            {locale === "ar"
              ? "ابنِ قوائمك أنت، وتتبّع كل ما تشاهده."
              : "Build your own lists, and track everything you watch."}
          </p>
          <Link href="/login" className={buttonClass({ size: "sm" })}>
            {locale === "ar" ? "ابدأ مع Loopz" : "Start with Loopz"}
          </Link>
        </div>
      )}
    </div>
  );
}
