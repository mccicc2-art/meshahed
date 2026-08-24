import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile, getFollowStats, displayNameOf } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { segmentedTrackFull, segmentedItem } from "@/components/ui/controls";
import { PeopleFollowList } from "@/components/PeopleFollowList";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { Icon } from "@/components/Icon";
import { num } from "@/lib/i18n";

/**
 * 🆕 **صفحةُ المتابعات** (D-565، طلبُ أحمد بمستطيلٍ على ترويسة
 * الرئيسية: «أحتاج أيقونةً واحدةً للمتابعين وتفتحها صفحةً كاملة، فيها
 * تبويبان — واحدٌ للتالين والثاني للمتابعين — وفيه زرُّ مشاركة ملفّي
 * وفيه زرُّ إضافة»).
 *
 * ================= لماذا صفحةٌ والوَرَقةُ قائمة =================
 *
 * **ورقةُ `FollowCountButton` تبقى** (D-561): **هي البابُ في ملفٍّ
 * أزوره** — أضغط رقماً فأرى من خلفَه، **وأعودُ إلى الملفّ.**
 * **وهذه بابُ شبكتي أنا** من رئيسيّتي: **فيها فعلان لا وجودَ لهما في
 * الورقة** (أشارك ملفّي · أضيف أحداً)، **وطولُها مئتا صفٍّ لا تحتملها
 * ورقةٌ نصفُ الشاشة.** **والقارئُ واحدٌ في المكوّن** —
 * `peopleFollowsOf` — **فلا حارسان ولا سقفان** (القاعدة ٦).
 *
 * ⚠️ **والتبويبُ في الرابط لا في حالةِ عميل** (D-438): **يُشارَك
 * ويعود إليه زرُّ الرجوع** — وهو ما لا تفعله حالةُ عميل.
 *
 * ⚠️ **وشريطُ التطبيق مخفيٌّ هنا** (`hidesAppHeader`): ترويستُها رجوعٌ
 * واسم، **وترويستان في شاشةٍ واحدة تجعلان سهمَي رجوعٍ وعنوانين**
 * (D-462/D-493).
 *
 * **والوجهةُ الافتراضيّةُ للرجوع الرئيسيةُ لا الإعدادات** — **من حيث
 * جاء البابُ يعود.**
 */
export default async function FollowsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { tab } = await searchParams;
  const dir: "followers" | "following" = tab === "followers" ? "followers" : "following";

  const [profile, stats] = await Promise.all([
    getProfile().catch(() => null),
    getFollowStats(user.id),
  ]);

  const displayName = displayNameOf(
    { nickname: profile?.nickname ?? null, username: profile?.username ?? null },
    t.anonymousUser,
  );
  /* **رابطُ ملفّي هو ما يُشارَك** — **ومن لا اسمَ مستخدمٍ له لا صفحةَ
     عامّةَ له بعد** (D-434)، **فبابُه تعديلُ الملفّ لا رابطٌ ميّت**
     (D-030). */
  const myPath = profile?.username ? `/u/${profile.username}` : null;

  const tabs = [
    { key: "following" as const, label: t.followsTabFollowing, count: stats.following },
    { key: "followers" as const, label: t.followsTabFollowers, count: stats.followers },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <SettingsHeader title={t.followsTitle} fallbackHref="/" />

      {/* ===== الفعلان =====
          **مشاركةُ ملفّي أوّلاً**: هي ما يجلب متابِعاً جديداً فعلاً،
          **و«إضافة» بحثٌ عن آخرين** — **والأوّلُ فعلٌ يخرج مني،
          والثاني رحلةٌ تبدأ.**
          ⚠️ **ولا زرَّ مشاركةٍ لمن لا اسمَ مستخدمٍ له**: **زرٌّ يشارك
          رابطاً لا يفتح شيئاً يكذب** (D-217) — **ومكانَه بابُ اختيار
          الاسم.** */}
      <div className="flex items-center gap-2 mb-4">
        {myPath ? (
          <ShareTitleButton
            path={myPath}
            title={displayName}
            label={t.shareMyProfile}
            locale={locale}
            className="border border-border bg-surface h-9 px-3.5"
          />
        ) : (
          <Link
            href="/profile/edit"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 h-9 text-14 font-bold transition hover:border-accent/50 active:scale-95"
          >
            <Icon name="edit" size={15} style={{ color: "var(--accent)" }} />
            {t.shareMyProfile}
          </Link>
        )}
        {/* **و«إضافة» تفتح بحثَ الأعضاء** — **البابُ القائمُ لا بابٌ
            ثانٍ** (`/search?type=members`، D-534). */}
        <Link
          href="/search?type=members"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent text-[color:var(--on-accent)] px-3.5 h-9 text-14 font-bold transition hover:brightness-110 active:scale-95"
        >
          <Icon name="plus" size={15} />
          {t.findPeople}
        </Link>
      </div>

      {/* ===== التبويبان =====
          **عائلةُ الشرائح المقسَّمة** (`02`: قسمان لا ثالث) — **نفسُ
          مسار `/stats` حرفاً** (D-493): روابطُ لا أزرار، **فالتبويبُ
          يُشارَك ويعود إليه زرُّ الرجوع.** */}
      <nav aria-label={t.followsTitle} className={`${segmentedTrackFull} -mx-4 px-4 mb-4`}>
        {tabs.map((tb) => (
          <Link
            key={tb.key}
            href={tb.key === "following" ? "/follows" : "/follows?tab=followers"}
            scroll={false}
            aria-current={dir === tb.key ? "page" : undefined}
            className={segmentedItem(dir === tb.key, "flex-1 text-center")}
          >
            {tb.label}
            {/* **والرقمُ باهتٌ بجانب الاسم** — جردٌ لا إشارة (عرفُ
                `PageTabs.count` نفسُه). */}
            <span className="ms-1.5 text-12 text-muted tabular-nums" dir="ltr">
              {num(tb.count, locale)}
            </span>
          </Link>
        ))}
      </nav>

      {/* **والمفتاحُ هو الاتّجاه** — فلا تبقى أسماءُ التبويب السابق
          معروضةً بينما يُجلب الجديد (نمطُ `Suspense key` في `/stats`). */}
      <PeopleFollowList key={dir} targetId={user.id} dir={dir} locale={locale} />
    </div>
  );
}
