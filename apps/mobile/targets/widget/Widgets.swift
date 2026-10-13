import AppIntents
import SwiftUI
import WidgetKit

/**
 * ====== 🆕 ودجتاتُ لوبز في iOS (خطّةُ الودجتات W1 … W13) ======
 *
 * «أكمل المشاهدة» (صغير · متوسط · مستطيلُ شاشة القفل) · «القادم» (صغير · سطرٌ فوق الساعة · مستطيل) · «فيلم الليلة» (صغير).
 * **التصميمُ هو تصميمُ أندرويد** — الحالاتُ والنصوصُ والروابطُ واحدة (W1). الأسودُ دائماً (W2)، ولا ✓ على شاشة القفل.
 * 🆕 W17 — **بطاقةُ «أكمل المشاهدة» بطاقةُ الرئيسيّة نفسُها** (الصورةُ العريضة والنسبةُ والشريط — نقضُ W3).
 * 🆕 W24 — **لا كبيرَ في iOS ولا «فيلم الليلة» متوسط** (قرارُ أحمد: «الغيه» · «متوسط فلم الليلة احذفه»)؛ ومتوسطُ iOS
 * أقصرُ من 4×2 أندرويد (المقاسُ من آبل)، فالبطاقتان فيه أعرضُ قليلاً ومعهما سطرُ «القادم» («متوسط مع السطر»).
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
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
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
  var slots: [Slot] = f.continue.items.prefix(max).map { .item($0.asTitle, sub: $0.sub ?? $0.label, link: WLink.title($0.asTitle), check: $0) }
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
    case .accessoryRectangular: LockContinue(feed: f, source: sourceOf(f, entry.source, max: 1))
    default:
      VStack(alignment: .leading, spacing: 0) {
        CardsRow(feed: f, source: sourceOf(f, entry.source, max: 2))
        UpLine(feed: f, now: entry.date)
      }
      .padding(.horizontal, 12).padding(.top, 11).padding(.bottom, 4)
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

struct Header: View {
  let title: String
  let link: URL?
  let all: (String, URL)?
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "play.circle").font(.system(size: 14, weight: .semibold)).foregroundStyle(WColor.accent)
      if let link { Link(destination: link) { titleText } } else { titleText }
      Spacer(minLength: 8)
      if let all { Link(destination: all.1) { Text(all.0).font(.system(size: 11)).foregroundStyle(WColor.muted) } }
    }
    .padding(.bottom, 8)
  }
  var titleText: some View { Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1) }
}

struct CardsRow: View {
  let feed: WFeed
  let source: Source
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Header(title: source.title, link: source.header, all: source.all)
      HStack(spacing: 9) {
        ForEach(0..<2, id: \.self) { i in
          if i < source.slots.count { CardView(feed: feed, slot: source.slots[i]) } else { Color.clear.frame(maxWidth: .infinity) }
        }
      }
    }
  }
}

/**
 * 🆕 W17 · W18 — **بطاقةُ «أكمل المشاهدة» كما في الرئيسيّة** (`Cards.tsx`): الصورةُ تملأ البطاقة ويبقى أعلاها، وحجابُ
 * `poster-veil` على ستّين بالمئة من أسفلها، والاسمُ ١٣ والسطرُ الثاني ١١ والنسبةُ في طرفه، وشريطُ ٤ من جهة البداية.
 */
struct CardView: View {
  let feed: WFeed
  let slot: Slot
  var radius: CGFloat = 12
  var body: some View {
    switch slot {
    case .item(let t, let sub, let link, let check):
      Link(destination: link) { card(t, sub: sub, item: check, faded: false, subColor: Color.white.opacity(0.75)) }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .faded(let t, let sub, let link):
      Link(destination: link) { card(t, sub: sub, item: nil, faded: true, subColor: WColor.accent) }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .start(let text):
      Link(destination: WLink.discover) {
        RoundedRectangle(cornerRadius: radius).strokeBorder(WColor.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
          .overlay(Text("+  " + text).font(.system(size: 11)).foregroundStyle(WColor.muted).padding(8))
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  func card(_ t: WTitle, sub: String?, item: WContinue?, faded: Bool, subColor: Color) -> some View {
    ZStack(alignment: .bottom) {
      WColor.surface
      if let img = FeedStore.image(item?.backdrop_path ?? t.poster_path, in: feed, maxPixel: 640) {
        Image(uiImage: img).resizable().scaledToFill()
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
          .clipped()
          .opacity(faded ? 0.55 : 1)
      }
      GeometryReader { g in
        LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: Color.black.opacity(0.25), location: 0.5), .init(color: Color.black.opacity(0.85), location: 1)], startPoint: .top, endPoint: .bottom)
          .frame(height: g.size.height * 0.6)
          .frame(maxHeight: .infinity, alignment: .bottom)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(t.title).font(.system(size: 13, weight: .semibold)).foregroundStyle(faded ? Color.white.opacity(0.55) : Color.white).lineLimit(1)
        HStack(spacing: 8) {
          Text(sub ?? " ").font(.system(size: 11, weight: .semibold)).foregroundStyle(subColor).lineLimit(1)
          Spacer(minLength: 0)
          if let p = item?.pct { Text("\(p)%").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.white.opacity(0.7)) }
        }
      }
      .padding(.horizontal, 10).padding(.bottom, 8)
      .frame(maxWidth: .infinity, alignment: .leading)
      if let p = item?.pct {
        GeometryReader { g in
          ZStack(alignment: .leading) {
            Rectangle().fill(Color.white.opacity(0.12))
            Rectangle().fill(p >= 100 ? WColor.success : WColor.accent).frame(width: g.size.width * CGFloat(min(max(p, 0), 100)) / 100)
          }
        }
        .frame(height: 4)
      }
    }
    .overlay(alignment: .topTrailing) { CheckButton(feed: feed, item: item, size: 28).padding(6) }
    .clipShape(RoundedRectangle(cornerRadius: radius))
    .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Color.white.opacity(0.14), lineWidth: 1))
  }
}

