import { redirect } from "next/navigation";
import {
  getUser,
  getMyLists,
  listsForDisplay,
  getSavedLists,
  getFollows,
  getMyListedMovieIds,
  getMyPlaylistIds,
  getProfile,
  getWatchedMovieIds,
} from "@/lib/data";
import { sanitizeHomePrefs, applyQueueOrder, unwatchedOf } from "@/core/homePrefs";
import { getT } from "@/lib/locale";
import { ListManager } from "@/components/ListManager";
import { HomeQueueSheetHost } from "@/components/HomeQueueOrder";
import type { ReorderItem } from "@/components/ReorderSheet";
import { PublicListsRail } from "@/components/PublicListsRail";
import { OneTimeHint } from "@/components/OneTimeHint";
import { getListProgress } from "@/lib/listProgress";
import { webWords } from "@/components/webWords";
import { segmentedItem, segmentedTrack } from "@/components/ui/controls";
import Link from "next/link";

/**
 * قوائمي.
 *
 * القوائم تُقرأ باستدعاء واحد يرجّع الاسم والعدد وثلاثة ملصقات — لا استعلام
 * لكل قائمة ولا طلب TMDB واحد، فالصفحة تفتح فوراً مهما كثرت القوائم.
 *
 * وتحت قوائمي: «قوائم محفوظة» (D-068) — مراجعُ حيّة إلى قوائم أصحابها،
 * بطاقتها بطاقة اكتشف نفسها بسطر صاحبها: هي قوائم غيرك لا قوائمك، وموضعها
 * بعد صنعك لا بينه.
 *
 * 🆕 **وبطاقةُ «للمشاهدة» هنا أيضاً** (D-559): **هذا المسارُ ولوحُ
 * القوائم في المكتبة يرسمان المكوّنَ نفسَه** (تعليقُ `LibraryGrid`:
 * «نفس تركيبة صفحة `/lists` حرفياً — لا نسخة ثانية منها») — **ولوحان
 * يرسمان المكوّنَ نفسَه ويعرضان قائمتين مختلفتين هما بعينهما ما تمنعه
 * القاعدة ٦.** **والمفتاحُ الذي يُرى في بابٍ ولا يُرى في الآخر يُبحث
 * عنه.**
 */
