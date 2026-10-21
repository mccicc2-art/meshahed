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

/* ====== 🆕 D-1500 — التقليبُ داخل الودجت (بديلُ التمرير) ======
 * الودجتُ صورةٌ يرسمها النظام: لا سحبَ فيها ولا قائمةَ تتحرّك (طلبُ أحمد ٢١ أكتوبر: «تمرير قائمة للمشاهدة داخل الويدجت»).
 * فكلُّ قسمٍ يزيد على ما يتّسع له يحمل ‹ › — اللمسةُ تحفظ أوّلَ المعروض في الحاوية ويعيد النظامُ الرسمَ فوراً، بلا شبكة
 * ولا فتح للتطبيق. والصفحاتُ تدور: بعد الأخيرة الأولى. ودجتان على الشاشة بالقسم نفسِه يتقلّبان معاً (المفتاحُ اسمُ القسم). */

struct WPager {
  let section: String
  let total: Int
  let per: Int
  let offset: Int
}

enum WPage {
  static func key(_ s: String) -> String { "wPage.\(s)" }

  /** أوّلُ المعروض الآن — على حدّ صفحة، وصفرٌ إن قصرت القائمةُ عنه (خلاصةٌ أحدثُ بأعمالٍ أقلّ) */
  static func offset(_ s: String, total: Int, per: Int) -> Int {
    guard per > 0, total > per else { return 0 }
    let o = FeedStore.defaults?.integer(forKey: key(s)) ?? 0
    return o >= 0 && o < total ? o - o % per : 0
  }

  static func move(_ s: String, step: Int, total: Int, per: Int) {
    guard per > 0, total > per else { return }
    let pages = (total + per - 1) / per
    let cur = offset(s, total: total, per: per) / per
    let next = ((cur + step) % pages + pages) % pages
    FeedStore.defaults?.set(next * per, forKey: key(s))
  }
}

struct PageIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.page"
  static let isDiscoverable = false

  @Parameter(title: "section") var section: String
  @Parameter(title: "step") var step: Int
  @Parameter(title: "total") var total: Int
  @Parameter(title: "per") var per: Int

  init() {}
  init(section: String, step: Int, total: Int, per: Int) {
    self.section = section
    self.step = step
    self.total = total
    self.per = per
  }

  func perform() async throws -> some IntentResult {
    WPage.move(section, step: step, total: total, per: per)
    return .result()
  }
}

/* ====== أفعالُ الودجت برمزه الخاصّ (W14 · W35 · W37 — الدفعةُ الثانية) ======
 * 🔑 **رمزٌ خاصٌّ لا جلسة** (`widget/token` في الحاوية): حلقة · فيلم · «ابدأ» · تقييم، وتراجعُ كلٍّ منها — لا قراءة ولا تجديدَ جلسة.
 * بلا رمزٍ لا شيء: الخادمُ يكتب `check: false` فتبقى اللمسةُ تفتح العمل. */

enum MarkAPI {
  static let base = "https://loopztv.com"

  static func token() -> String? {
    guard let url = FeedStore.dir()?.appendingPathComponent("token"), let s = try? String(contentsOf: url, encoding: .utf8) else { return nil }
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
  }

  /** نداءٌ برمز الودجت — `data` الردّ، أو `nil` لأيِّ فشل. وكلُّ نداءٍ يُكتب في سجلّ التشخيص (`Diag`) */
  static func post(_ path: String, _ body: [String: Any]) async -> [String: Any]? {
    let name = String(path.split(separator: "/").last ?? "")
    guard let token = token() else {
      Diag.add(name, "no_token", nil)
      return nil
    }
    guard let url = URL(string: base + path) else { return nil }
    var req = URLRequest(url: url, timeoutInterval: 8)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    do {
      let (data, res) = try await URLSession.shared.data(for: req)
      let code = (res as? HTTPURLResponse)?.statusCode ?? 0
      Diag.add(name, "http", String(code))
      guard (200..<300).contains(code) else { return nil }
      return ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["data"] as? [String: Any] ?? [:]
    } catch {
      Diag.add(name, "error", String(describing: error).prefix(120).description)
      return nil
    }
  }

