"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backdropUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { CommunityListCard } from "./PublicListsRail";
import { ToWatchListCard } from "./ToWatchListCard";
import type { UserList } from "@/lib/data";
import dynamic from "next/dynamic";
/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ TitleSearchSheet في
   الشريط السفليّ): لا تُرسم إلا بضغطةٍ، فشحنُها مع أوّل رسمةٍ ثمنٌ بلا
   قارئ — و`ssr: false` لأن لا HTML لها قبل الضغطة. */
const ShareListSheet = dynamic(() => import("./ShareListSheet").then((m) => m.ShareListSheet), { ssr: false });
import { NewListForm } from "./NewListForm";
import { LibrarySmartForm } from "./LibrarySmartForm";

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
  toWatch,
  playlistIds,
}: {
  lists: UserList[];
  /**
   * 🆕 **طابورُ «للمشاهدة» بطاقةً أولى** (D-559): **يسبق قوائمك
   * المكتوبة لأنه ليس واحدةً منها** — **وهو مبنيٌّ من مكتبتك كلِّها،
   * فموضعُه الصدر لا الذيل.** **والغيابُ يعني طابوراً فارغاً** —
   * **وبطاقةٌ تقول صفراً أسوأُ من غياب** (D-219).
   */
  toWatch?: { on: boolean; count: number; posters: (string | null)[] } | null;
  /**
   * 🆕 **أرقامُ قائمتك العامّة** (D-350، بند ٣): كانت بطاقةُ «قوائمي» بلا
   * ★/♥ **وبطاقةُ «المحفوظة» تحتها في اللوح نفسِه تحملهما** — **بطاقتان
   * بإيقاعين لمعنًى واحد** (القاعدة ٦)، وهو بابٌ آخرُ لعطل D-347.
   * **والصفرُ يُخفى** (D-219)، **والخاصّةُ بلا أرقامٍ أصلاً** (لا تُقرأ
   * فلا تُقيَّم — نصُّ الهجرة ١٠٥).
   */
  stats?: Map<string, { saves: number; reviews?: number; rating: number | null }>;
  /**
   * 🆕 **أيُّ قوائمك رايتُها مرفوعة** (D-563) — **والغيابُ يعني «لا
   * مفتاح»** لا «كلُّها متوقّفة**: **مستدعٍ لم يمرّرها لا يجوز أن
   * يرسم مفتاحاً يكذب** (D-217)، **وهو أيضاً ما يجعل هذا الكوميت
   * يُبنى وحدَه قبل أن تمرّرها الصفحتان** (D-028).
   */
  playlistIds?: string[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  /* المشاركة من صفحة القوائم نفسها (طلب المالك): زرٌّ على البطاقة يفتح
     نفس ورقة مشاركة صفحة القائمة — مكوّنٌ واحد لا نسختان */
  const [shareFor, setShareFor] = useState<UserList | null>(null);
  /* 🆕 **بابُ القائمة الذكيّة يفتح في مكانه** (D-877، حكمُ أحمد: «لا أريد
     الزر ينقلني إلى الديسكفري لأنها غير مفهومة») — **زرٌّ لا رابط** (D-017):
     **الوجهةُ صارت هنا لا صفحةً.** */
  const [smartOpen, setSmartOpen] = useState(false);
  /* **مجموعةٌ لا مصفوفة**: البحثُ يقع مرّةً لكلِّ بطاقة، **و`includes`
     على مصفوفةٍ داخل `map` مسحٌ داخل مسح.** */
  const playlists = playlistIds ? new Set(playlistIds) : null;

  return (
    <div>
      {/* نموذجُ الإنشاء صار مكوّناً مشتركاً (D-177): بابُه الثاني ورقةُ
          أدوات المكتبة، **وتحصينات D-168 لا تُنسخ** */}
      {/* 🆕 **زرٌّ لا حقلٌ دائم** (D-443) — انظر حجّتَه في `NewListForm` */}
      {/* 🆕 **وبابُ القائمة الذكيّة بجانبه** (D-830، سؤالُ أحمد: «ما
          عرفت كيف أسوي الليستات التلقائية؟»): **بابُها الوحيدُ كان
          رقاقةً في «اكتشف» لا تُرسم إلّا بعد اختيار فلتر** — **وميزةٌ
          لا يصل إليها إلّا من يعرف أنّها موجودة ليست مشحونة** (D-346).
          ⚖️ 🆕 **ونُقض نصفُه في D-877** (حكمُ أحمد: «اجعلني أستطيع من
          المكتبة تحديد الفلتر والإنشاء مباشرة، لا أريد الزر ينقلني إلى
          الديسكفري لأنها غير مفهومة»): **كان رابطاً إلى «اكتشف» فصار
          زرّاً يفتح الشروطَ هنا** — **بمفردات المكتبة (D-876) لا
          الكتالوج**: **من يقف في قوائمه يريد قائمةً ممّا يملك.**
          **وبابُ الكتالوج باقٍ في «اكتشف» لمن يبني شرطَه هناك** — بابان
          لمصدرين لا لشيءٍ واحد. **وزرٌّ لا رابط** لأن الوجهةَ لم تعد
          صفحة (D-017). */}
      <div className="mb-4">
        <NewListForm
          locale={locale}
          collapsed
          trailing={
            <button
              type="button"
              aria-expanded={smartOpen}
              onClick={() => setSmartOpen((v) => !v)}
              className={buttonClass({
                variant: "surface",
                size: "sm",
                className: "gap-1.5",
              })}
            >
              <Icon name="sparkle-star" size={14} />
              {t.smartListLabel}
            </button>
          }
        />
        {smartOpen && (
          <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
            <LibrarySmartForm locale={locale} onDone={() => setSmartOpen(false)} />
          </div>
        )}
        {/* 🔑 **والسطرُ يُقاس ولا يُفترض** (D-570): **يُرسم لمن لا قائمةَ
            ذكيّةَ له**، **ويسقط عن نفسه أوّلَ ما يصنع واحدة** — **ولا
            رايةَ تُخزَّن ولا سطرَ تعليمٍ يسكن الصفحةَ إلى الأبد**
            (D-138: أداةٌ تُرى ولا تُستعمل تزاحم ما يُستعمل). */}
        {!lists.some((l) => l.kind === "smart") && (
          <p className="text-12 text-muted mt-2 leading-relaxed" dir="auto">
            {t.smartListHint}
          </p>
        )}
      </div>

      {lists.length === 0 && !toWatch ? (
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
           (★/♥ من `stats` — D-350).

           🆕 **وعمودٌ واحدٌ على الجوّال** (D-461) — **ونفسُ شبكة
           `PublicListsRail` بالبكسل**: قوائمي والمحفوظةُ تحتها بطاقةٌ
           واحدةٌ في صفحةٍ واحدة، **وشبكتان بعرضين تُقرآن صنفين**.           ⚖️ 🆕 **وثالثٌ عند `xl`** (D-867): **الحاويةُ صارت ١٤٤٠**
           **فعمودان يعطيان البطاقةَ ٧٠٠px** — **ضعفَي ونصفٍ مقاسَها
           المصمَّم** (٢٨٠ في اكتشف — D-461) — **فتُقرأ لافتةً لا
           بطاقة.** **وثلاثةٌ تعطي ٤٦٢** — **فوق حدِّ D-461 نفسِه**،
           فالعمودُ الثالثُ تطبيقٌ لحجّته لا نقضٌ لها. */
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {toWatch && (
            <li key="lm-towatch" className="min-w-0">
              <ToWatchListCard
                locale={locale}
                initialOn={toWatch.on}
                count={toWatch.count}
                posters={toWatch.posters}
              />
            </li>
          )}
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
                    reviews: st?.reviews ?? 0,
                    rating: st?.rating ?? null,
                    /* ⚖️ 🆕 **والمفتاحُ انتقل إلى البطاقة نفسِها**
                       (D-674): كان يُمرَّر في خانة `action` بجوار
                       المشاركة **فصار يسار النجمة كما رسم أحمد** —
                       **والبطاقةُ ترسمه لكلِّ سطحٍ يمرّر الرايةَ**،
                       فلا نسختان تفترقان (D-145). */
                    mine: true,
                    playlist: playlists ? playlists.has(l.id) : undefined,
                  }}
                  /* **العدُّ بتفصيله حين تعرفه القاعدة** (my_lists) —
                     **وقبل الهجرة يسقط إلى العدّ الكلّي** (D-028). */
                  /* 🔴 🆕 **والقائمةُ الذكيّةُ لا تُعدّ صفوفاً** (D-823):
                     **`my_lists` تعدّ `user_list_items`، ولا صفَّ لها
                     فيه** — **فبطاقةٌ تقول «٠ أعمال» عن قائمةٍ تعرض
                     ستّين تكذب** (D-217). **والصادقُ أن تقول ما هي**،
                     **ولا عدَّ يُخترع بنداءِ TMDB لكلِّ بطاقةٍ في
                     الشاشة** (D-515). */
                  countLabel={
                    l.kind === "smart"
                      ? locale === "en"
                        ? "Fills itself"
                        : "تمتلئ وحدَها"
                      : typeof l.shows_count === "number" || typeof l.movies_count === "number"
                        ? t.listContentCount(l.shows_count ?? 0, l.movies_count ?? 0)
                        : undefined
                  }
                  cover={backdropUrl(l.cover_backdrop ?? null, "w780")}
                  action={
                    /* ⚠️ **زرٌّ داخل بطاقةٍ رابط** — فالحدثُ يُوقَف عنده
                       (D-339/D-155)، **وإلّا شارك وفتح الصفحة في لمسة.** */
                    <span className="shrink-0 flex items-center gap-1">
                    {/* 🆕 **مفتاحُ التشغيل قبل المشاركة** (D-563، طلبُ
                        أحمد): **حالةٌ تُقرأ قبل فعلٍ يُفعل** —
                        **والرقاقةُ تحمل كلمتَها فتُقرأ بلا ضغطة**،
                        والمشاركةُ رمزٌ يُقصد قصداً.
                        ⚠️ **ولا مفتاحَ لقائمةٍ فارغة**: رايةٌ على قائمةٍ
                        بلا أعمالٍ **لا تُظهر شيئاً في «تابِع
                        المشاهدة»** — **ومفتاحٌ يَعِد بما لا يقع يكذب**
                        (D-217)، وهو نفسُ شرطِ الصفِّ في ورقة الأدوات
                        (`visible.length > 0`). */}
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
                    </span>
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
