import AppIntents
import Foundation
import WidgetKit

/* ====== اختيارُ المصدر (W10) — «تعديل الأداة» من النظام ====== */

/** مصدرٌ يُختار: «أكمل المشاهدة» · «للمشاهدة» · قائمةٌ محفوظة — القوائمُ من آخر ما كتبه التطبيق */
struct SourceEntity: AppEntity {
  let id: String
  let name: String

  static let typeDisplayRepresentation: TypeDisplayRepresentation = TypeDisplayRepresentation(name: LocalizedStringResource("source.param"))
  static let defaultQuery = SourceQuery()
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

  static let continueSource = SourceEntity(id: "continue", name: String(localized: "source.continue"))
  static let towatchSource = SourceEntity(id: "towatch", name: String(localized: "source.towatch"))
}

struct SourceQuery: EntityQuery {
  func all() -> [SourceEntity] {
    var out = [SourceEntity.continueSource, SourceEntity.towatchSource]
    if case .ready(let f) = FeedStore.load() {
      out += f.lists.map { SourceEntity(id: "list:\($0.id)", name: $0.name) }
    }
    return out
  }

  func entities(for identifiers: [SourceEntity.ID]) async throws -> [SourceEntity] {
    let a = all()
    return identifiers.compactMap { id in a.first { $0.id == id } }
  }

  func suggestedEntities() async throws -> [SourceEntity] { all() }
  func defaultResult() async -> SourceEntity? { SourceEntity.continueSource }
}

struct ContinueConfigIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "source.title"
  @Parameter(title: "source.param")
  var source: SourceEntity?

  init() {}
}

/* ====== «فيلم آخر ↻» (W12) — يقلّب محلّيّاً بلا شبكةٍ ولا رمز ====== */

struct CycleTonightIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.cycle"
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult {
    let d = FeedStore.defaults
    d?.set((d?.integer(forKey: "tonightIndex") ?? 0) + 1, forKey: "tonightIndex")
    return .result()
  }
}

/* ====== ✓ (W14 — مخفيٌّ حتى الدفعة الثانية) ======
 * 🔑 **رمزٌ خاصٌّ لا جلسة** (`widget/token` في الحاوية): لا يقدر إلّا على «علّم حلقة» و«تراجع عنها».
 * بلا رمزٍ لا شيء — والخادمُ يكتب `check: false` في هذا البناء فالزرُّ لا يُرسم أصلاً. */

enum MarkAPI {
  static let base = "https://loopztv.com"

  static func token() -> String? {
    guard let url = FeedStore.dir()?.appendingPathComponent("token"), let s = try? String(contentsOf: url, encoding: .utf8) else { return nil }
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
  }

  /** الحلقةُ التالية من الردّ تُكتب في الملفّ مكانَ القديمة — `nil` = أنهى المتاح فيخرج من الصفّ */
  static func send(_ path: String, show: Int, season: Int, episode: Int) async -> Bool {
    guard let token = token(), let url = URL(string: base + path) else { return false }
    var req = URLRequest(url: url, timeoutInterval: 8)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["showTmdbId": show, "season": season, "episode": episode])
    guard let (data, res) = try? await URLSession.shared.data(for: req), let http = res as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return false }
    let next = ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["data"] as? [String: Any]
    apply(show: show, next: next?["next"] as? [String: Any])
    return true
  }

  static func apply(show: Int, next: [String: Any]?) {
    guard let url = FeedStore.dir()?.appendingPathComponent("feed.json"),
          let data = try? Data(contentsOf: url),
          var root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          var cont = root["continue"] as? [String: Any],
          let items = cont["items"] as? [[String: Any]] else { return }
    var out: [[String: Any]] = []
    for var it in items {
      if (it["id"] as? Int) != show { out.append(it); continue }
      guard let next else { continue }
      it["season"] = next["season"]
      it["episode"] = next["episode"]
      it["label"] = next["label"]
      out.append(it)
    }
    cont["items"] = out
    root["continue"] = cont
    if let d = try? JSONSerialization.data(withJSONObject: root) { try? d.write(to: url, options: .atomic) }
  }
}

struct MarkEpisodeIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.mark"
  static let isDiscoverable = false
  @Parameter(title: "show") var show: Int
  @Parameter(title: "season") var season: Int
  @Parameter(title: "episode") var episode: Int
  @Parameter(title: "label") var label: String

  init() {}
  init(show: Int, season: Int, episode: Int, label: String) {
    self.show = show
    self.season = season
    self.episode = episode
    self.label = label
  }

  func perform() async throws -> some IntentResult {
    if await MarkAPI.send("/api/v1/widget/mark", show: show, season: season, episode: episode) {
      FeedStore.defaults?.set(["show": show, "season": season, "episode": episode, "label": label, "at": Date().timeIntervalSince1970], forKey: "undoLast")
    }
    return .result()
  }
}

struct UnmarkEpisodeIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.unmark"
  static let isDiscoverable = false
  @Parameter(title: "show") var show: Int
  @Parameter(title: "season") var season: Int
  @Parameter(title: "episode") var episode: Int

  init() {}
  init(show: Int, season: Int, episode: Int) {
    self.show = show
    self.season = season
    self.episode = episode
  }

  func perform() async throws -> some IntentResult {
    if await MarkAPI.send("/api/v1/widget/unmark", show: show, season: season, episode: episode) {
      FeedStore.defaults?.removeObject(forKey: "undoLast")
    }
    return .result()
  }
}

/** «✓ ح٧ · تراجع» — حتى عشر دقائق بعد ✓ */
struct UndoInfo {
  let show: Int, season: Int, episode: Int, label: String

  static func current() -> UndoInfo? {
    guard let d = FeedStore.defaults?.dictionary(forKey: "undoLast"),
          let at = d["at"] as? Double, Date().timeIntervalSince1970 - at < 600,
          let show = d["show"] as? Int, let s = d["season"] as? Int, let e = d["episode"] as? Int else { return nil }
    return UndoInfo(show: show, season: s, episode: e, label: d["label"] as? String ?? "")
  }
}
