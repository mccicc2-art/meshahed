// تفضيلاتُ التبويبات — الترتيب والإظهار معاً، في مكانٍ واحد.
// آمن للاستيراد في الخادم والمتصفح: لا `next/headers` ولا `use server`.

/**
 * **حقيقةٌ واحدة لمحورين** (طلب أحمد ١١ أغسطس: «حطّ إمكانية أغيّر موقع
 * التيوب… حتى في الديسكفري والمكتبة حطّ خيار الإخفاء»).
 *
 * الترتيبُ هو ترتيبُ القائمة، والإخفاءُ علامةُ `-` على العنصر. فصفٌّ واحد
 * في كوكيٍّ واحد يحمل المحورين — ولا يفترقان فيختلفان:
 *
 * ```
 * loopz_tabs_community = mine,all,-inbox,news
 * ```
 *
 * **ولماذا كوكي لا عمود** (D-014، نفسُ حجّة `setWatchRegion` حرفاً بحرف):
 * تفضيلُ عرضٍ يقرؤه الخادم **قبل أوّل رسمة**، فلا يومض تبويبٌ ثم يختفي أو
 * يقفز إلى مكانه الصحيح. ولا يستحقّ هجرةً ولا صفّاً.
 *
 * **والترتيبُ والظهور محورانِ مستقلّان:** التبويب المُعاد تشغيلُه يرجع إلى
 * موضعه المحفوظ لا إلى الذيل. **وفعلٌ يُغيّر شيئين معاً يفاجئ صاحبه** —
 * من أعاد تبويباً فوجده في غير مكانه لا يثق بالمفتاح مرّةً أخرى. (وهذا هو
 * سببُ رفض «إذا طفّيته ينزل، وإذا شغّلته يكون الأخير» — كان يجعل الترتيب
 * أثراً جانبياً للإخفاء، فلا تُقدَّم «الأخبار» إلا بإطفاء الثلاثة وتشغيلها
 * بالترتيب.)
 */

export type TabSurface = "community" | "discover" | "library";

/** تبويبٌ في التفضيلات: مفتاحُه وحالتُه. الترتيبُ هو ترتيب المصفوفة. */
export type TabPref = { key: string; hidden: boolean };

type SurfaceSpec = {
  cookie: string;
  /** الترتيب الافتراضي — ونقطةُ الحقيقة لأيّ مفتاحٍ معروف */
  tabs: { key: string; hiddenByDefault?: boolean }[];
  /**
   * كوكي D-177 القديم (قائمةُ مخفيّاتٍ بلا ترتيب) — يُقرأ حين لا يوجد
   * الجديد، فلا يخسر من أخفى تبويباً أمسِ اختيارَه اليوم.
   */
  legacyHiddenCookie?: string;
};

