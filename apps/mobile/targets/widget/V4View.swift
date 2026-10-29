import AppIntents
import SwiftUI
import WidgetKit

/**
 * ====== 🆕 v4 — «المعمل» (خالد ٣٠ أكتوبر): الودجتُ يرسم مواضعَ المحرّك ولا يحسب شيئاً ======
 *
 * 🔑 المحرّكُ (`src/core/widgetTiles.ts`) كتب كلَّ بطاقةٍ وخطٍّ وصفٍّ بموضعه بنقاط التصميم (الآيفون ٣٦٤ عرضاً، والصغيرُ ١٧٠)، وأرقامُ
 * الرسم معه (`w2.look4.ios.draw`). هنا نضرب في نسبة العرض الحقيقيّ ونرسم — فتعديلُ المقاسات والخطوط والمطّ يصل هوائيّاً بلا بناء.
 * - **بمقاسات الآيفون** (D-1577): التصميمُ بنقاط الآيفون نفسِه، والنسبةُ داخل عائلته (Pro ٣٣٨ ÷ ٣٦٤) لا مقياسُ أندرويد.
 * - العربيّة: المواضعُ تنعكس هنا (المحرّكُ يكتبها من اليسار)، والكلامُ من اليمين.
 */

/** أرقامُ الرسم من الخلاصة، وإلّا الافتراضيُّ المطابقُ للمحرّك (`DRAW_BASE` و`defaultV4Look`) */
struct Draw4 {
  let o: [String: Any]
  func n(_ k: String, _ def: CGFloat) -> CGFloat {
    guard let v = num(o[k]), v >= 0 else { return def }
    return CGFloat(v)
  }
}

/** فعلُ الزرّ في البطاقة */
enum Act4 {
  case undo
  case ep(WContinue)
  case movie(WTitle)
  case start(WTitle)
  case towatch(WTitle)
  case open(URL, String)

  var icon: String {
    switch self {
    case .undo: return "arrow.uturn.backward"
    case .ep, .movie: return "checkmark"
    case .start: return "play.fill"
    case .towatch: return "plus"
    case .open(_, let i): return i
    }
  }
}

/** عنصرٌ في بطاقة: صورتاه والكلامُ والوجهةُ وزرُّ الفعل؛ `line2` سطرُ صفّ القادم المكبّر */
struct I4 {
  let poster: String?
  let backdrop: String?
  let name: String
  let line: String
  let avatar: String?
  let link: URL
  var bar: Int? = nil
  var act: Act4? = nil
  var faded: Bool = false
  var line2: String? = nil
}

