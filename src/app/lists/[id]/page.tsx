import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser, getList, getPublicList, isListSaved } from "@/lib/data";
import { getT } from "@/lib/locale";
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
  const pub = await getPublicList(id);
  if (!pub) return {};

  const title = pub.name;
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

  // زائرٌ بلا حساب: المعلنة تُعرض للقراءة، وغيرها لا وجود لها بالنسبة له
  if (!user) {
    const pub = await getPublicList(id);
    if (!pub) notFound();

    const items = await localizeRows(pub.items, locale);

    return (
      <div>
        <ListDetail
          listId={pub.id}
          name={pub.name}
          subtitle={pub.subtitle}
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
  const [pub, saved] = await Promise.all([
    isOwner ? Promise.resolve(null) : getPublicList(id),
    isOwner ? Promise.resolve(false) : isListSaved(id),
  ]);

  /* العناوين مخزّنة بلغة يوم الإضافة — تُترجَم عند العرض وحده (D-048)،
     فلا تظهر قائمةٌ عربية داخل واجهةٍ إنجليزية */
  const items = await localizeRows(data.items, locale);

  return (
    <div>
      {/* الرجوع إلى تبويب «القوائم» في المكتبة لا إلى المسار المنفصل:
          هو المكان الذي جاء منه المستخدم فعلاً بعد نقل القوائم إليه (D-042) */}
      <Link
        href="/library?filter=list"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition mb-3 -ms-1 px-1 py-1"
      >
        <span aria-hidden>‹</span>
        {t.listsTitle}
      </Link>
      <ListDetail
        listId={data.list.id}
        name={data.list.name}
        subtitle={data.list.subtitle}
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
      />
    </div>
  );
}
