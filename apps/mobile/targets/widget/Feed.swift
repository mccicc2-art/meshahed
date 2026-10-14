import Foundation
import ImageIO
import SwiftUI
import UIKit

/**
 * ====== بياناتُ الودجتات كما كتبها التطبيق (خطّةُ الودجتات §2.1) ======
 *
 * 🔑 **لا جلسةَ ولا شبكة** (D-929): التطبيقُ يكتب `widget/feed.json` والملصقاتِ في حاوية المجموعة، والملحقُ يقرأ.
 * **والفشلُ صمت**: ملفٌّ ناقصٌ = «افتح لوبز ليتحدّث الودجت»، لا ودجتٌ يسقط.
 * ⚠️ **التواريخُ تُحسب وقتَ الرسم** — الجدولُ الزمنيُّ يُعيد الرسمَ عند منتصف الليل فتتبدّل «اليوم» بلا فتح التطبيق.
 */
let appGroup = "group.com.loopztv.app"

struct WTitle: Codable, Hashable {
  let kind: String
  let id: Int
  let title: String
  let poster_path: String?
}

struct WContinue: Codable, Hashable {
  let kind: String
  let id: Int
  let title: String
  let poster_path: String?
  let season: Int?
  let episode: Int?
  let label: String?
  /** 🆕 W17 — بطاقةُ الرئيسيّة: الصورةُ العريضة، والسطرُ الثاني كما في التطبيق، والنسبة (اختياريّةٌ: ملفٌّ قديمٌ بلا الحقول يُقرأ) */
  let backdrop_path: String?
  let sub: String?
  let pct: Int?
  var asTitle: WTitle { WTitle(kind: kind, id: id, title: title, poster_path: poster_path) }
}

struct WToWatch: Codable, Hashable {
  let kind: String
  let id: Int
  let title: String
  let poster_path: String?
  let action: String
  var asTitle: WTitle { WTitle(kind: kind, id: id, title: title, poster_path: poster_path) }
}

struct WUpcoming: Codable, Hashable {
  let kind: String
  let id: Int
  let title: String
  let poster_path: String?
  let date: String?
  let season: Int?
  let episode: Int?
  let label: String?
  let behind_label: String?
  var asTitle: WTitle { WTitle(kind: kind, id: id, title: title, poster_path: poster_path) }
}

struct WMovie: Codable, Hashable {
  let kind: String
  let id: Int
  let title: String
  let poster_path: String?
  let runtime: Int?
  let rating: Double?
  let source: String
  /** 🆕 v2 (W42) — هيدرُ بطاقة فيلم الليلة العريضة؛ ملفٌّ أقدمُ بلا الحقل يُقرأ */
  let backdrop_path: String?
  var asTitle: WTitle { WTitle(kind: kind, id: id, title: title, poster_path: poster_path) }
}

struct WList: Codable, Hashable {
  let id: String
  let name: String
  let count: Int
  let items: [WTitle]
}

struct WPaged<T: Codable & Hashable>: Codable, Hashable {
  let items: [T]
  let total: Int
}

struct WFeed: Codable {
  let lang: String
  let dir: String
  let `continue`: WPaged<WContinue>
  let towatch_series: [WToWatch]
  let towatch_all: [WTitle]
  let upcoming: WPaged<WUpcoming>
  let tonight: [WMovie]
  let lists: [WList]
  let check: Bool
  let strings: [String: String]
  let posters: [String: String]?

  var rtl: Bool { dir == "rtl" }
  func s(_ k: String) -> String { strings[k] ?? "" }
  var locale: Locale { Locale(identifier: lang == "en" ? "en" : "ar") }

  /** ما لم يمضِ — موعدٌ نزل اليومَ يبقى، وما مضى يسقط (التقويمُ يُسقطه، D-828) */
  func upcomingNow(_ now: Date) -> [WUpcoming] {
    upcoming.items.filter { u in
      guard let d = u.date else { return true }
      return (WDates.days(from: now, to: d) ?? 0) >= 0
    }
  }
}

enum FeedState {
  case none
  case signedOut
  case ready(WFeed)
}

