package com.loopztv.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
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
 *
 * 🆕 **ولكلِّ صفٍّ لمستُه** (مراجعةُ أحمد، ٥ سبتمبر): ثلاثةُ صفوفٍ بفعلٍ
 * واحدٍ إهدار. الصفُّ يفتح صفحةَ العمل عبر `com.loopztv.app://web?u=/show/…`،
 * **وهو مسارٌ يعرفه الموجِّه أصلاً** (`app/web.tsx`) فلا صفحةَ «غير موجود».
 */
class LoopzWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> render(context, manager, id) }
    }

    private data class Row(val name: String, val episode: String, val href: String)

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.loopz_widget)
        val rows = readSnapshot(context)

        /* لمسةُ الخلفيّة تفتح التطبيقَ كما هو — حزامُ أمانٍ لو خلا الصفُّ
           من رابطٍ أو ضُغط الهامشُ بين الصفوف. */
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
            views.setOnClickPendingIntent(R.id.widget_root, activity(context, id * 10, launch))
        }

        views.setTextViewText(R.id.widget_count, if (rows.isEmpty()) "" else "${rows.size}")

        val rowIds = intArrayOf(R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3)
        val nameIds = intArrayOf(R.id.widget_name_1, R.id.widget_name_2, R.id.widget_name_3)
        val epIds = intArrayOf(R.id.widget_ep_1, R.id.widget_ep_2, R.id.widget_ep_3)

        if (rows.isEmpty()) {
            // الحالةُ الفارغة: سطرٌ واحدٌ خافتٌ يقول ماذا يفعل المستخدم، لا فراغ
            views.setViewVisibility(rowIds[0], View.VISIBLE)
            views.setTextViewText(nameIds[0], context.getString(R.string.widget_empty))
            views.setTextColor(nameIds[0], MUTED)
            views.setTextViewText(epIds[0], "")
            views.setViewVisibility(rowIds[1], View.GONE)
            views.setViewVisibility(rowIds[2], View.GONE)
            manager.updateAppWidget(id, views)
            return
        }

        rowIds.forEachIndexed { i, rowId ->
            val row = rows.getOrNull(i)
            if (row == null) {
                views.setViewVisibility(rowId, View.GONE)
                return@forEachIndexed
            }
            views.setViewVisibility(rowId, View.VISIBLE)
            views.setTextViewText(nameIds[i], row.name)
            views.setTextColor(nameIds[i], FOREGROUND)
            views.setTextViewText(epIds[i], row.episode)
            if (row.href.isNotEmpty()) {
                val uri = Uri.parse("$SCHEME://web?u=" + Uri.encode(row.href))
                val open = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName)
                /* ⚠️ **رمزُ الطلب يجب أن يختلف لكلِّ صفٍّ ولكلِّ ودجت**: نيّتان
                   معلّقتان برمزٍ واحدٍ تتطابقان عند أندرويد، **فتفتح الصفوفُ
                   الثلاثةُ العملَ نفسَه.** */
                views.setOnClickPendingIntent(rowId, activity(context, id * 10 + i + 1, open))
            }
        }
        manager.updateAppWidget(id, views)
    }

    private fun activity(context: Context, code: Int, intent: Intent): PendingIntent {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, code, intent, flags)
    }

    /**
     * `files/widget.json` هو نفسُه `Paths.document + "widget.json"` في
     * جافاسكربت — **مجلّدٌ واحدٌ لا جسرٌ أصليّ**: الكتابةُ لا تحتاج وحدةً
     * أصليّةً أصلاً، والقراءةُ هنا سطران.
     * **والفشلُ صمتٌ**: ودجتٌ فارغةٌ خيرٌ من ودجتٍ تُسقط الشاشة.
     */
    private fun readSnapshot(context: Context): List<Row> {
        return try {
            val file = File(context.filesDir, "widget.json")
            if (!file.exists()) return emptyList()
            val arr = JSONArray(file.readText())
            (0 until minOf(arr.length(), 3)).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                /* ⚠️ **`optString` على `null` تعيد نصَّ «null» لا فراغاً** في
                   org.json — واللقطةُ تكتب `s: null` لمن لا حلقةَ تاليةَ له. */
                val name = if (o.isNull("t")) "" else o.optString("t")
                val ep = if (o.isNull("s")) "" else o.optString("s")
                val href = if (o.isNull("h")) "" else o.optString("h")
                if (name.isEmpty()) null else Row(name, ep, href)
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private companion object {
        /* الرموزُ من `src/core/themes.ts` — تُقرأ لا تُكتب من الذاكرة */
        const val FOREGROUND = 0xFFF7F7F7.toInt()
        const val MUTED = 0xFFB5B5B5.toInt()
        /* `scheme` في `app.json` — تغييرُه هناك يكسر اللمسَ هنا بصمت */
        const val SCHEME = "com.loopztv.app"
    }
}
