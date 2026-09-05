package com.loopztv.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.loopztv.app.R
import org.json.JSONArray
import java.io.File

/**
 * ودجتُ «أكمل المشاهدة» (D-929).
 *
 * 🔑 **لا مصادقةَ هنا ولا شبكة**: بعد D-922 لا يملك الغلافُ جلسةً — يمسحها
 * بعد تسليمها للـWebView — **فالودجتُ لا يستطيع أن ينادي `/api/v1` بهويّة
 * أحد.** والحلُّ أنّ الصفحةَ تكتب لقطةً صغيرةً في `files/widget.json` حين
 * تُفتح، **والودجتُ يرسم آخرَ ما رآه**. ودجتٌ بلا رمزٍ ولا طلبِ شبكة.
 *
 * ⚖️ **ولا تُحدَّث الودجتُ بنفسها إلا كلَّ نصف ساعة** (حدُّ أندرويد الأدنى)
 * — **ولقطةٌ عمرُها ساعةٌ خيرٌ من رمزِ تجديدٍ ثانٍ يتنازع مع الويب.**
 */
class LoopzWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> render(context, manager, id) }
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.loopz_widget)
        val rows = readSnapshot(context)

        // اللمسُ في أيِّ موضعٍ يفتح التطبيق — لا فعلَ آخرَ في الودجت
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, 0, launch, flags),
            )
        }

        val lineIds = intArrayOf(R.id.widget_line_1, R.id.widget_line_2, R.id.widget_line_3)
        if (rows.isEmpty()) {
            views.setTextViewText(lineIds[0], context.getString(R.string.widget_empty))
            views.setViewVisibility(lineIds[1], android.view.View.GONE)
            views.setViewVisibility(lineIds[2], android.view.View.GONE)
        } else {
            lineIds.forEachIndexed { i, viewId ->
                if (i < rows.size) {
                    views.setTextViewText(viewId, rows[i])
                    views.setViewVisibility(viewId, android.view.View.VISIBLE)
                } else {
                    views.setViewVisibility(viewId, android.view.View.GONE)
                }
            }
        }
        manager.updateAppWidget(id, views)
    }

    /**
     * `files/widget.json` هو نفسُه `FileSystem.documentDirectory + "widget.json"`
     * في جافاسكربت — **مسارٌ واحدٌ لا جسرٌ أصليّ**: الكتابةُ لا تحتاج وحدةً
     * أصليّةً أصلاً، والقراءةُ هنا سطران.
     * **والفشلُ صمتٌ**: ودجتٌ فارغةٌ خيرٌ من ودجتٍ تُسقط الشاشة.
     */
    private fun readSnapshot(context: Context): List<String> {
        return try {
            val file = File(context.filesDir, "widget.json")
            if (!file.exists()) return emptyList()
            val arr = JSONArray(file.readText())
            (0 until minOf(arr.length(), 3)).map { i ->
                val o = arr.getJSONObject(i)
                val title = o.optString("t")
                /* ⚠️ **`optString` على `null` يعيد نصَّ «null» لا فراغاً** في
                   org.json — ولقطتُنا تكتب `s: null` لمن لا حلقةَ تاليةَ له،
                   **فبلا `isNull` تقرأ الودجتُ «الاسم · null» على شاشة أحدهم.** */
                val sub = if (o.isNull("s")) "" else o.optString("s")
                if (sub.isEmpty()) title else "$title  ·  $sub"
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
