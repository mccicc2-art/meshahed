import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getUser,
  getList,
  getPublicList,
  isListSaved,
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

  // زائرٌ بلا حساب: المعلنة تُعرض للقراءة، وغيرها لا وجود لها بالنسبة له
  if (!user) {
    /* **والزائرُ لا يمرّ بصفّ القائمة** (D-053) فسلغُها نداءٌ خفيفٌ
       موازٍ — لا انتظارَ متسلسل */
    const [pub, slug] = await Promise.all([getPublicList(id), getCuratedSlug(id)]);
    if (!pub) notFound();

    const items = await localizeRows(pub.items, locale);

    return (
      <div>
        <ListDetail
          listId={pub.id}
          name={curatedName(slug, pub.name, loc)}
          /* 🆕 **ونبذةُ قائمةِ لوبز تُصاغ من القاموس** (D-373) —
             **وقائمةُ العضو تعود بوصفها الذي كتبه صاحبُه** (D-063). */
          subtitle={curatedBlurb(slug, loc) ?? pub.subtitle}
          isPublic
          kind={pub.kind}
          items={items}
          ratings={{}}
          isOwner={false}
          owner={{
            nickname: pub.owner_nickname,
            username: pub.owner_username,
            avatar: pub.owner_avatar,
          }}
          locale={locale}
          /* الغلافُ يسافر مع الرابط (D-208): من فُتح له رابطُ القائمة يرى
             وجهَها الذي اختاره صاحبُها — ولا يبدّله لأنها ليست قائمته */
          cover={pub.cover_backdrop ? { backdrop: pub.cover_backdrop } : null}
        />

        {/* دعوةٌ واحدة في القاع لا لافتةٌ فوق المحتوى: الزائر جاء ليرى
            القائمة، فتُعرض أولاً ثم يُعرض عليه أن يبني مثلها */}
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
      </div>
    );
  }

  const data = await getList(id);
  if (!data) notFound();

  const isOwner = data.list.user_id === user.id;
  // صاحب القائمة يُقرأ من الباب العامّ نفسه — لا استعلام ثانٍ على الملفات؛
  // وحالة الحفظ لغير المالك وحده (D-068)
  const [
    pub,
    saved,
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
    isOwner ? Promise.resolve(false) : isListSaved(id),
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
                nickname: pub.owner_nickname,
                username: pub.owner_username,
                avatar: pub.owner_avatar,
              }
            : null
        }
        locale={locale}
        initialSaved={isOwner ? null : saved}
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
              meId={user.id}
              me={meProfile}
              social={social}
              replies={replies}
            />
          ) : undefined
        }
      />
    </div>
  );
}
