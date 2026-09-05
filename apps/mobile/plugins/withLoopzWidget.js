const {
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * 🆕 **ودجتُ «أكمل المشاهدة»** (D-929) — إضافةُ إعدادٍ لأنّ المشروع بلا
 * مجلَّد `android/` (CNG): كلُّ ما هو أصليٌّ يُحقن هنا أو لا يوجد.
 *
 * 🔑 **ولا وحدةَ أصليّةً للكتابة**: جافاسكربت تكتب `documentDirectory/widget.json`
 * وهو نفسُه `context.filesDir/widget.json` في كوتلن — **مسارٌ واحدٌ يغني عن
 * جسر.** فالإضافةُ تنسخ كوتلن والموارد وتسجّل المستقبِل، ولا شيءَ غير ذلك.
 */
const PKG_DIR = path.join("com", "loopztv", "app", "widget");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/** نسخُ كوتلن والموارد إلى مشروع أندرويد المولَّد */
const withWidgetFiles = (config) =>
  withDangerousMod(config, [
    "android",
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const src = path.join(cfg.modRequest.projectRoot, "widget");
      const main = path.join(root, "app", "src", "main");

      const kotlinOut = path.join(main, "java", PKG_DIR);
      fs.mkdirSync(kotlinOut, { recursive: true });
      fs.copyFileSync(
        path.join(src, "kotlin", "LoopzWidget.kt"),
        path.join(kotlinOut, "LoopzWidget.kt"),
      );
      copyDir(path.join(src, "res"), path.join(main, "res"));
      return cfg;
    },
  ]);

/**
 * تسجيلُ المستقبِل في البيان.
 * ⚠️ **و`android:exported="true"` إلزاميّ**: مُشغِّلُ الشاشة عمليّةٌ أخرى،
 * ومستقبِلُ ودجتٍ غيرُ مُصدَّرٍ لا يصله بثُّ التحديث فتبقى الودجت بيضاء.
 */
const withWidgetReceiver = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = app.receiver ?? [];
    const name = ".widget.LoopzWidget";
    if (!app.receiver.some((r) => r.$?.["android:name"] === name)) {
      app.receiver.push({
        $: { "android:name": name, "android:exported": "true", "android:label": "Loopz" },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/loopz_widget_info",
            },
          },
        ],
      });
    }
    return cfg;
  });

/**
 * نصّا الودجت.
 * 🔴 **ولا يُنسخ `values/strings.xml` مع الموارد**: البناءُ يولّده أصلاً وفيه
 * `app_name` — **ونسخُه فوقه يمحو اسمَ التطبيق**. فالإضافةُ تُلحق مفتاحين
 * بالملفِّ المولَّد ولا تكتبه.
 */
const withWidgetStrings = (config) =>
  withStringsXml(config, (cfg) => {
    const add = (name, value) => {
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        [{ _: value, $: { name, translatable: "false" } }],
        cfg.modResults,
      );
    };
    add("widget_title", "أكمل المشاهدة");
    add("widget_empty", "افتح Loopz ليتحدّث الودجت");
    return cfg;
  });

module.exports = (config) =>
  withWidgetStrings(withWidgetReceiver(withWidgetFiles(config)));