/** سطرُ «القادم» تحت البطاقتين — أقربُ موعدٍ لمسلسلٍ يتابعه، ولمستُه التقويم */
struct UpLine: View {
  let feed: WFeed
  let now: Date
  var body: some View {
    let u = feed.upcomingNow(now).first
    Link(destination: WLink.calendar) {
      HStack(spacing: 8) {
        if let u {
          if let d = u.date { Text(WDates.label(d, feed: feed, now: now)).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1) }
          if let img = FeedStore.image(u.poster_path, in: feed, maxPixel: 90) {
            Image(uiImage: img).resizable().frame(width: 14, height: 21).clipShape(RoundedRectangle(cornerRadius: 3))
          }
          Text(u.title).font(.system(size: 11)).foregroundStyle(WColor.fg).lineLimit(1)
          if let l = u.behind_label ?? u.label { Text("· " + l).font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1) }
        } else {
          Text(feed.s("noUpcoming")).font(.system(size: 11)).foregroundStyle(WColor.muted).lineLimit(1)
        }
        Spacer(minLength: 0)
      }
      .frame(height: 24)
    }
    .padding(.top, 6)
    .overlay(alignment: .top) { Rectangle().fill(Color.white.opacity(0.09)).frame(height: 1).padding(.top, 2) }
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

/** الصغير = ص١: بطاقةُ «أكمل المشاهدة» واحدةٌ تملأ الودجت (W22) */
struct SmallContinue: View {
  let feed: WFeed
  let source: Source
  var body: some View {
    let slot = source.slots.first ?? .start(feed.s("startSomething"))
    CardView(feed: feed, slot: slot, radius: 0)
      .widgetURL(link(slot))
  }
  func link(_ s: Slot) -> URL {
    switch s {
    case .item(_, _, let l, _): return l
    case .faded(_, _, let l): return l
    default: return WLink.discover
    }
  }
}

/**
 * 🆕 W21 — **الصغيرُ بالملصق كبطاقة «To watch»**: الملصقُ كلُّه بمقاس الودجت (يُمَطّ ولا يُقصّ — «الصورة كاملة … عادي تمطها»)،
 * والتظليلُ خلف الكلام فقط فوق وتحت بالدرجة الوسط («اعتمد ب»)، ووسطُ الملصق صافٍ. الشارةُ فوق، والاسمُ على الحافة السفلى.
 */
struct PosterCard<Top: View>: View {
  let feed: WFeed
  let path: String?
  let title: String
  let sub: String
  @ViewBuilder let top: () -> Top
  var body: some View {
    ZStack {
      if let img = FeedStore.image(path, in: feed, maxPixel: 600) {
        Image(uiImage: img).resizable()
      } else {
        WColor.surface
      }
      GeometryReader { g in
        VStack(spacing: 0) {
          LinearGradient(colors: [Color.black.opacity(0.5), Color.clear], startPoint: .top, endPoint: .bottom)
            .frame(height: g.size.height * 0.21)
          Spacer(minLength: 0)
          LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: Color.black.opacity(0.42), location: 0.53), .init(color: Color.black.opacity(0.75), location: 1)], startPoint: .top, endPoint: .bottom)
            .frame(height: g.size.height * 0.38)
        }
      }
      VStack(alignment: .leading, spacing: 1) {
        top()
        Spacer(minLength: 0)
        if !sub.isEmpty { Text(sub).font(.system(size: 10)).foregroundStyle(Color(white: 0.84)).lineLimit(1) }
        Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(WColor.fg).lineLimit(1)
      }
      .padding(.horizontal, 10).padding(.top, 9).padding(.bottom, 9)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
        let day = u.date.map { WDates.label($0, feed: f, now: entry.date) }
        PosterCard(feed: f, path: u.poster_path, title: u.title, sub: u.behind_label ?? u.label ?? "") {
          Text(([f.s("comingUpTitle"), day].compactMap { $0 }.joined(separator: " · ")) + (same > 0 ? "  +\(same)" : ""))
            .font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
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
      .supportedFamilies([.systemSmall])
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
    if let rating = m.rating { parts.append("★ " + String(format: "%.1f", rating)) }
    if let r = WDates.runtime(m.runtime, feed: f) { parts.append(r) }
    return parts.joined(separator: " · ")
  }

  @ViewBuilder func content(_ f: WFeed) -> some View {
    if let m = current(f) {
      PosterCard(feed: f, path: m.poster_path, title: m.title, sub: sub(m, f)) {
        HStack(alignment: .top) {
          Text(f.s("tonightTitle")).font(.system(size: 11, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
          Spacer(minLength: 4)
          if f.tonight.count > 1 {
            Button(intent: CycleTonightIntent()) {
              Image(systemName: "arrow.clockwise").font(.system(size: 12, weight: .bold)).foregroundStyle(WColor.fg)
                .frame(width: 26, height: 26).background(Circle().fill(Color.black.opacity(0.55)))
            }
            .buttonStyle(.plain)
            .padding(.top, -3)
          }
        }
      }
      .widgetURL(WLink.title(m.asTitle))
    } else {
      EmptyNote(text: f.s("noTowatchMovies")).widgetURL(WLink.discover)
    }
  }
}