enum Items4 {
  /** عناصرُ القسم بترتيبها، ومن أين يبدأ (فيلمُ الليلة والسينما يدوران بـ↻) */
  static func of(_ f: V2Feed, _ key: String, now: Date) -> (items: [I4], base: Int) {
    let check = f.feed.check
    switch key {
    case "cont":
      let main: [I4] = f.feed.continue.items.map { c in
        var act: Act4? = nil
        if check && WState.undoOn("ep", c.id) { act = .undo } else if check && c.season != nil && c.episode != nil { act = .ep(c) }
        return I4(poster: c.poster_path, backdrop: c.backdrop_path, name: c.title, line: c.sub ?? c.label ?? "", avatar: nil, link: WLink.title(c.asTitle), bar: c.pct ?? 0, act: act)
      }
      /* أقلُّ من بطاقتين: الباقي من «للمشاهدة» باهتاً يبدأ العمل (W5) */
      let ids = Set(f.feed.continue.items.map { $0.id })
      let faded: [I4] = f.feed.towatch_series.filter { !ids.contains($0.id) && !f.hidden.contains($0.id) }.map { w in
        I4(poster: w.poster_path, backdrop: nil, name: w.title, line: f.feed.s("towatchStart"), avatar: nil, link: WLink.start(w.asTitle, action: w.action), faded: true)
      }
      /* لا شيءَ يُكمَل ولا شيءَ للمشاهدة: «ابدأ عملاً» يفتح الاكتشاف */
      let all = main + faded
      if all.isEmpty { return ([I4(poster: nil, backdrop: nil, name: "+  " + f.feed.s("startSomething"), line: "", avatar: nil, link: WLink.discover)], 0) }
      return (all, 0)
    case "tonight":
      let items: [I4] = f.tonight.map { m in
        let act: Act4 = check && WState.undoOn("movie", m.id) ? .undo : (check ? .movie(m.asTitle) : .open(WLink.title(m.asTitle), "checkmark"))
        return I4(poster: m.poster_path, backdrop: m.backdrop_path, name: m.title, line: Sections.tonightSub(m, f), avatar: nil, link: WLink.title(m.asTitle), act: act)
      }
      let day = Int((now.timeIntervalSince1970 + Double(TimeZone.current.secondsFromGMT(for: now))) / 86_400)
      return (items, day + (FeedStore.defaults?.integer(forKey: "tonightIndex") ?? 0))
    case "cine":
      let items: [I4] = f.cinema.compactMap { x in
        guard let t = f.title(x) else { return nil }
        let act: Act4
        if check && WState.undoOn("towatch", t.id) { act = .undo }
        else if (x["followed"] as? Bool ?? false) || f.hidden.contains(t.id) { act = .open(WLink.title(t), "checkmark") }
        else if check { act = .towatch(t) }
        else { act = .open(WLink.title(t), "plus") }
        return I4(poster: t.poster_path, backdrop: x["backdrop_path"] as? String, name: t.title, line: Sections.cineMeta(f, x), avatar: nil, link: WLink.title(t), act: act)
      }
      return (items, FeedStore.defaults?.integer(forKey: "cinemaIndex") ?? 0)
    case "tw":
      let items: [I4] = f.arr("towatch").compactMap { x in
        guard let t = f.title(x) else { return nil }
        let rating = num(x["rating"]).map { "★ " + String(format: "%.1f", $0) }
        let movie = (x["action"] as? String) == "watched"
        let act: Act4
        if check && WState.undoOn(movie ? "movie" : "start", t.id) { act = .undo }
        else if movie { act = check ? .movie(t) : .open(WLink.title(t), "checkmark") }
        else { act = check ? .start(t) : .open(WLink.start(t, action: "start"), "play.fill") }
        let line = [x["type_label"] as? String, rating].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return I4(poster: t.poster_path, backdrop: nil, name: t.title, line: line, avatar: nil, link: WLink.title(t), act: act)
      }
      return (items, 0)
    case "up":
      let items: [I4] = f.upcoming(now).compactMap { u in
        guard let t = f.title(u) else { return nil }
        let label = (u["label"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        let day = (u["date"] as? String).map { WDates.label($0, feed: f.feed, now: now) }
        return I4(poster: t.poster_path, backdrop: nil, name: t.title, line: [day, label].compactMap { $0 }.joined(separator: " · "), avatar: nil, link: WLink.title(t), line2: label)
      }
      return (items, 0)
    case "friends":
      /* أصدقاؤك: الصورةُ جنب الاسم (خالد ٠١:٠٣)، ثمّ وش سوّى ومتى */
      let items: [I4] = Sections.lines(f, key, now: now).map { l in
        I4(poster: l.t?.poster_path, backdrop: nil, name: l.name, line: [l.sub, l.time].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
           avatar: (l.raw?["avatar_url"] as? String).flatMap { $0.isEmpty ? nil : $0 }, link: l.link)
      }
      return (items, 0)
    case "act":
      let items: [I4] = Sections.lines(f, key, now: now).map { l in
        let title = l.t?.title ?? l.name
        let what = l.name == title ? nil : l.name
        return I4(poster: l.t?.poster_path, backdrop: nil, name: title, line: [what, l.sub, l.time].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "), avatar: nil, link: l.link)
      }
      return (items, 0)
    default:
      return ([], 0)
    }
  }

  static func rot(_ list: [I4], _ base: Int, _ i: Int) -> I4? {
    guard !list.isEmpty else { return nil }
    let n = list.count
    return list[(((base + i) % n) + n) % n]
  }
}

/** ↻ بخطوته: الخانةُ الكاملةُ ٣ ورا ٣، والنصُّ والصغيرُ واحدٌ واحد (خالد ٠١:٠١) */
struct CycleStepIntent: AppIntent {
  static let title: LocalizedStringResource = "intent.cycle"
  static let isDiscoverable = false
  @Parameter(title: "section") var section: String
  @Parameter(title: "step") var step: Int

  init() {}
  init(section: String, step: Int) {
    self.section = section
    self.step = step
  }

  func perform() async throws -> some IntentResult {
    let d = FeedStore.defaults
    let k = section == "cine" ? "cinemaIndex" : "tonightIndex"
    d?.set((d?.integer(forKey: k) ?? 0) + max(1, min(9, step)), forKey: k)
    return .result()
  }
}

/** الدائرةُ نفسُها لكلِّ زرّ — بقطرها من الأرقام، واللمسُ أوسعُ من الرسم */
struct Circle4: View {
  let icon: String
  let d: CGFloat
  var body: some View {
    Image(systemName: icon).font(.system(size: d * 0.42, weight: .bold)).foregroundStyle(icon == "arrow.uturn.backward" ? WColor.success : Color.white)
      .frame(width: d, height: d)
      .background(Circle().fill(Color.black.opacity(0.55)))
      .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 1))
      .frame(width: d + 10, height: d + 10)
      .contentShape(Rectangle())
  }
}

struct ActButton4: View {
  let act: Act4
  let d: CGFloat
  var body: some View {
    switch act {
    case .undo: Button(intent: UndoActionIntent()) { Circle4(icon: act.icon, d: d) }.buttonStyle(.plain)
    case .ep(let c): Button(intent: MarkEpisodeIntent(show: c.id, season: c.season ?? 0, episode: c.episode ?? 0, label: c.label ?? "")) { Circle4(icon: act.icon, d: d) }.buttonStyle(.plain)
    case .movie(let t): Button(intent: MarkMovieIntent(id: t.id, name: t.title, poster: t.poster_path)) { Circle4(icon: act.icon, d: d) }.buttonStyle(.plain)
    case .start(let t): Button(intent: StartShowIntent(id: t.id)) { Circle4(icon: act.icon, d: d) }.buttonStyle(.plain)
    case .towatch(let t): Button(intent: ToWatchIntent(id: t.id)) { Circle4(icon: act.icon, d: d) }.buttonStyle(.plain)
    case .open(let url, _): Link(destination: url) { Circle4(icon: act.icon, d: d) }
    }
  }
}

/** صورةٌ تغطّي مربّعها: مطٌّ حتّى `lim` ثمّ قصٌّ `cropTop` من فوق والباقي من تحت — وزومُ الصغير فوق وتحت */
struct Fit4: View {
  let f: V2Feed
  let path: String?
  let w: CGFloat
  let h: CGFloat
  let lim: CGFloat
  let cropTop: CGFloat
  var zoom: CGFloat = 0
  var faded: Bool = false
  var body: some View {
    if let img = FeedStore.image(path, in: f.feed, maxPixel: max(max(w, h) * 2, 60)), img.size.height > 0, h > 0 {
      let a = img.size.width / img.size.height
      let b = w / h
      let s = min(max(b, a / (1 + lim)), a * (1 + lim))
      let wider = b >= s
      let iw0 = wider ? w : h * s
      let ih0 = wider ? w / s : h
      let ih = zoom > 0 ? max(h, ih0 * (1 - zoom)) : ih0
      let iw = iw0
      let l = wider ? 0 : -(iw - w) / 2
      let t = -(ih - h) * cropTop
      Image(uiImage: img).resizable()
        .frame(width: iw, height: ih)
        .offset(x: l, y: t)
        .opacity(faded ? 0.55 : 1)
        .frame(width: w, height: h, alignment: .topLeading)
        .clipped()
    } else {
      WColor.surface.frame(width: w, height: h)
    }
  }
}

/** بطاقةُ المعمل: الصورةُ والعنوانُ الأصفرُ داخلها، والاسمُ وسطرُه تحت، والزرُّ في الزاوية و↻ فوق في الطرف */
struct Card4: View {
  let f: V2Feed
  let it: I4?
  let w: CGFloat
  let h: CGFloat
  /** نقاطُ الشاشة لكلِّ نقطة تصميم */
  let s: CGFloat
  let label: String?
  let small: Bool
  /** ↻: القسمُ وخطوتُه */
  let cyc: (String, Int)?
  let topBtn: Bool
  let bar: Bool
  let wide: Bool
  let zoom: CGFloat
  let rtl: Bool
  let d: Draw4

