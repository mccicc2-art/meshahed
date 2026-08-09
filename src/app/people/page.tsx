import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getUser,
  getCommunityFeed,
  getPeopleToFollow,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getConversations,
  getUnreadShares,
  type ConvShareEvent,
  type FeedItem,
  type PersonLite,
} from "@/lib/data";
import { myMutualFollows } from "@/lib/actions";
import { getT } from "@/lib/locale";
import type { Dict } from "@/lib/i18n";
import { localizeRows } from "@/lib/localize";
import { formatDateShort } from "@/lib/when";
import { num } from "@/lib/i18n";
import { FeedEmptyCta } from "@/components/FeedEmptyCta";
import { PeopleToFollow } from "@/components/PeopleToFollow";
import { Inbox } from "@/components/Inbox";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { PersonName } from "@/components/PersonRow";
import { backdropUrl, posterUrl } from "@/lib/media";
import { getTv, getMovie } from "@/lib/tmdb";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import {
  chipClass,
  chipRow,
  segmentedItem,
  segmentedTrack,
  segmentedTrackFull,
} from "@/components/ui/controls";
import { ScrollMemory } from "@/components/ScrollMemory";

/** كم عملاً نطلب له صورةً عرضية — سقفٌ يمنع موجة طلباتٍ بحجم الخط */
const BACKDROP_LIMIT = 12;

type Tab = "mine" | "all" | "inbox";
function asTab(v: string | undefined): Tab {
  return v === "all" || v === "inbox" ? v : "mine";
}

/**
 * تبديدُ الصفوف: لا يظهر شخصٌ مرّتين متتاليتين ما دام في الخطّ غيرُه.
 *
 * سقفُ الخمسة في SQL يمنع أن يملك شخصٌ الخطَّ **عدداً**، ولا يمنع أن
 * يملكه **بصريّاً**: أوّل تشغيلٍ حيّ أظهر خمسة صفوفٍ متلاصقة لشخصٍ واحد
 * («شاهد الفيلم» ×٥) فقرأ الخطّ كسجلٍّ لا كمجتمع. الترتيب الزمني وحده لا
 * يكفي حين تكون الدائرة صغيرة.
 *
 * جشعٌ بسيط: خذ أوّل صفٍّ صاحبُه غير صاحب سابقه، وإلا فخذ التالي كما هو.
 * الترتيب النسبي لصفوف الشخص الواحد محفوظ، والتكلفة لا شيء عند ستّين صفّاً.
 * **يُطبَّق على «الأحدث» وحده** — «الأكثر إعجاباً» ترتيبُه هو معناه.
 */
function spreadByPerson(rows: FeedItem[]): FeedItem[] {
  const pool = [...rows];
  const out: FeedItem[] = [];
  let last: string | null = null;
  while (pool.length) {
    let i = pool.findIndex((r) => r.person.id !== last);
    if (i === -1) i = 0;
    const [picked] = pool.splice(i, 1);
    out.push(picked);
    last = picked.person.id;
  }
  return out;
}

/**
 * صفُّ النجوم في **عمود المحتوى** لا تحت الملصق (طلب أحمد 9 Aug:
 * «التقييم لا يكون تحت الفلم، يكون في المحتوى وتظهر النجوم»).
 *
 * عشر نجوم لا خمس: هذا هو المقياس الذي يقيّم به المستخدم في `RatingBox`،
 * وقسمتُه على اثنتين للعرض تجعل ما يراه غير ما ضغطه. ونفس الحرف ونفس
 * لون التمييز — لا لغةَ بصريةٍ جديدة، والرقم يبقى بجانبها لمن يقرأ رقماً.
 */
function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="mt-2 flex items-center gap-[1px]" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`text-[13px] leading-none ${
            i < rating ? "text-accent" : "text-muted/25"
          }`}
        >
          ★
        </span>
      ))}
      <span className="text-[12px] text-muted ms-1.5 tabular-nums" dir="ltr">
        {rating}/10
      </span>
    </span>
  );
}

