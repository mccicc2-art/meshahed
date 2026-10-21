import ExpoModulesCore
import Foundation
import WidgetKit

/**
 * جسرُ الودجتات في iOS (خطّةُ الودجتات §2.2).
 *
 * 🔑 **المجلّدُ حاويةُ مجموعة التطبيقات** (`group.com.loopztv.app`) — التطبيقُ والملحقُ عمليّتان منفصلتان
 * ولا يتشاركان إلّا ما فيها. ولهذا الكتابةُ هنا لا في `expo-file-system`: صلاحيّاتُه لا تشمل الحاوية.
 * ⚠️ **وغيابُ الحاوية خطأٌ صامت**: بناءٌ بلا الاستحقاق (App Group غيرُ مفعّلة على المعرّف) يعيد `nil` —
 * فالودجتُ يبقى فارغاً والتطبيقُ يعمل كما هو، لا شاشةَ تسقط.
 */
public class LoopzWidgetModule: Module {
  static let group = "group.com.loopztv.app"
  /** 🆕 D-1500 — تنبيهُ «رابطٌ ينتظر» (بحثُ Spotlight — `app/LoopzSearchIntent.swift`) ما دام في JS من يسمع */
  private var linkObserver: NSObjectProtocol?

  private func dir() throws -> URL {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.group) else {
      throw NSError(domain: "LoopzWidget", code: 1, userInfo: [NSLocalizedDescriptionKey: "no app group"])
    }
    let d = base.appendingPathComponent("widget", isDirectory: true)
    try FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
    return d
  }

  private func safe(_ name: String) throws -> String {
    let ok = name.range(of: "^[A-Za-z0-9._-]{1,80}$", options: .regularExpression) != nil
    if !ok { throw NSError(domain: "LoopzWidget", code: 2, userInfo: [NSLocalizedDescriptionKey: "bad name"]) }
    return name
  }

  static func familyName(_ f: WidgetFamily) -> String {
    switch f {
    case .systemSmall: return "small"
    case .systemMedium: return "medium"
    case .systemLarge: return "large"
    case .systemExtraLarge: return "xl"
    default: return isPortraitXL(f) ? "xl" : "other"
    }
  }

  /** 🆕 D-1500 — الكبيرُ جداً في الآيفون (iOS 27)؛ أدواتُ آبل الأقدم لا تعرف الحالة فتُترجم بلاها */
  static func isPortraitXL(_ f: WidgetFamily) -> Bool {
    #if compiler(>=6.4)
    if #available(iOS 27.0, *), f == .systemExtraLargePortrait { return true }
    #endif
    return false
  }

  public func definition() -> ModuleDefinition {
    Name("LoopzWidget")

    /* 🆕 D-1500 — رابطٌ من خارج التطبيق لا يمرّ بـ`Linking` (بحثُ Spotlight): يُحفظ، وهذا يقول لـJS «خذه» */
    Events("onLink")

    OnStartObserving {
      self.linkObserver = NotificationCenter.default.addObserver(forName: Notification.Name("LoopzPendingLink"), object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onLink", [:])
      }
    }

    OnStopObserving {
      if let o = self.linkObserver { NotificationCenter.default.removeObserver(o) }
      self.linkObserver = nil
    }

    /** الرابطُ المنتظَر — يُقرأ مرّةً ويُمحى؛ وما مضت عليه دقيقةٌ يُهمل */
    Function("takeLink") { () -> String? in
      let d = UserDefaults.standard
      guard let o = d.dictionary(forKey: "loopz.pendingLink") else { return nil }
      d.removeObject(forKey: "loopz.pendingLink")
      guard let url = o["url"] as? String, let at = o["at"] as? Double, Date().timeIntervalSince1970 - at < 60 else { return nil }
      return url
    }

    Function("writeText") { (name: String, text: String) in
      let url = try self.dir().appendingPathComponent(try self.safe(name))
      try text.data(using: .utf8)?.write(to: url, options: .atomic)
    }

    Function("importFile") { (fromUri: String, name: String) in
      guard let src = URL(string: fromUri) else { return }
      let data = try Data(contentsOf: src)
      let url = try self.dir().appendingPathComponent(try self.safe(name))
      try data.write(to: url, options: .atomic)
    }

    Function("exists") { (name: String) -> Bool in
      guard let d = try? self.dir(), let n = try? self.safe(name) else { return false }
      return FileManager.default.fileExists(atPath: d.appendingPathComponent(n).path)
    }

    /** 🆕 يقرأ ملفّاً نصّيّاً من مجلّد الودجت — سجلُّ لمسات الودجت (`diag.json`) يرسله التطبيقُ للتشخيص؛ `nil` إن غاب */
    Function("readText") { (name: String) -> String? in
      guard let d = try? self.dir(), let n = try? self.safe(name) else { return nil }
      return try? String(contentsOf: d.appendingPathComponent(n), encoding: .utf8)
    }

    /**
     * 🆕 W40 «١ أ» — الودجتاتُ على الشاشة الآن: حجمُ كلٍّ والتخطيطُ الذي اختاره. الودجتُ نفسُه يكتب ما يُرسم به
     * (`placed.json`: الحجمُ|التخطيط ⇐ آخرُ رسم) — والتطبيقُ لا يقرأ نوعَ إعداده — ويُصفّى بما يعدّه النظامُ موضوعاً الآن.
     */
    AsyncFunction("installedWidgets") { (promise: Promise) in
      WidgetCenter.shared.getCurrentConfigurations { result in
        var families: [String: Int] = [:]
        if case .success(let infos) = result {
          for i in infos where i.kind == "LoopzMain" { families[LoopzWidgetModule.familyName(i.family), default: 0] += 1 }
        }
        var out: [[String: Any]] = []
        if let d = try? self.dir(),
           let data = try? Data(contentsOf: d.appendingPathComponent("placed.json")),
           let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Double] {
          let now = Date().timeIntervalSince1970
          for (key, at) in raw.sorted(by: { $0.value > $1.value }) where now - at < 3 * 86400 {
            let parts = key.split(separator: "|", maxSplits: 1).map(String.init)
            guard parts.count == 2, (families[parts[0]] ?? 0) > 0 else { continue }
            out.append(["family": parts[0], "layout": parts[1]])
          }
        }
        /* حجمٌ موضوعٌ لم يرسم بعدُ بتخطيطٍ معروف: يظهر بالرئيسيّ */
        for (fam, n) in families where !out.contains(where: { ($0["family"] as? String) == fam }) && n > 0 {
          out.append(["family": fam, "layout": "main"])
        }
        promise.resolve(out)
      }
    }

    Function("prune") { (keep: [String]) in
      let d = try self.dir()
      let set = Set(keep)
      for name in (try? FileManager.default.contentsOfDirectory(atPath: d.path)) ?? [] where !set.contains(name) {
        try? FileManager.default.removeItem(at: d.appendingPathComponent(name))
      }
    }

    Function("reload") {
      WidgetCenter.shared.reloadAllTimelines()
    }

    /** القوائمُ المختارةُ مصدراً (W10) — يكتبها الملحقُ في الإعدادات المشتركة حين يرسم */
    Function("configuredLists") { () -> [String] in
      let defaults = UserDefaults(suiteName: Self.group)
      return (defaults?.stringArray(forKey: "configuredLists") ?? [])
    }

    AsyncFunction("installedCount") { (promise: Promise) in
      WidgetCenter.shared.getCurrentConfigurations { result in
        switch result {
        case .success(let infos): promise.resolve(infos.count)
        case .failure: promise.resolve(0)
        }
      }
    }
  }
}
