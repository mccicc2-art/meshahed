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
  // حدُّ النواة المشتركة (Phase 9 §5.2 — الخطوة 1 من ترتيب البناء):
  // هذه الملفّات هي ما سيشاركه تطبيقُ Expo مع الويب كما هو. لا يجوز أن تستورد
  // شيئاً من Next أو DOM أو عميلِ الخادم أو المكوّنات أو ملفّات lib الواقفة
  // خلف الـAPI — وإلا تسرّبت التبعيّةُ بصمت ولم نكتشفها إلا يومَ نُحاول
  // تجميعها لـReact Native. القاعدة تُثبِت الحدَّ آليّاً من اليوم بلا نقلِ ملفّ
  // (النقلُ الفعليّ إلى packages/core مع خطوة workspaces).
  // استيرادُ الأنواع فقط مسموح (allowTypeImports): يُمحى عند التجميع ولا
  // يحمل كوداً؛ وتبقى ثمانيةُ ملفّات بأنواعٍ من data/tmdb تُفصَل لاحقاً.
  {
    files: [
      "src/lib/anilist.ts",
      "src/lib/arabic.ts",
      "src/lib/autoGroups.ts",
      "src/lib/awards.ts",
      "src/lib/awardsWins.ts",
      "src/lib/browse.ts",
      "src/lib/bulletinLine.ts",
      "src/lib/calendar.ts",
      "src/lib/cardCount.ts",
      "src/lib/chartFloor.ts",
      "src/lib/chromeRules.ts",
      "src/lib/contentPrefs.ts",
      "src/lib/density.ts",
      "src/lib/dir.ts",
      "src/lib/famousLists.ts",
      "src/lib/features.ts",
      "src/lib/fontPrefs.ts",
      "src/lib/heroPosters.ts",
      "src/lib/homePrefs.ts",
      "src/lib/i18n.ts",
      "src/lib/imageLoader.ts",
      "src/lib/imdbOverrides.ts",
      "src/lib/importParse.ts",
      "src/lib/importer.ts",
      "src/lib/intent.ts",
      "src/lib/keys.ts",
      "src/lib/letterboxd.ts",
      "src/lib/libraryStatus.ts",
      "src/lib/loopz.ts",
      "src/lib/media.ts",
      "src/lib/myRows.ts",
      "src/lib/nationality.ts",
      "src/lib/newsLine.ts",
      "src/lib/people.ts",
      "src/lib/plan.ts",
      "src/lib/playback.ts",
      "src/lib/postKeys.ts",
      "src/lib/prefTemplates.ts",
      "src/lib/profilePrefs.ts",
      "src/lib/progress.ts",
      "src/lib/providerLinks.ts",
      "src/lib/railPrefs.ts",
      "src/lib/ratelimit.ts",
      "src/lib/recommend.ts",
      "src/lib/refresh.ts",
      "src/lib/region.ts",
      "src/lib/savedFilters.ts",
      "src/lib/searchTypes.ts",
      "src/lib/sessionCookie.ts",
      "src/lib/siteOrigin.ts",
      "src/lib/smartListKeys.ts",
      "src/lib/socials.ts",
      "src/lib/statsFormat.ts",
      "src/lib/tabDrag.ts",
      "src/lib/tabPrefs.ts",
      "src/lib/tasteMatch.ts",
      "src/lib/themes.ts",
      "src/lib/titleMode.ts",
      "src/lib/trackerExport.ts",
      "src/lib/trailerProviders.ts",
      "src/lib/trailerTabs.ts",
      "src/lib/tvtime.ts",
      "src/lib/universes.ts",
      "src/lib/useBeforePaint.ts",
      "src/lib/validate.ts",
      "src/lib/watchTime.ts",
      "src/lib/when.ts",
      "src/lib/wikidata.ts",
      "src/lib/zone.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              allowTypeImports: true,
              group: [
                "next", "next/*", "react-dom", "react-dom/*", "server-only",
                "@/components/*", "@/app/*", "@/lib/supabase/*", "./supabase/*",
              ],
              message: "core boundary: shared logic must not depend on Next, DOM, the server client or components (Phase 9 §5.2).",
            },
            {
              allowTypeImports: true,
              group: [
      "@/lib/actions", "./actions",
      "@/lib/ai", "./ai",
      "@/lib/artists", "./artists",
      "@/lib/data", "./data",
      "@/lib/gif", "./gif",
      "@/lib/haptics", "./haptics",
      "@/lib/imageFile", "./imageFile",
      "@/lib/imdbChart", "./imdbChart",
      "@/lib/libState", "./libState",
      "@/lib/librarySmart", "./librarySmart",
      "@/lib/locale", "./locale",
      "@/lib/localize", "./localize",
      "@/lib/loginGate", "./loginGate",
      "@/lib/loopzNews", "./loopzNews",
      "@/lib/myActivity", "./myActivity",
      "@/lib/news", "./news",
      "@/lib/newsReports", "./newsReports",
      "@/lib/offline", "./offline",
      "@/lib/og", "./og",
      "@/lib/omdb", "./omdb",
      "@/lib/periodStats", "./periodStats",
      "@/lib/plusGate", "./plusGate",
      "@/lib/prefetchIntent", "./prefetchIntent",
      "@/lib/reports", "./reports",
      "@/lib/sections", "./sections",
      "@/lib/seo", "./seo",
      "@/lib/shareCard", "./shareCard",
      "@/lib/site", "./site",
      "@/lib/smartLists", "./smartLists",
      "@/lib/suggest", "./suggest",
      "@/lib/talkBulletins", "./talkBulletins",
      "@/lib/titleAliases", "./titleAliases",
      "@/lib/titleNews", "./titleNews",
      "@/lib/tmdb", "./tmdb",
      "@/lib/toast", "./toast",
      "@/lib/topChart", "./topChart",
      "@/lib/tour", "./tour",
      "@/lib/trailerCard", "./trailerCard",
      "@/lib/trailerPrefs", "./trailerPrefs",
      "@/lib/trailers", "./trailers",
      "@/lib/trakt", "./trakt",
      "@/lib/translate", "./translate",
      "@/lib/uiState", "./uiState",
      "@/lib/useKeyboard", "./useKeyboard",
      "@/lib/usePoll", "./usePoll",
      "@/lib/useScrollMemory", "./useScrollMemory",
      "@/lib/useUiLocale", "./useUiLocale",
      "@/lib/appleTrailers", "./appleTrailers",
      "@/lib/xLink", "./xLink",
              ],
              message: "core boundary: this module stays behind the API (SERVER/REWRITE in Phase 9 §2) — do not import it from shared logic.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