export default async function ListsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const [lists, saved, follows, listedMovieIds, profileRow, playlistIds, watchedMovieIds] = await Promise.all([
    getMyLists(),
    getSavedLists(),
    getFollows(),
    getMyListedMovieIds().catch(() => new Set<number>()),
    getProfile().catch(() => null),
    /* 🆕 **رايةُ التشغيل لكلِّ قائمة** (D-563) — **داخل الموجة نفسِها**:
       نداءٌ واحدٌ بعمودٍ واحدٍ لصاحب الجلسة، **وموجةٌ ثانيةٌ لحرفٍ في
       بطاقةٍ ثمنٌ بلا مقابل.** */
    getMyPlaylistIds(),
    /* 🔴 **القارئُ الثالثُ الذي قالت D-848 إنّه لا يوجد** (D-942، بلاغُ أحمد:
       «قائمة تو واتش فيها أفلام أنا شفتها»): الرئيسيّةُ والمكتبةُ تُسقطان
       المشاهَدَ عبر `unwatchedOf`، **وهذه الصفحةُ كانت تعدّ الطابورَ الخامَ
       وتعرضه في ورقة الترتيب** — **فبابٌ ثالثٌ يقول عن القائمة نفسِها ما لا
       يقوله أخواه.** الحكمُ نفسُه، من الدالّة نفسِها. */
    getWatchedMovieIds().catch(() => new Set<number>()),
  ]);

  /* **الحسابُ حسابُ المكتبة والرئيسية حرفاً** (D-505): أفلامُك التي لا
     قائمةَ لها، بترتيب الإضافة. **والفارغُ لا بطاقةَ له** (D-219). */
  const queue = unwatchedOf(
    follows
      .filter((f) => f.media_type === "movie" && !listedMovieIds.has(f.tmdb_id))
      .sort((a, b) => a.added_at.localeCompare(b.added_at)),
    watchedMovieIds,
  );
  /* 🆕 **وترتيبُ صاحبها ثالثَ الأبواب** (D-719) */
  const queueOrdered = applyQueueOrder(
    queue,
    (f) => `tw-mv-${f.tmdb_id}`,
    sanitizeHomePrefs(profileRow?.home_prefs).towatchListOrder,
  );
  const toWatch = queue.length
    ? {
        on: sanitizeHomePrefs(profileRow?.home_prefs).toWatch,
        count: queue.length,
        posters: queueOrdered.slice(0, 3).map((f) => f.poster_path ?? null),
      }
    : null;
  const toWatchListItems: ReorderItem[] = queueOrdered.map((f) => ({
    key: `tw-mv-${f.tmdb_id}`,
    title: f.title,
    poster_path: f.poster_path ?? null,
    media_type: "movie" as const,
  }));

  /* 🆕 R272 — شريطُ «كم شاهدت» على بطاقات الحاسوب، و«أكملتها» في المحفوظة (أحمد: «كمل اللي ما بنيته»). نداءٌ واحدٌ
     لقوائمك ومحفوظاتك معاً — بعد الموجة الأولى لأنّ المعرّفاتِ منها */
  const progress = await getListProgress([...lists.map((l) => l.id), ...saved.map((l) => l.id)]);
  const doneOnly = (await searchParams).saved === "done";
  const isDone = (id: string) => {
    const p = progress[id];
    return !!p && p.total > 0 && p.watched >= p.total;
  };
  const savedDesk = doneOnly ? saved.filter((l) => isDone(l.id)) : saved;
  const w = webWords(locale);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.listsTitle}</h1>
      <OneTimeHint id="lists-intro" text={t.hintLists} closeLabel={t.closeLabel} />
      {/* 🆕 مضيفُ ورقة ترتيب البطاقة (D-719) — حيث تُرسم البطاقةُ يُركَّب */}
      {toWatchListItems.length > 0 && (
        <HomeQueueSheetHost locale={locale} cont={[]} towatch={[]} towatchList={toWatchListItems} />
      )}
      {/* 🆕 **و«المفضّلة» خرجت من قوائمه هنا أيضاً** (D-654): **هذه
          الشاشةُ وشاشةُ المكتبة واحدةٌ بطريقين** — **ولو صُفّيت في
          واحدةٍ لافترقتا عند أوّل تعديل** (D-145). */}
      <ListManager
        lists={listsForDisplay(lists)}
        locale={locale}
        toWatch={toWatch}
        playlistIds={playlistIds}
        progress={progress}
      />
      {/* العدّاد في العنوان (تدقيق 8 Aug م٣-١): القسم يسكن تحت قوائمك
          وخلف طيّة الجوال — الرقم يقول «عندك محفوظات» قبل أن تصل إليه */}
      <div className="desk:hidden">
      <PublicListsRail
        lists={saved}
        locale={locale}
        title={saved.length > 0 ? `${t.savedListsSection} · ${saved.length}` : t.savedListsSection}
      />
      </div>
      {/* 🆕 R266 — **المحفوظةُ على الحاسوب شبكةٌ لا رفّ** (أحمد ١٨ نوفمبر): ثلاثُ بطاقاتٍ في الصفّ كقوائمك فوقها — البطاقةُ
          نفسُها (`grid` القائم في `PublicListsRail`)، والرفُّ الأفقيُّ يُخفي ما تملكه خلف الحافّة */}
      <div className="hidden desk:block">
      <PublicListsRail
        lists={savedDesk}
        locale={locale}
        grid
        progress={progress}
        title={saved.length > 0 ? `${t.savedListsSection} · ${saved.length}` : t.savedListsSection}
        action={
          saved.some((l) => isDone(l.id)) ? (
            <span className={segmentedTrack}>
              <Link href="/lists" scroll={false} className={segmentedItem(!doneOnly, "px-3 pt-1 pb-2 text-13", false)}>{w.savedAll}</Link>
              <Link href="/lists?saved=done" scroll={false} className={segmentedItem(doneOnly, "px-3 pt-1 pb-2 text-13", false)}>{w.savedDone}</Link>
            </span>
          ) : undefined
        }
      />
      </div>
    </div>
  );
}
