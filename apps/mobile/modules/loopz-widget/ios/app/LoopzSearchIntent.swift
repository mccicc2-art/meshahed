import AppIntents
import Foundation

/**
 * ====== 🆕 D-1500 — البحثُ من Spotlight (طلبُ أحمد ٢١ أكتوبر: «البحث يكون في spotlight») ======
 *
 * ⚠️ **هذا الملفُّ لا يُترجم في وحدة الجسر**: `withLoopzWidget.js` ينسخه إلى هدف التطبيق نفسِه (`podspec` يستثنيه) — اختصاراتُ
 * التطبيق (`AppShortcutsProvider`) لا يقرؤها النظامُ إلّا من هدف التطبيق، ووحدةٌ ساكنةٌ في CocoaPods لا تُفهرس.
 * وبقي هنا (تحت `modules/loopz-widget/ios`) لأنّ بصمةَ الآيفون تقرأ هذا المجلّدَ — تعديلُه يبني الآيفون وحدَه.
 *
 * 🔑 **الودجتُ لا يقبل كتابة** (آبل: أزرارٌ ومفاتيحُ وروابطُ فقط) — فالكتابةُ في Spotlight أو Siri أو زرّ الأكشن: «ابحث في
 * Loopz» يسأل عن النصّ ثمّ يفتح التطبيقَ على نتائجه. **والطريقُ إلى الشاشة طريقُ الودجت نفسُه**: رابطُ `w/search?q=` يُحفظ
 * ويُنبَّه الجسرُ (`LoopzWidgetModule` · `takeLink`) — و`WidgetGate` ينفّذه بعد أن يُدفع الجذرُ، بارداً كان التطبيقُ أو مفتوحاً.
 *
 * ⚖️ **العنوانُ عربيٌّ بلا ترجمة**: هدفُ التطبيق بلا `ar.lproj` عمداً (إضافتُه تغيّر لغةَ واجهات النظام في التطبيق كلِّه)
 * — والتطبيقُ عربيٌّ أوّلاً. العباراتُ بالعربيّة والإنجليزيّة لـSiri.
 */
@available(iOS 17.0, *)
struct LoopzSearchIntent: AppIntent {
  static let title: LocalizedStringResource = "ابحث في Loopz"
  static let description = IntentDescription("ابحث عن مسلسل أو فيلم أو أنمي في Loopz")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "البحث", requestValueDialog: IntentDialog("وش تبغى تدوّر؟"))
  var query: String

  init() {}

  @MainActor
  func perform() async throws -> some IntentResult {
    let q = String(query.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
    var c = URLComponents()
    c.scheme = "com.loopztv.app"
    c.host = "w"
    c.path = "/search"
    if !q.isEmpty { c.queryItems = [URLQueryItem(name: "q", value: q)] }
    if let link = c.url?.absoluteString {
      /* الوقتُ معه: رابطٌ لم يُؤخذ خلال دقيقة (التطبيقُ أُغلق قبل أن يقرأه) لا يفتح البحثَ في الإقلاع التالي */
      UserDefaults.standard.set(["url": link, "at": Date().timeIntervalSince1970], forKey: "loopz.pendingLink")
      NotificationCenter.default.post(name: Notification.Name("LoopzPendingLink"), object: nil)
    }
    return .result()
  }
}

@available(iOS 17.0, *)
struct LoopzShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LoopzSearchIntent(),
      phrases: [
        "ابحث في \(.applicationName)",
        "Search \(.applicationName)",
        "Search in \(.applicationName)",
      ],
      shortTitle: "ابحث في Loopz",
      systemImageName: "magnifyingglass"
    )
  }
}
