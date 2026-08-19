"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backdropUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { CommunityListCard } from "./PublicListsRail";
import type { UserList } from "@/lib/data";
import { ShareListSheet } from "./ShareListSheet";
import { NewListForm } from "./NewListForm";

/**
 * إدارة القوائم.
 *
 * كل قائمة بطاقةٌ كاملة: ترويسةٌ (الاسم + العدد + سهمُ الدخول) ثم
 * صفُّ ملصقاتٍ أفقيٌّ يُظهر محتواها لمحةً واحدة — البطاقة كلها رابطٌ إلى
 * صفحة القائمة، فالضغط في أي مكانٍ يفتحها. لا زرَّ حذفٍ هنا: التسمية
 * والنوع والترتيب والحذف بابُها الوحيد قائمةُ خيارات صفحة القائمة —
 * «بابٌ واحدٌ لكل فعل» بدل بابين متباعدين.
 *
 * الحدّ لونُ خلفية الثيم لا رماديٌّ ثابت: صلبٌ بلا تدرّج، أسود في الداكن
 * يطابق هوية التطبيق، وفاتحٌ في `daylight` — فلا يكسر الثيم الفاتح.
 */
export function ListManager({
  lists,
  stats,
  locale,
}: {
  lists: UserList[];
  /**
   * 🆕 **أرقامُ قائمتك العامّة** (D-350، بند ٣): كانت بطاقةُ «قوائمي» بلا
   * ★/♥ **وبطاقةُ «المحفوظة» تحتها في اللوح نفسِه تحملهما** — **بطاقتان
   * بإيقاعين لمعنًى واحد** (القاعدة ٦)، وهو بابٌ آخرُ لعطل D-347.
   * **والصفرُ يُخفى** (D-219)، **والخاصّةُ بلا أرقامٍ أصلاً** (لا تُقرأ
   * فلا تُقيَّم — نصُّ الهجرة ١٠٥).
   */
  stats?: Map<string, { saves: number; rating: number | null }>;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  /* المشاركة من صفحة القوائم نفسها (طلب المالك): زرٌّ على البطاقة يفتح
     نفس ورقة مشاركة صفحة القائمة — مكوّنٌ واحد لا نسختان */
  const [shareFor, setShareFor] = useState<UserList | null>(null);

  return (
    <div>
      {/* نموذجُ الإنشاء صار مكوّناً مشتركاً (D-177): بابُه الثاني ورقةُ
          أدوات المكتبة، **وتحصينات D-168 لا تُنسخ** */}
      {/* 🆕 **زرٌّ لا حقلٌ دائم** (D-443) — انظر حجّتَه في `NewListForm` */}
      <div className="mb-4">
        <NewListForm locale={locale} collapsed />
      </div>

      {lists.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listsEmpty}</p>
      ) : (
        /* 🔴 🆕 **وقوائمُك تلبس بطاقةَ الاكسبلورر** (D-364، طلبُ أحمد:
           «تصميم الليست في المكتبة يكون نفس تصميم الاكسبلور، ما ابغا
           الشكل الطويل الموجود حالياً»).

           **وكانت بطاقتين لمعنًى واحد**: صفٌّ عريضٌ بارتفاع شاشةٍ هنا،
           وبطاقةٌ مضغوطةٌ في اكتشف — **والقارئُ يرى قائمتَه بوجهين حسب
           البابِ الذي دخل منه** (القاعدة ٦/D-068: بطاقةٌ واحدةٌ لأربعة
           أبوابٍ لا نسخٌ تتباعد).
           **والشبكةُ عمودان على الجوال** فتُقرأ أربعُ قوائمَ في شاشةٍ
           كانت تعرض واحدةً ونصفاً.

           ⚠️ **وثلاثةٌ لا تسقط في الطريق**: **الغلافُ المختار** (D-208 —
           `cover` يحلّ محلَّ الملصقات)، **وزرُّ المشاركة في زاويتها**
           (قرارٌ محسوم — يسكن عمودَ الزاوية الفارغ)، **وسطرُ الأرقام**
           (★/♥ من `stats` — D-350). */
        <ul className="grid grid-cols-2 gap-2.5">
          {lists.map((l) => {
            const st = stats?.get(l.id);
            return (
              <li key={l.id} className="min-w-0">
                <CommunityListCard
                  locale={locale}
                  className="w-full h-full"
                  /* **قائمتي أنا**: لا حفظَ ولا تقييمَ لها (`can_*` غائبة)
                     — **وزرٌّ لا يستطيع أن يكتب وعدٌ كاذب** (D-217)،
                     **والأرقامُ تبقى ساكنةً فلا يفقد صاحبُها الحقيقة.** */
                  list={{
                    id: l.id,
                    name: l.name,
                    kind: l.kind,
                    owner: null,
                    item_count: l.item_count,
                    posters: l.posters ?? [],
                    saves: st?.saves ?? 0,
                    rating: st?.rating ?? null,
                  }}
                  /* **العدُّ بتفصيله حين تعرفه القاعدة** (my_lists) —
                     **وقبل الهجرة يسقط إلى العدّ الكلّي** (D-028). */
                  countLabel={
                    typeof l.shows_count === "number" || typeof l.movies_count === "number"
                      ? t.listContentCount(l.shows_count ?? 0, l.movies_count ?? 0)
                      : undefined
                  }
                  cover={backdropUrl(l.cover_backdrop ?? null, "w780")}
                  action={
                    /* ⚠️ **زرٌّ داخل بطاقةٍ رابط** — فالحدثُ يُوقَف عنده
                       (D-339/D-155)، **وإلّا شارك وفتح الصفحة في لمسة.** */
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShareFor(l);
                      }}
                      aria-label={t.listShare}
                      title={t.listShare}
                      className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted hover:text-accent active:scale-90 transition"
                    >
                      <Icon name="share" size={16} />
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {shareFor && (
        <ShareListSheet
          listId={shareFor.id}
          name={shareFor.name}
          isPublic={shareFor.is_public}
          locale={locale}
          onClose={() => setShareFor(null)}
          onChanged={() => {
            // بعد جعلها معلنة: حدّث البطاقة محلياً كي تعرض الورقة أزرار
            // المشاركة، وأنعش الصفحة لتتبدّل الشارة
            setShareFor((s) => (s ? { ...s, is_public: true } : s));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
