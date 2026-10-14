package expo.modules.loopzwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * جسرُ الودجتات في أندرويد (خطّةُ الودجتات §2.2).
 *
 * 🔑 **الكتابةُ هنا لا في جافاسكربت**: الملفُّ والملصقاتُ تُكتب في `filesDir/widget/` بالذرّة (ملفٌّ مؤقّتٌ ثمّ
 * إعادةُ تسمية) — فالودجتُ لا يقرأ ملفّاً نصفُه مكتوب لو جاء البثُّ في منتصف الكتابة.
 *
 * ⚠️ **وأسماءُ المزوّدين نصوصٌ لا أصناف**: المزوّدون في حزمة التطبيق (`com.loopztv.app.widget`) والوحدةُ مكتبةٌ
 * منفصلة لا تراهم — والقائمةُ هنا والبيانُ في `withLoopzWidget.js` يجب أن يتطابقا.
 */
class LoopzWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no context")

  private fun dir(): File = File(context.filesDir, "widget").apply { mkdirs() }

  private fun safe(name: String): String {
    require(name.matches(Regex("^[A-Za-z0-9._-]{1,80}$"))) { "bad name" }
    return name
  }

  private fun atomicWrite(target: File, write: (File) -> Unit) {
    val tmp = File(target.parentFile, target.name + ".tmp")
    write(tmp)
    if (!tmp.renameTo(target)) {
      target.delete()
      tmp.renameTo(target)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LoopzWidget")

    Function("writeText") { name: String, text: String ->
      atomicWrite(File(dir(), safe(name))) { it.writeText(text, Charsets.UTF_8) }
    }

    /** ملصقٌ نزّله التطبيقُ إلى الكاش ⇐ نسخةٌ في مجلّد الودجت */
    Function("importFile") { fromUri: String, name: String ->
      val src = File(Uri.parse(fromUri).path ?: throw IllegalArgumentException("bad uri"))
      atomicWrite(File(dir(), safe(name))) { src.copyTo(it, overwrite = true) }
    }

    Function("exists") { name: String -> File(dir(), safe(name)).exists() }

    /** يحذف ما لم يعد في البيانات — فالمجلّدُ لا يكبر بملصقاتِ ما انتهى */
    Function("prune") { keep: List<String> ->
      val set = keep.toSet()
      dir().listFiles()?.forEach { f -> if (f.isFile && f.name !in set && !f.name.endsWith(".tmp")) f.delete() }
    }

    Function("reload") {
      val ctx = context
      val manager = AppWidgetManager.getInstance(ctx)
      for (cls in PROVIDERS) {
        val component = ComponentName(ctx.packageName, cls)
        val ids = try { manager.getAppWidgetIds(component) } catch (e: Exception) { IntArray(0) }
        if (ids.isEmpty()) continue
        val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .setComponent(component)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        ctx.sendBroadcast(intent)
      }
    }

    /** القوائمُ التي اختارها الشخصُ مصدراً (W10) — تكتبها شاشةُ الضبط في التفضيلات */
    Function("configuredLists") {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      prefs.all.values
        .mapNotNull { (it as? String)?.takeIf { v -> v.startsWith("list:") }?.removePrefix("list:") }
        .distinct()
    }

    Function("installedCount") {
      val ctx = context
      val manager = AppWidgetManager.getInstance(ctx)
      PROVIDERS.sumOf { cls ->
        try { manager.getAppWidgetIds(ComponentName(ctx.packageName, cls)).size } catch (e: Exception) { 0 }
      }
    }
  }

  companion object {
    const val PREFS = "loopz_widget_cfg"
    /** 🆕 الودجت الواحد (W28) — مزوّدٌ واحد؛ والبيانُ في `withLoopzWidget.js` يطابقه */
    val PROVIDERS = listOf("com.loopztv.app.widget.LoopzWidget")
  }
}
