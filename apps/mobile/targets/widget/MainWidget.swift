import AppIntents
import SwiftUI
import WidgetKit

/**
 * ====== 🆕 ودجتُ لوبز الواحد في iOS (خطّةُ الودجتات v2، W28–W43) ======
 *
 * 🔑 **نوعٌ واحدٌ بثلاثة أحجام** (صغير · متوسط · كبير — لا «كبير جداً» في آبل، W28). **الصفوفُ محسومةٌ في التطبيق**
 * (`resolveWidget` بمقاسات آبل، مكتوبةً في `w2.ios` لكلِّ تخطيط) — هنا رسمٌ فقط، فالمعاينةُ والودجتُ لا يختلفان (§11.2).
 * 🔑 **الخيارُ ب (W40)**: التخطيطاتُ تُبنى في التطبيق، و«تعديل الأداة» من النظام يختار واحداً منها لا غير.
 * ودجتاتُ شاشة القفل باقيةٌ مجّانيّةً كما هي (W41 «٢ ب») — في `Widgets.swift`.
 */

/* ───────── الخلاصةُ كما كُتبت: `v2` (الأقسام) و`w2` (الصفوفُ المحسومة) ───────── */

struct V2Feed {
  let feed: WFeed
  let raw: [String: Any]
  /** 🆕 W37 — ما شوهد أو بدأ من الودجت للتوّ (يُخفى حتى تصل خلاصةٌ أحدث)، وشريطُ التقييم القائم */
  var hidden: Set<Int> = []
  var rate: [String: Any]? = nil

  var v2: [String: Any] { raw["v2"] as? [String: Any] ?? [:] }
  func s2(_ k: String) -> String { (v2["strings"] as? [String: Any])?[k] as? String ?? "" }
  func arr(_ k: String) -> [[String: Any]] {
    let a = v2[k] as? [[String: Any]] ?? []
    return k == "towatch" ? a.filter { !hidden.contains(Int(num($0["id"]) ?? 0)) } : a
  }
  /** «فيلم الليلة» بلا ما شوهد للتوّ — فيأتي الفيلمُ التالي */
  var tonight: [WMovie] { feed.tonight.filter { !hidden.contains($0.id) } }
  /** نصٌّ من الخلاصة، وبديلُه للخلاصات الأقدم من الدفعة الثانية */
  func s2or(_ k: String, _ ar: String, _ en: String) -> String {
    let v = s2(k)
    return v.isEmpty ? (feed.locale.identifier.hasPrefix("en") ? en : ar) : v
  }
  var lapsed: Bool { v2["lapsed"] as? Bool ?? false }
  var layouts: [[String: Any]] { ((raw["w2"] as? [String: Any])?["ios"] as? [[String: Any]]) ?? [] }

  /** التخطيطُ المختار، أو الأوّلُ («الرئيسي») إن حُذف المختارُ في التطبيق */
  func resolved(_ id: String?) -> [String: Any]? {
    let all = layouts
    let pick = all.first { ($0["id"] as? String) == id } ?? all.first
    return pick?["resolved"] as? [String: Any]
  }

  func title(_ o: [String: Any]?) -> WTitle? {
    guard let o, let id = num(o["id"]).map({ Int($0) }) else { return nil }
    return WTitle(kind: o["kind"] as? String ?? "tv", id: id, title: o["title"] as? String ?? "—", poster_path: o["poster_path"] as? String)
  }

  /** «القادم» ما لم يمضِ — المسلسلاتُ والأفلام (W32) */
  func upcoming(_ now: Date) -> [[String: Any]] {
    let items = (v2["upcoming"] as? [String: Any])?["items"] as? [[String: Any]] ?? []
    return items.filter { u in
      guard let d = u["date"] as? String else { return true }
      return (WDates.days(from: now, to: d) ?? 0) >= 0
    }
  }
}

func num(_ any: Any?) -> Double? {
  if let n = any as? NSNumber { return n.doubleValue }
  if let d = any as? Double { return d }
  if let i = any as? Int { return Double(i) }
  return nil
}

enum V2State {
  case none
  case signedOut
  case ready(V2Feed)
}

extension FeedStore {
  static func loadV2() -> V2State {
    guard let url = dir()?.appendingPathComponent("feed.json"), let data = try? Data(contentsOf: url) else { return .none }
    guard let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return .none }
    if raw["signed_out"] as? Bool == true { return .signedOut }
    guard let feed = try? JSONDecoder().decode(WFeed.self, from: data) else { return .none }
    /* خلاصةٌ من تطبيقٍ أقدم (بلا `w2`) ⇒ «افتح لوبز» حتى يكتبها التطبيقُ الجديد */
    guard raw["w2"] != nil, raw["v2"] != nil else { return .none }
    return .ready(V2Feed(feed: feed, raw: raw, hidden: WState.hidden(), rate: feed.check ? WState.rate() : nil))
  }
}

extension WLink {
  static var search: URL { url("w/search") }
  static var settings: URL { url("w/settings") }
}

/* ───────── «تعديل الأداة»: اختيارُ التخطيط (W40 ب) ───────── */

struct LayoutEntity: AppEntity {
  let id: String
  let name: String

  static let typeDisplayRepresentation: TypeDisplayRepresentation = TypeDisplayRepresentation(name: LocalizedStringResource("layout.param"))
  static let defaultQuery = LayoutQuery()
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct LayoutQuery: EntityQuery {
  func all() -> [LayoutEntity] {
    if case .ready(let f) = FeedStore.loadV2() {
      let out = f.layouts.compactMap { o -> LayoutEntity? in
        guard let id = o["id"] as? String else { return nil }
        return LayoutEntity(id: id, name: o["name"] as? String ?? id)
      }
      if !out.isEmpty { return out }
    }
    return [LayoutEntity(id: "main", name: String(localized: "layout.main"))]
  }

  func entities(for identifiers: [LayoutEntity.ID]) async throws -> [LayoutEntity] {
    let a = all()
    return identifiers.compactMap { id in a.first { $0.id == id } }
  }

  func suggestedEntities() async throws -> [LayoutEntity] { all() }
  func defaultResult() async -> LayoutEntity? { all().first }
}

struct LayoutConfigIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "layout.title"
  @Parameter(title: "layout.param")
  var layout: LayoutEntity?