  /** ✓ حلقةٍ أو تراجعٌ عنها، والحلقةُ التالية من الردّ تُكتب في الملفّ مكانَ القديمة */
  static func send(_ path: String, show: Int, season: Int, episode: Int) async -> Bool {
    guard let data = await post(path, ["showTmdbId": show, "season": season, "episode": episode]) else { return false }
    apply(show: show, next: data["next"] as? [String: Any])
    return true
  }

  static func apply(show: Int, next: [String: Any]?) {
    guard let url = FeedStore.dir()?.appendingPathComponent("feed.json"),
          let data = try? Data(contentsOf: url),
          var root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          var cont = root["continue"] as? [String: Any],
          let items = cont["items"] as? [[String: Any]] else { return }
    /* ⚠️ التعديلُ المحلّيُّ لا يُعدّ «خلاصةً أحدث» — طابعُ الملفّ يُعاد كما كان فلا يُظهر ما أُخفي */
    let stamp = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date
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
    if let stamp { try? FileManager.default.setAttributes([.modificationDate: stamp], ofItemAtPath: url.path) }
  }
}

/**
 * 🆕 **حالةُ ما بعد اللمسة** (W37 · قرارُ أحمد «١ ب»، ١٤ أكتوبر) — في الحاوية، لكلِّ الودجتات معاً:
 * - `wUndo`: آخرُ فعلٍ و«↶ تراجع» عليه **٥ ثوانٍ**؛ المزوّدُ يطلب خطّاً زمنيّاً جديداً عند انقضائها.
 * - `wHidden`: فيلمٌ شوهد أو مسلسلٌ بدأ — يُخفى من «للمشاهدة» و«فيلم الليلة» حتى يكتب التطبيقُ خلاصةً أحدث (أو يمضي يوم).
 * - `wRate`: شريطُ «قيّم الفيلم» تحت البحث بعد ✓ فيلم — **يبقى حتى يقيّم أو يتخطّى**.
 * ما انقضى من `wUndo` يُعامَل مستقرّاً عند القراءة (`settle`) — فلا يتوقّف شيءٌ على موعد إعادة الرسم.
 */
/**
 * 🆕 سجلُّ لمسات الودجت للتشخيص (`widget/diag.json` في الحاوية، آخرُ ٣٠): ما وصل · لا رمز · ردُّ الخادم · خطأ.
 * التطبيقُ يرسله إلى `runtime_errors` عند فتحه (`sendDiag` في `feed.ts`) ثمّ يفرغه — تسجيلُ أحمد ١٤ أكتوبر.
 */
enum Diag {
  static func add(_ action: String, _ stage: String, _ detail: String?) {
    guard let url = FeedStore.dir()?.appendingPathComponent("diag.json") else { return }
    var arr = ((try? Data(contentsOf: url)).flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [[String: Any]]) ?? []
    var row: [String: Any] = ["t": Int(Date().timeIntervalSince1970), "a": action, "s": stage]
    if let detail { row["d"] = detail }
    arr.append(row)
    if arr.count > 30 { arr = Array(arr.suffix(30)) }
    if let d = try? JSONSerialization.data(withJSONObject: arr) { try? d.write(to: url, options: .atomic) }
  }
}

enum WState {
  static let undoSeconds: TimeInterval = 5
  static let hiddenSeconds: TimeInterval = 24 * 3600

  static func undoRecord() -> [String: Any]? { FeedStore.defaults?.dictionary(forKey: "wUndo") }

  /** الفعلُ الذي عليه «↶ تراجع» عند `now` */
  static func undo(_ now: Date = Date()) -> [String: Any]? {
    guard let o = undoRecord(), let at = o["at"] as? Double else { return nil }
    let limit = (o["pending"] as? Bool == true) ? 20 : undoSeconds + 0.4
    return now.timeIntervalSince1970 - at <= limit ? o : nil
  }

  static func undoOn(_ kind: String, _ id: Int, _ now: Date = Date()) -> Bool {
    guard let o = undo(now) else { return false }
    return o["kind"] as? String == kind && o["id"] as? Int == id
  }

  /** متى ينقضي «↶ تراجع» القائم — ليطلب المزوّدُ رسماً جديداً حينها */
  static func undoEnds() -> Date? {
    guard let o = undoRecord(), let at = o["at"] as? Double else { return nil }
    let end = Date(timeIntervalSince1970: at + undoSeconds + 0.5)
    return end > Date() ? end : nil
  }

