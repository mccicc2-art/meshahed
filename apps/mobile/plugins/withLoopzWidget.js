const { withAndroidManifest, withAppBuildGradle, withDangerousMod, AndroidConfig, IOSConfig } = require("expo/config-plugins");
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
const ICONS = { widget_ic_check: "check.png", widget_ic_repeat: "repeat.png", widget_ic_play: "play.png", widget_ic_search: "search.png", widget_ic_lock: "lock.png", widget_ic_undo: "undo.png", widget_ic_star: "star-filled.png", widget_ic_star_off: "star.png" };

/* 🆕 الودجت الواحد (W28): مزوّدٌ واحد — `LoopzWidget` باسم المتوسط القديم (D-929)، والبقيّةُ أُزيلت («٢ ب»: تُوضع من جديد) */
const PROVIDERS = [{ name: ".widget.LoopzWidget", label: "@string/w2_name", info: "@xml/loopz_widget_info" }];
/* المزوّدون القدامى يُمحَون من البيان إن بقي لهم أثرٌ في بناءٍ سابق */
const REMOVED = [".widget.ContinueSmallWidget", ".widget.ContinueLargeWidget", ".widget.ComingUpWidget", ".widget.TonightSmallWidget"];

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
    app.receiver = app.receiver.filter((r) => !REMOVED.includes(r.$?.["android:name"]));
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

    /* 🆕 نداءُ أفعال الودجت مهمّةً مستعجلة (أندرويد يقطع الشبكةَ عن المستقبِل في الخلفيّة) — لا يصلها إلّا النظام */
    const job = ".widget.WidgetJobService";
    app.service = (app.service ?? []).filter((x) => x.$?.["android:name"] !== job);
    app.service.push({ $: { "android:name": job, "android:permission": "android.permission.BIND_JOB_SERVICE", "android:exported": "false" } });

    /*
     * 🆕 1.12.7 — **إشعارُ الرسالة بزرّيه والتطبيقُ مقفول** (`DmPush.kt`): خدمتُنا ترث خدمةَ Expo وتحلّ محلَّها — أندرويد يسلّم
     * رسائلَ Firebase لخدمةٍ واحدة، فمدخلُ Expo (من بيان المكتبة، يُدمج وقتَ البناء) يُزال هنا صراحةً (`tools:node="remove"`)
     * لا يُترك لأولويّةٍ قد يحسمها النظامُ بغير ما نريد. وكلُّ ما ليس رسالةً يمرّ منها إلى Expo كما كان.
     */
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, "xmlns:tools": "http://schemas.android.com/tools" };
    const EXPO_FCM = "expo.modules.notifications.service.ExpoFirebaseMessagingService";
    const fcm = ".widget.LoopzMessagingService";
    app.service = app.service.filter((x) => ![EXPO_FCM, fcm].includes(x.$?.["android:name"]));
    app.service.push({ $: { "android:name": EXPO_FCM, "tools:node": "remove" } });
    app.service.push({
      $: { "android:name": fcm, "android:exported": "false" },
      "intent-filter": [{ action: [{ $: { "android:name": "com.google.firebase.MESSAGING_EVENT" } }] }],
    });
    /* زرّا «رد» و«تمييز كمقروءة» — غيرُ مُصدَّر كمستقبِل ✓: لا تصله إلّا نيّةٌ معلّقةٌ صنعها التطبيق */
    const dmReceiver = ".widget.DmActionReceiver";
    app.receiver = app.receiver.filter((r) => r.$?.["android:name"] !== dmReceiver);
    app.receiver.push({ $: { "android:name": dmReceiver, "android:exported": "false" } });

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

/**
 * 🆕 1.12.7 — `LoopzMessagingService` يرث خدمةَ Expo، وصنفُها الأبُ (`FirebaseMessagingService`) في مكتبة Firebase التي تضمّها
 * expo-notifications **لنفسها** (`implementation`) فلا يراها كودُ التطبيق عند الترجمة. تُضاف هنا **بنسخة expo-notifications
 * نفسِها** (تُقرأ من ملفّها وقتَ التوليد) — فلا نسختان من Firebase في بناءٍ واحد.
 */
function firebaseMessagingVersion(projectRoot) {
  try {
    const gradle = path.join(path.dirname(require.resolve("expo-notifications/package.json", { paths: [projectRoot] })), "android", "build.gradle");
    const m = /com\.google\.firebase:firebase-messaging:([0-9][0-9.]*)/.exec(fs.readFileSync(gradle, "utf8"));
    if (m) return m[1];
  } catch {
    /* المكتبةُ في غير مكانها المعتاد — النسخةُ المعروفة أدناه */
  }
  return "25.0.1";
}

const withMessagingDependency = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const line = `    implementation("com.google.firebase:firebase-messaging:${firebaseMessagingVersion(cfg.modRequest.projectRoot)}") // loopz-dm-native`;
    let src = cfg.modResults.contents.replace(/^.*\/\/ loopz-dm-native\s*$\n?/m, "");
    if (!/^dependencies\s*\{/m.test(src)) throw new Error("withLoopzWidget: no dependencies block in app/build.gradle");
    src = src.replace(/^dependencies\s*\{/m, (m) => `${m}\n${line}`);
    cfg.modResults.contents = src;
    return cfg;
  });

/**
 * 🆕 D-1500 — **«ابحث في Loopz» في Spotlight** يُنسخ إلى هدف التطبيق نفسِه: النظامُ لا يقرأ اختصاراتِ التطبيق إلّا منه.
 * المصدرُ في `modules/loopz-widget/ios/app/` (لا هنا) لأنّ بصمةَ الآيفون تقرأ ذلك المجلّد — فتعديلُ الملفّ يبني الآيفون،
 * والجسرُ يستثنيه من ترجمته (`exclude_files`).
 */
const withSearchShortcut = (config) =>
  IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: "LoopzSearchIntent.swift",
    contents: fs.readFileSync(path.join(__dirname, "..", "modules", "loopz-widget", "ios", "app", "LoopzSearchIntent.swift"), "utf8"),
    overwrite: true,
  });

module.exports = (config) => withSearchShortcut(withMessagingDependency(withWidgetManifest(withWidgetFiles(config))));