  init() {}
}

struct MainEntry: TimelineEntry {
  let date: Date
  let state: V2State
  let layout: String?
}

struct MainProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> MainEntry { MainEntry(date: Date(), state: .none, layout: nil) }

  func snapshot(for configuration: LayoutConfigIntent, in context: Context) async -> MainEntry {
    MainEntry(date: Date(), state: FeedStore.loadV2(), layout: configuration.layout?.id)
  }

  /** الآن، ثمّ منتصفُ الليل — «اليوم» وفيلمُ اليوم يتبدّلان بلا فتح التطبيق (W42) */
  func timeline(for configuration: LayoutConfigIntent, in context: Context) async -> Timeline<MainEntry> {
    WState.settle()
    let now = Date()
    let state = FeedStore.loadV2()
    /* 🆕 W37 — «↶ تراجع» قائم: رسمٌ جديدٌ عند انقضاء الخمس ثوانٍ (قد يتأخّر ثانيةً أو اثنتين في iOS) */
    if let end = WState.undoEnds() {
      return Timeline(entries: [MainEntry(date: now, state: state, layout: configuration.layout?.id)], policy: .after(end))
    }
    let id = configuration.layout?.id
    let cal = Calendar.current
    let midnight = cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: now) ?? now)
    let after = cal.date(byAdding: .day, value: 1, to: midnight) ?? midnight
    return Timeline(entries: [MainEntry(date: now, state: state, layout: id), MainEntry(date: midnight, state: state, layout: id)], policy: .after(after))
  }
}

struct LoopzMainWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "LoopzMain", intent: LayoutConfigIntent.self, provider: MainProvider()) { entry in
      MainView(entry: entry)
    }
    .configurationDisplayName(LocalizedStringResource("main.name"))
    .description(LocalizedStringResource("main.desc"))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct MainView: View {
  let entry: MainEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch entry.state {
      case .ready(let f):
        content(f)
          .environment(\.layoutDirection, f.feed.rtl ? .rightToLeft : .leftToRight)
          .environment(\.locale, f.feed.locale)
      case .signedOut: EmptyNote(text: String(localized: "signed.out"))
      case .none: EmptyNote(text: String(localized: "open.app"))
      }
    }
    .containerBackground(for: .widget) { WColor.bg }
  }

  var sizeName: String {
    switch family {
    case .systemLarge: return "large"
    case .systemMedium: return "medium"
    default: return "small"
    }
  }

  @ViewBuilder func content(_ f: V2Feed) -> some View {
    if let r = f.resolved(entry.layout) {
      let opts = r["opts"] as? [String: Any] ?? [:]
      let locked = (r["locked"] as? [String: Any])?[sizeName] as? Bool ?? false
      if locked {
        LockCard(f: f)
      } else if sizeName == "small" {
        SmallMain(f: f, small: r["small"] as? [String: Any] ?? [:], opts: opts, now: entry.date)
      } else {
        /* 🆕 الصفوفُ المحسومةُ لارتفاع الودجت الحقيقيّ على هذا الجهاز (أكبرُ مفتاحٍ لا يزيد عليه) */
        GeometryReader { g in
          /* 🆕 W37 — شريطُ التقييم يأخذ مكانه (٨٠ وفاصل) فتُحسم الصفوفُ لما بقي؛ وإن لم يبقَ ما يتّسع لصفٍّ فالشريطُ وحدَه */
          let room = f.rate != nil ? g.size.height - 93 : g.size.height
          let fit = room < 130 && f.rate != nil ? nil : Self.byHeight(r["heights"] as? [String: Any], room)
          let fitLocked = (r["locked"] as? [String: Any])?[(fit?["size"] as? String) ?? sizeName] as? Bool ?? false
          if fitLocked {
            LockCard(f: f)
          } else {
            if f.rate != nil && fit == nil {
              RowsView(f: f, rows: [], opts: opts, now: entry.date, rate: f.rate)
            } else {
              RowsView(f: f, rows: (fit?["rows"] as? [[String: Any]]) ?? ((r["rows"] as? [String: Any])?[sizeName] as? [[String: Any]]) ?? [], opts: opts, now: entry.date, rate: f.rate)
            }
          }
        }
      }
    } else {
      EmptyNote(text: String(localized: "open.app"))
    }
  }
}

extension MainView {
  /** أكبرُ ارتفاعٍ محسومٍ لا يزيد على ارتفاع الودجت — وإن قصر عن كلِّها فأصغرُها */
  static func byHeight(_ all: [String: Any]?, _ h: CGFloat) -> [String: Any]? {
    guard let all else { return nil }
    let keys = all.keys.compactMap { Int($0) }.sorted()
    guard let first = keys.first else { return nil }
    let k = keys.last { CGFloat($0) <= h } ?? first
    return all[String(k)] as? [String: Any]
  }
}

/* ───────── W41 — القفل ───────── */

struct LockCard: View {
  let f: V2Feed
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "lock.fill").font(.system(size: 20, weight: .semibold)).foregroundStyle(WColor.accent)
      Text(f.s2(f.lapsed ? "plusLapsedTitle" : "plusLockedTitle")).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).multilineTextAlignment(.center)
      Text(f.s2(f.lapsed ? "plusLapsedSub" : "plusLockedSub")).font(.system(size: 12)).foregroundStyle(WColor.muted).multilineTextAlignment(.center)
      WChip(icon: nil, text: f.s2(f.lapsed ? "renew" : "subscribe")).padding(.top, 6)
    }
    .padding(18)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(WLink.settings)
  }
}

