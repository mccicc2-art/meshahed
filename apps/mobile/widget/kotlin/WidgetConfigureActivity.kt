package com.loopztv.app.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * ====== «الإعدادات» من الودجت نفسِه (W40 — المكانُ الأوّل للتعديل في أندرويد) ======
 *
 * 🔑 **لا واجهةَ أصليّةَ ثانية**: الضغطُ المطوّل ← «الإعدادات» يفتح شاشةَ «ودجت لوبز» في التطبيق (المعاينةُ والسحبُ
 * والأوراقُ نفسُها) عبر `com.loopztv.app://w/settings`. شاشتان للشيء نفسِه تفترقان في أوّل تعديل (القاعدة ٣).
 * **اختياريّة عند الوضع** (`configuration_optional`): الودجتُ يُوضع على الإعداد المحفوظ مباشرةً.
 */
class WidgetConfigureActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val id = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    /* الرجوعُ لا يُلغي الودجت — الإعدادُ المحفوظُ يكفي */
    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
    try {
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${WFeed.SCHEME}://w/settings")).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
      /* لا شيء — يبقى الودجتُ على إعداده */
    }
    finish()
  }
}
