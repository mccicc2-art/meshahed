package com.loopztv.app.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import com.loopztv.app.R

/**
 * ====== ماذا يعرض ودجتُ «أكمل المشاهدة»؟ (W10) ======
 *
 * تُفتح عند إضافة الودجت وعند «إعادة الضبط» من الضغط المطوّل (أندرويد ١٢ فأحدث). **اختياريّة**
 * (`configuration_optional`): من لم يخترْ يبقى على الافتراضيّ «أكمل المشاهدة».
 *
 * 🔑 **القوائمُ من آخر ما كتبه التطبيق** (`feed.json` → `lists`) — لا شبكةَ هنا. قائمةٌ اختيرت ولم تُجلب عناصرُها بعد
 * تمتلئ في الكتابة التالية: التطبيقُ يسأل `configuredLists()` ويطلب عناصرَ ما اختير وحدَه.
 */
class WidgetConfigureActivity : Activity() {
  private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    /* الرجوعُ بلا اختيار = الافتراضيّ، لا ودجتٌ يُلغى */
    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    val feed = WFeed.load(this) as? WFeed
    val options = mutableListOf(
      "continue" to getString(R.string.w_cfg_continue) + "  ·  " + getString(R.string.w_cfg_default),
      "towatch" to getString(R.string.w_cfg_towatch),
    )
    feed?.lists?.forEach { options.add("list:${it.id}" to getString(R.string.w_cfg_saved) + ": " + it.name) }

    val dp = resources.displayMetrics.density
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#181818"))
      setPadding((16 * dp).toInt(), (16 * dp).toInt(), (16 * dp).toInt(), (8 * dp).toInt())
      layoutDirection = if (feed?.rtl != false) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
    }
    root.addView(TextView(this).apply {
      text = getString(R.string.w_cfg_title)
      setTextColor(Color.parseColor("#B5B5B5"))
      textSize = 13f
      setPadding(0, 0, 0, (8 * dp).toInt())
      textAlignment = View.TEXT_ALIGNMENT_VIEW_START
    })
    val current = BaseWidget.prefs(this).getString("src_$widgetId", "continue")
    val list = ListView(this).apply {
      divider = null
      adapter = object : ArrayAdapter<String>(this@WidgetConfigureActivity, android.R.layout.simple_list_item_1, options.map { it.second }) {
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
          val v = super.getView(position, convertView, parent) as TextView
          v.setTextColor(if (options[position].first == current) Color.parseColor("#FFD400") else Color.parseColor("#F7F7F7"))
          v.textSize = 15f
          v.gravity = Gravity.CENTER_VERTICAL or Gravity.START
          v.textAlignment = View.TEXT_ALIGNMENT_VIEW_START
          return v
        }
      }
      setOnItemClickListener { _, _, position, _ -> choose(options[position].first) }
    }
    root.addView(list, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    if (feed == null || feed.lists.isEmpty()) {
      root.addView(TextView(this).apply {
        text = getString(R.string.w_cfg_no_lists)
        setTextColor(Color.parseColor("#777777"))
        textSize = 12f
        setPadding(0, (8 * dp).toInt(), 0, (8 * dp).toInt())
        textAlignment = View.TEXT_ALIGNMENT_VIEW_START
      })
    }
    setContentView(root)
  }

  private fun choose(value: String) {
    BaseWidget.prefs(this).edit().putString("src_$widgetId", value).apply()
    BaseWidget.redrawAll(this)
    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
    finish()
  }
}
