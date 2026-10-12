/**
 * D-1375 — **رابطُ العمل يفتح التطبيقَ عند من ثبّته** (قرارُ أحمد «23 أ»، ١٢ أكتوبر).
 *
 * أندرويد وiOS لا يسلّمان رابطَ `https://loopztv.com/...` للتطبيق إلّا إذا أثبت النطاقُ نفسُه أنّ التطبيقَ له: ملفٌّ
 * في `/.well-known/` يسمّي التطبيقَ وبصمتَه، والتطبيقُ يعلن النطاقَ في بنائه (`app.json`). الطرفان معاً، وإلّا
 * فالمتصفّح — بلا خطأٍ ولا رسالة، وهذا ما يجعل الخطأ هنا صامتاً.
 *
 * ⚖️ **صفحاتُ الأعمال وحدها** (`/show/*` · `/movie/*`) — هي ما يُشارك، ولها شاشةٌ أصليّة (`/title/[kind]/[id]`).
 * الأنمي ليس مساراً ثالثاً: هو مسلسلٌ أو فيلمٌ في TMDB، فرابطُه أحدُ الاثنين. بقيّةُ الموقع تبقى في المتصفّح.
 * المساراتُ نفسُها في `apps/mobile/app.json` (`intentFilters`) — تغييرُ أحدهما بلا الآخر يكسر الربطَ بصمت.
 */
export const APP_ID = "com.loopztv.app";
export const APPLE_TEAM_ID = "GZFYZ4FGW4";
export const APP_LINK_PATHS = ["/show/*", "/movie/*"] as const;

/**
 * بصماتُ الشهادتين (SHA-256)، منقولةٌ من Play Console ← توقيع التطبيق (١٢ أكتوبر). ليست سرّاً — تُقرأ من أيِّ APK.
 * - **الأولى: مفتاحُ توقيع Google Play** — هي ما يحمله كلُّ تطبيقٍ ثُبّت من المتجر (Play يعيد التوقيع)، وهي التي
 *   يقترحها Play نفسُه في نصِّ assetlinks. بدونها لا ربط.
 * - **الثانية: مفتاحُ الرفع (EAS)** — لنسخةٍ تُثبَّت خارج المتجر من بناءٍ موقَّعٍ به؛ لا تضرّ وجودَها.
 * 🔴 تغيّر المفتاحُ في Play («تغيير المفتاح») ⇒ تُحدَّث هنا، وإلّا يرجع كلُّ رابطٍ إلى المتصفّح بصمت.
 */
export const ANDROID_CERT_SHA256: readonly string[] = [
  "EA:05:94:86:77:A8:9C:6D:AF:FA:B0:CA:09:54:73:0F:80:8E:82:44:FD:59:83:04:BC:50:D2:17:DB:12:9A:02",
  "66:1D:5D:33:FC:68:9F:F6:65:20:BB:EE:BF:FC:F8:5C:88:34:B1:B5:2F:EA:F0:07:16:52:6F:93:C3:FC:7E:4C",
];

export function assetLinks() {
  if (ANDROID_CERT_SHA256.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_ID,
        sha256_cert_fingerprints: [...ANDROID_CERT_SHA256],
      },
    },
  ];
}

export function appleAppSiteAssociation() {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${APPLE_TEAM_ID}.${APP_ID}`],
          components: APP_LINK_PATHS.map((p) => ({ "/": p })),
        },
      ],
    },
  };
}
