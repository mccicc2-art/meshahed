import React from "react";
import { Platform } from "react-native";
import { Image, type ImageRef } from "expo-image";

/**
 * ====== مجموعةُ الأيقونات الواحدة — مساراتُ `Icon.tsx` (الويب) مرسومةً مرّةً ======
 *
 * 🔑 **لا مجموعةَ أيقوناتٍ ثانية** (القاعدة ٣): كلُّ ملفٍّ هنا هو مسارُ SVG
 * الويب نفسُه (`viewBox 0 0 24 24 · stroke 1.7 · round`) مرسومٌ أبيضَ ٧٢px
 * ويُلوَّن بـ`tintColor` وقتَ الرسم — فاللونُ من الرموز لا من الصورة. ولا
 * حزمةَ SVG في التطبيق: اثنا عشرَ ملفّاً صغيراً أرخصُ من محرّكٍ كامل.
 * **رمزٌ جديد = يُرسم من `Icon.tsx` بالطريقة نفسِها لا يُرسم بيد.**
 */
const ICONS = {
  /* Phase 11-H — رموزُ الرئيسية: من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  mail: require("../assets/icons/mail.png"),
  bell: require("../assets/icons/bell.png"),
  settings: require("../assets/icons/settings.png"),
  calendar: require("../assets/icons/calendar.png"),
  hourglass: require("../assets/icons/hourglass.png"),
  book: require("../assets/icons/book.png"),
  trending: require("../assets/icons/trending.png"),
  check: require("../assets/icons/check.png"),
  play: require("../assets/icons/play.png"),
  info: require("../assets/icons/info.png"),
  repeat: require("../assets/icons/repeat.png"),
  "check-line": require("../assets/icons/check-line.png"),
  star: require("../assets/icons/star.png"),
  card: require("../assets/icons/card.png"),
  chart: require("../assets/icons/chart.png"),
  clock: require("../assets/icons/clock.png"),
  heart: require("../assets/icons/heart.png"),
  "heart-filled": require("../assets/icons/heart-filled.png"),
  sliders: require("../assets/icons/sliders.png"),
  search: require("../assets/icons/search.png"),
  close: require("../assets/icons/close.png"),
  /* 🆕 D-947 — رموزُ التبويبَين الرابع والخامس وبطاقةِ القائمة، من `Icon.tsx` بالطريقة نفسِها */
  people: require("../assets/icons/people.png"),
  list: require("../assets/icons/list.png"),
  share: require("../assets/icons/share.png"),
  comment: require("../assets/icons/comment.png"),
  "sparkle-star": require("../assets/icons/sparkle-star.png"),
  /* Phase 11-G — بديلا الملصق في صفّ نتيجة البحث (`film` · `tv`) وبابُ «ابحث بالوصف» (`sparkles`)،
     مساراتُ `Icon.tsx` نفسُها مرسومةً ٧٢px بالطريقة نفسِها */
  film: require("../assets/icons/film.png"),
  tv: require("../assets/icons/tv.png"),
  sparkles: require("../assets/icons/sparkles.png"),
  plus: require("../assets/icons/plus.png"),
  minus: require("../assets/icons/minus.png"),
  "red-card": require("../assets/icons/red-card.png"),
  bookmark: require("../assets/icons/bookmark.png"),
  "chevron-down": require("../assets/icons/chevron-down.png"),
  /* D-948 — مقبضُ الترتيب، وعينُ الحرق، والنجمةُ الممتلئة (`fill-current` في الويب) */
  grip: require("../assets/icons/grip.png"),
  eye: require("../assets/icons/eye.png"),
  "eye-off": require("../assets/icons/eye-off.png"),
  "star-filled": require("../assets/icons/star-filled.png"),
  /* 🆕 D-959 — رموزُ المشغّل الأصليّ، من `Icon.tsx` بالطريقة نفسِها: دائرةُ
     الإيقاف، ومخروطُ الصوت الواحد بموجتِه أو بشطبِه (**عائلةٌ واحدةٌ للرمز**
     — التبديلُ يُقرأ حالةً لا أيقونتين غريبتين). */
  pause: require("../assets/icons/pause.png"),
  volume: require("../assets/icons/volume.png"),
  "volume-off": require("../assets/icons/volume-off.png"),
  /* 🆕 D-961 — رموزُ الشريط السفليّ، وجهان لكلِّ خانة: مفرَّغٌ للخامل وممتلئٌ
     للنشط (`Icon.tsx` نفسُها — والممتلئُ `fill="currentColor" stroke="none"`
     فيُرسم أبيضَ ويُلوَّن بـ`tintColor` كسائره). `people` و`search` المفرَّغتان
     موجودتان أصلاً فلم تُرسما ثانيةً. */
  home: require("../assets/icons/home.png"),
  "home-filled": require("../assets/icons/home-filled.png"),
  library: require("../assets/icons/library.png"),
  "library-filled": require("../assets/icons/library-filled.png"),
  compass: require("../assets/icons/compass.png"),
  "compass-filled": require("../assets/icons/compass-filled.png"),
  "people-filled": require("../assets/icons/people-filled.png"),
  "search-filled": require("../assets/icons/search-filled.png"),
  /* 🆕 D-1020 — رموزُ قائمة «المزيد» في صفحة العمل، من `Icon.tsx` بالطريقة نفسِها (cairosvg
     ٧٢×٧٢ أبيض على شفّاف، يُلوَّن بـ`tintColor`) */
  dots: require("../assets/icons/dots.png"),
  send: require("../assets/icons/send.png"),
  palette: require("../assets/icons/palette.png"),
  link: require("../assets/icons/link.png"),
  /* Phase 11-I — رموزُ فهرس الإعدادات، من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  edit: require("../assets/icons/edit.png"),
  "person-check": require("../assets/icons/person-check.png"),
  shield: require("../assets/icons/shield.png"),
  download: require("../assets/icons/download.png"),
  /* D-1106 — تعديلُ الملفّ أصليّاً: الصورةُ وحذفُها، من `Icon.tsx` بالطريقة نفسِها (cairosvg · ٧٢px · أبيض) */
  image: require("../assets/icons/image.png"),
  trash: require("../assets/icons/trash.png"),
  /* 🆕 D-1134 — مبدّلُ العرض في الرئيسيّة كالويب (`HomeViewSwitch`: `grid` ⇄ `list`)، cairosvg · ٧٢px · أبيض،
     خطٌّ ٢ كما يمرّره الويب */
  grid: require("../assets/icons/grid.png"),
  /* 🆕 D-1321 — «مزدوج» من `Icon.tsx` بالطريقة نفسِها */
  "view-mixed": require("../assets/icons/view-mixed.png"),
  /* 🆕 11-M · M2 — دبّوسُ غرفة «الأعمال» (`RoomPinButton`: خطٌّ ٢٫٢ كما يمرّره الويب)، cairosvg · ٧٢px · أبيض.
     ⚠️ **صورةُ بياناتٍ لا ملفّ** — والحجّةُ سببُ الطريق لا الذوق: الدفعُ عبر `push_files` نصٌّ وحده، فملفٌّ ثنائيٌّ
     لا يعبر؛ و`expo-image` يقرأ `data:` ويلوّنها بـ`tintColor` كأخواتها — الرسمُ نفسُه والحجمُ ١٫٥KB. */
  pin: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAAEJElEQVR4nO2bzW8XRRjHv9OXQAkJvlVjCCeDUsQTEY0iJ0MIkT8DCheNiUYlBTSe/BOsLzFeTdTEGPViAgWMBw8SUgxXS9NElMaLFmg/HnZJyg92Zp7dnd8uMp9bM7PP851vd3af2ZmflMk0waUICoxJ2inpMUkPpMixjmVJS5IuOeduJs7VDGAK+ARYZvgsl7l3dO3DHQAjwCngRgfGDHIdOAEkmR1mKMz5vFtP7spn9MEkijunr8w0HV8jh4EpSRckjTUVkogbknY55y7XDTDSUMAb6q85kjQu6c0mAWrfQRSv8quStlR0OSPpY0n/1s0RyYSkw5L2VrRfkzTpnFtNrON2gGc8c/90aeCwtIwBZz16nq4bu8kU2+ppmx1m0Vbm+tDTxafVS9NnUJ9I8kpvYtAVT9vRIU+xcUnTni4+rV5SPqTPSZpVIe6yc+73urkq8m+TNCXpcUlHJL1Q0bWbh7QkUax9YjkHvNRCzn3AT4a8s22Mta7YHRRrn1huAocb5JsuY8SyAmxvc8x1RJ8wCL5lUlXN4suzD1g15jqeYsxW4SMUC0MLZ2vkOW/M8Sl9WKxKEuCAGWzTLbo2AbYZ4q4Ax3tjznqAJ4GPgGsRA3nZEHd/RLy/gFm6fubEAIwCOynuqioOGeId8sSZKXONphhLkmKurDnmgSdSxB/gV+fcfKrg/6elRhKyQQGyQQGyQQGyQQGyQQGyQQGyQQGyQQFSG7TB02b5wrfmaRs3xDGT2qBXPG1/GOJc9bQdNMTpB8Am4H1grWKBuQJsMsTbTPWnlDXgPUu8zgAmgNeBJc/qG+CbGrG/D8RcKnNPpBhbI4CNwGvAYmAQt4j+FrQux4HI2IvAq8DGFGO1ih4FjgFXIsUDfNEg31eGPAvAURJ9J4oR+yj+/fC7cQGo2keLyfkgcNGY8zQw2ebYY4Q+BMwbhf4IPNJC7sly0BYuAqkPk94m8muDuAXgCNBaSUGxkzKNbWp/2Vb+kLiDkYKSPyyxvxz2p9KyXtQPARFDf90SX158m1pIqGA7SYcFG0WB+i4tFah1BDzv+e90d0hgAIpd1SqetcSyPjgf9rR9Z4yVEt9UMr3yrQb5+vfpdxLXPW2mwrHNjcMX6UN5X7C7rUBWg1Y8bW81ETJE/rF0tk6xS8b+fQNJpm1qk0HlOcPzlmt6xpxzbtFyQZ3y/23ZPpf2hVVJ71gvMhvknJuTdEz3lkmrkqadc8O7+4G9wJynIOsLZ4CqI8JBGh9TozhK95T8RaSP3ap+A34g6Zeacf+U9Jv1mdM78J8eiz6Floq8cRggGxQgGxQgGxQgGxQgGxQgGxQgGxQgGxQgGxSgDwb9XbPt/gDYQLE9PcgC4DvCd/8A7BkwaQHY07UuKdGP8etQ3i3PlX/+7JzzbRBkMvcI/wHymLK0u0/rsgAAAABJRU5ErkJggg==" },
  "pin-filled": { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAADVUlEQVR4nO2cPYtdRRiAnzcf5gNBo0SLlKJmYzohgqYXgun8D5rGICh+sCIhlX9BMQRrtbOxzIpgYaFgErR0syyoyWKhZOPmsThXCDeJszOz52M383SXe96Z9zz73jkzc4aFRqOG6KNRdQ9wDHgSeLSPPu5gDVgFrkTEPz33VYe6oH6qrjk8a7O+j47t4S7UXeqH6q0RxMyzrn6g9vLryMZOzmfjOrknF52CJLvKmSqLtfdXZVhdAH4E9tQm0hO3gOMR8XNpA7sqE3iL6coB2Au8XdNAcQXZPcp/Bx6pSWAAbgCHI2KjJLimghaYvhyAQ0Dxo79G0JGK2KEpzrV2DNrx1Ai6tmVZ9E9xrm2QTlBcQbOF4Rel8QPyeakcqJ8oHqWbKO6taadH1ukmir+UNlA1SEfEVeB8TRs9c65GzpZgt1i9OOaC6z5ccAqLVQA11EW7rYaxuam+71Tk3In6jPqJemMEMdfVj9Wnx/aQRN2tHrOrqr5ZnPW1u4976WUlPnusXlaf6qP9OX6IiMt9Nd6WGgmaoARNUIImKEETlKAJStAEJWiCEjRBCfoWtK/n9qHnvai+Bb3Sc/sApwboY2tRD6rn1dsDLFZvq+fUg2PfdxL1gPqmujqAmHlWZ30fGNvDXaj71bPqyghi5llR31D3j+3lv32fM+q1UZXcm2X1dSv3iWreiz0BfAm8VJPAAFwCXo2I30qCiwSpjwHf0B1g2A78BJyMiLXcwNLH/AW2jxyA5+hyzia7gtRTwFclnU2AlyPi65yAkgo6WxAzFbJzz6og9WHgOtN91ZxiHTgUEX9tNiC3go6zfeUAPEQ3Hm2aXEGPZ14/RQ7nXJwraCdsj2RNHHfCDfdKrqCbvWQxLH/nXJwr6Erm9VNDIOs1dZagiPgV+DYnZmIsRcRKTkDJGPQuUHzmb0Q2gPdyg7IFRcQScIbtJWkDeC0ihqt+9aS6NN52z6a5pL5Yep/Vx9TUI8CzlE8inwfeuc93HwHfF7b7B3A1d8yZHOrp//nrnx47vzZRTNAEJWiCEjRBCZqgBE1QgiYoQROUoAlK0AQlmIKgPwu/ezBQ99mdxJhnWR3iCN/0UU/MSVpWT4ydF/T0L7pKmFXLC7OP30XETnhB0Hjg+ReEqRZjOWrlKQAAAABJRU5ErkJggg==" },
} as const;

export type IconName = keyof typeof ICONS;
/** 🆕 D-1112 — أسماءُ الأيقونات في سجلّات النواة (`homePrefs`/`profilePrefs`) أسماءُ الويب؛ ما لا نظيرَ له
    هنا (`grid`) يسقط إلى بديلٍ لا إلى صورةٍ فارغة */
export function iconOr(name: string, fallback: IconName): IconName {
  return name in ICONS ? (name as IconName) : fallback;
}

/**
 * 🆕 D-1276 — **رموزُ الشريط السفليّ تُحمَّل إلى الذاكرة عند الإقلاع** (بلاغُ أحمد بتسجيل، ٤ أكتوبر ٢٠٢٦: «ليش
 * تسير خضخضة ورمشة على الدوك إذا كنت تو داخل التطبيق»).
 *
 * **المقيسُ من التسجيل إطاراً بإطار**: أوّلُ دخولٍ لتبويبٍ في الجلسة تختفي فيه الرموزُ الخمسةُ وتبقى الكلمات — ٩٣ms
 * عند «المجتمع» و٢٣٥ms عند «اكتشف»؛ والرجوعُ إلى تبويبٍ سبق فتحُه بلا اختفاء. **السبب**: كلُّ جذرٍ يرسم شريطَه
 * (`BottomNav`)، فأوّلُ دخولٍ يركّب شريطاً جديداً بخمس صورٍ جديدة، و`expo-image` يحمّل الصورةَ بعد التركيب لا معه —
 * والخيطُ مشغولٌ بتركيب الشاشة نفسِها، فتتأخّر الصورُ بقدر ثقلها. الكلماتُ نصٌّ فتُرسم فوراً.
 *
 * **العلاج**: الوجوهُ العشرةُ تُحمَّل مرّةً (`Image.loadAsync`) وتبقى مراجعُها حيّة؛ و`Icon` يعطي الصورةَ المرجعَ
 * المحمَّل بدل رقم الملفّ، فالشريطُ الجديدُ يرسم من صورةٍ مفكوكةٍ في الذاكرة لا من ملفٍّ يُقرأ. عشرُ صورٍ ٧٢px —
 * لا ثمنَ يُذكر. وما لم يُحمَّل بعد (أو سقط تحميلُه) يُرسم بالطريق القديم حرفاً.
 * ⚠️ **لم يُجرَّب على جهاز قبل الرفع** — الحَكَمُ تسجيلٌ بعده؛ وإن بقي أثرٌ فالعلاجُ الأكبر شريطٌ واحدٌ فوق
 * التبويبات لا يُعاد تركيبُه.
 */
const NAV_ICONS: IconName[] = [
  "home", "home-filled", "library", "library-filled", "compass", "compass-filled",
  "people", "people-filled", "search", "search-filled",
];
/* 🆕 D-1325 — ورموزُ رأس الملفّ معها (بطاقةُ الأرقام وسطرُ العدّادات): كانت تظهر بعد وصول الملفّ بنحو ١٧٠ms في تسجيل
   أحمد ٨ أكتوبر — السببُ نفسُه (صورةٌ تُحمَّل بعد التركيب). سبعُ صورٍ ٧٢px. */
const PROFILE_ICONS: IconName[] = ["tv", "film", "sparkles", "chart", "calendar", "star", "heart"];
const warm = new Map<IconName, ImageRef>();
for (const name of Platform.OS === "ios" ? [] : [...NAV_ICONS, ...PROFILE_ICONS]) {
  try {
    void Image.loadAsync(ICONS[name] as number)
      .then((ref) => {
        warm.set(name, ref);
      })
      .catch(() => {});
  } catch {
    /* وحدةٌ أصليّةٌ غائبة (اختبار، ويب): الطريقُ القديم */
  }
}

/**
 * 🔴 D-1333 — **في iOS الأيقونةُ من ملفّها، وتُركَّب من جديد إذا تغيّر لونها** (أوّلُ نسخة iOS، تسجيلُ أحمد ٨ أكتوبر:
 * «الدوك فيه خلل فالاضاءه» — الكلمةُ تتلوّن صحيحاً والأيقونةُ تبقى بلونها السابق أو بيضاء، والأبيضُ لونُ الصورة قبل
 * التلوين). `expo-image` في iOS لا يطبّق `tintColor` بثباتٍ على المرجع المحمَّل مسبقاً (D-1276)، ولا يعيده حين يتغيّر
 * اللونُ وحدَه والمصدرُ ثابت. **أندرويد كما هو** — المرجعُ المحمَّل يمنع رمشةَ أوّل دخول (D-1276) ولا عيبَ فيه هناك.
 * ⚠️ مستنتَجٌ من التسجيل والكود لا من جهاز — الحَكَمُ تسجيلٌ بعد التحديث.
 */
const IOS = Platform.OS === "ios";

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  if (IOS) {
    return <Image key={`${name}|${color}`} source={ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
  }
  return <Image source={warm.get(name) ?? ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}