  /* كلُّ مقاسٍ محسوبٌ هنا مرّةً (رقمٌ واحدٌ لكلِّ تعبير — لا تعبيراتٍ مركّبةً يطول فحصُها عند الترجمة) */
  var radius: CGFloat { small ? 0 : d.n("radius", 10) * s }
  var cd: CGFloat { (small ? d.n("circleSmall", 28) : d.n("circle", 24)) * s }
  var pad: CGFloat { (small ? d.n("textPadSmall", 10) : d.n("textPad", 8)) * s }
  var inset: CGFloat { (small ? 7 : 4) * s }
  var labelSize: CGFloat { (small ? d.n("labelSmall", 11.5) : d.n("label", 10.5)) * s }
  var labelTop: CGFloat { (small ? 9 : 7) * s }
  var labelReserve: CGFloat { (cyc != nil || topBtn) ? cd + 10 * s : pad }
  var nameSize: CGFloat {
    if small { return d.n("nameSmall", 13.5) * s }
    let big: Bool = w / s > 120
    return (big ? d.n("nameBig", 12.5) : d.n("name", 11.5)) * s
  }
  var lineSize: CGFloat { (small ? d.n("lineSmall", 10.5) : d.n("line", 9)) * s }
  var avatarSize: CGFloat { (small ? d.n("avatarSmall", 18) : d.n("avatar", 16)) * s }
  var textBottom: CGFloat { (small ? d.n("textBottomSmall", 11) : d.n("textBottom", 7)) * s }
  var bottomBtn: Bool { !topBtn && it?.act != nil }
  var btnReserve: CGFloat { bottomBtn ? cd + (small ? 14 : 10) * s : pad }
  /** Circle4 يحيط الدائرةَ بخمس نقاطٍ للّمس — الإزاحةُ تعيد الدائرةَ إلى بعدها من الحافة (٤، والصغيرُ ٧) */
  var shift: CGFloat { 5 - inset }