enum FeedStore {
  static func dir() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appendingPathComponent("widget", isDirectory: true)
  }

  static func load() -> FeedState {
    guard let url = dir()?.appendingPathComponent("feed.json"), let data = try? Data(contentsOf: url) else { return .none }
    if let probe = try? JSONSerialization.jsonObject(with: data) as? [String: Any], probe["signed_out"] as? Bool == true {
      return .signedOut
    }
    guard let feed = try? JSONDecoder().decode(WFeed.self, from: data) else { return .none }
    return .ready(feed)
  }

  /** ملصقٌ مصغَّرٌ بحجمه — ImageIO لا `UIImage(contentsOfFile:)`: حدُّ ذاكرة الملحق قرابة ٣٠ ميغابايت */
  static func image(_ path: String?, in feed: WFeed, maxPixel: CGFloat) -> UIImage? {
    guard let path, let name = feed.posters?[path], let url = dir()?.appendingPathComponent(name) else { return nil }
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixel,
      kCGImageSourceCreateThumbnailWithTransform: true,
    ]
    guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
    return UIImage(cgImage: cg)
  }

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  /** القوائمُ المختارةُ مصدراً (W10) — التطبيقُ يقرؤها (`configuredLists`) ويطلب عناصرَها وحدَها */
  static func noteConfigured(list id: String) {
    guard let d = defaults else { return }
    var seen = d.dictionary(forKey: "configuredListsAt") as? [String: Double] ?? [:]
    let now = Date().timeIntervalSince1970
    seen[id] = now
    seen = seen.filter { now - $0.value < 7 * 86_400 }
    d.set(seen, forKey: "configuredListsAt")
    d.set(Array(seen.keys), forKey: "configuredLists")
  }
}

enum WDates {
  static let iso: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  static func days(from now: Date, to date: String) -> Int? {
    guard let d = iso.date(from: date) else { return nil }
    let cal = Calendar.current
    return cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: d)).day
  }

  /** «اليوم» · «غداً» · اسمُ اليوم · «٢٢ نوفمبر» */
  static func label(_ date: String, feed: WFeed, now: Date) -> String {
    guard let n = days(from: now, to: date), let d = iso.date(from: date) else { return date }
    if n <= 0 { return feed.s("today") }
    if n == 1 { return feed.s("tomorrow") }
    let f = DateFormatter()
    f.locale = feed.locale
    f.dateFormat = n < 7 ? "EEEE" : "d MMMM"
    return f.string(from: d)
  }

  static func isToday(_ date: String?, now: Date) -> Bool {
    guard let date, let n = days(from: now, to: date) else { return false }
    return n <= 0
  }

  static func runtime(_ min: Int?, feed: WFeed) -> String? {
    guard let min, min > 0 else { return nil }
    let h = min / 60, m = min % 60
    if feed.lang == "en" { return h > 0 ? "\(h)h \(m)m" : "\(m)m" }
    return h > 0 ? "\(h) س \(m) د" : "\(m) د"
  }
}

/** روابطُ الودجت — كلُّها إلى `WidgetGate` (`com.loopztv.app://w/…`) */
enum WLink {
  static func url(_ path: String) -> URL { URL(string: "com.loopztv.app://\(path)")! }
  static func enc(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "" }
  static func title(_ t: WTitle) -> URL { url("w/title?k=\(t.kind == "movie" ? "movie" : "tv")&id=\(t.id)") }
  static func all(_ s: String) -> URL { url("w/all?s=\(s)") }
  static var calendar: URL { url("w/calendar") }
  static var discover: URL { url("w/discover") }
  static func list(_ id: String) -> URL { url("w/list?id=\(enc(id))") }
  static func start(_ t: WTitle, action: String) -> URL { url("w/start?id=\(t.id)&a=\(enc(action))&t=\(enc(t.title))") }
}

/** ألوانُ الثيم الرسميّ (W2: الأسودُ دائماً) — من `src/core/themes.ts` لا من الذاكرة */
enum WColor {
  static let bg = Color(red: 5 / 255, green: 5 / 255, blue: 5 / 255)
  static let surface = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255)
  static let surface2 = Color(red: 24 / 255, green: 24 / 255, blue: 24 / 255)
  static let fg = Color(red: 247 / 255, green: 247 / 255, blue: 247 / 255)
  static let muted = Color(red: 181 / 255, green: 181 / 255, blue: 181 / 255)
  static let accent = Color(red: 1, green: 212 / 255, blue: 0)
  static let border = Color(red: 41 / 255, green: 41 / 255, blue: 41 / 255)
  static let success = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
}
