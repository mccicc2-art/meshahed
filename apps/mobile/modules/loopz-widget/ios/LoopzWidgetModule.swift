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

  public func definition() -> ModuleDefinition {
    Name("LoopzWidget")

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
