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
 *
 * 🆕 **روابطُ الودجتات الجديدة** (`com.loopztv.app://w/…`) لا تخصّ الموجِّه: تُردّ فارغةً والتطبيقُ مفتوح،
 * وإلى البداية (`/`) حين تفتحه من الصفر — و`WidgetGate` يقرؤها من `Linking` وينفّذها بعد أن يُدفع الجذر.
 */
const APP_LINK = /^(?:https?:\/\/(?:www\.)?loopztv\.com)?\/(show|movie)\/(\d+)\/?(?:[?#].*)?$/i;
const WIDGET_LINK = /^(?:com\.loopztv\.app:\/\/|\/)?w\/[a-z]+(?:[?#].*)?$/i;

export function appLinkTarget(path: string): string | null {
  const m = APP_LINK.exec(path);
  return m ? `/web?u=${encodeURIComponent(`/${m[1].toLowerCase()}/${m[2]}`)}` : null;
}

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (!initial && path.includes("auth/callback")) return null;
    if (WIDGET_LINK.test(path)) return initial ? "/" : null;
    const link = appLinkTarget(path);
    if (link) return link;
  } catch {
    /* رابطٌ لا يُقرأ — يمرّ كما هو */
  }
  return path;
}
