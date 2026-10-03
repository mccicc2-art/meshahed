import { InteractionManager } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { api, queryClient } from "../api";
import { posterFor } from "../poster";
import type { ProfilePayload } from "@/core/contracts/profile";

/**
 * ====== بياناتُ ملفّ الشخص — المفتاحُ والجلبُ في ملفٍّ صغير (🆕 D-1238) ======
 *
 * **لماذا ملفٌّ ثانٍ**: الرئيسيّةُ تسخّن ملفَّ صاحبها (أدناه)، واستيرادُ `ProfileScreen` (١٢٠٠ سطر) لأجل مفتاحٍ ودالّةِ جلبٍ
 * كان سيقيّم الشاشةَ كلَّها مع الرئيسيّة.
 */
export const profileKey = (username: string) => [`profile:${username.toLowerCase()}`] as const;

export async function fetchProfile(username: string) {
  return (await api<ProfilePayload>(`/api/v1/profile/${encodeURIComponent(username)}`)).data;
}

/** عرضُ الملصق لكلِّ كثافة (D-441) — هنا لأنّ تسخينَ الصور يبني الروابطَ نفسَها التي ترسمها الشاشة */
export const DENSITY_W = { compact: 96, comfortable: 118, large: 148 } as const;

/**
 * ====== طولا رأس الملفّ وشريطِه — يعيشان بين الجلسات (🆕 D-1243) ======
 * D-1222 حفظهما في الذاكرة فتُرسم الألواحُ مع الرأس في التزامٍ واحد من الزيارة الثانية. لكنّ **أوّلَ دخولٍ بعد كلِّ تشغيل**
 * بقي على التزامين: رأسٌ فوق جسمٍ أسود ثمّ الجسم (تسجيلُ أحمد ٣ أكتوبر: ~٠٫٤ث بينهما) — والجلسةُ تبدأ من جديدٍ مع كلِّ
 * تحديثٍ هوائيّ. ملفٌّ صغيرٌ يُقرأ عند تقييم هذا الملفّ (الرئيسيّةُ تستورده، فيسبق أيَّ ضغطة) ويُكتب بعد هدوء.
 * ⚖️ طولٌ قديم (سيرةٌ عُدّلت، خطٌّ كُبّر) يُرسم به مرّةً ثمّ يصحّحه القياسُ كما كان — التزامٌ زائدٌ لا خطأ.
 */
export const headMemo = new Map<string, { head: number; bar: number }>();
const HEAD_KEEP = 24;
const headFile = () => new File(Paths.document, "profile-head.json");
void (async () => {
  try {
    const f = headFile();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as Record<string, { head?: unknown; bar?: unknown }>;
    for (const [k, v] of Object.entries(saved))
      if (typeof v?.head === "number" && typeof v?.bar === "number" && v.head > 0 && v.bar > 0 && !headMemo.has(k)) headMemo.set(k, { head: v.head, bar: v.bar });
  } catch {
    /* ملفٌّ تالف: يُقاس من جديد */
  }
})();
let headTimer: ReturnType<typeof setTimeout> | null = null;
export function rememberHead(username: string, head: number, bar: number) {
  const cur = headMemo.get(username);
  if (cur && cur.head === head && cur.bar === bar) return;
  /* الأحدثُ في الآخر: `Map` يحفظ ترتيبَ الإدراج، فالقصُّ يرمي الأقدم */
  headMemo.delete(username);
  headMemo.set(username, { head, bar });
  if (headTimer) clearTimeout(headTimer);
  headTimer = setTimeout(() => {
    headTimer = null;
    InteractionManager.runAfterInteractions(() => {
      try {
        const f = headFile();
        if (!f.exists) f.create();
        f.write(JSON.stringify(Object.fromEntries([...headMemo].slice(-HEAD_KEEP))));
      } catch {
        /* الحفظُ ليس شرطاً */
      }
    });
  }, 3000);
}

/**
 * 🆕 D-1243 — **صورُ الشاشة الأولى تُحمَّل مع الحمولة**: الصورةُ الشخصيّة والغلافُ وملصقاتُ أوّل ثلاثة صفوفٍ من التبويب
 * الأوّل (ما يملأ عرضَ الشاشة منها). تسجيلُ أحمد ٣ أكتوبر: الشاشةُ تظهر ثمّ «تتحمّض» صورُها صفّاً بعد صفّ، والصورةُ
 * الشخصيّة دائرةٌ رماديّةٌ ~٠٫٣ث. الروابطُ هنا **هي روابطُ الشاشة حرفاً** (`posterFor` بعرض كثافة القارئ) — رابطٌ آخر
 * لا يصيب الكاش. ⚖️ ~١٢ صورةً في الخلفيّة لكلِّ جلسةٍ ولو لم يُفتح الملفّ؛ والفشلُ صامت.
 */
