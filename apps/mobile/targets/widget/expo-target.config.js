/**
 * 🆕 ملحقُ ودجتات iOS (خطّةُ الودجتات) — `@bacons/apple-targets` يولّده في كلِّ prebuild من هذا المجلّد.
 *
 * 🔑 **مجموعةُ التطبيقات نفسُها** (`group.com.loopztv.app`): التطبيقُ يكتب `widget/feed.json` والملصقاتِ فيها والملحقُ
 * يقرأ — عمليّتان لا تتشاركان إلّا الحاوية. **والمعرّفُ `com.loopztv.app.widget`** يحتاج App Group مفعّلةً عليه في
 * حساب Apple قبل البناء (الخطّة §5).
 *
 * ⚠️ **iOS 17**: الضبطُ بـ AppIntent وأزرارُ الودجت («فيلم آخر» و✓) لا تعمل قبله — جهازٌ أقدم لا يرى الودجتات.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: "widget",
  name: "LoopzWidgets",
  displayName: "Loopz",
  bundleIdentifier: ".widget",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "AppIntents"],
  colors: {
    $accent: "#FFD400",
    $widgetBackground: "#050505",
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
