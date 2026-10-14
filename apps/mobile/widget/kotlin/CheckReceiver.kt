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
 * ====== أفعالُ الودجت برمزه الخاصّ (W14 · W35 · W37 — الدفعةُ الثانية) ======
 *
 * 🔑 **رمزٌ خاصٌّ لا جلسة**: `files/widget/token` يكتبه التطبيق — رمزٌ لا يقدر إلّا على أفعال الودجت
 * (حلقة · فيلم · «ابدأ» · تقييم، وتراجعُ كلٍّ منها). **لا قراءة، لا إعدادات، لا تجديدَ جلسة**: رمزُ تجديد Supabase
 * لا يخرج من التطبيق (لو جدّد الودجتُ والتطبيقُ معاً لعدّه الخادمُ سرقةً وأخرج صاحبَه — D-929).
 *
 * ⚠️ **بلا رمزٍ لا شيء**: الخادمُ يكتب `check: false` فلا تُرسم الأفعالُ، وتبقى اللمسةُ تفتح العمل.
 *
 * 🆕 **حالةُ ما بعد اللمسة** (قرارُ أحمد W37 · «١ ب»، ١٤ أكتوبر) في تفضيلات الودجت — لكلِّ الودجتات معاً:
 * - `w_undo`: آخرُ فعلٍ و«↶ تراجع» عليه **٥ ثوانٍ** (`UNDO_MS`)؛ الرسّامُ يقرؤه، والخيطُ نفسُه يعيد الرسمَ بعدها.
 * - `w_hidden`: فيلمٌ شوهد أو مسلسلٌ بدأ — يُخفى من «للمشاهدة» و«فيلم الليلة» حتى يكتب التطبيقُ خلاصةً جديدة
 *   (الخادمُ لا يعيده فيها أصلاً)، ويسقط وحدَه بعد يوم.
 * - `w_rate`: شريطُ «قيّم الفيلم» تحت البحث بعد ✓ فيلم — **يبقى حتى يقيّم أو يتخطّى**.
 */
class CheckReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action == ACTION_SKIP) {
      LoopzWidget.prefs(ctx).edit().remove(K_RATE).apply()
      LoopzWidget.redrawAll(ctx)
      return
    }
    if (action !in ACTIONS) return
    val token = token(ctx) ?: return
    val pending = goAsync()
    Thread {
      try {
        run(ctx, action, intent, token)
      } catch (e: Exception) {
        /* لا شبكة أو رفضٌ: الودجتُ على حاله، والتطبيقُ يصحّح عند الفتح */
      } finally {
        pending.finish()
      }
    }.start()
  }

  private fun run(ctx: Context, action: String, i: Intent, token: String) {
    val id = i.getIntExtra("id", i.getIntExtra("show", 0))
    when (action) {
      ACTION_MARK, ACTION_UNMARK -> {
        val season = i.getIntExtra("season", 0)
        val episode = i.getIntExtra("episode", 0)
        if (id <= 0 || season <= 0 || episode <= 0) return
        val mark = action == ACTION_MARK
        val data = post(if (mark) "/api/v1/widget/mark" else "/api/v1/widget/unmark", token, JSONObject().put("showTmdbId", id).put("season", season).put("episode", episode)) ?: return
        applyNext(ctx, id, data.optJSONObject("next"))
        if (mark) undoFor(ctx, JSONObject().put("kind", "ep").put("id", id).put("season", season).put("episode", episode))
        else clearUndo(ctx)
      }
      ACTION_MOVIE -> {
        if (id <= 0) return
        post("/api/v1/widget/movie", token, JSONObject().put("movieTmdbId", id).put("watched", true)) ?: return
        undoFor(ctx, JSONObject().put("kind", "movie").put("id", id).put("title", i.getStringExtra("title") ?: "").put("poster", i.getStringExtra("poster") ?: ""))
      }
      ACTION_START -> {
        if (id <= 0) return
        post("/api/v1/widget/start", token, JSONObject().put("showTmdbId", id).put("start", true)) ?: return
        undoFor(ctx, JSONObject().put("kind", "start").put("id", id))
      }
      ACTION_RATE -> {
        val n = i.getIntExtra("rating", 0)
        if (id <= 0 || n !in 1..10) return
        post("/api/v1/widget/rate", token, JSONObject().put("movieTmdbId", id).put("rating", n)) ?: return
        LoopzWidget.prefs(ctx).edit().remove(K_RATE).apply()
        LoopzWidget.redrawAll(ctx)
      }
      ACTION_UNDO -> undo(ctx, token)
    }
  }

  /**
   * الفعلُ نجح: «↶ تراجع» يظهر **٥ ثوانٍ**، ثمّ — ما لم يتراجع — يُخفى الفيلمُ أو المسلسلُ ويظهر شريطُ التقييم للفيلم.
   * الانتظارُ في الخيط نفسِه (`goAsync` يتّسع له): لا منبّهَ ولا خدمة.
   */
  private fun undoFor(ctx: Context, o: JSONObject) {
    val at = System.currentTimeMillis()
    LoopzWidget.prefs(ctx).edit().putString(K_UNDO, o.put("at", at).toString()).apply()
    LoopzWidget.redrawAll(ctx)
    Thread.sleep(UNDO_MS + 200)
    val now = LoopzWidget.prefs(ctx).getString(K_UNDO, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    /* تراجع أثناء الانتظار، أو فعلٌ أحدثُ أخذ مكانه: لا شيءَ هنا */
    if (now == null || now.optLong("at") != at) return
    val p = LoopzWidget.prefs(ctx).edit().remove(K_UNDO)
    when (o.optString("kind")) {
      "movie" -> {
        p.putString(K_HIDDEN, hiddenWith(ctx, o.optInt("id")))
        p.putString(K_RATE, JSONObject().put("id", o.optInt("id")).put("title", o.optString("title")).put("poster", o.optString("poster")).toString())
      }
      "start" -> p.putString(K_HIDDEN, hiddenWith(ctx, o.optInt("id")))
    }
    p.apply()
    LoopzWidget.redrawAll(ctx)
  }

  /** «↶ تراجع»: الفعلُ المعاكسُ على الخادم، ثمّ الودجتُ كما كان */
  private fun undo(ctx: Context, token: String) {
    val o = undoNow(ctx) ?: return
    val id = o.optInt("id")
    when (o.optString("kind")) {
      "ep" -> {
        val data = post("/api/v1/widget/unmark", token, JSONObject().put("showTmdbId", id).put("season", o.optInt("season")).put("episode", o.optInt("episode"))) ?: return
        /* ردُّ التراجع = الحلقةُ نفسُها التالية من جديد — فتعود البطاقةُ كما كانت */
        applyNext(ctx, id, data.optJSONObject("next"))
      }
      "movie" -> post("/api/v1/widget/movie", token, JSONObject().put("movieTmdbId", id).put("watched", false)) ?: return
      "start" -> post("/api/v1/widget/start", token, JSONObject().put("showTmdbId", id).put("start", false)) ?: return
    }
    clearUndo(ctx)
  }

  private fun clearUndo(ctx: Context) {
    LoopzWidget.prefs(ctx).edit().remove(K_UNDO).apply()
    LoopzWidget.redrawAll(ctx)
  }

  /** نداءٌ برمز الودجت — `data` الردّ، أو `null` لأيِّ فشل */
  private fun post(path: String, token: String, body: JSONObject): JSONObject? {
    val conn = (URL(BASE + path).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 8000
      readTimeout = 8000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Authorization", "Bearer $token")
    }
    return try {
      conn.outputStream.use { it.write(body.toString().toByteArray()) }
      if (conn.responseCode !in 200..299) null
      else JSONObject(conn.inputStream.bufferedReader().readText()).optJSONObject("data") ?: JSONObject()
    } finally {
      conn.disconnect()
    }
  }

  companion object {
    const val ACTION_MARK = "com.loopztv.app.widget.MARK"
    const val ACTION_UNMARK = "com.loopztv.app.widget.UNMARK"
    const val ACTION_MOVIE = "com.loopztv.app.widget.MOVIE"
    const val ACTION_START = "com.loopztv.app.widget.START"
    const val ACTION_RATE = "com.loopztv.app.widget.RATE"
    const val ACTION_SKIP = "com.loopztv.app.widget.SKIP"
    const val ACTION_UNDO = "com.loopztv.app.widget.UNDO"
    private val ACTIONS = setOf(ACTION_MARK, ACTION_UNMARK, ACTION_MOVIE, ACTION_START, ACTION_RATE, ACTION_UNDO)
    const val BASE = "https://loopztv.com"
    /** W37 — «زر تراجع … لمدة ٥ ثوان» */
    const val UNDO_MS = 5_000L
    private const val HIDDEN_MS = 24 * 60 * 60_000L
    private const val K_UNDO = "w_undo"
    private const val K_RATE = "w_rate"
    private const val K_HIDDEN = "w_hidden"

    private fun token(ctx: Context): String? = try {
      File(WFeed.dir(ctx), "token").takeIf { it.exists() }?.readText()?.trim()?.takeIf { it.isNotEmpty() }
    } catch (e: Exception) {
      null
    }

    private fun pi(ctx: Context, code: Int, i: Intent): PendingIntent =
      PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun base(ctx: Context, action: String) = Intent(ctx, CheckReceiver::class.java).setAction(action)

    /** ✓ حلقةٍ على بطاقة «أكمل المشاهدة» */
    fun intent(ctx: Context, code: Int, c: WContinue): PendingIntent =
      pi(ctx, code, base(ctx, ACTION_MARK).putExtra("id", c.t.id).putExtra("season", c.season ?: 0).putExtra("episode", c.episode ?: 0))

    /** «✓ شاهدته» لفيلم — العنوانُ والملصقُ لشريط التقييم بعده */
    fun movieIntent(ctx: Context, code: Int, t: WTitle): PendingIntent =
      pi(ctx, code, base(ctx, ACTION_MOVIE).putExtra("id", t.id).putExtra("title", t.title).putExtra("poster", t.poster ?: ""))

    /** «▶ ابدأ» لمسلسل */
    fun startIntent(ctx: Context, code: Int, t: WTitle): PendingIntent = pi(ctx, code, base(ctx, ACTION_START).putExtra("id", t.id))

    fun undoIntent(ctx: Context, code: Int): PendingIntent = pi(ctx, code, base(ctx, ACTION_UNDO))
    fun skipIntent(ctx: Context, code: Int): PendingIntent = pi(ctx, code, base(ctx, ACTION_SKIP))
    fun rateIntent(ctx: Context, code: Int, id: Int, n: Int): PendingIntent =
      pi(ctx, code, base(ctx, ACTION_RATE).putExtra("id", id).putExtra("rating", n))

    /** الفعلُ الذي عليه «↶ تراجع» الآن — بعد ٥ ثوانٍ لا شيء */
    fun undoNow(ctx: Context): JSONObject? {
      val raw = LoopzWidget.prefs(ctx).getString(K_UNDO, null) ?: return null
      val o = runCatching { JSONObject(raw) }.getOrNull() ?: return null
      return if (System.currentTimeMillis() - o.optLong("at") <= UNDO_MS + 400) o else null
    }

    /** شريطُ التقييم: `{id, title, poster}` حتى يقيّم أو يتخطّى */
    fun rateNow(ctx: Context): JSONObject? =
      LoopzWidget.prefs(ctx).getString(K_RATE, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    /** ما شوهد أو بدأ من الودجت — يُخفى حتى تصل خلاصةٌ أحدثُ منه (أو يمضي يوم) */
    fun hidden(ctx: Context, feedAt: Long): Set<Int> {
      val raw = LoopzWidget.prefs(ctx).getString(K_HIDDEN, null) ?: return emptySet()
      val o = runCatching { JSONObject(raw) }.getOrNull() ?: return emptySet()
      val now = System.currentTimeMillis()
      return o.keys().asSequence().filter { k ->
        val at = o.optLong(k)
        now - at < HIDDEN_MS && at > feedAt
      }.mapNotNull { it.toIntOrNull() }.toSet()
    }

    private fun hiddenWith(ctx: Context, id: Int): String {
      val o = LoopzWidget.prefs(ctx).getString(K_HIDDEN, null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
      val now = System.currentTimeMillis()
      o.keys().asSequence().toList().forEach { k -> if (now - o.optLong(k) > HIDDEN_MS) o.remove(k) }
      return o.put(id.toString(), now).toString()
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
      /* ⚠️ التعديلُ المحلّيُّ لا يُعدّ «خلاصةً أحدث» — طابعُ الملفّ يُعاد كما كان فلا يُظهر ما أُخفي */
      val stamp = f.lastModified()
      if (!tmp.renameTo(f)) {
        f.delete()
        tmp.renameTo(f)
      }
      f.setLastModified(stamp)
    }
  }
}
