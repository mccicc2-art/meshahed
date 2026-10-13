import AppIntents
import SwiftUI
import WidgetKit

/**
 * ====== 🆕 ودجتاتُ لوبز في iOS (خطّةُ الودجتات W1 … W13) ======
 *
 * «أكمل المشاهدة» (صغير · متوسط · كبير · مستطيلُ شاشة القفل) · «القادم» (صغير · سطرٌ فوق الساعة · مستطيل) ·
 * «فيلم الليلة» (صغير · متوسط). **التصميمُ هو تصميمُ أندرويد** — الحالاتُ والنصوصُ والروابطُ واحدة (W1).
 * الأسودُ دائماً (W2)، لا شريطَ تقدّم (W3)، ولا ✓ على شاشة القفل (الجوالُ مقفول: أيُّ أحدٍ يمسكه يعلّم).
 */
@main
struct LoopzWidgetsBundle: WidgetBundle {
  var body: some Widget {
    ContinueWidget()
    ComingUpWidget()
    TonightWidget()
  }
}

struct WEntry: TimelineEntry {
  let date: Date
  let state: FeedState
  let source: String
}

/** الآن، ثمّ منتصفُ الليل — «اليوم» تتبدّل بلا فتح التطبيق، والتطبيقُ يطلب إعادةَ الرسم كلّما كتب */
func entries(_ state: FeedState, source: String) -> Timeline<WEntry> {
  let now = Date()
  let cal = Calendar.current
  let midnight = cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: now) ?? now)
  let after = cal.date(byAdding: .day, value: 1, to: midnight) ?? midnight
  return Timeline(
    entries: [WEntry(date: now, state: state, source: source), WEntry(date: midnight, state: state, source: source)],
    policy: .after(after)
  )
}

/* ============ «أكمل المشاهدة» ============ */

struct ContinueProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> WEntry { WEntry(date: Date(), state: .none, source: "continue") }

  func snapshot(for configuration: ContinueConfigIntent, in context: Context) async -> WEntry {
    WEntry(date: Date(), state: FeedStore.load(), source: configuration.source?.id ?? "continue")
  }

  func timeline(for configuration: ContinueConfigIntent, in context: Context) async -> Timeline<WEntry> {
    let source = configuration.source?.id ?? "continue"
    if source.hasPrefix("list:") { FeedStore.noteConfigured(list: String(source.dropFirst(5))) }
    return entries(FeedStore.load(), source: source)
  }
}

struct ContinueWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "LoopzContinue", intent: ContinueConfigIntent.self, provider: ContinueProvider()) { entry in
      ContinueView(entry: entry)
    }
    .configurationDisplayName(LocalizedStringResource("continue.name"))
    .description(LocalizedStringResource("continue.desc"))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    .contentMarginsDisabled()
  }
}

/** خانةٌ مرسومة: عملٌ، أو باهتةٌ من «للمشاهدة» (W5)، أو «ابدأ عملاً» */
enum Slot: Hashable {
  case item(WTitle, sub: String?, link: URL, check: WContinue?)
  case faded(WTitle, sub: String, link: URL)
  case start(String)
}

struct Source {
  let title: String
  let all: (String, URL)?
  let header: URL?
  let slots: [Slot]
}

func sourceOf(_ f: WFeed, _ src: String, max: Int = 3) -> Source {
  let type = { (t: WTitle) in t.kind == "movie" ? f.s("movieType") : f.s("seriesType") }
  if src == "towatch" {
    return Source(title: f.s("towatchTitle"), all: nil, header: WLink.all("towatch"),
                  slots: f.towatch_all.prefix(max).map { .item($0, sub: type($0), link: WLink.title($0), check: nil) })
  }
  if src.hasPrefix("list:"), let l = f.lists.first(where: { "list:\($0.id)" == src }) {
    return Source(title: l.name, all: nil, header: WLink.list(l.id),
                  slots: l.items.prefix(max).map { .item($0, sub: type($0), link: WLink.title($0), check: nil) })
  }
  var slots: [Slot] = f.continue.items.prefix(max).map { .item($0.asTitle, sub: $0.label, link: WLink.title($0.asTitle), check: $0) }
  var seen = Set(f.continue.items.prefix(max).map(\.id))
  for w in f.towatch_series where slots.count < max && !seen.contains(w.id) {
    seen.insert(w.id)
    slots.append(.faded(w.asTitle, sub: f.s("towatchStart"), link: WLink.start(w.asTitle, action: w.action)))
  }
  if slots.count < max && f.towatch_series.isEmpty { slots.append(.start(f.s("startSomething"))) }
  let all = f.continue.total > max ? (f.s("allCount").replacingOccurrences(of: "%d", with: "\(f.continue.total)"), WLink.all("continue")) : nil
  return Source(title: f.s("continueTitle"), all: all, header: WLink.all("continue"), slots: slots)
}

