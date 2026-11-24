/**
 * ====== الروابطُ الواردة قبل أن يراها الموجِّه (expo-router `+native-intent`) ======
 *
 * 🔴 D-1160 — **رابطُ الرجوع من Google لا يخصّ الموجِّه والتطبيقُ مفتوح** (قياسُ D-1159، ٢٧ سبتمبر):
 * `signInWithGoogle` يفتح نافذةَ Google ويستلم `com.loopztv.app://auth/callback?code=…` منها مباشرةً ويبدّل
 * الرمزَ بنفسه — **لكنّ الموجِّه كان يلتقط الرابطَ نفسَه** فيفتح شاشةَ `auth/callback`. بعد الخروج تكون الشاشاتُ
 * كلُّها قد أُنزلت، فلا ترى تلك الشاشةُ ما ترجع إليه، فتحوّل إلى `/` ⇢ `/web` **فتُركَّب WebView ثانية**
 * (`web.mount count=2`) تحمّل `/` قبل أن يصل الكوكي — ترحيبُ الزائر — والتسليمُ الناجحُ يجري في الأولى
 * المدفونة تحتها. لذلك كان كلُّ أوّلِ دخولٍ بعد خروجٍ يحتاج محاولتين. D-1158 (الرجوعُ بدل التحويل) لم يكفِ.
 *
 * الآن: رابطُ الرجوع **وهو يصل إلى تطبيقٍ مفتوح** يُرَدّ فارغاً — والموجِّهُ لا ينتقل حين يكون الرابطُ فارغاً
 * (`link/linking.js`: `if (href) listener(href)`) — فلا شاشةَ ولا WebView ثانية، والتبادلُ في `signInWithGoogle`
 * كما هو. ⚖️ **والرابطُ الذي يفتح التطبيقَ من الصفر** (`initial` — أندرويد قتله أثناء نافذة Google) يمرّ كما كان
 * إلى `auth/callback` فتحوّل إلى البداية. وكلُّ رابطٍ آخر (الودجت `web?u=…`) يمرّ كما هو.
 *
 * 🆕 D-1375 — **رابطُ العمل من واتساب يفتح التطبيق** (قرارُ أحمد «23 أ»): `https://loopztv.com/show/4607` يصل هنا
 * بعد أن يتحقّق النظامُ من `/.well-known/` — ويُترجم إلى **طريق الودجت نفسِه** (`/web?u=/show/4607`) لا إلى شاشةٍ
 * جديدة: ذاك الطريقُ يعرف الجلسةَ والترحيبَ والدخولَ وينتظر الكوكي قبل أن ينتقل (D-910)، ومجرّبٌ على الأجهزة.
 * المساران هما ما يعلنه `app.json` (`intentFilters`) و`src/lib/appLinks.ts` في الويب — الثلاثةُ معاً.
 * 🆕 T538 (أحمد ٢٤ نوفمبر «٢أ»): **صار يفتح صفحةَ العمل الأصليّة لا نسخةَ الويب** — الرابطُ يُردّ كرابط الودجت (فارغاً والتطبيقُ
 * مفتوح، و`/` من الصفر) و`WidgetGate` يدفع `/title/[kind]/[id]` بعد الجذر والجلسة، الطريقُ المجرَّبُ للمسة الودجت.
 *
 * 🆕 **روابطُ الودجتات الجديدة** (`com.loopztv.app://w/…`) لا تخصّ الموجِّه: تُردّ فارغةً والتطبيقُ مفتوح،
 * وإلى البداية (`/`) حين تفتحه من الصفر — و`WidgetGate` يقرؤها من `Linking` وينفّذها بعد أن يُدفع الجذر.
 *
 * 🆕 R282 — **عودةُ Trakt مثلُ عودة Google** (صورةُ أحمد ١٩ نوفمبر: «Unmatched Route» فوق استيرادٍ نجح): `importFromTrakt`
 * يستلم `com.loopztv.app://trakt?code=…` من نافذة الدخول ويُكمل الاستيرادَ بنفسه، والموجِّهُ كان يلتقط الرابطَ نفسَه ويبحث عن
 * شاشة `trakt` فلا يجدها. والتطبيقُ مفتوحٌ ⇐ فارغٌ فيبقى العضوُ في «الاستيراد والتصدير» ويرى الإشعار؛ ومن الصفر (أندرويد قتله
 * أثناء النافذة) ⇐ البداية — الشِفرةُ بلا مُتحقِّقها لا تُصرف، فلا شيءَ يُستكمل.
 *
 * 🆕 المهمة ٣٧٠ — **رابطُ الدعوة** (`com.loopztv.app://join/<CODE>`، زرُّ «افتح الدعوة في التطبيق» في `/invite/<code>`) لا
 * يخصّ الموجِّه أيضاً: الكودُ يُحفظ في الجهاز (`invite/pending.ts`) ويقرؤه الترحيبُ فيسأل «هل دعاك أحمد؟» — والتطبيقُ مفتوحٌ يبقى
 * حيث هو، ومن الصفر يبدأ من البداية كما يبدأ دائماً (الدخولُ ثمّ الترحيب).
 */