  /** 🆕 اللمسةُ تُرى فوراً: «↶ تراجع» معلّقاً حتى يردّ الخادم، ويُرسم قبل الشبكة */
  static func setPending(_ kind: String, _ id: Int) {
    FeedStore.defaults?.removeObject(forKey: "wUndoCancel")
    FeedStore.defaults?.set(["kind": kind, "id": id, "at": Date().timeIntervalSince1970, "pending": true], forKey: "wUndo")
    WidgetCenter.shared.reloadAllTimelines()
  }

  /** الخادمُ لم يقبل: المعلّقُ يزول */
  static func clearPending() {
    if undoRecord()?["pending"] as? Bool == true { FeedStore.defaults?.removeObject(forKey: "wUndo") }
    FeedStore.defaults?.removeObject(forKey: "wUndoCancel")
  }

  /**
   * W44 — «↶ تراجع» لُمس والفعلُ معلّقٌ لم يردّ عليه الخادم: يُرسم ✓ فوراً، ويُحفظ أنّ صاحبه تراجع
   * فيعكسه الفعلُ نفسُه حين يصله الردّ (`takeCancel`) — بدل أن يعود «↶» والفعلُ قائم.
   */
  static func cancelPending() -> Bool {
    guard let o = undoRecord(), o["pending"] as? Bool == true else { return false }
    let c: [String: Any] = ["kind": o["kind"] as? String ?? "", "id": o["id"] as? Int ?? 0]
    FeedStore.defaults?.set(c, forKey: "wUndoCancel")
    FeedStore.defaults?.removeObject(forKey: "wUndo")
    return true
  }

  /** هل تراجع صاحبُ هذا الفعل وهو معلّق؟ — يُقرأ مرّةً ويُمحى */
  static func takeCancel(_ kind: String, _ id: Int) -> Bool {
    guard let c = FeedStore.defaults?.dictionary(forKey: "wUndoCancel") else { return false }
    FeedStore.defaults?.removeObject(forKey: "wUndoCancel")
    return c["kind"] as? String == kind && c["id"] as? Int == id
  }

  static func setUndo(_ o: [String: Any]) {
    var o = o
    o["at"] = Date().timeIntervalSince1970
    FeedStore.defaults?.set(o, forKey: "wUndo")
  }

  /** ما انقضى بلا تراجع: الفيلمُ والمسلسلُ يُخفيان، وشريطُ التقييم للفيلم */
  static func settle() {
    guard let o = undoRecord(), o["pending"] as? Bool != true, let at = o["at"] as? Double, Date().timeIntervalSince1970 - at > undoSeconds else { return }
    let d = FeedStore.defaults
    d?.removeObject(forKey: "wUndo")
    guard let id = o["id"] as? Int else { return }
    switch o["kind"] as? String {
    case "movie":
      hide(id)
      d?.set(["id": id, "title": o["title"] as? String ?? "", "poster": o["poster"] as? String ?? ""], forKey: "wRate")
    case "start":
      hide(id)
    default: break
    }
  }

  static func hide(_ id: Int) {
    let now = Date().timeIntervalSince1970
    var h = (FeedStore.defaults?.dictionary(forKey: "wHidden") as? [String: Double]) ?? [:]
    h = h.filter { now - $0.value < hiddenSeconds }
    h[String(id)] = now
    FeedStore.defaults?.set(h, forKey: "wHidden")
  }

  /** المخفيّ الآن: ما أُخفي بعد آخر خلاصةٍ كتبها التطبيق، وما انقضى تراجعُه ولم يُستقرّ بعد */
  static func hidden() -> Set<Int> {
    settle()
    let now = Date().timeIntervalSince1970
    let url = FeedStore.dir()?.appendingPathComponent("feed.json")
    let feedAt = (url.flatMap { try? FileManager.default.attributesOfItem(atPath: $0.path) }?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
    let h = (FeedStore.defaults?.dictionary(forKey: "wHidden") as? [String: Double]) ?? [:]
    return Set(h.filter { now - $0.value < hiddenSeconds && $0.value > feedAt }.compactMap { Int($0.key) })
  }

  static func rate() -> [String: Any]? {
    settle()
    return FeedStore.defaults?.dictionary(forKey: "wRate")
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
    Diag.add("mark", "tap", nil)
    WState.setPending("ep", show)
    if await MarkAPI.send("/api/v1/widget/mark", show: show, season: season, episode: episode) {
      if WState.takeCancel("ep", show) {
        _ = await MarkAPI.send("/api/v1/widget/unmark", show: show, season: season, episode: episode)
      } else {
        WState.setUndo(["kind": "ep", "id": show, "season": season, "episode": episode])
      }
    } else {
      WState.clearPending()
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
      FeedStore.defaults?.removeObject(forKey: "wUndo")
    }
    return .result()
  }
}

/** 🆕 «✓ شاهدته» لفيلم — العنوانُ والملصقُ لشريط التقييم بعده (W37) */
struct MarkMovieIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.mark"
  static let isDiscoverable = false
  @Parameter(title: "id") var id: Int
  @Parameter(title: "title") var name: String
  @Parameter(title: "poster") var poster: String