struct ContinueView: View {
  let entry: WEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch entry.state {
      case .ready(let f):
        content(f)
          .environment(\.layoutDirection, f.rtl ? .rightToLeft : .leftToRight)
          .environment(\.locale, f.locale)
      case .signedOut: EmptyNote(text: String(localized: "signed.out"))
      case .none: EmptyNote(text: String(localized: "open.app"))
      }
    }
    .containerBackground(for: .widget) { WColor.bg }
  }

  @ViewBuilder func content(_ f: WFeed) -> some View {
    switch family {
    case .systemSmall: SmallContinue(feed: f, source: sourceOf(f, entry.source, max: 1))
    case .systemLarge:
      VStack(alignment: .leading, spacing: 0) {
        SlotRow(feed: f, source: sourceOf(f, entry.source))
        Divider().overlay(Color.white.opacity(0.08)).padding(.top, 13).padding(.bottom, 11)
        UpcomingList(feed: f, now: entry.date)
        Spacer(minLength: 0)
      }
      .padding(13)
    case .accessoryRectangular: LockContinue(feed: f, source: sourceOf(f, entry.source, max: 1))
    default: SlotRow(feed: f, source: sourceOf(f, entry.source)).padding(13)
    }
  }
}

struct EmptyNote: View {
  let text: String
  var body: some View {
    Text(text).font(.system(size: 12)).foregroundStyle(WColor.muted).multilineTextAlignment(.center).padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct Poster: View {
  let feed: WFeed
  let path: String?
  let maxPixel: CGFloat
  var radius: CGFloat = 8
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: radius).fill(WColor.surface)
      if let img = FeedStore.image(path, in: feed, maxPixel: maxPixel) {
        Image(uiImage: img).resizable().scaledToFill()
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: radius))
  }
}

struct Header: View {
  let title: String
  let link: URL?
  let all: (String, URL)?
  var body: some View {
    HStack {
      if let link { Link(destination: link) { titleText } } else { titleText }
      Spacer(minLength: 8)
      if let all { Link(destination: all.1) { Text(all.0).font(.system(size: 11)).foregroundStyle(WColor.muted) } }
    }
    .padding(.bottom, 9)
  }
  var titleText: some View { Text(title).font(.system(size: 12, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1) }
}

struct SlotRow: View {
  let feed: WFeed
  let source: Source
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Header(title: source.title, link: source.header, all: source.all)
      HStack(alignment: .top, spacing: 10) {
        ForEach(0..<3, id: \.self) { i in
          if i < source.slots.count { SlotView(feed: feed, slot: source.slots[i]) } else { Color.clear.frame(maxWidth: .infinity) }
        }
      }
    }
  }
}