  var body: some View {
    let labelW: CGFloat = max(1, w - pad - labelReserve)
    let labelX: CGFloat = rtl ? labelReserve : pad
    let textW: CGFloat = max(1, w - pad - btnReserve)
    let textX: CGFloat = rtl ? btnReserve : pad
    let textH: CGFloat = max(1, h - textBottom)
    let sideX: CGFloat = rtl ? -shift : shift
    let btnY: CGFloat = topBtn ? -shift : shift
    let cycShift: CGFloat = 5 - 4 * s
    let cycX: CGFloat = rtl ? -cycShift : cycShift
    let btnAlign: Alignment = topBtn ? (rtl ? .topLeading : .topTrailing) : (rtl ? .bottomLeading : .bottomTrailing)
    let cycAlign: Alignment = rtl ? .topLeading : .topTrailing
    let textAlign: Alignment = rtl ? .trailing : .leading
    let dir: LayoutDirection = rtl ? .rightToLeft : .leftToRight
    ZStack(alignment: .topLeading) {
      WColor.surface.frame(width: w, height: h)
      if let it {
        Link(destination: it.link) {
          ZStack(alignment: .topLeading) {
            Fit4(f: f, path: wide ? (it.backdrop ?? it.poster) : it.poster, w: w, h: h, lim: d.n("lim", 0.25), cropTop: d.n("cropTop", 0.35), zoom: zoom, faded: it.faded)
            LinearGradient(stops: [
              .init(color: Color.black.opacity(0.55), location: 0),
              .init(color: .clear, location: 0.28),
              .init(color: .clear, location: 0.5),
              .init(color: Color.black.opacity(0.92), location: 1),
            ], startPoint: .top, endPoint: .bottom)
            .frame(width: w, height: h)
            if let label {
              Label4(text: label, size: labelSize, s: s)
                .frame(width: labelW, alignment: textAlign)
                .offset(x: labelX, y: labelTop)
            }
            Text4(f: f, it: it, nameSize: nameSize, lineSize: lineSize, avatar: avatarSize, s: s)
              .environment(\.layoutDirection, dir)
              .frame(width: textW, alignment: textAlign)
              .frame(height: textH, alignment: .bottom)
              .offset(x: textX)
            if bar, let p = it.bar {
              Bar4(pct: p, w: w, h: d.n("bar", 2.5) * s, rtl: rtl)
                .offset(y: h - d.n("bar", 2.5) * s)
            }
          }
          .frame(width: w, height: h, alignment: .topLeading)
        }
        if let act = it.act {
          ActButton4(act: act, d: cd)
            .frame(width: w, height: h, alignment: btnAlign)
            .offset(x: sideX, y: btnY)
        }
        if let cyc {
          Button(intent: CycleStepIntent(section: cyc.0, step: cyc.1)) { Circle4(icon: "arrow.clockwise", d: cd) }.buttonStyle(.plain)
            .frame(width: w, height: h, alignment: cycAlign)
            .offset(x: cycX, y: -cycShift)
        }
      } else if let label {
        /* خانةٌ داكنةٌ بلا عنصر — وعنوانُ القسم يبقى */
        Label4(text: label, size: labelSize, s: s)
          .frame(width: labelW, alignment: textAlign)
          .offset(x: labelX, y: labelTop)
      }
    }
    .frame(width: w, height: h, alignment: .topLeading)
    .clipShape(RoundedRectangle(cornerRadius: radius))
  }
}

/** عنوانُ القسم الأصفرُ داخل الصورة */
struct Label4: View {
  let text: String
  let size: CGFloat
  let s: CGFloat
  var body: some View {
    Text(text).font(.system(size: size, weight: .bold)).foregroundStyle(WColor.accent)
      .shadow(color: .black, radius: 1.5 * s, x: 0, y: s).lineLimit(1)
  }
}

/** الاسمُ (والصديقُ بصورته جنبه) وسطرُه — `leading` داخل اتّجاه البطاقة: يمينٌ في العربيّة */
struct Text4: View {
  let f: V2Feed
  let it: I4
  let nameSize: CGFloat
  let lineSize: CGFloat
  let avatar: CGFloat
  let s: CGFloat
  var nameColor: Color { it.faded ? WColor.fg.opacity(0.55) : Color.white }
  var lineColor: Color { it.faded ? WColor.accent : Color(white: 0.87) }
  var body: some View {
    VStack(alignment: .leading, spacing: s) {
      HStack(spacing: 4 * s) {
        if let a = it.avatar, let img = FeedStore.image(a, in: f.feed, maxPixel: 64) {
          Image(uiImage: img).resizable().scaledToFill().frame(width: avatar, height: avatar).clipShape(Circle())
        }
        Text(it.name).font(.system(size: nameSize, weight: .bold)).foregroundStyle(nameColor).lineLimit(1)
      }
      if !it.line.isEmpty {
        Text(it.line).font(.system(size: lineSize)).foregroundStyle(lineColor).lineLimit(1)
      }
    }
  }
}

/** شريطُ التقدّم تحت البطاقة — من البداية: يسارٌ في الإنجليزيّة ويمينٌ في العربيّة */
struct Bar4: View {
  let pct: Int
  let w: CGFloat
  let h: CGFloat
  let rtl: Bool
  var fill: CGFloat { w * CGFloat(min(100, max(0, pct))) / 100 }
  var color: Color { pct >= 99 ? WColor.success : WColor.accent }
  var body: some View {
    ZStack(alignment: rtl ? .trailing : .leading) {
      Color.white.opacity(0.15)
      color.frame(width: fill)
    }
    .frame(width: w, height: h)
  }
}

/** صفُّ القادم المكبّر أو سطرُه النحيل — وحين لا قادم: آخرُ نشاطٍ لأصدقائك بصورة الصديق */
struct Row4: View {
  let f: V2Feed
  let it: I4?
  let head: String
  let tail: String
  let slim: Bool
  let friends: Bool
  let w: CGFloat
  let h: CGFloat
  let s: CGFloat
  let rtl: Bool
  let d: Draw4

