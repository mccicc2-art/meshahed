const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * 🆕 **ودجتاتُ لوبز في أندرويد** (D-929 ثمّ خطّةُ الودجتات، ١٣ أكتوبر) — إضافةُ إعدادٍ لأنّ المشروع بلا مجلَّد
 * `android/` (CNG): كلُّ ما هو أصليٌّ يُحقن هنا أو لا يوجد.
 *
 * 🔑 **والكتابةُ صارت جسراً** (`modules/loopz-widget`): الملفُّ والملصقاتُ في `files/widget/` تُكتب بالذرّة، والجسرُ
 * يرسل بثَّ التحديث للمزوّدين بأسمائهم أدناه — **فالقائمتان (هنا وفي `LoopzWidgetModule.kt`) يجب أن تتطابقا.**
 *
 * 🔴 **ولا يُنسخ `values/strings.xml`**: البناءُ يولّده وفيه `app_name` — نصوصُ الودجت في ملفٍّ باسمه
 * (`loopz_widget_strings.xml`)، بالعربيّة والإنجليزيّة، فلا يُمحى شيء.
 */
const PKG_DIR = path.join("com", "loopztv", "app", "widget");

/** الأيقوناتُ من مجموعة التطبيق الواحدة (`assets/icons`) لا رسمٌ ثانٍ لها (القاعدة ٣) */
const ICONS = { widget_ic_check: "check.png", widget_ic_repeat: "repeat.png" };

const PROVIDERS = [
  { name: ".widget.LoopzWidget", label: "@string/w_continue_name", info: "@xml/loopz_widget_info" },
  { name: ".widget.ContinueSmallWidget", label: "@string/w_continue_name", info: "@xml/loopz_w_continue_s_info" },
  { name: ".widget.ContinueLargeWidget", label: "@string/w_continue_name", info: "@xml/loopz_w_continue_l_info" },
  { name: ".widget.ComingUpWidget", label: "@string/w_comingup_name", info: "@xml/loopz_w_comingup_info" },
  { name: ".widget.TonightSmallWidget", label: "@string/w_tonight_name", info: "@xml/loopz_w_tonight_s_info" },
  { name: ".widget.TonightMediumWidget", label: "@string/w_tonight_name", info: "@xml/loopz_w_tonight_m_info" },
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/** نسخُ كوتلن والموارد والأيقونات إلى مشروع أندرويد المولَّد */
const withWidgetFiles = (config) =>
  withDangerousMod(config, [
    "android",
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const project = cfg.modRequest.projectRoot;
      const src = path.join(project, "widget");
      const main = path.join(root, "app", "src", "main");

      const kotlinOut = path.join(main, "java", PKG_DIR);
      fs.mkdirSync(kotlinOut, { recursive: true });
      for (const f of fs.readdirSync(path.join(src, "kotlin"))) {
        if (f.endsWith(".kt")) fs.copyFileSync(path.join(src, "kotlin", f), path.join(kotlinOut, f));
      }
      copyDir(path.join(src, "res"), path.join(main, "res"));
      const drawable = path.join(main, "res", "drawable");
      fs.mkdirSync(drawable, { recursive: true });
      for (const [name, file] of Object.entries(ICONS)) {
        fs.copyFileSync(path.join(project, "assets", "icons", file), path.join(drawable, `${name}.png`));
      }
      return cfg;
    },
  ]);

/**
 * تسجيلُ المزوّدين والمستقبِل وشاشة الضبط في البيان.
 * ⚠️ **و`android:exported="true"` إلزاميٌّ للمزوّدين**: مُشغِّلُ الشاشة عمليّةٌ أخرى، ومستقبِلُ ودجتٍ غيرُ مُصدَّرٍ لا يصله
 * بثُّ التحديث فتبقى الودجت بيضاء. **ومستقبِلُ ✓ غيرُ مُصدَّر**: لا يصله إلّا نيّةٌ معلّقةٌ صنعها التطبيقُ نفسُه.
 */
const withWidgetManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = app.receiver ?? [];
    app.activity = app.activity ?? [];
    for (const p of PROVIDERS) {
      app.receiver = app.receiver.filter((r) => r.$?.["android:name"] !== p.name);
      app.receiver.push({
        $: { "android:name": p.name, "android:exported": "true", "android:label": p.label },
        "intent-filter": [{ action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] }],
        "meta-data": [{ $: { "android:name": "android.appwidget.provider", "android:resource": p.info } }],
      });
    }
    const check = ".widget.CheckReceiver";
    app.receiver = app.receiver.filter((r) => r.$?.["android:name"] !== check);
    app.receiver.push({ $: { "android:name": check, "android:exported": "false" } });

    const cfgName = ".widget.WidgetConfigureActivity";
    app.activity = app.activity.filter((a) => a.$?.["android:name"] !== cfgName);
    app.activity.push({
      $: {
        "android:name": cfgName,
        "android:exported": "true",
        "android:theme": "@android:style/Theme.DeviceDefault.Dialog.NoActionBar",
        "android:excludeFromRecents": "true",
        "android:taskAffinity": "",
      },
      "intent-filter": [{ action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_CONFIGURE" } }] }],
    });
    return cfg;
  });

module.exports = (config) => withWidgetManifest(withWidgetFiles(config));