const PER_ROW = 4;
const ROWS = 3;
export function profileFirstImages(d: ProfilePayload): string[] {
  const out: string[] = [];
  if (!d.person.hide_name && d.person.avatar_url) out.push(d.person.avatar_url);
  if (d.person.cover_url) out.push(d.person.cover_url);
  if (d.locked) return out;
  const w = DENSITY_W[d.viewer.density ?? "comfortable"];
  const rows: { poster_path: string | null }[][] = [];
  const first = d.tabs[0];
  if (first === "overview") {
    /* 🔴 D-1244 — **الصفوفُ المرسومةُ وحدَها تُعدّ** (كما في `Overview`: قسمٌ فارغٌ لا يُرسم). كان القسمُ الفارغ يأخذ
       خانةً من الثلاث، فخرج صفُّ الأنمي عند أحمد من التسخين وبقي آخرَ ما يظهر في كلِّ دخول. */
    for (const s of d.sections) {
      if (s === "shows" || s === "movies" || s === "anime") {
        if (d.overview[s].length) rows.push(d.overview[s]);
      } else if (s === "ratings") {
        if (d.overview.ratings.length) rows.push(d.overview.ratings);
      } else if (d.overview[s].length) rows.push([]); /* القوائمُ والفنّانون: صفٌّ يأخذ مكانَه في الشاشة بلا ملصقاتِ أعمال */
    }
  } else if (first === "favorites") {
    const f = d.favorites;
    for (const k of f.order) {
      const r = k === "shows" ? f.shows : f.movies;
      if (r.length) rows.push(r);
    }
    if (f.anime.length) rows.push(f.anime);
  }
  for (const r of rows.slice(0, ROWS))
    for (const x of r.slice(0, PER_ROW)) {
      const u = posterFor(x.poster_path, w);
      if (u) out.push(u);
    }
  return out;
}
function warmImages(d: ProfilePayload) {
  const urls = profileFirstImages(d);
  if (urls.length) void Image.prefetch(urls, "memory-disk").catch(() => false);
}

/**
 * 🆕 D-1238 — **ملفُّ صاحب الحساب يُجلب قبل أن يضغط صورتَه**. أرقامُ جهاز أحمد (٧ أيّام حتى ٣ أكتوبر): `profile.open`
 * وسيطُه ١٠٩٤ms من الشبكة و٤٩٠ms من الكاش — والرئيسيّةُ تعرف الاسمَ منذ رسمت رأسَها، فالانتظارُ الأوّلُ كلُّه شبكةٌ
 * كان يمكن أن تسبق الإصبع.
 * 🔴 D-1243 — **فورَ وصول حمولة الرئيسيّة لا بعد ٢٫٥ث من هدوئها**: تسجيلُ أحمد ٣ أكتوبر يضغط صورتَه بعد ثانيةٍ من التشغيل،
 * فكان الجلبُ لم يبدأ والدخولُ الأوّل ٧٦٦–١٢٥٢ms من الشبكة. الطلبُ واحدٌ خفيف، ومن ضغط وهو في الطريق يكمل عليه
 * (`useQuery` بالمفتاح نفسِه يشارك الطلبَ الجاري) لا يبدأ من جديد.
 * 🔑 **يُعاد حين يغيب من الكاش لا مرّةً في الجلسة**: الكاشُ يُكنس بعد ٣٠ دقيقةً بلا مشاهد (`gcTime`)، والرئيسيّةُ تنادي
 * هذا مع كلِّ حمولةٍ جديدةٍ لها. وما في الكاش لا يُجلب ثانيةً هنا: الشاشةُ نفسُها تجدّد الشائخَ عند فتحها.
 * ⚖️ فشلُه صامت (`prefetchQuery` لا يرمي)، والشاشةُ تجلب بنفسها كما كانت.
 */
const imagesWarmed = new Set<string>();
export function warmOwnProfile(username: string | null | undefined): void {
  if (!username) return;
  const key = profileKey(username);
  const have = queryClient.getQueryData<ProfilePayload>(key);
  const after = (d: ProfilePayload | undefined) => {
    if (!d || imagesWarmed.has(username)) return;
    imagesWarmed.add(username);
    warmImages(d);
  };
  if (have) return after(have);
  void queryClient.prefetchQuery({ queryKey: key, queryFn: () => fetchProfile(username), staleTime: 60_000 }).then(() => after(queryClient.getQueryData<ProfilePayload>(key)));
}