  var second: String {
    guard let it else { return "" }
    if friends { return [it.name, it.line].filter { !$0.isEmpty }.joined(separator: " · ") }
    return [it.name, it.line2 ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
  }

  var body: some View {
    let av = (slim ? d.n("slimAvatar", 14) : d.n("avatar", 16)) * s
    Group {
      if slim {
        HStack(spacing: 6 * s) {
          Text(head).font(.system(size: d.n("slimFont", 11) * s, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1).layoutPriority(1)
          if friends, let a = it?.avatar, let img = FeedStore.image(a, in: f.feed, maxPixel: 48) {
            Image(uiImage: img).resizable().scaledToFill().frame(width: av, height: av).clipShape(Circle())
          }
          Text(second).font(.system(size: d.n("slimFont", 11) * s)).foregroundStyle(WColor.fg).lineLimit(1)
          Spacer(minLength: 0)
        }
      } else {
        HStack(spacing: 9 * s) {
          Poster(f: f, path: it?.poster, w: d.n("upThumbW", 29) * s, h: d.n("upThumbH", 44) * s, r: 4 * s)
          VStack(alignment: .leading, spacing: 0) {
            Text(head).font(.system(size: d.n("upTitle", 10.5) * s, weight: .bold)).foregroundStyle(WColor.accent).lineLimit(1)
            HStack(spacing: 4 * s) {
              if friends, let a = it?.avatar, let img = FeedStore.image(a, in: f.feed, maxPixel: 64) {
                Image(uiImage: img).resizable().scaledToFill().frame(width: av, height: av).clipShape(Circle())
              }
              Text(second).font(.system(size: d.n("upName", 12) * s)).foregroundStyle(WColor.fg).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
          if !tail.isEmpty {
            Text(tail).font(.system(size: d.n("upTail", 10) * s)).foregroundStyle(Color(white: 0.61)).lineLimit(1)
          }
        }
      }
    }
    .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
    .frame(width: w, height: h)
  }
}

/** الودجتُ v4 كاملاً — المواضعُ لارتفاعه الحقيقيّ (أكبرُ مفتاحٍ لا يزيد عليه)، أو الصغيرُ بطاقةً واحدة */
struct V4Root: View {
  let f: V2Feed
  let r: [String: Any]
  let small: Bool
  let now: Date

  var look: [String: Any] { (((f.raw["w2"] as? [String: Any])?["look4"] as? [String: Any])?["ios"] as? [String: Any]) ?? [:] }

  var body: some View {
    let nums = Draw4(o: look["nums"] as? [String: Any] ?? [:])
    let d = Draw4(o: look["draw"] as? [String: Any] ?? [:])
    let rtl = f.feed.rtl
    GeometryReader { g in
      let W = g.size.width
      let H = g.size.height
      if small {
        let sm = (r["v4"] as? [String: Any])?["small"] as? [String: Any] ?? [:]
        let key = sm["s"] as? String ?? "cont"
        let src = Items4.of(f, key, now: now)
        let it = Items4.rot(src.items, src.base, 0)
        let s = W / max(50, nums.n("smallW", 170))
        let cyc: (String, Int)? = (num(sm["cyc"]) ?? 0) > 0 && src.items.count > 1 ? (key, 1) : nil
        /* الصغيرُ لمسةٌ واحدة في آبل (`widgetURL`) — الأزرارُ بنيّاتها تعمل فوقها */
        Card4(f: f, it: it, w: W, h: H, s: s, label: Sections.title(f, key), small: true, cyc: cyc, topBtn: false, bar: key == "cont", wide: false,
              zoom: d.n("smallZoom", 1), rtl: rtl, d: d)
          .widgetURL(it?.link ?? WLink.discover)
      } else {
        let dw = max(50, nums.n("designW", 364))
        let s = W / dw
        /* شريطُ التقييم بعد ✓ فيلمٍ يأخذ مكانه تحت (٩٣)، والمواضعُ تُحسم لما فوقه */
        let strip: CGFloat = f.rate != nil ? 93 : 0
        let room = max(1, H - strip)
        /* لا يتّسع فوق الشريط شيء (المتوسط): الشريطُ وحدَه بالارتفاع كلِّه، كما كان */
        let fits: Bool = room / s >= 130
        let fit = fits ? MainView.byHeight(r["heights"] as? [String: Any], room / s) : nil
        let tiles = fit?["tiles"] as? [[String: Any]] ?? []
        let tilesH: CGFloat = fits ? room : 0
        let stripH: CGFloat = fits ? strip : H
        let cache = Items4Cache(f: f, now: now)
        VStack(spacing: 0) {
          ZStack(alignment: .topLeading) {
            ForEach(0..<tiles.count, id: \.self) { n in
              tile(tiles[n], s: s, dw: dw, rtl: rtl, d: d, cache: cache)
            }
          }
          .frame(width: W, height: tilesH, alignment: .topLeading)
          .clipped()
          if let rate = f.rate {
            RateStrip(f: f, rate: rate)
              .padding(.horizontal, 10)
              .frame(width: W, height: stripH)
              .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
          }
        }
        .frame(width: W, height: H, alignment: .topLeading)
      }
    }
    .environment(\.layoutDirection, .leftToRight)
  }

  @ViewBuilder func tile(_ t: [String: Any], s: CGFloat, dw: CGFloat, rtl: Bool, d: Draw4, cache: Items4Cache) -> some View {
    let w = CGFloat(num(t["w"]) ?? 0)
    let h = CGFloat(num(t["h"]) ?? 0)
    let y = CGFloat(num(t["y"]) ?? 0)
    let x0 = CGFloat(num(t["x"]) ?? 0)
    let x = rtl ? dw - x0 - w : x0
    switch t["k"] as? String ?? "" {
    case "hair":
      Color.white.opacity(0.13).frame(width: max(w * s, 1), height: max(h * s, 1)).offset(x: x * s, y: y * s)
    case "card":
      let key = t["s"] as? String ?? ""
      let src = cache.get(key)
      let i = Int(num(t["i"]) ?? 0)
      /* لا بوسترَ مكرّر: ما زاد على ما في القسم خانةٌ داكنة */
      let it: I4? = i < src.items.count ? Items4.rot(src.items, src.base, i) : nil
      let step = Int(num(t["cyc"]) ?? 0)
      let label: String? = (num(t["lab"]) ?? 0) == 1 ? Sections.title(f, key) : nil
      let cyc: (String, Int)? = step > 0 && src.items.count > 1 ? (key, step) : nil
      let topBtn: Bool = (t["bt"] as? String) == "t"
      let bar: Bool = (num(t["bar"]) ?? 0) == 1
      let wideImg: Bool = (t["img"] as? String) == "b"
      Card4(f: f, it: it, w: w * s, h: h * s, s: s, label: label, small: false, cyc: cyc, topBtn: topBtn, bar: bar, wide: wideImg, zoom: 0, rtl: rtl, d: d)
        .offset(x: x * s, y: y * s)
    case "up", "slim":
      let friends = (t["s"] as? String) == "friends"
      let src = cache.get(friends ? "friends" : "up")
      let it = src.items.first
      let head: String = friends ? f.s2("friendsTitle") : upHead()
      let tail: String = friends ? "" : (src.items.count > 1 ? "+\(src.items.count - 1) →" : "")
      Link(destination: friends ? (it?.link ?? WLink.discover) : WLink.calendar) {
        Row4(f: f, it: it, head: head, tail: tail, slim: (t["k"] as? String) == "slim", friends: friends, w: w * s, h: h * s, s: s, rtl: rtl, d: d)
      }
      .offset(x: x * s, y: y * s)
    default:
      EmptyView()
    }
  }

  /** «القادم · غداً» — اليومُ بساعة الجهاز وقتَ الرسم */
  func upHead() -> String {
    let title = f.feed.s("comingUpTitle")
    guard let u = f.upcoming(now).first, let date = u["date"] as? String else { return title }
    return "\(title) · \(WDates.label(date, feed: f.feed, now: now))"
  }
}

/** عناصرُ كلِّ قسمٍ مرّةً واحدةً في الرسم */
final class Items4Cache {
  let f: V2Feed
  let now: Date
  private var store: [String: (items: [I4], base: Int)] = [:]
  init(f: V2Feed, now: Date) {
    self.f = f
    self.now = now
  }
  func get(_ key: String) -> (items: [I4], base: Int) {
    if let v = store[key] { return v }
    let v = Items4.of(f, key, now: now)
    store[key] = v
    return v
  }
}
