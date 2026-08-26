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
} from "@/lib/data";
import { sanitizeHomePrefs } from "@/lib/homePrefs";
import { getT } from "@/lib/locale";
import { ListManager } from "@/components/ListManager";
import { PublicListsRail } from "@/components/PublicListsRail";
import { OneTimeHint } from "@/components/OneTimeHint";

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
export default async function ListsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const [lists, saved, follows, listedMovieIds, profileRow, playlistIds] = await Promise.all([
    getMyLists(),
    getSavedLists(),
    getFollows(),
    getMyListedMovieIds().catch(() => new Set<number>()),
    getProfile().catch(() => null),
    /* 🆕 **رايةُ التشغيل لكلِّ قائمة** (D-563) — **داخل الموجة نفسِها**:
       نداءٌ واحدٌ بعمودٍ واحدٍ لصاحب الجلسة، **وموجةٌ ثانيةٌ لحرفٍ في
       بطاقةٍ ثمنٌ بلا مقابل.** */
    getMyPlaylistIds(),
  ]);

  /* **الحسابُ حسابُ المكتبة والرئيسية حرفاً** (D-505): أفلامُك التي لا
     قائمةَ لها، بترتيب الإضافة. **والفارغُ لا بطاقةَ له** (D-219). */
  const queue = follows
    .filter((f) => f.media_type === "movie" && !listedMovieIds.has(f.tmdb_id))
    .sort((a, b) => a.added_at.localeCompare(b.added_at));
  const toWatch = queue.length
    ? {
        on: sanitizeHomePrefs(profileRow?.home_prefs).toWatch,
        count: queue.length,
        posters: queue.slice(0, 3).map((f) => f.poster_path ?? null),
      }
    : null;

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.listsTitle}</h1>
      <OneTimeHint id="lists-intro" text={t.hintLists} closeLabel={t.closeLabel} />
      {/* 🆕 **و«المفضّلة» خرجت من قوائمه هنا أيضاً** (D-654): **هذه
          الشاشةُ وشاشةُ المكتبة واحدةٌ بطريقين** — **ولو صُفّيت في
          واحدةٍ لافترقتا عند أوّل تعديل** (D-145). */}
      <ListManager
        lists={listsForDisplay(lists)}
        locale={locale}
        toWatch={toWatch}
        playlistIds={playlistIds}
      />
      {/* العدّاد في العنوان (تدقيق 8 Aug م٣-١): القسم يسكن تحت قوائمك
          وخلف طيّة الجوال — الرقم يقول «عندك محفوظات» قبل أن تصل إليه */}
      <PublicListsRail
        lists={saved}
        locale={locale}
        title={saved.length > 0 ? `${t.savedListsSection} · ${saved.length}` : t.savedListsSection}
      />
    </div>
  );
}