struct SlotView: View {
  let feed: WFeed
  let slot: Slot
  var body: some View {
    switch slot {
    case .item(let t, let sub, let link, let check):
      Link(destination: link) {
        VStack(alignment: .leading, spacing: 0) {
          Poster(feed: feed, path: t.poster_path, maxPixel: 300).frame(height: 62)
            .overlay(alignment: .topTrailing) { CheckButton(feed: feed, item: check, size: 26).padding(4) }
          Text(t.title).font(.system(size: 12)).foregroundStyle(WColor.fg).lineLimit(1).padding(.top, 5)
          Text(sub ?? " ").font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity)
    case .faded(let t, let sub, let link):
      Link(destination: link) {
        VStack(alignment: .leading, spacing: 0) {
          Poster(feed: feed, path: t.poster_path, maxPixel: 300).frame(height: 62).opacity(0.55)
          Text(t.title).font(.system(size: 12)).foregroundStyle(WColor.fg.opacity(0.55)).lineLimit(1).padding(.top, 5)
          Text(sub).font(.system(size: 11)).foregroundStyle(WColor.accent).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity)
    case .start(let text):
      Link(destination: WLink.discover) {
        VStack(alignment: .leading, spacing: 0) {
          RoundedRectangle(cornerRadius: 8).strokeBorder(WColor.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            .overlay(Text("+").font(.system(size: 18)).foregroundStyle(WColor.muted)).frame(height: 62)
          Text(text).font(.system(size: 12)).foregroundStyle(WColor.muted).lineLimit(1).padding(.top, 5)
          Text(" ").font(.system(size: 11))
        }
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/** ✓ (W14) — لا يُرسم إلّا حين يكتب الخادمُ `check: true` (الدفعة الثانية) */
struct CheckButton: View {
  let feed: WFeed
  let item: WContinue?
  let size: CGFloat
  var body: some View {
    if feed.check, let item, let s = item.season, let e = item.episode {
      Button(intent: MarkEpisodeIntent(show: item.id, season: s, episode: e, label: item.label ?? "")) {
        Image(systemName: "checkmark").font(.system(size: size * 0.42, weight: .bold)).foregroundStyle(WColor.fg)
          .frame(width: size, height: size)
          .background(Circle().fill(Color.black.opacity(0.55)))
          .overlay(Circle().stroke(Color.white.opacity(0.35), lineWidth: 1))
      }
      .buttonStyle(.plain)
    }
  }
}

/** الصغير = ص١: عملٌ واحدٌ ثابتٌ بملصقٍ كامل (W8) */
struct SmallContinue: View {
  let feed: WFeed
  let source: Source
  var body: some View {
    switch source.slots.first ?? .start(feed.s("startSomething")) {
    case .item(let t, let sub, let link, let check):
      FullPoster(feed: feed, path: t.poster_path, faded: false) {
        VStack(alignment: .leading, spacing: 0) {
          HStack(alignment: .top) {
            if let undo = UndoInfo.current(), feed.check, check != nil {
              Button(intent: UnmarkEpisodeIntent(show: undo.show, season: undo.season, episode: undo.episode)) {
                Text("✓ \(undo.label) · \(feed.s("undo").isEmpty ? "↶" : feed.s("undo"))").font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.success)
              }
              .buttonStyle(.plain)
            } else {
              Text(check != nil ? feed.s("next") : source.title).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent)
            }
            Spacer()
            CheckButton(feed: feed, item: check, size: 34)
          }
          Spacer()
          Text(t.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
          Text(sub ?? "").font(.system(size: 11)).foregroundStyle(Color(white: 0.87)).lineLimit(2).padding(.top, 2)
        }
      }
      .widgetURL(link)
    case .faded(let t, _, let link):
      FullPoster(feed: feed, path: t.poster_path, faded: true) {
        VStack(alignment: .leading, spacing: 0) {
          Text(feed.s("towatchTitle")).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.muted)
          Spacer()
          Text(t.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg.opacity(0.75)).lineLimit(2)
          Text(feed.s("start") + " ›").font(.system(size: 11)).foregroundStyle(WColor.accent).padding(.top, 2)
        }
      }
      .widgetURL(link)
    case .start(let text):
      VStack(spacing: 10) {
        RoundedRectangle(cornerRadius: 7).strokeBorder(WColor.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
          .overlay(Text("+").font(.system(size: 18)).foregroundStyle(WColor.muted)).frame(width: 46, height: 62)
        Text(text).font(.system(size: 12)).foregroundStyle(WColor.muted)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .widgetURL(WLink.discover)
    }
  }
}

/** ملصقٌ يملأ الودجت وحجابٌ أثقلُ أسفلَ حيث الحروف (`art-veil`) */
struct FullPoster<Content: View>: View {
  let feed: WFeed
  let path: String?
  let faded: Bool
  @ViewBuilder let content: () -> Content
  var body: some View {
    ZStack {
      if let img = FeedStore.image(path, in: feed, maxPixel: 520) {
        Image(uiImage: img).resizable().scaledToFill().opacity(faded ? 0.55 : 1)
      } else {
        WColor.surface
      }
      LinearGradient(colors: [Color.black.opacity(0.2), Color.black.opacity(0.4), Color.black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
      content().padding(12).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

struct LockContinue: View {
  let feed: WFeed
  let source: Source
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(source.title).font(.system(size: 12)).opacity(0.75).lineLimit(1)
      switch source.slots.first ?? .start(feed.s("startSomething")) {
      case .item(let t, let sub, _, _):
        Text(t.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
        if let sub { Text(sub).font(.system(size: 12)).lineLimit(1) }
      case .faded(let t, _, _):
        Text(t.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
        Text(feed.s("towatchStart")).font(.system(size: 12)).lineLimit(1)
      default:
        Text(feed.s("startSomething")).font(.system(size: 13)).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .widgetURL(lockLink)
  }
  var lockLink: URL {
    switch source.slots.first ?? .start("") {
    case .item(_, _, let link, _): return link
    case .faded(_, _, let link): return link
    default: return WLink.discover
    }
  }
}

/* ============ «القادم» ============ */

struct UpcomingList: View {
  let feed: WFeed
  let now: Date
  var body: some View {
    let up = feed.upcomingNow(now)
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        Link(destination: WLink.calendar) { Text(feed.s("comingUpTitle")).font(.system(size: 12, weight: .bold)).foregroundStyle(WColor.accent) }
        Spacer()
        if feed.upcoming.total > 3 { Link(destination: WLink.calendar) { Text(feed.s("all")).font(.system(size: 11)).foregroundStyle(WColor.muted) } }
      }
      if up.isEmpty {
        Text(feed.s("noUpcoming")).font(.system(size: 12)).foregroundStyle(WColor.muted).frame(maxWidth: .infinity, minHeight: 60)
      }
      ForEach(Array(up.prefix(3).enumerated()), id: \.offset) { _, u in
        Link(destination: WLink.title(u.asTitle)) {
          HStack(spacing: 10) {
            Poster(feed: feed, path: u.poster_path, maxPixel: 120, radius: 6).frame(width: 28, height: 40)
            VStack(alignment: .leading, spacing: 0) {
              Text(u.title).font(.system(size: 12)).foregroundStyle(WColor.fg).lineLimit(1)
              Text(u.behind_label ?? u.label ?? " ").font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1)
            }
            Spacer(minLength: 8)
            if let d = u.date { DayChip(text: WDates.label(d, feed: feed, now: now), today: WDates.isToday(d, now: now)) }
          }
        }
      }
    }
  }
}

struct DayChip: View {
  let text: String
  let today: Bool
  var glass = false
  var body: some View {
    Text(text).font(.system(size: 11)).lineLimit(1)
      .foregroundStyle(today ? Color(red: 5 / 255, green: 5 / 255, blue: 5 / 255) : (glass ? WColor.fg : WColor.muted))
      .padding(.horizontal, 8).padding(.vertical, 2)
      .background(Capsule().fill(today ? WColor.accent : (glass ? Color.black.opacity(0.6) : WColor.surface2)))
  }
}

struct SimpleProvider: TimelineProvider {
  func placeholder(in context: Context) -> WEntry { WEntry(date: Date(), state: .none, source: "") }
  func getSnapshot(in context: Context, completion: @escaping (WEntry) -> Void) { completion(WEntry(date: Date(), state: FeedStore.load(), source: "")) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<WEntry>) -> Void) { completion(entries(FeedStore.load(), source: "")) }
}

struct ComingUpWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LoopzComingUp", provider: SimpleProvider()) { entry in ComingUpView(entry: entry) }
      .configurationDisplayName(LocalizedStringResource("comingup.name"))
      .description(LocalizedStringResource("comingup.desc"))
      .supportedFamilies([.systemSmall, .accessoryInline, .accessoryRectangular])
      .contentMarginsDisabled()
  }
}

struct ComingUpView: View {
  let entry: WEntry
  @Environment(\.widgetFamily) var family
  var body: some View {
    Group {
      switch entry.state {
      case .ready(let f):
        content(f).environment(\.layoutDirection, f.rtl ? .rightToLeft : .leftToRight).environment(\.locale, f.locale)
      case .signedOut: EmptyNote(text: String(localized: "signed.out"))
      case .none: EmptyNote(text: String(localized: "open.app"))
      }
    }
    .containerBackground(for: .widget) { WColor.bg }
  }

  @ViewBuilder func content(_ f: WFeed) -> some View {
    let up = f.upcomingNow(entry.date)
    let u = up.first
    switch family {
    case .accessoryInline:
      if let u { Text(inline(u, f)) } else { Text(f.s("noUpcoming")) }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(f.s("comingUpTitle")).font(.system(size: 12)).opacity(0.75)
        if let u {
          Text(u.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
          Text([u.label, u.date.map { WDates.label($0, feed: f, now: entry.date) }].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 12)).lineLimit(1)
        } else {
          Text(f.s("noUpcoming")).font(.system(size: 12)).lineLimit(2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .widgetURL(u.map { WLink.title($0.asTitle) } ?? WLink.calendar)
    default:
      if let u {
        let same = up.dropFirst().filter { $0.date == u.date && u.date != nil }.count
        FullPoster(feed: f, path: u.poster_path, faded: false) {
          VStack(alignment: .leading, spacing: 0) {
            if let d = u.date {
              DayChip(text: WDates.label(d, feed: f, now: entry.date) + (same > 0 ? "  +\(same)" : ""), today: WDates.isToday(d, now: entry.date), glass: true)
            }
            Spacer()
            Text(u.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
            Text(u.behind_label ?? u.label ?? "").font(.system(size: 11)).foregroundStyle(Color(white: 0.87)).lineLimit(2).padding(.top, 2)
          }
        }
        .widgetURL(same > 0 ? WLink.calendar : WLink.title(u.asTitle))
      } else {
        EmptyNote(text: f.s("noUpcoming")).widgetURL(WLink.calendar)
      }
    }
  }

  /** «Shogun الليلة» فوق الساعة: الاسمُ وموعدُه في سطرٍ واحد */
  func inline(_ u: WUpcoming, _ f: WFeed) -> String {
    guard let d = u.date else { return u.title }
    return "\(u.title) · \(WDates.label(d, feed: f, now: entry.date))"
  }
}

/* ============ «فيلم الليلة» (W12) ============ */

struct TonightWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LoopzTonight", provider: SimpleProvider()) { entry in TonightView(entry: entry) }
      .configurationDisplayName(LocalizedStringResource("tonight.name"))
      .description(LocalizedStringResource("tonight.desc"))
      .supportedFamilies([.systemSmall, .systemMedium])
      .contentMarginsDisabled()
  }
}

struct TonightView: View {
  let entry: WEntry
  @Environment(\.widgetFamily) var family
  var body: some View {
    Group {
      switch entry.state {
      case .ready(let f):
        content(f).environment(\.layoutDirection, f.rtl ? .rightToLeft : .leftToRight).environment(\.locale, f.locale)
      case .signedOut: EmptyNote(text: String(localized: "signed.out"))
      case .none: EmptyNote(text: String(localized: "open.app"))
      }
    }
    .containerBackground(for: .widget) { WColor.bg }
  }

  func current(_ f: WFeed) -> WMovie? {
    guard !f.tonight.isEmpty else { return nil }
    let n = FeedStore.defaults?.integer(forKey: "tonightIndex") ?? 0
    return f.tonight[((n % f.tonight.count) + f.tonight.count) % f.tonight.count]
  }

  func sub(_ m: WMovie, _ f: WFeed) -> String {
    var parts: [String] = []
    if let r = WDates.runtime(m.runtime, feed: f) { parts.append(r) }
    if m.source == "suggested", let rating = m.rating { parts.append("★ " + String(format: "%.1f", rating)) }
    return parts.joined(separator: " · ")
  }

  @ViewBuilder func content(_ f: WFeed) -> some View {
    if let m = current(f) {
      if family == .systemMedium {
        HStack(spacing: 12) {
          Link(destination: WLink.title(m.asTitle)) { Poster(feed: f, path: m.poster_path, maxPixel: 360).frame(width: 82) }
          VStack(alignment: .leading, spacing: 0) {
            Text(f.s("tonightTitle")).font(.system(size: 12, weight: .bold)).foregroundStyle(WColor.accent)
            Spacer()
            Link(destination: WLink.title(m.asTitle)) {
              Text(m.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
            }
            Text([sub(m, f), m.source == "suggested" ? "" : f.s("fromTowatch")].filter { !$0.isEmpty }.joined(separator: " · "))
              .font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1).padding(.top, 3)
            if m.source == "suggested" { Text(f.s("suggested")).font(.system(size: 11)).foregroundStyle(WColor.accent) }
            Spacer()
            if f.tonight.count > 1 {
              Button(intent: CycleTonightIntent()) {
                Text(f.s("anotherMovie")).font(.system(size: 11)).foregroundStyle(WColor.fg)
                  .padding(.horizontal, 10).padding(.vertical, 4).background(Capsule().fill(WColor.surface2))
              }
              .buttonStyle(.plain)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(13)
      } else {
        FullPoster(feed: f, path: m.poster_path, faded: false) {
          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
              Text(f.s("tonightTitle")).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent)
              Spacer()
              if f.tonight.count > 1 {
                Button(intent: CycleTonightIntent()) {
                  Image(systemName: "arrow.clockwise").font(.system(size: 13, weight: .bold)).foregroundStyle(WColor.fg)
                    .frame(width: 30, height: 30).background(Circle().fill(Color.black.opacity(0.55)))
                }
                .buttonStyle(.plain)
              }
            }
            Spacer()
            Text(m.title).font(.system(size: 14, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(2)
            Text(sub(m, f)).font(.system(size: 11)).foregroundStyle(Color(white: 0.87)).lineLimit(1).padding(.top, 2)
          }
        }
        .widgetURL(WLink.title(m.asTitle))
      }
    } else {
      EmptyNote(text: f.s("noTowatchMovies")).widgetURL(WLink.discover)
    }
  }
}
