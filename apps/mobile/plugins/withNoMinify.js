const { withGradleProperties } = require("expo/config-plugins");

/**
 * 🆕 D-1557 — **R8 مطفأٌ في نسخة الأندرويد** (Expo SDK 58 يشغّله افتراضياً في قالب `gradle.properties`).
 * R8 يضغط الكود ويغيّر أسماءَ الأصناف، وعندنا ما يعتمد على الأسماء: مزوّدو الودجت (`AppWidgetProvider` بأسمائهم
 * في البيان وفي `LoopzWidgetModule.kt`) والدخولُ الأصليّ بقوقل. ترقيةُ الـSDK مخاطرةٌ كافيةٌ وحدها —
 * فنطفئه هنا ونجرّبه لاحقاً في إصدارٍ مستقلّ مع قواعد `proguard-rules.pro` إن احتجنا. حذفُ هذا الملحق = تشغيله.
 */
module.exports = function withNoMinify(config) {
  return withGradleProperties(config, (cfg) => {
    const key = "android.enableMinifyInReleaseBuilds";
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === "property" && p.key === key));
    cfg.modResults.push({ type: "property", key, value: "false" });
    return cfg;
  });
};
