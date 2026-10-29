package expo.modules.loopzwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/*
 * 🆕 D-1568 — **مرساةُ البصمة لرسّام الودجت**: ملفّاتُ `widget/kotlin` و`widget/res` ينسخها `withLoopzWidget.js` عند البناء، والبصمةُ
 * لا تقرؤها — فتعديلُها وحدَه يخرج تحديثاً عبر الهواء لا يصل الودجت (D-1562 خرج كذلك، ٢٩ أكتوبر). كلُّ تعديلٍ للرسّام يرفع هذا الرقم.
 * مراجعةُ الرسّام: 1562
 */

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

    /** 🆕 يقرأ ملفّاً نصّيّاً من مجلّد الودجت — سجلُّ لمسات الودجت (`diag.json`) يرسله التطبيقُ للتشخيص؛ `null` إن غاب */
    Function("readText") { name: String ->
      val f = File(dir(), safe(name))
      if (f.exists()) f.readText(Charsets.UTF_8) else null
    }

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

    /**
     * 🆕 W40 — الودجتاتُ على الشاشة الآن: رقمُ كلٍّ ومقاسُه بالـdp (عرضُ الوضع العموديّ وأطولُ ارتفاعه) — شاشةُ «ودجت لوبز»
     * تسرد منها «على شاشتك الآن» وتفتح إعدادَ كلِّ واحد. **ولا رقمَ صفحةٍ**: أندرويد لا يعطيه لأحد.
     */
    Function("installedWidgets") {
      val ctx = context
      val manager = AppWidgetManager.getInstance(ctx)
      PROVIDERS.flatMap { cls ->
        val ids = try { manager.getAppWidgetIds(ComponentName(ctx.packageName, cls)) } catch (e: Exception) { IntArray(0) }
        ids.map { id ->
          val o = manager.getAppWidgetOptions(id)
          mapOf(
            "id" to id,
            "w" to o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
            "h" to o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0),
          )
        }
      }
    }

    /**
     * 🆕 «أضف ودجت للشاشة»: يطلب من المشغِّل وضعَ ودجتٍ جديد (أندرويد 8+ ومشغِّلٌ يدعمه). إن وضعه الشخصُ فتح النظامُ
     * شاشةَ الضبط ومعها رقمُه (`EXTRA_APPWIDGET_ID` يُضاف للنيّة — فهي قابلةٌ للتعديل) فتفتح شاشةُ تخصيصه مباشرة.
     */
    Function("requestPin") {
      val ctx = context
      if (android.os.Build.VERSION.SDK_INT < 26) return@Function false
      val manager = AppWidgetManager.getInstance(ctx)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      val cfg = Intent().setComponent(ComponentName(ctx.packageName, "com.loopztv.app.widget.WidgetConfigureActivity"))
      val flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT or (if (android.os.Build.VERSION.SDK_INT >= 31) android.app.PendingIntent.FLAG_MUTABLE else 0)
      val cb = android.app.PendingIntent.getActivity(ctx, 4711, cfg, flags)
      manager.requestPinAppWidget(ComponentName(ctx.packageName, PROVIDERS.first()), null, cb)
    }

    /**
     * 🆕 1.12.7 — هذا البناءُ يرسم إشعارَ الرسالة بكوده الأصليّ (`DmPush.kt` في التطبيق) — فيقول التطبيقُ للخادم «dm-native».
     * **وجودُ الدالّة هو الجواب**: بناءٌ أقدمُ بلا هذا الكود لا يملكها، والتحديثُ عبر الهواء لا يضيفها.
     */
    Function("dmNative") { true }

    /**
     * 🆕 1.12.7 — المحادثةُ المفتوحةُ الآن (`peer` أو `g:<قروب>`، أو `null` عند المغادرة): الإشعارُ الأصليُّ لا يُرسم لرسالةٍ منها
     * والتطبيقُ أمامك (D-1307). اسمُ الملفّ والمفتاحُ نفسُهما في `DmPush.kt` — يجب أن يتطابقا.
     */
    Function("setDmOpen") { key: String? ->
      val e = context.getSharedPreferences(DM_PREFS, Context.MODE_PRIVATE).edit()
      if (key.isNullOrEmpty()) e.remove("open") else e.putString("open", key.lowercase())
      e.apply()
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
    /** 🆕 1.12.7 — المحادثةُ المفتوحة (`DmPush.OPEN_PREFS`) */
    const val DM_PREFS = "loopz_dm"
    /** 🆕 الودجت الواحد (W28) — مزوّدٌ واحد؛ والبيانُ في `withLoopzWidget.js` يطابقه */
    val PROVIDERS = listOf("com.loopztv.app.widget.LoopzWidget")
  }
}