  init() {}
  init(id: Int, name: String, poster: String?) {
    self.id = id
    self.name = name
    self.poster = poster ?? ""
  }

  func perform() async throws -> some IntentResult {
    Diag.add("movie", "tap", nil)
    WState.setPending("movie", id)
    if await MarkAPI.post("/api/v1/widget/movie", ["movieTmdbId": id, "watched": true]) != nil {
      if WState.takeCancel("movie", id) {
        _ = await MarkAPI.post("/api/v1/widget/movie", ["movieTmdbId": id, "watched": false])
      } else {
        WState.setUndo(["kind": "movie", "id": id, "title": name, "poster": poster])
      }
    } else {
      WState.clearPending()
    }
    return .result()
  }
}

/** 🆕 «▶ ابدأ» لمسلسلٍ في «للمشاهدة» (W35) */
struct StartShowIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.mark"
  static let isDiscoverable = false
  @Parameter(title: "id") var id: Int

  init() {}
  init(id: Int) { self.id = id }

  func perform() async throws -> some IntentResult {
    Diag.add("start", "tap", nil)
    WState.setPending("start", id)
    if await MarkAPI.post("/api/v1/widget/start", ["showTmdbId": id, "start": true]) != nil {
      if WState.takeCancel("start", id) {
        _ = await MarkAPI.post("/api/v1/widget/start", ["showTmdbId": id, "start": false])
      } else {
        WState.setUndo(["kind": "start", "id": id])
      }
    } else {
      WState.clearPending()
    }
    return .result()
  }
}

/** 🆕 «↶ تراجع» (W37 — ٥ ثوانٍ): الفعلُ المعاكسُ على الخادم، ثمّ الودجتُ كما كان */
struct UndoActionIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.unmark"
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult {
    Diag.add("undo", "tap", nil)
    if WState.cancelPending() { return .result() }
    guard let o = WState.undoRecord(), o["pending"] as? Bool != true, let id = o["id"] as? Int else { return .result() }
    var done = false
    switch o["kind"] as? String {
    case "ep":
      done = await MarkAPI.send("/api/v1/widget/unmark", show: id, season: o["season"] as? Int ?? 0, episode: o["episode"] as? Int ?? 0)
    case "movie":
      done = await MarkAPI.post("/api/v1/widget/movie", ["movieTmdbId": id, "watched": false]) != nil
    case "start":
      done = await MarkAPI.post("/api/v1/widget/start", ["showTmdbId": id, "start": false]) != nil
    default: break
    }
    if done { FeedStore.defaults?.removeObject(forKey: "wUndo") }
    return .result()
  }
}

/** 🆕 ★ من شريط التقييم — عشرُ نجومٍ كالتطبيق */
struct RateMovieIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.mark"
  static let isDiscoverable = false
  @Parameter(title: "id") var id: Int
  @Parameter(title: "rating") var rating: Int

  init() {}
  init(id: Int, rating: Int) {
    self.id = id
    self.rating = rating
  }

  func perform() async throws -> some IntentResult {
    Diag.add("rate", "tap", nil)
    if await MarkAPI.post("/api/v1/widget/rate", ["movieTmdbId": id, "rating": rating]) != nil {
      FeedStore.defaults?.removeObject(forKey: "wRate")
    }
    return .result()
  }
}

/** 🆕 «تخطَّ» — محلّيٌّ بلا شبكة */
struct SkipRateIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.unmark"
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult {
    FeedStore.defaults?.removeObject(forKey: "wRate")
    return .result()
  }
}