import { inviteCodeOf, pendingInvite } from "../src/invite/pending";

const APP_LINK = /^(?:https?:\/\/(?:www\.)?loopztv\.com)?\/(show|movie)\/(\d+)\/?(?:[?#].*)?$/i;
const WIDGET_LINK = /^(?:com\.loopztv\.app:\/\/|\/)?w\/[a-z]+(?:[?#].*)?$/i;
/* 🆕 R282 — عودةُ Trakt (`com.loopztv.app://trakt?code=…`، وقد تصل بثلاث شرطات) — انظر الفقرة أعلاه */
const TRAKT_RETURN = /^(?:com\.loopztv\.app:\/\/\/?|\/)?trakt(?:[?#].*)?$/i;

/* 🆕 T530 — رابطُ المراجعة من X يفتح التطبيق (أحمد «١أ»: الآيفون الآن عبر `APP_LINK_PATHS`، وأندرويد في البناء المدفوع القادم).
   **إلى شاشة المراجعة الأصليّة مباشرةً** (`app/review/[kind]/[id]/[user].tsx`) لا إلى الويب — كما كانت الحزمُ الأقدمُ تصلها حين
   يمرّ المسارُ كما هو (مراجعةُ الوكيل ٢، البند ٥)؛ و`?card=rating` يخصّ صورةَ المشاركة وحدَها فيسقط */
const REVIEW_LINK = /^(?:https?:\/\/(?:www\.)?loopztv\.com)?\/review\/(tv|movie)\/(\d+)\/([0-9a-f-]{36})\/?(?:[?#].*)?$/i;

export function appLinkTarget(path: string): string | null {
  const r = REVIEW_LINK.exec(path);
  return r ? `/review/${r[1].toLowerCase()}/${r[2]}/${r[3].toLowerCase()}` : null;
}

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (!initial && path.includes("auth/callback")) return null;
    if (TRAKT_RETURN.test(path)) return initial ? "/" : null;
    if (WIDGET_LINK.test(path)) return initial ? "/" : null;
    /* 🆕 T538 — رابطُ العمل مثلُ رابط الودجت: `WidgetGate` يقرؤه من `Linking` ويدفع صفحةَ العمل الأصليّة بعد الجذر */
    if (APP_LINK.test(path)) return initial ? "/" : null;
    const invite = inviteCodeOf(path);
    if (invite) {
      void pendingInvite.set(invite);
      return initial ? "/" : null;
    }
    const link = appLinkTarget(path);
    if (link) return link;
  } catch {
    /* رابطٌ لا يُقرأ — يمرّ كما هو */
  }
  return path;
}
