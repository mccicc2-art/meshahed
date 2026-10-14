package com.loopztv.app.widget

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * ====== ✓ من الودجت (W14 — مخفيٌّ حتى الدفعة الثانية) ======
 *
 * 🔑 **رمزٌ خاصٌّ لا جلسة**: `files/widget/token` يكتبه التطبيقُ في الدفعة الثانية — رمزٌ لا يقدر إلّا على «علّم
 * حلقة» و«تراجع عنها» (`/api/v1/widget/mark|unmark`). **لا قراءة، لا إعدادات، لا تجديدَ جلسة** — فمن يمسك الجوالَ
 * مفتوحاً يعلّم حلقاتٍ لا غير، ورمزُ تجديد Supabase لا يخرج من التطبيق (لو جدّد الودجتُ والتطبيقُ معاً لعدّه الخادمُ
 * سرقةً وأخرج صاحبَه).
 *
 * ⚠️ **بلا رمزٍ لا شيء**: في هذا البناء لا يُكتب الرمزُ والخادمُ يكتب `check: false`، فالزرُّ لا يُرسم أصلاً.
 * والردُّ يحمل الحلقةَ التالية فيُعاد الرسمُ بلا فتح التطبيق ولا جلب البيانات كلِّها.
 */
class CheckReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != ACTION_MARK && action != ACTION_UNMARK) return
    val token = try {
      File(WFeed.dir(ctx), "token").takeIf { it.exists() }?.readText()?.trim()
    } catch (e: Exception) {
      null
    } ?: return
    val show = intent.getIntExtra("show", 0)
    val season = intent.getIntExtra("season", 0)
    val episode = intent.getIntExtra("episode", 0)
    val label = intent.getStringExtra("label") ?: ""
    if (show <= 0 || season <= 0 || episode <= 0) return
    val pending = goAsync()
    Thread {
      try {
        val path = if (action == ACTION_MARK) "/api/v1/widget/mark" else "/api/v1/widget/unmark"
        val body = JSONObject().put("showTmdbId", show).put("season", season).put("episode", episode).toString()
        val conn = (URL(BASE + path).openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 8000
          readTimeout = 8000
          doOutput = true
          setRequestProperty("Content-Type", "application/json")
          setRequestProperty("Authorization", "Bearer $token")
        }
        conn.outputStream.use { it.write(body.toByteArray()) }
        if (conn.responseCode in 200..299) {
          val data = JSONObject(conn.inputStream.bufferedReader().readText()).optJSONObject("data")
          applyNext(ctx, show, data?.optJSONObject("next"))
          val p = LoopzWidget.prefs(ctx).edit()
          if (action == ACTION_MARK) {
            p.putString("undo_last", JSONObject().put("show", show).put("season", season).put("episode", episode).put("label", label).put("at", System.currentTimeMillis()).toString())
          } else p.remove("undo_last")
          p.apply()
          LoopzWidget.redrawAll(ctx)
        }
        conn.disconnect()
      } catch (e: Exception) {
        /* لا شبكة أو رفضٌ: الودجتُ على حاله، والتطبيقُ يصحّح عند الفتح */
      } finally {
        pending.finish()
      }
    }.start()
  }

  companion object {
    const val ACTION_MARK = "com.loopztv.app.widget.MARK"
    const val ACTION_UNMARK = "com.loopztv.app.widget.UNMARK"
    const val BASE = "https://loopztv.com"
    private const val UNDO_MS = 10 * 60_000L

    fun intent(ctx: Context, code: Int, c: WContinue): PendingIntent {
      val i = Intent(ctx, CheckReceiver::class.java).setAction(ACTION_MARK)
        .putExtra("show", c.t.id).putExtra("season", c.season ?: 0).putExtra("episode", c.episode ?: 0).putExtra("label", c.label ?: "")
      return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** «✓ ح٧ · تراجع» بعد ✓ — حتى عشر دقائق، ثمّ يعود السطرُ «التالية» */
    fun undoLabel(ctx: Context, feed: WFeed, code: Int): Pair<String, PendingIntent>? {
      val raw = LoopzWidget.prefs(ctx).getString("undo_last", null) ?: return null
      return try {
        val o = JSONObject(raw)
        if (System.currentTimeMillis() - o.optLong("at") > UNDO_MS) return null
        val i = Intent(ctx, CheckReceiver::class.java).setAction(ACTION_UNMARK)
          .putExtra("show", o.optInt("show")).putExtra("season", o.optInt("season")).putExtra("episode", o.optInt("episode"))
        val undo = feed.s("undo").ifEmpty { "↶" }
        "✓ ${o.optString("label")} · $undo" to PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      } catch (e: Exception) {
        null
      }
    }

    /** الحلقةُ التالية من الردّ تُكتب في الملفّ مكانَ القديمة — `null` = أنهى المتاح، فيخرج من الصفّ */
    private fun applyNext(ctx: Context, show: Int, next: JSONObject?) {
      val f = File(WFeed.dir(ctx), "feed.json")
      if (!f.exists()) return
      val o = JSONObject(f.readText())
      val cont = o.optJSONObject("continue") ?: return
      val items = cont.optJSONArray("items") ?: return
      val out = org.json.JSONArray()
      for (n in 0 until items.length()) {
        val it = items.optJSONObject(n) ?: continue
        if (it.optInt("id") != show) {
          out.put(it)
          continue
        }
        if (next == null) continue
        it.put("season", next.optInt("season")).put("episode", next.optInt("episode")).put("label", next.optString("label"))
        out.put(it)
      }
      cont.put("items", out)
      val tmp = File(f.parentFile, "feed.json.tmp")
      tmp.writeText(o.toString())
      if (!tmp.renameTo(f)) {
        f.delete()
        tmp.renameTo(f)
      }
    }
  }
}