/* ───────── المكوّناتُ الصغيرة ───────── */

/** W36 — رقاقةُ الودجت الواحدة: رماديٌّ زجاجيّ بحافّةٍ رفيعة، لا أصفر */
struct WChip: View {
  let icon: String?
  let text: String?
  var body: some View {
    HStack(spacing: 5) {
      if let icon { Image(systemName: icon).font(.system(size: 10, weight: .bold)) }
      if let text, !text.isEmpty { Text(text).font(.system(size: 10.5, weight: .semibold)).lineLimit(1) }
    }
    .foregroundStyle(WColor.fg)
    .padding(.horizontal, 10)
    .frame(height: 26)
    .background(Capsule().fill(Color(red: 22 / 255, green: 22 / 255, blue: 22 / 255).opacity(0.78)))
    .overlay(Capsule().stroke(Color.white.opacity(0.08), lineWidth: 1))
  }
}

/** بوسترٌ بمقاس خانته — ٢:٣ في ٢:٣ فلا زوم ولا فراغ (W38) */
struct Poster: View {
  let f: V2Feed
  let path: String?
  let w: CGFloat
  let h: CGFloat
  var r: CGFloat = 5
  var body: some View {
    Group {
      if let img = FeedStore.image(path, in: f.feed, maxPixel: max(max(w, h) * 3, 60)) {
        Image(uiImage: img).resizable()
      } else {
        WColor.surface
      }
    }
    .frame(width: w, height: h)
    .clipShape(RoundedRectangle(cornerRadius: r))
  }
}

struct SecHeader: View {
  let title: String
  let link: URL?
  var body: some View {
    HStack(spacing: 6) {
      if let link {
        Link(destination: link) { titleText }
      } else {
        titleText
      }
      Spacer(minLength: 0)
    }
    .frame(height: 20)
  }
  var titleText: some View { Text(title).font(.system(size: 14.5, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1) }
}

/** سطرٌ في قسم — صورةٌ واسمٌ وسطرٌ ثانٍ ووجهةُ اللمسة */
struct LineItem {
  let t: WTitle?
  let name: String
  let sub: String?
  let link: URL
  let raw: [String: Any]?
  /** 🆕 «أصدقاؤك» وحدَه: متى، في طرف السطر */
  var time: String? = nil
}

enum Sections {
  static func title(_ f: V2Feed, _ key: String) -> String {
    switch key {
    case "cont": return f.feed.s("continueTitle")
    case "up": return f.feed.s("comingUpTitle")
    case "tonight": return f.feed.s("tonightTitle")
    case "tw": return f.feed.s("towatchTitle")
    case "friends": return f.s2("friendsTitle")
    case "act": return f.s2("activityTitle")
    default: return f.s2("searchPlaceholder")
    }
  }

  static func link(_ key: String) -> URL? {
    switch key {
    case "cont": return WLink.all("continue")
    case "up": return WLink.calendar
    case "tw": return WLink.all("towatch")
    default: return nil
    }
  }

  static func ago(_ iso: String?, _ f: V2Feed, now: Date) -> String? {
    guard let iso else { return nil }
    let p = ISO8601DateFormatter()
    p.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let d = p.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return nil }
    let r = RelativeDateTimeFormatter()
    r.locale = f.feed.locale
    r.unitsStyle = .abbreviated
    return r.localizedString(for: d, relativeTo: now)
  }

  /** W42 — فيلمُ اليوم يتبدّل وحدَه كلَّ يوم، و«فيلم آخر» يقلّب فوقه (`tonightIndex`) */
  static func tonight(_ f: V2Feed, now: Date) -> WMovie? {
    let all = f.tonight
    guard !all.isEmpty else { return nil }
    let day = Int((now.timeIntervalSince1970 + Double(TimeZone.current.secondsFromGMT(for: now))) / 86_400)
    let n = day + (FeedStore.defaults?.integer(forKey: "tonightIndex") ?? 0)
    return all[((n % all.count) + all.count) % all.count]
  }

  static func tonightSub(_ m: WMovie, _ f: V2Feed) -> String {
    var parts: [String] = []
    if let rating = m.rating { parts.append("★ " + String(format: "%.1f", rating)) }
    if let r = WDates.runtime(m.runtime, feed: f.feed) { parts.append(r) }
    return parts.joined(separator: " · ")
  }

  static func lines(_ f: V2Feed, _ key: String, now: Date) -> [LineItem] {
    switch key {
    case "up":
      return f.upcoming(now).compactMap { u in
        guard let t = f.title(u) else { return nil }
        let sub = [(u["date"] as? String).map { WDates.label($0, feed: f.feed, now: now) }, u["label"] as? String].compactMap { $0 }.joined(separator: " · ")
        return LineItem(t: t, name: t.title, sub: sub, link: WLink.title(t), raw: u)
      }
    case "friends":
      return f.arr("friends").compactMap { x in
        guard let t = f.title(x["title"] as? [String: Any]) else { return nil }
        /* 🆕 سطران: الاسمُ فوق و«شاهد …» تحته، ومتى مختصراً في الطرف (تسجيلُ أحمد ١٤ أكتوبر) */
        let sub = "\(x["action"] as? String ?? "") \(t.title)"
        return LineItem(t: t, name: x["name"] as? String ?? "", sub: sub, link: WLink.title(t), raw: x, time: ago(x["at"] as? String, f, now: now))
      }
    case "tw":
      return f.arr("towatch").compactMap { x in
        guard let t = f.title(x) else { return nil }
        let rating = num(x["rating"]).map { "★ " + String(format: "%.1f", $0) }
        let sub = [x["type_label"] as? String, rating].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return LineItem(t: t, name: t.title, sub: sub, link: WLink.title(t), raw: x)
      }
    case "act":
      return f.arr("activity").compactMap { x in
        guard let t = f.title(x["title"] as? [String: Any]) else { return nil }
        return LineItem(t: t, name: x["line"] as? String ?? t.title, sub: x["sub"] as? String, link: WLink.title(t), raw: x)
      }
    case "cont":
      return f.feed.continue.items.map { c in
        LineItem(t: c.asTitle, name: c.title, sub: c.sub ?? c.label, link: WLink.title(c.asTitle), raw: nil)
      }
    case "tonight":
      guard let m = tonight(f, now: now) else { return [] }
      return [LineItem(t: m.asTitle, name: m.title, sub: tonightSub(m, f), link: WLink.title(m.asTitle), raw: nil)]
    default:
      return []
    }
  }
}

