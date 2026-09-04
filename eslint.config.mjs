import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // سياجُ عميل الخدمة (D-898 · LOOPZ-AUD-0040): `src/lib/supabase/service.ts`
  // يحمل مفتاح service_role الذي يتجاوز RLS. لا يستورده إلا مواضعُ الكتابة
  // المجمَّعة والقياس المعدودة أدناه — استيرادُه من مكوّنٍ أو ملفٍّ مشترك أو
  // مسارٍ آخر يوقف البناء بدل أن يتسرّب المفتاحُ بصمت. الكتلةُ قبل كتلة حدِّ
  // النواة عمداً: الأخيرةُ تحلّ محلَّ خيارات القاعدة نفسِها في ملفّات النواة
  // (لا دمجَ في flat config)، وهي أصلاً تمنع `@/lib/supabase/*` كلَّه هناك.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/supabase/service.ts",
      "src/lib/omdb.ts",
      "src/lib/imdbChart.ts",
      "src/lib/loopzNews.ts",
      "src/lib/newsReports.ts",
      "src/lib/talkBulletins.ts",
      "src/lib/actions.ts",
      "src/app/api/imdb-chart/route.ts",
      "src/app/api/lang-ping/route.ts",
      "src/app/api/trailer-signal/route.ts",
      "src/app/p/[[]code[]]/route.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/service", "**/supabase/service", "**/supabase/service.ts"],
              message:
                "service-role fence (D-898): only the listed bulk-write/telemetry call sites may import the service client — add the file to eslint.config.mjs deliberately, never around it.",
            },
          ],
        },
      ],
    },
  },
  // والمفتاحُ نفسُه يُقرأ في ملفّين لا غير: service.ts وinstrumentation.ts
  // (fetch خامّ قد يجري في Edge). قراءتُه في أيّ موضعٍ آخر خطأُ بناء.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/supabase/service.ts", "src/instrumentation.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message: "service-role fence (D-898): read SUPABASE_SERVICE_ROLE_KEY only in src/lib/supabase/service.ts.",
        },
      ],
    },
  },
  // ====== حدُّ النواة المشتركة (Phase 9 §5.2 — الخطوة ١ من ترتيب البناء) ======
  // `src/core/` هو ما سيشاركه تطبيقُ Expo مع الويب كما هو، **بلا نسخةٍ ثانية**.
  // والحدُّ يُقاس بالمجلَّد لا بقائمةِ أسماء: قائمةُ D-897 كانت تسعةً وستّين سطراً
  // يجب أن يتذكّرها من يضيف ملفاً — **ونسيانُها يفتح البابَ بصمت**؛ أمّا المجلَّد
  // فيحرس نفسَه: أيُّ ملفٍّ يوضع هنا يرث الحدَّ في اللحظة نفسِها.
  //
  // **والمنعُ صار شاملاً لا معدوداً:** كلُّ `@/lib/*` ممنوع — لا قائمةَ ملفّاتٍ
  // خادميّة تُصان. ما يبقى مباحاً: حزمُ npm المحايدة، و`@/core/*`، والجيران.
  // (استيرادُ الأنواع مباح — يُمحى عند التجميع ولا يحمل كوداً — وخمسةُ ملفّاتٍ
  //  لا تزال تأخذ أنواعاً من `data`/`tmdb`، تُفصَل في الخطوة ٢.)
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              allowTypeImports: true,
              group: [
                "next", "next/*", "react-dom", "react-dom/*", "server-only",
                "@/components/*", "@/app/*", "@/lib", "@/lib/*", "../lib/*", "../*",
              ],
              message:
                "core boundary (Phase 9 §5.2): src/core is what Expo shares as-is — it must not reach Next, the DOM, components, or anything under src/lib.",
            },
          ],
        },
      ],
      // **والعوالمُ الأصليّة تُمنع بالاسم**: `window`/`document`/`localStorage`
      // لا وجودَ لها في React Native، **وغيابُها لا يظهر إلا وقتَ التشغيل**
      // على جهازٍ حقيقيّ — فيُقال هنا وقتَ البناء.
      "no-restricted-globals": [
        "error",
        { name: "window", message: "core boundary: no DOM in shared logic (Phase 9 §5.2)." },
        { name: "document", message: "core boundary: no DOM in shared logic (Phase 9 §5.2)." },
        { name: "localStorage", message: "core boundary: use a platform storage adapter, not localStorage." },
        { name: "sessionStorage", message: "core boundary: use a platform storage adapter, not sessionStorage." },
        { name: "navigator", message: "core boundary: no DOM in shared logic (Phase 9 §5.2)." },
      ],
    },
  },
]);

export default eslintConfig;