/**
 * سطر الفعل تحت الاسم — «ماذا فعل» في جملةٍ واحدة (D-123).
 *
 * التقييم مع مشاهدةٍ في نفس اليوم يذكرهما معاً («شاهد ٦ حلقات · قيّمه»):
 * الصفّ الواحد ابتلع الحدثين، فالسطر يردّ للمشاهدة ذكرها. وتقييمٌ بمراجعةٍ
 * مكتوبةٍ بلا مشاهدة لا يحتاج سطراً أصلاً — النصّ نفسه هو الخبر.
 */
function actionLine(a: FeedItem, t: Dict): string | null {
  const parts: string[] = [];
  if (a.episodeCount > 0) {
    parts.push(t.feedActEpisodes(a.episodeCount));
    if (a.topSeason > 0) parts.push(t.seasonLabel(a.topSeason));
  }
  if (a.kind === "rate") {
    /* لا كلمة «قيّمه» بعد اليوم (طلب أحمد 9 Aug — شطبها في لقطته):
       صفُّ النجوم تحتها يقول الشيء نفسه بصورةٍ تُقرأ أسرع من كلمة.
       وما بقي في السطر هو المشاهدة التي ابتلعها التقييم إن وُجدت. */
  } else if (a.kind === "movie") {
    parts.push(t.feedActMovie);
  } else if (a.kind === "add") {
    parts.push(t.feedActAdd);
  }
  return parts.length ? parts.join(" · ") : null;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    sort?: string;
    with?: string;
    c?: string;
    k?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const {
    tab: tabParam,
    sort,
    with: withParam,
    c: cParam,
    k: kParam,
  } = await searchParams;
  const tab = asTab(tabParam);
  /* مرشِّح نوع الحدث (طلب أحمد 9 Aug: «احتاج فلتر التعليقات وفلتر
     التقييمات»). ثلاثة أقسام **متنافية** كي لا يتداخل مرشِّحان:
     «التقييمات» = رقمٌ بلا نصّ · «المراجعات» = رأيٌ مكتوب. والمشاهدات
     تظهر في «الكل» وحده — لها فعلها في السطر ولا تُطلب بذاتها.
     ملاحظة مفردات (D-026): كلمة المنتج للنصّ هي «مراجعة» لا «تعليق» —
     مصطلحٌ واحد لكل مفهوم؛ الفلتر هو ما طلبتَه واللفظ هو لفظ التطبيق. */
  const kind: "rate" | "review" | null =
    kParam === "rate" || kParam === "review" ? kParam : null;
  /* **الأحدث هو الافتراضي منذ D-123**: الخطّ صار يحمل المشاهدة لا المراجعة
     وحدها، وأحداث المشاهدة بلا إعجابات (D-124 لم تُشحن) — فالترتيب
     بالإعجاب كان يدفنها كلّها أسفل الصفحة ويعيد الخطّ إلى شكله القديم.
     والطزاجة هي ما يقول «الموقع حيّ». `?sort=top` يعيد القديم. */
  const newest = sort !== "top";
  const openWith = tab === "inbox" && withParam ? withParam : null;

  /* الخطّان يُبنيان معاً كي يحمل التبويبان عدّادَيهما دائماً — كصفّ شرائح
     المكتبة (١٨ مسلسلاً · ١٨ فيلماً). كلٌّ نداءا definer خفيفان؛ والترجمة
     والصور العرضية للنشِط وحده. والرسائل تُقرأ عند الحاجة فقط. */
  /* «المجتمع» صار دليلَ مجتمعاتٍ لا خطَّ تفاعلات (قرار المالك): خطُّ
     الجميع أُسقط — «مجتمعي» يكفي لدائرتك والتقييمات في صفحة كل عمل —
     فسقط طلبُه أيضاً، وحلّ محلّه نداءُ مجتمعاتي الخفيف لعدّاد التبويب. */
  /* سقط استعلاما قوائم المتابعة وطلباتها من هذه الصفحة مع سقوط شريطها
     (طلب أحمد): عدّاداهما انتقلا إلى ترويسة الرئيسية، فبقاؤهما هنا
     استعلامان يُدفعان في كل فتحةٍ لصفحةٍ لم تعد تعرضهما */
  const [followingFeed, myCommunities, myInvites, unread] = await Promise.all([
    getCommunityFeed("following"),
    getMyCommunities(),
    // دعواتي المعلّقة (هجرة 42) — قسم «دعوات» فوق مجتمعاتي في الدليل
    getMyCommunityInvites(),
    getUnreadShares(),
  ]);

  const mineCount = followingFeed.length;
  const allCount = myCommunities.length;

  // غرفةٌ مفتوحة؟ («‎?tab=all&c=<id>‎» — الحالة في الرابط كالوارد، D-051/D-054)
  const openCommunity =
    tab === "all" && cParam ? await getCommunityRoom(cParam) : null;

  // ===== الرسائل — محادثةٌ لكل شخص =====
  // ترجمة عناوين الأعمال المُشارَكة عند العرض (D-048): نجمع أحداث المشاركة
  // من كل المحادثات، نترجمها دفعةً، ثم نعيدها إلى مواضعها بمعرّفاتها
  let conversations = tab === "inbox" ? await getConversations() : [];
  if (conversations.length) {
    const shareEvents = conversations.flatMap((c) =>
      c.events.filter((e): e is ConvShareEvent => e.kind === "share"),
    );
    const localized = await localizeRows(shareEvents, locale);
    const byId = new Map(localized.map((s) => [s.id, s]));
    conversations = conversations.map((c) => ({
      ...c,
      events: c.events.map((e) => (e.kind === "share" ? byId.get(e.id) ?? e : e)),
    }));
  }

  // من نبدأ معه: المتابَعون المتبادلون ممّن لا خيط معهم بعد (طلب المالك —
  // «ابدأ محادثة مع شخص جديد» مع بقاء قاعدة «لا محادثة من فراغ»، D-051).
  // يُطلب للوارد وحده، ويُطرح منه أصحاب المحادثات القائمة كي لا يتكرّروا.
  let startable: PersonLite[] = [];
  if (tab === "inbox") {
    const withConv = new Set(conversations.map((c) => c.personId));
    startable = (await myMutualFollows()).filter((p) => !withConv.has(p.id));
  }

  // ===== خطّ الآراء — لتبويب «مجتمعي» وحده الآن =====
  const sorted =
    tab !== "mine"
      ? []
      : (await localizeRows(followingFeed, locale))
          .filter((a) =>
            kind === "review"
              ? Boolean(a.review)
              : kind === "rate"
                ? a.kind === "rate" && !a.review
                : true,
          )
          .sort((a, b) =>
            newest
              ? b.updated_at.localeCompare(a.updated_at)
              : b.likes - a.likes || b.updated_at.localeCompare(a.updated_at),
          );
  const feed = newest ? spreadByPerson(sorted) : sorted;

  /* «أشخاص لمتابعتهم» (D-126) — تُطلب حين يكون الخطّ هزيلاً لا فارغاً
     وحده: دائرةٌ من شخصين تُنتج خطّاً صامتاً كدائرةٍ من صفر، والفرق أن
     الأولى لا تُظهر حالةً فارغة فتبدو الصفحة معطوبة لا ناقصة.
     ونداءٌ ثانٍ مشروط لا يدخل `Promise.all`: أكثر الحسابات دائرتُها
     نشطة، فلا يُدفع ثمنُه إلا من يحتاجه. والمرشِّح يُلغيه — فراغُ
     مرشِّحٍ ليس فراغ دائرة (نفس تفريق D-106). */
  const FEED_THIN = 5;
  const suggestions =
    tab === "mine" && kind === null && feed.length < FEED_THIN
      ? await getPeopleToFollow(null, 5)
      : [];

  /* الصورة العرضية ليست في صفّ التقييم — تُطلب من TMDB لأوائل الخط فقط،
     متوازيةً ومخزَّنة ساعةً في طبقة fetch. الأولوية: عرضيّة TMDB، ثم
     ملصقها، ثم الملصق المخزَّن، ثم الأيقونة. */
  const artTargets = feed.slice(0, BACKDROP_LIMIT);
  const artPairs = await Promise.all(
    artTargets.map(async (a) => {
      const key = `${a.media_type}-${a.tmdb_id}`;
      try {
        const d =
          a.media_type === "tv" ? await getTv(a.tmdb_id) : await getMovie(a.tmdb_id);
        return [key, { backdrop: d.backdrop_path, poster: d.poster_path }] as const;
      } catch {
        return [key, { backdrop: null, poster: null }] as const;
      }
    }),
  );
  const artById = new Map(artPairs);

  // روابط التبويبات — الحالة في الرابط كبقيّة التطبيق: قابلةٌ للمشاركة
  // وللرجوع، وتُرسم على الخادم فلا وميض
  const tabs: { key: Tab; href: string; label: string; count?: number; badge?: number }[] = [
    { key: "mine", href: "/people", label: t.communityTabMine, count: mineCount },
    { key: "all", href: "/people?tab=all", label: t.communityTabAll, count: allCount },
    { key: "inbox", href: "/people?tab=inbox", label: t.communityTabInbox, badge: unread },
  ];

  /* روابط الفرز والمرشِّح تحفظ بعضها — تغيير الفرز لا يمسح المرشِّح
     والعكس (نمط D-095: الحالة في الرابط، قابلةً للمشاركة والرجوع).
     انقلبت وجهتا الفرز مع انقلاب الافتراضي (D-123): العاري = الأحدث. */
  const circleHref = (opts: { top?: boolean; k?: string | null }) => {
    const p = new URLSearchParams();
    if (opts.top ?? !newest) p.set("sort", "top");
    const nk = opts.k === undefined ? kind : opts.k;
    if (nk) p.set("k", nk);
    const qs = p.toString();
    return qs ? `/people?${qs}` : "/people";
  };
  const kinds: { key: "rate" | "review" | null; label: string }[] = [
    { key: null, label: t.feedFilterAll },
    { key: "rate", label: t.feedFilterRatings },
    { key: "review", label: t.feedFilterReviews },
  ];

  return (
    <div className="space-y-5">
      {/* ذاكرة موضع التمرير — العائد من ملف صديقٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* العنوان مخفيٌّ بصريّاً وباقٍ لقارئ الشاشة — أُزيلت كلمة «المجتمع»
          المرئية، وانتقل عدّادا المتابعة وزرّ الإضافة إلى صفّ الترتيب أسفل
          التبويبات (طلب المالك) */}
      <h1 className="sr-only">{t.peopleTitle}</h1>

      {/* ===== صفّ التبويبات =====
          مقسّمٌ يملأ العرض ويقسّمه بالتساوي بأثلاثٍ متطابقة العرض
          (segmentedTrackFull + flex-1 basis-0 min-w-0) — نفس صفّ شرائح
          المكتبة (D-016، D-042). عدّادٌ على «مجتمعي» و«المجتمع»، وشارة غير
          المقروء على «الرسائل» تختفي عند الصفر. */}
      {/* رأسٌ لاصق (طلب أحمد 9 Aug): التبويبات وصفّ الترتيب/المرشِّح
          يبقيان تحت الترويسة والخطّ يمرّ تحتهما. خلفية صمّاء لا شفافة —
          صور الأعمال تمرّ خلفها. و`space-y-5` الأب يضيف فراغاً بين
          الحاوية وما بعدها، فالحشو السفليّ هنا صغير. */}
      <div className="sticky top-[var(--sticky-top)] z-20 -mx-4 px-4 pt-1 pb-2 bg-[color:var(--background)] border-b border-[color:var(--divider)] space-y-3">
      <nav aria-label={t.communityTabsGroup} className={segmentedTrackFull}>
        {tabs.map((tb) => {
          const active = tb.key === tab;
          return (
            <Link
              key={tb.key}
              href={tb.href}
              aria-current={active ? "page" : undefined}
              className={segmentedItem(active, "flex-1 basis-0 min-w-0 flex items-center justify-center gap-1.5")}
            >
              <span className="truncate">{tb.label}</span>
              {typeof tb.count === "number" && (
                <span className={`tabular-nums text-[12px] ${active ? "text-muted" : "text-muted/70"}`} dir="ltr">
                  {num(tb.count, locale)}
                </span>
              )}
              {typeof tb.badge === "number" && tb.badge > 0 && (
                <span
                  aria-label={t.communityUnreadAria(tb.badge)}
                  className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
                  dir="ltr"
                >
                  {num(tb.badge, locale)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* صفُّ «مجتمعي» وحده: الترتيب ثم مرشِّح النوع على البداية،
          والعدّادات على الطرف. **تبويبا المجتمع والرسائل لم يعودا يرسمان
          صفّاً خاصاً بالعدّادات** — تُحقن داخل صفّ بحثهما فيصير الرأس
          صفّاً واحداً (طلب أحمد 9 Aug). ويختفي داخل محادثةٍ مفتوحة. */}
      {tab === "mine" && !openWith && !openCommunity && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex items-center gap-3 flex-wrap">
            {(feed.length > 0 || kind !== null) && (
              <>
                <div role="group" aria-label={t.feedSortGroup} className={segmentedTrack}>
                  <Link
                    href={circleHref({ top: false })}
                    aria-current={newest ? "true" : undefined}
                    className={segmentedItem(newest)}
                  >
                    {t.feedSortNew}
                  </Link>
                  <Link
                    href={circleHref({ top: true })}
                    aria-current={!newest ? "true" : undefined}
                    className={segmentedItem(!newest)}
                  >
                    {t.feedSortTop}
                  </Link>
                </div>
                {/* رقائق لا مقسّم ثانٍ: محوران مختلفان في صفٍّ واحد
                    يحتاجان شكلين مختلفين وإلا قُرئا محوراً واحداً (D-016) */}
                <div role="group" aria-label={t.feedFilterGroup} className={chipRow}>
                  {kinds.map((kk) => (
                    <Link
                      key={kk.key ?? "all"}
                      href={circleHref({ k: kk.key })}
                      aria-current={kind === kk.key ? "true" : undefined}
                      className={chipClass(kind === kk.key, "sm")}
                    >
                      {kk.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ===== محتوى التبويب ===== */}
      {tab === "inbox" ? (
        <Inbox
          conversations={conversations}
          startable={startable}
          openWith={openWith}
          locale={locale}
        />
      ) : tab === "all" ? (
        openCommunity ? (
          <CommunityRoom room={openCommunity} locale={locale} />
        ) : (
          <CommunityDirectory
            mine={myCommunities}
            invites={myInvites}
            locale={locale}
          />
        )
      ) : (
        <section>
          {feed.length === 0 ? (
            /* حالةٌ موجَّهة لا جملةٌ تشخّص (تقييم 9 Aug م٦): الزرّ يفتح
               ورقة البحث عن الأشخاص — أول خطوةٍ للخروج من الفراغ.
               **لكن الفراغ الناتج عن مرشِّحٍ ليس فراغ دائرة**: اقتراح
               «ابحث عن أصدقاء» هناك تشخيصٌ خاطئ، والصواب جملةٌ تقول
               إن هذا النوع وحده خالٍ */
            kind !== null ? (
              <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
                {t.feedFilterEmpty}
              </p>
            ) : (
              /* الحالة الفارغة تطوّرت من جملةٍ وزرّ بحث إلى أسماءٍ حقيقية
                 (D-126): «ابحث عن أصدقاء» يفترض أنه يعرف من يبحث عنه */
              <>
                <FeedEmptyCta locale={locale} />
                <PeopleToFollow people={suggestions} locale={locale} />
              </>
            )
          ) : (
            <>
            <div className="divide-y divide-[color:var(--divider)]">
              {feed.map((a) => {
                const found = artById.get(`${a.media_type}-${a.tmdb_id}`);
                const line = actionLine(a, t);
                const art =
                  backdropUrl(found?.backdrop ?? null, "w500") ??
                  posterUrl(found?.poster ?? a.poster_path, "w342");
                return (
                  <article
                    key={`${a.person.id}-${a.media_type}-${a.tmdb_id}-${a.day}`}
                    className="py-4 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <PersonName
                          person={a.person}
                          t={t}
                          size={34}
                          sub={formatDateShort(a.updated_at, t)}
                        />

                        {/* سطر الفعل: ما الذي حدث. يظهر لغير المراجعات، ومع
                            المراجعة إن حملت مشاهدةً في نفس اليوم (التقييم
                            يبتلع المشاهدة ولا يلغيها — D-123) */}
                        {line && <p className="mt-2.5 text-[13px] text-muted">{line}</p>}

                        {a.rating !== null && (
                          <Stars rating={a.rating} label={t.rateOutOf(a.rating)} />
                        )}

                        {a.review && (
                          <p className="text-[15px] leading-relaxed whitespace-pre-line mt-2">
                            {a.review}
                          </p>
                        )}

                        {/* الإعجاب على **كل** حدث (D-124): صفُّ التقييم
                            يكتب في `review_likes` وغيرُه في
                            `activity_likes`. أما البلاغ فللنصّ المكتوب
                            وحده — لا يُبلَّغ عن مشاهدةٍ لا رأي فيها */}
                        <div className="mt-2 flex items-center gap-1">
                          <LikeButton
                            reviewUserId={a.person.id}
                            tmdbId={a.tmdb_id}
                            mediaType={a.media_type}
                            likes={a.likes}
                            likedByMe={a.likedByMe}
                            isMine={false}
                            target={a.kind === "rate" ? "review" : "activity"}
                            day={a.day}
                            locale={locale}
                          />
                          {a.review && (
                            <ReportButton
                              reviewUserId={a.person.id}
                              tmdbId={a.tmdb_id}
                              mediaType={a.media_type}
                              locale={locale}
                            />
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                        prefetch={false}
                        className="shrink-0 w-28 sm:w-40 group"
                      >
                        <span className="relative block w-full aspect-video rounded-lg overflow-hidden bg-surface-2">
                          {art ? (
                            <Image
                              src={art}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 112px, 160px"
                              className="object-cover"
                            />
                          ) : (
                            <span
                              className="w-full h-full grid place-items-center text-muted"
                              aria-hidden
                            >
                              <Icon name="film" size={16} />
                            </span>
                          )}
                        </span>

                        <span className="mt-1.5 block text-[13px] font-semibold leading-snug truncate group-hover:text-accent transition">
                          {a.title ?? "—"}
                        </span>

                        {/* النوع وحده تحت الملصق — التقييم انتقل إلى عمود
                            المحتوى نجوماً (طلب أحمد)، وبقاؤه هنا تكرارٌ
                            لرقمٍ واحد في مكانين */}
                        <span className="mt-0.5 block text-[11px] text-muted truncate">
                          {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                        </span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            {/* خطٌّ هزيل: الاقتراح **بعد** الصفوف لا قبلها — ما فعلته
                دائرتك أهمّ ممّن قد تضيفه إليها */}
            <PeopleToFollow people={suggestions} locale={locale} compact />
            </>
          )}
        </section>
      )}
    </div>
  );
}