/* ───────── الصفوف ───────── */

/** 🆕 W37 · «١ ب» — شريطُ «قيّم الفيلم» تحت البحث (٨٠، `rateStrip`): عشرُ نجومٍ كالتطبيق و«تخطَّ»، يبقى حتى يقيّم أو يتخطّى */
struct RateStrip: View {
  let f: V2Feed
  let rate: [String: Any]

  var body: some View {
    let id = rate["id"] as? Int ?? 0
    let title = rate["title"] as? String ?? ""
    let poster = (rate["poster"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    VStack(spacing: 2) {
      HStack(spacing: 8) {
        Poster(f: f, path: poster, w: 22, h: 33, r: 3)
        Text(f.s2or("rate", "قيّم %s", "Rate %s").replacingOccurrences(of: "%s", with: title))
          .font(.system(size: 13, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1)
        Spacer(minLength: 0)
        Button(intent: SkipRateIntent()) { WChip(icon: nil, text: f.s2or("skip", "تخطَّ", "Skip")) }.buttonStyle(.plain)
      }
      .frame(height: 34)
      HStack(spacing: 0) {
        ForEach(1...10, id: \.self) { n in
          Button(intent: RateMovieIntent(id: id, rating: n)) {
            Image(systemName: "star.fill").font(.system(size: 17)).foregroundStyle(Color(white: 0.42))
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 10).padding(.vertical, 7)
    .frame(height: 80)
    .background(RoundedRectangle(cornerRadius: 12).fill(WColor.surface))
  }
}

struct RowsView: View {
  let f: V2Feed
  let rows: [[String: Any]]
  let opts: [String: Any]
  let now: Date
  /** شريطُ التقييم القائم — تحت البحث إن كان أوّلَ صفّ، وإلّا في الأعلى */
  var rate: [String: Any]? = nil

  var divider: some View {
    VStack(spacing: 0) {
      Spacer(minLength: 6)
      Rectangle().fill(Color.white.opacity(0.1)).frame(height: 1)
      Spacer(minLength: 6)
    }
  }

  var body: some View {
    /* ما يزيد من الارتفاع يتوزّع على الفواصل — لا كتلةَ سوداءَ تحت آخر قسم */
    let afterSearch = (rows.first?["type"] as? String) == "search"
    VStack(alignment: .leading, spacing: 0) {
      if let rate, !afterSearch {
        RateStrip(f: f, rate: rate)
        if !rows.isEmpty { divider.frame(height: 13) }
      }
      ForEach(Array(rows.enumerated()), id: \.offset) { pair in
        if pair.offset == 1, afterSearch, let rate {
          divider.frame(height: 13)
          RateStrip(f: f, rate: rate)
        }
        if pair.offset > 0 {
          /* 🆕 فاصلٌ ١٣ (`gap`) — والزائدُ القليلُ (أقلُّ من صفّ، المحرّكُ كبّر الصفوف قبله) يتوزّع هنا */
          VStack(spacing: 0) {
            Spacer(minLength: 6)
            Rectangle().fill(Color.white.opacity(0.1)).frame(height: 1)
            Spacer(minLength: 6)
          }
        }
        RowView(f: f, row: pair.element, opts: opts, now: now)
          .frame(height: CGFloat(num(pair.element["h"]) ?? 44), alignment: .top)
      }
      if rows.count == 1, afterSearch, let rate {
        divider.frame(height: 13)
        RateStrip(f: f, rate: rate)
      }
      if rows.count < 2 { Spacer(minLength: 0) }
    }
    .padding(12)
  }
}

struct RowView: View {
  let f: V2Feed
  let row: [String: Any]
  let opts: [String: Any]
  let now: Date

  var type: String { row["type"] as? String ?? "" }
  var keys: [String] { row["keys"] as? [String] ?? [] }
  var key: String { row["key"] as? String ?? "" }

  var body: some View {
    switch type {
    case "search": SearchRow(f: f, full: row["full"] as? Bool ?? false, trend: row["trend"] as? String ?? "list")
    case "cont": ContRow(f: f, upLine: row["upLine"] as? Bool ?? false, tall: row["tall"] as? Bool ?? false, now: now)
    case "list": ListSection(f: f, key: key, view: row["view"] as? String ?? "list", count: max(0, min(3, Int(num(row["count"]) ?? 2))), now: now)
    case "tonight": TonightRow(f: f, wide: (row["view"] as? String ?? "wide") != "poster", now: now)
    case "pair":
      /* 🆕 بثلاثة أسطر أو بسطرين كما حسم المحرّك (خلاصةٌ أقدمُ بلا العدد ⇒ ٣) */
      let n = max(1, min(3, Int(num(row["count"]) ?? 3)))
      HStack(alignment: .top, spacing: 17) {
        /* كلُّ نصفٍ محصورٌ في عرضه ومقصوصٌ عليه — لا يطلع اسمٌ على جاره */
        Half(f: f, key: keys.first ?? "", opts: opts, count: n, now: now).frame(maxWidth: .infinity, alignment: .leading).clipped()
        if keys.count > 1 { Half(f: f, key: keys[1], opts: opts, count: n, now: now).frame(maxWidth: .infinity, alignment: .leading).clipped() } else { Color.clear }
      }
    case "line": LineRow(f: f, key: key, now: now)
    default: Color.clear
    }
  }
}

/* W31 — البحث: الشريطُ يفتح البحث، و«الرائج اليوم» تحته في الشكل الكامل */
struct SearchRow: View {
  let f: V2Feed
  let full: Bool
  let trend: String

  var body: some View {
    let trending = f.arr("trending").compactMap { f.title($0) }
    VStack(alignment: .leading, spacing: 8) {
      Link(destination: WLink.search) {
        HStack(spacing: 10) {
          Image(systemName: "magnifyingglass").font(.system(size: 14, weight: .semibold)).foregroundStyle(WColor.accent)
          Text(f.s2("searchPlaceholder")).font(.system(size: 12)).foregroundStyle(WColor.muted).lineLimit(1)
          Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
        .background(Capsule().fill(Color(red: 22 / 255, green: 22 / 255, blue: 22 / 255)))
      }
      if full {
        Text(f.s2("trendingToday")).font(.system(size: 11, weight: .semibold)).foregroundStyle(WColor.muted).frame(height: 16)
        if trend == "posters" {
          HStack(spacing: 0) {
            ForEach(0..<3, id: \.self) { n in
              if n > 0 { Spacer(minLength: 6) }
              if n < trending.count {
                Link(destination: WLink.title(trending[n])) {
                  Poster(f: f, path: trending[n].poster_path, w: 87, h: 130, r: 8)
                    .overlay(alignment: .bottomLeading) {
                      Text("\(n + 1)").font(.system(size: 20, weight: .heavy)).foregroundStyle(n == 0 ? WColor.accent : WColor.fg).padding(.leading, 7).padding(.bottom, 3)
                    }
                }
              } else {
                Color.clear.frame(width: 87, height: 130)
              }
            }
          }
        } else {
          HStack(spacing: 12) {
            ForEach(0..<2, id: \.self) { n in
              if n < trending.count {
                Link(destination: WLink.title(trending[n])) {
                  HStack(spacing: 8) {
                    Text("\(n + 1)").font(.system(size: 15, weight: .heavy)).foregroundStyle(n == 0 ? WColor.accent : WColor.muted)
                    Poster(f: f, path: trending[n].poster_path, w: 28, h: 40, r: 4)
                    Text(trending[n].title).font(.system(size: 11, weight: .semibold)).foregroundStyle(WColor.fg).lineLimit(1)
                    Spacer(minLength: 0)
                  }
                }
              } else {
                Color.clear.frame(maxWidth: .infinity)
              }
            }
          }
          .frame(height: 40)
        }
      }
    }
  }
}

/* W33 — أكمل المشاهدة: البطاقتان (بطاقةُ الرئيسيّة نفسُها، W17) وسطرُ «القادم» حين يقوله المحرّك */
struct ContRow: View {
  let f: V2Feed
  let upLine: Bool
  /** 🆕 المتوسطُ وأكملُ المشاهدة وحدَه: بطاقتان ١٢٠ بدل ٩٣ (`contTall`) */
  var tall: Bool = false
  let now: Date

  var body: some View {
    let source = sourceOf(f.feed, "continue", max: 2)
    VStack(alignment: .leading, spacing: 0) {
      SecHeader(title: source.title, link: source.header)
      HStack(spacing: 9) {
        ForEach(0..<2, id: \.self) { i in
          if i < source.slots.count { CardView(feed: f.feed, slot: source.slots[i]) } else { Color.clear.frame(maxWidth: .infinity) }
        }
      }
      .frame(height: tall ? 120 : 93)
      .padding(.top, 8)
      if upLine {
        Rectangle().fill(Color.white.opacity(0.1)).frame(height: 1).padding(.top, 5)
        Link(destination: WLink.calendar) {
          HStack(spacing: 6) {
            if let u = f.upcoming(now).first {
              let day = (u["date"] as? String).map { WDates.label($0, feed: f.feed, now: now) }
              Text([f.s2("upLinePrefix"), day].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
              Text(u["title"] as? String ?? "").font(.system(size: 11)).foregroundStyle(WColor.fg).lineLimit(1)
              if let l = u["label"] as? String { Text(l).font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1) }
            } else {
              Text(f.s2("noUpcoming")).font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
          }
          .frame(height: 17)
        }
      }
    }
  }
}

/* W32 · W35 — قسمُ قائمةٍ كامل */
struct ListSection: View {
  let f: V2Feed
  let key: String
  let view: String
  let count: Int
  let now: Date

  var body: some View {
    let items = Sections.lines(f, key, now: now)
    VStack(alignment: .leading, spacing: 4) {
      SecHeader(title: Sections.title(f, key), link: Sections.link(key))
      if view == "posters" {
        HStack(spacing: 0) {
          ForEach(0..<3, id: \.self) { n in
            if n > 0 { Spacer(minLength: 6) }
            if n < items.count {
              Link(destination: items[n].link) { Poster(f: f, path: items[n].t?.poster_path, w: 87, h: 130, r: 8) }
            } else {
              Color.clear.frame(width: 87, height: 130)
            }
          }
        }
      } else {
        /* الصفوفُ متلاصقةٌ بارتفاع ٥٠ (`rowGap` = ٠) */
        VStack(alignment: .leading, spacing: 0) {
          ForEach(Array(items.prefix(count).enumerated()), id: \.offset) { pair in
            ItemRow(f: f, key: key, item: pair.element)
          }
        }
      }
    }
  }
}

struct ItemRow: View {
  let f: V2Feed
  let key: String
  let item: LineItem

  /* 🆕 صفٌّ واحدٌ لكلِّ القوائم (٥٠): صورةٌ ٣٢×٤٨ واسمٌ ١٤ وسطرٌ ثانٍ ١٢ — والأصدقاءُ مثلها ومتى في الطرف
     (تسجيلُ أحمد ١٤ أكتوبر، الآيفون ٨: «أصدقائك» و«أنشطتك» صغيرة) */
  var body: some View {
    HStack(spacing: 10) {
      Link(destination: item.link) {
        HStack(spacing: 10) {
          Poster(f: f, path: item.t?.poster_path, w: 32, h: 48, r: 4)
          VStack(alignment: .leading, spacing: 1) {
            Text(item.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(WColor.fg).lineLimit(1)
            if let done = doneLine {
              Text(done).font(.system(size: 12, weight: .semibold)).foregroundStyle(WColor.success).lineLimit(1)
            } else if let s = item.sub, !s.isEmpty { Text(s).font(.system(size: 12)).foregroundStyle(WColor.muted).lineLimit(1) }
          }
          Spacer(minLength: 0)
          if let time = item.time { Text(time).font(.system(size: 11.5)).foregroundStyle(WColor.muted).lineLimit(1) }
        }
      }
      /* W35 — «▶ ابدأ» للمسلسل والأنمي و«✓ شاهدته» للفيلم */
      if key == "tw", let t = item.t, let raw = item.raw {
        let movie = raw["action"] as? String == "watched"
        if f.feed.check && WState.undoOn(movie ? "movie" : "start", t.id) {
          Button(intent: UndoActionIntent()) { WChip(icon: "arrow.uturn.backward", text: f.s2or("undo", "تراجع", "Undo")) }.buttonStyle(.plain)
        } else if movie {
          if f.feed.check {
            Button(intent: MarkMovieIntent(id: t.id, name: t.title, poster: t.poster_path)) { WChip(icon: "checkmark", text: f.s2("watched")) }.buttonStyle(.plain)
          } else {
            Link(destination: WLink.title(t)) { WChip(icon: "checkmark", text: f.s2("watched")) }
          }
        } else if f.feed.check {
          Button(intent: StartShowIntent(id: t.id)) { WChip(icon: "play.fill", text: f.feed.s("start")) }.buttonStyle(.plain)
        } else {
          Link(destination: WLink.start(t, action: "start")) { WChip(icon: "play.fill", text: f.feed.s("start")) }
        }
      }
    }
    .frame(height: 50)
  }

  /** W37 — «✓ شاهدته/بدأته» خمسَ ثوانٍ بعد اللمسة */
  var doneLine: String? {
    guard key == "tw", f.feed.check, let t = item.t, let raw = item.raw else { return nil }
    let movie = raw["action"] as? String == "watched"
    guard WState.undoOn(movie ? "movie" : "start", t.id) else { return nil }
    return "✓ " + (movie ? f.s2("watched") : f.s2or("started", "بدأته", "Started"))
  }
}

/* W34 · W42 — فيلم الليلة كاملاً */
struct TonightRow: View {
  let f: V2Feed
  let wide: Bool
  let now: Date

  var body: some View {
    if let m = Sections.tonight(f, now: now) {
      if wide { wideCard(m) } else { posterCard(m) }
    } else {
      Link(destination: WLink.discover) {
        Text(f.feed.s("noTowatchMovies")).font(.system(size: 12)).foregroundStyle(WColor.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
  }

  var chips: some View {
    HStack(spacing: 6) {
      if let m = Sections.tonight(f, now: now) {
        if f.feed.check && WState.undoOn("movie", m.id) {
          /* W37 — «↶ تراجع» مكانَ الرقاقتين خمسَ ثوانٍ، ثمّ فيلمٌ آخر وشريطُ التقييم */
          Button(intent: UndoActionIntent()) { WChip(icon: "arrow.uturn.backward", text: f.s2or("undo", "تراجع", "Undo")) }.buttonStyle(.plain)
        } else if f.feed.check {
          Button(intent: MarkMovieIntent(id: m.id, name: m.title, poster: m.poster_path)) { WChip(icon: "checkmark", text: f.s2("watched")) }.buttonStyle(.plain)
        } else {
          Link(destination: WLink.title(m.asTitle)) { WChip(icon: "checkmark", text: f.s2("watched")) }
        }
      }
      if f.tonight.count > 1 && !undoing {
        Button(intent: CycleTonightIntent()) { WChip(icon: "repeat", text: f.s2("another")) }.buttonStyle(.plain)
      }
    }
  }

  var undoing: Bool {
    guard f.feed.check, let m = Sections.tonight(f, now: now) else { return false }
    return WState.undoOn("movie", m.id)
  }

  /** سطرُ الفيلم الثاني — أو «✓ شاهدته» بالأخضر الخافت خمسَ ثوانٍ */
  func subLine(_ m: WMovie, color: Color) -> some View {
    let done = f.feed.check && WState.undoOn("movie", m.id)
    return Text(done ? "✓ " + f.s2("watched") : Sections.tonightSub(m, f)).font(.system(size: 11)).foregroundStyle(done ? WColor.success : color).lineLimit(1)
  }

  func wideCard(_ m: WMovie) -> some View {
    Link(destination: WLink.title(m.asTitle)) {
      ZStack(alignment: .bottom) {
        WColor.surface
        if let img = FeedStore.image(m.backdrop_path ?? m.poster_path, in: f.feed, maxPixel: 900) {
          Image(uiImage: img).resizable().scaledToFill().frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top).clipped()
        }
        LinearGradient(stops: [.init(color: .clear, location: 0.35), .init(color: Color.black.opacity(0.85), location: 1)], startPoint: .top, endPoint: .bottom)
        HStack(alignment: .bottom, spacing: 8) {
          VStack(alignment: .leading, spacing: 2) {
            Text(m.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1)
            subLine(m, color: Color(white: 0.84))
          }
          Spacer(minLength: 0)
          chips
        }
        .padding(.horizontal, 11).padding(.bottom, 9)
      }
      .overlay(alignment: .topLeading) {
        Text(f.feed.s("tonightTitle")).font(.system(size: 10.5, weight: .bold)).foregroundStyle(WColor.accent).padding(.leading, 11).padding(.top, 9)
      }
      .clipShape(RoundedRectangle(cornerRadius: 12))
    }
  }

  func posterCard(_ m: WMovie) -> some View {
    HStack(alignment: .top, spacing: 12) {
      Link(destination: WLink.title(m.asTitle)) { Poster(f: f, path: m.poster_path, w: 100, h: 150, r: 10) }
      VStack(alignment: .leading, spacing: 4) {
        Text(f.feed.s("tonightTitle")).font(.system(size: 10.5, weight: .bold)).foregroundStyle(WColor.accent)
        Text(m.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
        subLine(m, color: WColor.muted)
        Spacer(minLength: 0)
        chips
      }
      .padding(.vertical, 4)
    }
  }
}

/* W30 — نصفُ صفّ */
struct Half: View {
  let f: V2Feed
  let key: String
  let opts: [String: Any]
  var count: Int = 3
  let now: Date

  var body: some View {
    let o = opts[key] as? [String: Any] ?? [:]
    if key == "tonight" {
      PosterColumn(f: f, key: key, now: now, buttons: (o["small"] as? String ?? "poster") != "list")
    } else {
      HalfList(f: f, key: key, posters: key != "tonight" && (o["view"] as? String) == "posters", count: count, now: now)
    }
  }
}

/** W30 — القسمُ الصغير: ثلاثةُ أسطرٍ أو بوستران (فيلم الليلة قائمةً: فيلمٌ واحد، W34) */
struct HalfList: View {
  let f: V2Feed
  let key: String
  let posters: Bool
  var count: Int = 3
  let now: Date

  var body: some View {
    let items = Sections.lines(f, key, now: now)
    VStack(alignment: .leading, spacing: 4) {
      SecHeader(title: Sections.title(f, key), link: Sections.link(key))
      if posters {
        GeometryReader { g in
          let pw = max(0, (g.size.width - 8) / 2)
          HStack(spacing: 8) {
            ForEach(0..<2, id: \.self) { n in
              if n < items.count {
                /* ٢:٣ بلا مطّ: الأقصرُ من عرض النصف وارتفاع الجسم يحكم */
                let ph = min(g.size.height, pw * 1.5)
                Link(destination: items[n].link) { Poster(f: f, path: items[n].t?.poster_path, w: ph / 1.5, h: ph, r: 6) }
              } else {
                Color.clear.frame(width: pw)
              }
            }
          }
        }
      } else {
        /* الأسطرُ الثلاثةُ تتقاسم ارتفاعَ الخانة كلَّه */
        VStack(alignment: .leading, spacing: 0) {
          ForEach(Array(items.prefix(key == "tonight" ? 1 : count).enumerated()), id: \.offset) { pair in
            Link(destination: pair.element.link) {
              HStack(spacing: 8) {
                Poster(f: f, path: pair.element.t?.poster_path, w: 30, h: 45, r: 4)
                VStack(alignment: .leading, spacing: 1) {
                  Text(pair.element.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(WColor.fg).lineLimit(1)
                  if let s = pair.element.sub, !s.isEmpty { Text(s).font(.system(size: 12)).foregroundStyle(WColor.muted).lineLimit(1) }
                }
                Spacer(minLength: 0)
              }
              .frame(maxHeight: .infinity)
            }
          }
        }
      }
    }
  }
}

/** W34 · W35 — بوسترٌ ٢:٣ كاملٌ بطول الخانة وعمودٌ بجانبه: 🔁 فوق، والتقييمُ والمدّة، و✓ تحت */
struct PosterColumn: View {
  let f: V2Feed
  let key: String
  let now: Date
  var buttons: Bool = true

  /** الزرُّ الدائريُّ الرماديّ (W36) */
  func circle(_ icon: String) -> some View {
    Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.fg)
      .frame(width: 28, height: 28)
      .background(Circle().fill(Color(red: 22 / 255, green: 22 / 255, blue: 22 / 255).opacity(0.78)))
      .overlay(Circle().stroke(Color.white.opacity(0.08), lineWidth: 1))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if key == "tonight" {
        SecHeader(title: Sections.title(f, key), link: nil)
        if let m = Sections.tonight(f, now: now) {
          column(t: m.asTitle, meta: Sections.tonightSub(m, f), cycle: buttons && f.tonight.count > 1 && !(f.feed.check && WState.undoOn("movie", m.id)), action: buttons ? "watched" : "")
        } else {
          Text(f.feed.s("noTowatchMovies")).font(.system(size: 11)).foregroundStyle(WColor.muted)
        }
      } else {
        let all = f.arr("towatch")
        SecHeader(title: all.count > 1 ? "\(Sections.title(f, key)) · \(all.count)" : Sections.title(f, key), link: Sections.link(key))
        if let x = all.first, let t = f.title(x) {
          let rating = num(x["rating"]).map { "★ " + String(format: "%.1f", $0) }
          column(t: t, meta: [x["type_label"] as? String, rating].compactMap { $0 }.joined(separator: " · "), cycle: false, action: x["action"] as? String ?? "start")
        }
      }
    }
  }

  func column(t: WTitle, meta: String, cycle: Bool, action: String) -> some View {
    GeometryReader { g in
      /* 🆕 البوسترُ ٢:٣ حتّى عرض ٨٠ ووسطَ الخانة — فيبقى للاسم عرضٌ في النصف ولا يتداخل مع جاره (١٤ أكتوبر) */
      let pw = min(g.size.height * 2 / 3, 80)
      HStack(alignment: .center, spacing: 8) {
        Link(destination: WLink.title(t)) { Poster(f: f, path: t.poster_path, w: pw, h: pw * 1.5, r: 8) }
        /* البوسترُ بطول الخانة، وبجانبه 🔁 فوق والاسمُ والتفاصيلُ و✓ تحت — بلا فراغٍ وسط العمود */
        VStack(alignment: .leading, spacing: 0) {
          if cycle {
            Button(intent: CycleTonightIntent()) { WChip(icon: "repeat", text: nil) }.buttonStyle(.plain)
          }
          Spacer(minLength: 0)
          Text(t.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
          let movie = action == "watched"
          let undoing = !action.isEmpty && f.feed.check && WState.undoOn(movie ? "movie" : "start", t.id)
          if undoing {
            /* W37 — «✓ شاهدته/بدأته» و«↶ تراجع» خمسَ ثوانٍ */
            Text("✓ " + (movie ? f.s2("watched") : f.s2or("started", "بدأته", "Started"))).font(.system(size: 12, weight: .semibold)).foregroundStyle(WColor.success).lineLimit(1).padding(.top, 3)
          } else if !meta.isEmpty { Text(meta).font(.system(size: 12)).foregroundStyle(WColor.muted).lineLimit(2).padding(.top, 3) }
          Spacer(minLength: 0)
          if undoing {
            Button(intent: UndoActionIntent()) { circle("arrow.uturn.backward") }.buttonStyle(.plain)
          } else if !action.isEmpty && f.feed.check {
            if movie {
              Button(intent: MarkMovieIntent(id: t.id, name: t.title, poster: t.poster_path)) { circle("checkmark") }.buttonStyle(.plain)
            } else {
              Button(intent: StartShowIntent(id: t.id)) { circle("play.fill") }.buttonStyle(.plain)
            }
          } else if !action.isEmpty {
            Link(destination: movie ? WLink.title(t) : WLink.start(t, action: "start")) { circle(movie ? "checkmark" : "play.fill") }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }
}

/* W39 — السطرُ المختصر */
struct LineRow: View {
  let f: V2Feed
  let key: String
  let now: Date

  var body: some View {
    let it = Sections.lines(f, key, now: now).first
    Link(destination: it?.link ?? Sections.link(key) ?? WLink.discover) {
      HStack(spacing: 10) {
        if let it { Poster(f: f, path: it.t?.poster_path, w: 28, h: 42, r: 4) }
        VStack(alignment: .leading, spacing: 1) {
          Text(Sections.title(f, key)).font(.system(size: 10, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
          Text([it?.name, it?.sub].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ").ifEmpty("—"))
            .font(.system(size: 12)).foregroundStyle(WColor.fg).lineLimit(1)
        }
        Spacer(minLength: 0)
      }
    }
  }
}

extension String {
  func ifEmpty(_ other: String) -> String { isEmpty ? other : self }
}

/* ───────── الحجمُ الصغير (W33 · W34 · W35) — الآيفونُ مربّع ───────── */

struct SmallMain: View {
  let f: V2Feed
  let small: [String: Any]
  let opts: [String: Any]
  let now: Date

  var body: some View {
    let key = small["key"] as? String ?? "cont"
    let form = small["square"] as? String ?? "list"
    switch form {
    case "headerFade":
      SmallFade(f: f, now: now)
    case "posterColumn":
      PosterColumn(f: f, key: key, now: now).padding(12)
        .widgetURL(Sections.lines(f, key, now: now).first?.link ?? WLink.discover)
    default:
      HalfList(f: f, key: key, posters: key != "tonight" && ((opts[key] as? [String: Any])?["view"] as? String) == "posters", now: now).padding(12)
        .widgetURL(Sections.link(key) ?? Sections.lines(f, key, now: now).first?.link ?? WLink.discover)
    }
  }
}

/** W33 — «أكمل المشاهدة» الصغير: الهيدرُ كلُّه بعرض الودجت (≈١٧٠×١٠٠، مطٌّ ~٤٪) يذوب في الأسود، والكلامُ تحته */
struct SmallFade: View {
  let f: V2Feed
  let now: Date

  var body: some View {
    let c = f.feed.continue.items.first
    GeometryReader { g in
      ZStack(alignment: .topLeading) {
        WColor.bg
        if let c, let img = FeedStore.image(c.backdrop_path ?? c.poster_path, in: f.feed, maxPixel: 600) {
          Image(uiImage: img).resizable().frame(width: g.size.width, height: g.size.width * 9 / 16)
            .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.45), .init(color: WColor.bg, location: 1)], startPoint: .top, endPoint: .bottom))
        }
        VStack(alignment: .leading, spacing: 2) {
          let total = f.feed.continue.total
          Text(total > 1 ? "\(f.feed.s("continueTitle")) · \(total)" : f.feed.s("continueTitle"))
            .font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
          Spacer(minLength: 0)
          if let c {
            HStack(alignment: .bottom) {
              VStack(alignment: .leading, spacing: 2) {
                Text(c.title).font(.system(size: 13, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1)
                Text(c.sub ?? c.label ?? "").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Color.white.opacity(0.75)).lineLimit(1)
              }
              Spacer(minLength: 4)
              CheckButton(feed: f.feed, item: c, size: 28)
            }
          } else {
            Text(f.feed.s("startSomething")).font(.system(size: 12)).foregroundStyle(WColor.muted)
          }
        }
        .padding(11)
      }
    }
    .widgetURL(c.map { WLink.title($0.asTitle) } ?? WLink.discover)
  }
}