export const TAB_SURFACES: Record<TabSurface, SurfaceSpec> = {
  community: {
    cookie: "loopz_tabs_community",
    /* **«المراجعات» بجانب «النشاط»** (طلب أحمد ١٢ أغسطس): الرأيُ المكتوب
       غادر خطَّ النشاط إلى تبويبه. وموضعُه هنا يخصّ الحسابات الجديدة
       وحدها — **ومن عنده كوكي يجده في الذيل** بحكم القارئ المتسامح
       (D-179)، ولا هجرةَ ولا كسرَ لترتيبٍ اختاره أحد. */
    /* **ثلاثةٌ بعد أن كانت خمسة (D-187).**
       «الرسائل» غادرت إلى الترويسة بجانب الجرس: الرسالةُ تُفتح حين تصل
       لا حين تتصفّح، **وشارتُها كانت تزاحم معنى شارة المجتمع** — نقطةٌ
       تعني ثلاثة أشياء لا تعني شيئاً.
       و«النشاط» حُذف: ما انفرد به «شاهد» و«قيّم بلا نصّ» — أضعفُ إشارةٍ
       عندنا — والرأيُ المكتوب صار له بيتٌ أفضل. **وتبويبٌ لا يعرف صاحبُه
       لماذا يفتحه يُحذف لا يُجمَّل** (قرار أحمد).
       و«المراجعات» صارت «الأعمال»: الصفُّ عملٌ لا رأي، وتحته آخرُ رأيين.
       **والمفاتيح المحذوفة تسقط من كوكي من عنده بلا هجرة** — القارئ
       المتسامح يتجاهل ما لا يعرفه (D-179). */
    /* **ثلاثةٌ بأسمائها الجديدة (D-219):** تعليقات · نقاش · خبر.
       **و«الأعمال» صارت `talk`، و«المجتمعات» (`all`) خرجت من الصفّ** —
       تُفتح بالرابط من صفحة العمل ولا شريحةَ لها.

       ⚠️ **وهذا السطرُ نقطةُ الحقيقة للترتيب وللافتراض معاً، لا صفُّ
       الشرائح في الصفحة.** نُسي في أوّل شحنةٍ لـD-219 **فوقع عطلٌ ظاهر
       كشفه أوّلُ فحصٍ حيّ**: المفتاحان الجديدان مجهولان هنا فألحقهما
       القارئُ المتسامح بالذيل (**خبر · تعليقات · نقاش**)، **وأعاد
       `defaultTab` مفتاحاً محذوفاً** (`works`) فانفتحت الصفحة على «نقاش»
       لا «تعليقات». **وتبويبٌ يُعاد تسميته يُعاد تسميتُه في مكانين.**

       **والمفاتيح المحذوفة تسقط من كوكي من عنده بلا هجرة** — القارئ
       المتسامح يتجاهل ما لا يعرفه ويُلحق الناقص بالذيل (D-179). */
    tabs: [{ key: "comments" }, { key: "talk" }, { key: "news" }],
    legacyHiddenCookie: "loopz_ctabs_hidden",
  },
  /* **الأفلام أوّلاً ثم المسلسلات** — رجوعٌ إلى الترتيب الأصليّ بطلب أحمد
     (١٢ أغسطس)، بعد أن عُكس في ١١ أغسطس بطلبه أيضاً. في اكتشف والمكتبة
     معاً، فلا تختلف الصفحتان في ترتيبٍ واحد.
     **وهذا ترتيبُ الافتراض لا أمرٌ نهائيّ:** من رتّبها بنفسه يبقى على
     ترتيبه، لأن القارئ يقرأ الكوكي قبل أن يقرأ هذه القائمة —
     **فمن عكسها بيده لن يرى هذا الرجوع**، ويعيدها بسهمين. */
  discover: {
    cookie: "loopz_tabs_discover",
    tabs: [{ key: "movies" }, { key: "shows" }, { key: "anime" }, { key: "lists" }],
  },
  library: {
    cookie: "loopz_tabs_library",
    /* **والأنمي في الذيل عمداً** (D-182): القارئ المتسامح يُلحق كلَّ
       مفتاحٍ ناقصٍ بذيل الكوكي القديم، فمن رتّب تبويباته أمس يجد الجديد
       آخرَها لا مقحماً في وسط ترتيبه. ومن أراده أوّلاً حرّكه بسهمين. */
    tabs: [
      { key: "movies" },
      { key: "shows" },
      { key: "anime" },
      /* **مخفيٌّ افتراضاً للحسابات الجديدة** (طلب أحمد ١٢ أغسطس): متابعةُ
         الفنّانين عادةٌ يبنيها من يريدها، **وتبويبٌ فارغٌ في صفٍّ من خمسة
         يأكل عرضاً ولا يجيب سؤالاً**. ومن يحتاجه يشغّله من ورقة الأدوات.
         **ولا يمسّ من عنده كوكي**: القارئ يقرأ اختياره أوّلاً، والافتراضُ
         لا يُطبَّق إلا على مفتاحٍ لم يُذكر فيه (D-179). */
      { key: "artists", hiddenByDefault: true },
      { key: "lists" },
    ],
  },
};

export function surfaceCookie(surface: TabSurface): string {
  return TAB_SURFACES[surface].cookie;
}

export function isTabSurface(v: string): v is TabSurface {
  return v === "community" || v === "discover" || v === "library";
}

/**
 * **قارئٌ متسامح — وهو ما يجعل الميزة تعيش بعد أوّل تبويبٍ جديد.**
 *
 * أيُّ مفتاحٍ مجهولٍ يسقط (كوكي قديمٌ أو محرَّرٌ بيد)، وأيُّ مفتاحٍ ناقصٍ
 * **يُلحَق بالذيل بحالته الافتراضية**. فإضافةُ تبويبٍ غداً لا تكسر كوكي
 * أحد، **ولا تحتاج هجرةً ولا كتابةً في متصفّح كل مستخدم**.
 *
 * **والحارس هنا أيضاً:** لو خرج الكوكي وكلُّ تبويباته مخفيّة (تحريرٌ بيد،
 * أو تبويبٌ حُذف من التطبيق فبقي الظاهرُ الوحيد في كوكيٍّ قديم) يعود
 * الأوّلُ ظاهراً. **صفحةٌ بلا تبويبٍ واحد صفحةٌ بلا باب.**
 */
export function parseTabPrefs(
  surface: TabSurface,
  raw: string | undefined | null,
  legacyHidden?: string | undefined | null,
): TabPref[] {
  const spec = TAB_SURFACES[surface];
  const known = new Map(spec.tabs.map((x) => [x.key, x]));
  const out: TabPref[] = [];
  const seen = new Set<string>();

  for (const piece of (raw ?? "").split(",")) {
    const token = piece.trim();
    if (!token) continue;
    const hidden = token.startsWith("-");
    const key = hidden ? token.slice(1) : token;
    if (!known.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, hidden });
  }

  /* لا كوكي جديد بعد: تُقرأ قائمةُ D-177 المخفيّة مرّةً كترقيةٍ صامتة */
  const legacy = out.length === 0 && spec.legacyHiddenCookie
    ? new Set(
        (legacyHidden ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  for (const tab of spec.tabs) {
    if (seen.has(tab.key)) continue;
    out.push({
      key: tab.key,
      hidden: legacy ? legacy.has(tab.key) : tab.hiddenByDefault === true,
    });
  }

  return guardLastVisible(out);
}

/** آخرُ تبويبٍ ظاهر لا يُخفى — يُطبَّق على القارئ والكاتب معاً */
export function guardLastVisible(prefs: TabPref[]): TabPref[] {
  if (prefs.length === 0) return prefs;
  if (prefs.some((x) => !x.hidden)) return prefs;
  return prefs.map((x, i) => (i === 0 ? { ...x, hidden: false } : x));
}

export function serializeTabPrefs(prefs: TabPref[]): string {
  return prefs.map((x) => (x.hidden ? `-${x.key}` : x.key)).join(",");
}

/** كم تبويباً ظاهراً؟ — الواجهة تعطّل المفتاح الأخير قبل أن يُضغط */
export function visibleTabs(prefs: TabPref[]): TabPref[] {
  return prefs.filter((x) => !x.hidden);
}

/* حُذفت `tabPrefsTouched` — كانت تُضيء رمزَ الأدوات حين يخالف الترتيبُ
   الافتراضَ، **وقد نقضها أحمد بنصّه**: «الفلتر المفروض ما يتغيّر لونه إذا
   استخدمته في تغيير التبويب، لأن أنا بغيّرها تغييراً دائماً».
   **والحجّة صحيحة وتستحقّ أن تبقى مكتوبة:** نقطةُ الحالة تقول «هناك شيءٌ
   مفعَّل الآن ويمكن إلغاؤه» — وهي لغةُ الفلاتر. **والتفضيل الدائم ليس
   حالةً تُلغى**، فإضاءتُه تجعل الرمز يصرخ إلى الأبد بعد لمسةٍ واحدة. */

/**
 * نقلُ تبويبٍ خطوةً واحدة. **يتخطّى المخفيّ ولا يعبره:** الترتيب الذي يراه
 * صاحبُه هو ترتيبُ الظاهر، فسهمٌ يبدو أنه لم يفعل شيئاً (لأنه تبادل مع
 * تبويبٍ مخفيّ) عطلٌ في عين من ضغطه.
 */
export function moveTab(prefs: TabPref[], key: string, dir: -1 | 1): TabPref[] {
  const from = prefs.findIndex((x) => x.key === key);
  if (from < 0) return prefs;
  const moving = prefs[from];

  let to = -1;
  if (moving.hidden) {
    /* المخفيّ يتحرّك بين جيرانه المباشرين — لا ظاهرَ يقاس عليه */
    to = from + dir;
  } else {
    for (let i = from + dir; i >= 0 && i < prefs.length; i += dir) {
      if (!prefs[i].hidden) {
        to = i;
        break;
      }
    }
  }
  if (to < 0 || to >= prefs.length) return prefs;

  const next = prefs.slice();
  next.splice(from, 1);
  next.splice(to, 0, moving);
  return next;
}

/** قلبُ ظهورِ تبويب — مع حارس «الأخير لا يُخفى» */
export function toggleTab(prefs: TabPref[], key: string): TabPref[] {
  const target = prefs.find((x) => x.key === key);
  if (!target) return prefs;
  if (!target.hidden && visibleTabs(prefs).length <= 1) return prefs;
  return prefs.map((x) => (x.key === key ? { ...x, hidden: !x.hidden } : x));
}

/**
 * ترتيبُ عناصر الرأس وتصفيتُها بالتفضيلات.
 *
 * **والتبويب المفتوح لا يُخفى من نفسه** (نفس قاعدة D-177): من أخفى تبويباً
 * وهو واقفٌ فيه يبقى يراه حتى يغادره، وإلا اختفت الصفحة تحت قدميه.
 */
export function applyTabPrefs<T extends { key: string }>(
  items: T[],
  prefs: TabPref[],
  active?: string,
): T[] {
  const byKey = new Map(items.map((x) => [x.key, x]));
  const out: T[] = [];
  for (const pref of prefs) {
    const item = byKey.get(pref.key);
    if (!item) continue;
    byKey.delete(pref.key);
    if (pref.hidden && item.key !== active) continue;
    out.push(item);
  }
  /* عنصرٌ في الرأس لا يعرفه هذا السطح (لن يقع، والصمتُ عنه يُخفي عطلاً):
     يبقى في ذيله بدل أن يختفي */
  for (const rest of byKey.values()) out.push(rest);
  return out;
}

/**
 * التبويبُ الذي تفتح عليه الصفحة حين **لا يطلب الرابطُ تبويباً بعينه**.
 *
 * بلا هذا، من أخفى تبويبه الافتراضيّ يفتح الصفحة عليه في كل مرّة (لأن
 * المفتوحَ لا يُخفى من نفسه) — **فيبدو الإخفاء وكأنه لم يعمل**.
 */
export function defaultTab(prefs: TabPref[], fallback: string): string {
  return visibleTabs(prefs)[0]?.key ?? fallback;
}
