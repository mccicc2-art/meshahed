package com.loopztv.app.widget

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.BaseBundle
import android.os.PersistableBundle
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
 *
 * 🆕 **الشبكةُ عبر نظام المهام** (سجلُّ لمسات أحمد ١٤ أكتوبر: `UnknownHostException` على كلِّ ✓ — أندرويد يقطع
 * الشبكةَ عن مستقبِلٍ في الخلفيّة): اللمسةُ تُرسم فوراً هنا، والنداءُ يُسلَّم مهمّةً مستعجلةً (`WidgetJobService`) تُعطى
 * الشبكةَ والتطبيقُ مقيّد، وتنتظر الشبكةَ إن غابت فلا تضيع اللمسة. وإعادةُ الرسم مباشرةٌ (`redrawAll`) لا بثٌّ يتأخّر.
 */
class CheckReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val action = intent.action ?: return
    val short = action.substringAfterLast('.')
    diag(ctx, short, "tap", null)
    if (action == ACTION_SKIP) {
      LoopzWidget.prefs(ctx).edit().remove(K_RATE).apply()
      LoopzWidget.redrawAll(ctx)
      return
    }
    if (action !in ACTIONS) return
    val token = token(ctx)
    if (token == null) {
      diag(ctx, short, "no_token", null)
      return
    }
    /* 🆕 **اللمسةُ تُرى فوراً** (تسجيلُ أحمد: «ما تنضغط»): حالةُ ما بعد الفعل تُرسم قبل الشبكة، وتُعاد إن فشلت */
    optimistic(ctx, action, intent)
    val args = PersistableBundle().apply {
      putString("action", action)
      putInt("id", intent.getIntExtra("id", intent.getIntExtra("show", 0)))
      putInt("season", intent.getIntExtra("season", 0))
      putInt("episode", intent.getIntExtra("episode", 0))
      putInt("rating", intent.getIntExtra("rating", 0))
      putString("title", intent.getStringExtra("title") ?: "")
      putString("poster", intent.getStringExtra("poster") ?: "")
    }
    if (WidgetJobService.enqueue(ctx, args)) {
      diag(ctx, short, "job", null)
      return
    }
    /* النظامُ رفض المهمّة (نادر): النداءُ هنا كما كان */
    val pending = goAsync()
    Thread {
      try {
        perform(ctx, args, token)
      } finally {
        pending.finish()
      }
    }.start()
  }

  /** ينفّذ الفعلَ على الخادم — من المهمّة (`WidgetJobService`) أو من هنا إن رُفضت المهمّة */
  fun perform(ctx: Context, args: BaseBundle, token: String) {
    val action = args.getString("action") ?: return
    try {
      run(ctx, action, args, token)
    } catch (e: Exception) {
      diag(ctx, action.substringAfterLast('.'), "error", "${e.javaClass.simpleName}: ${e.message?.take(120)}")
      revert(ctx, action)
    }
  }

  /** ما يُرسم لحظةَ اللمس: «↶ تراجع» على الزرّ (معلّقاً حتى يردّ الخادم)، أو شريطُ التقييم يختفي */
  private fun optimistic(ctx: Context, action: String, i: Intent) {
    val id = i.getIntExtra("id", i.getIntExtra("show", 0))
    val p = LoopzWidget.prefs(ctx).edit()
    when (action) {
      /* W44 — الحلقةُ المعروضةُ قبل اللمسة تُحفظ مع التراجع («prev»): التراجعُ يعيدها فوراً بلا انتظار الخادم */
      ACTION_MARK -> p.putString(K_UNDO, JSONObject().put("kind", "ep").put("id", id).put("at", System.currentTimeMillis()).put("pending", true).put("prev", contItem(ctx, id)).toString())
      ACTION_MOVIE -> p.putString(K_UNDO, JSONObject().put("kind", "movie").put("id", id).put("at", System.currentTimeMillis()).put("pending", true).toString())
      ACTION_START -> p.putString(K_UNDO, JSONObject().put("kind", "start").put("id", id).put("at", System.currentTimeMillis()).put("pending", true).toString())
      ACTION_RATE -> {
        val r = LoopzWidget.prefs(ctx).getString(K_RATE, null)
        if (r != null) p.putString(K_RATE_WAS, r)
        p.remove(K_RATE)
      }
      ACTION_UNDO -> undoNow(ctx)?.let { p.putString(K_UNDO_WAS, it.toString()) }.also { p.remove(K_UNDO) }
      else -> return
    }
    p.apply()
    /* W44 — كان التراجعُ يرسم ✓ فوراً والبطاقةُ ما زالت على الحلقة **التالية** حتى يردّ الخادم: السطرُ لا يعود،
       ولمسةُ ✓ في تلك الثانية تؤشّر الحلقةَ التالية لا التي تراجع عنها (سجلُّ ١٤ أكتوبر). الآن تعود البطاقةُ قبل الرسم */
    if (action == ACTION_UNDO) {
      val was = LoopzWidget.prefs(ctx).getString(K_UNDO_WAS, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
      val prev = was?.optJSONObject("prev")
      if (was?.optString("kind") == "ep" && prev != null) runCatching { applyNext(ctx, was.optInt("id"), prev) }
    }
    LoopzWidget.redrawAll(ctx)
  }

  /** الخادمُ لم يقبل: الودجتُ كما كان قبل اللمسة */
  private fun revert(ctx: Context, action: String) {
    val prefs = LoopzWidget.prefs(ctx)
    val p = prefs.edit()
    when (action) {
      ACTION_MARK, ACTION_MOVIE, ACTION_START -> {
        val o = prefs.getString(K_UNDO, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
        if (o?.optBoolean("pending") == true) p.remove(K_UNDO)
      }
      ACTION_RATE -> prefs.getString(K_RATE_WAS, null)?.let { p.putString(K_RATE, it) }
      ACTION_UNDO -> prefs.getString(K_UNDO_WAS, null)?.let {
        p.putString(K_UNDO, it)
        /* الخادمُ رفض التراجع: البطاقةُ تعود إلى الحلقة التالية كما كانت بعد ✓ */
        val was = runCatching { JSONObject(it) }.getOrNull()
        val next = was?.optJSONObject("next")
        if (was?.optString("kind") == "ep" && next != null) runCatching { applyNext(ctx, was.optInt("id"), next) }
      }
    }
    p.remove(K_RATE_WAS).remove(K_UNDO_WAS).apply()
    LoopzWidget.redrawAll(ctx)
  }

  private fun run(ctx: Context, action: String, i: BaseBundle, token: String) {
    val id = i.getInt("id", 0)
    when (action) {
      ACTION_MARK, ACTION_UNMARK -> {
        val season = i.getInt("season", 0)
        val episode = i.getInt("episode", 0)
        if (id <= 0 || season <= 0 || episode <= 0) return revert(ctx, action)
        val mark = action == ACTION_MARK
        val data = post(ctx, if (mark) "/api/v1/widget/mark" else "/api/v1/widget/unmark", token, JSONObject().put("showTmdbId", id).put("season", season).put("episode", episode)) ?: return revert(ctx, action)
        val prev = undoNow(ctx)?.takeIf { it.optString("kind") == "ep" && it.optInt("id") == id }?.optJSONObject("prev")
        if (mark && undoneWhilePending(ctx, "ep", id)) {
          /* تراجع قبل أن يردّ الخادم: الحلقةُ تُرفع الآن، والبطاقةُ على ردِّ الرفع (الحلقةُ نفسُها من جديد) */
          val back = post(ctx, "/api/v1/widget/unmark", token, JSONObject().put("showTmdbId", id).put("season", season).put("episode", episode))
          applyNext(ctx, id, back?.optJSONObject("next") ?: prev)
          return settleEarlyUndo(ctx)
        }
        applyNext(ctx, id, data.optJSONObject("next"))
        if (mark) undoFor(ctx, JSONObject().put("kind", "ep").put("id", id).put("season", season).put("episode", episode)
          .put("prev", prev).put("next", data.optJSONObject("next")))
        else clearUndo(ctx)
      }
      ACTION_MOVIE -> {
        if (id <= 0) return
        post(ctx, "/api/v1/widget/movie", token, JSONObject().put("movieTmdbId", id).put("watched", true)) ?: return revert(ctx, action)
        if (undoneWhilePending(ctx, "movie", id)) {
          post(ctx, "/api/v1/widget/movie", token, JSONObject().put("movieTmdbId", id).put("watched", false))
          return settleEarlyUndo(ctx)
        }
        undoFor(ctx, JSONObject().put("kind", "movie").put("id", id).put("title", i.getString("title") ?: "").put("poster", i.getString("poster") ?: ""))
      }
      ACTION_START -> {
        if (id <= 0) return
        post(ctx, "/api/v1/widget/start", token, JSONObject().put("showTmdbId", id).put("start", true)) ?: return revert(ctx, action)
        if (undoneWhilePending(ctx, "start", id)) {
          post(ctx, "/api/v1/widget/start", token, JSONObject().put("showTmdbId", id).put("start", false))
          return settleEarlyUndo(ctx)
        }
        undoFor(ctx, JSONObject().put("kind", "start").put("id", id))
      }
      ACTION_RATE -> {
        val n = i.getInt("rating", 0)
        if (id <= 0 || n !in 1..10) return
        post(ctx, "/api/v1/widget/rate", token, JSONObject().put("movieTmdbId", id).put("rating", n)) ?: return revert(ctx, action)
        LoopzWidget.prefs(ctx).edit().remove(K_RATE).remove(K_RATE_WAS).apply()
        LoopzWidget.redrawAll(ctx)
      }
      ACTION_UNDO -> undo(ctx, token)
    }
  }

  /**
   * الفعلُ نجح: «↶ تراجع» يظهر **٥ ثوانٍ**، ثمّ — ما لم يتراجع — يُخفى الفيلمُ أو المسلسلُ ويظهر شريطُ التقييم للفيلم.
   * الانتظارُ في خيط المهمّة نفسِه: لا منبّه.
   */
  private fun undoFor(ctx: Context, o: JSONObject) {
    val at = System.currentTimeMillis()
    /* اللمسةُ رسمت حالةً معلّقة؛ الخادمُ قبل ⇒ تبدأ الثواني الخمس الآن */
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
    val o = LoopzWidget.prefs(ctx).getString(K_UNDO_WAS, null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return
    /* لم يردّ الخادمُ على الفعل نفسِه بعد — لا شيءَ يُتراجع عنه على الخادم؛ الحالةُ المحلّيّة أُزيلت باللمسة */
    if (o.optBoolean("pending")) return
    val ok: Boolean
    val id = o.optInt("id")
    ok = when (o.optString("kind")) {
      "ep" -> {
        val data = post(ctx, "/api/v1/widget/unmark", token, JSONObject().put("showTmdbId", id).put("season", o.optInt("season")).put("episode", o.optInt("episode")))
        /* ردُّ التراجع = الحلقةُ نفسُها التالية من جديد — فتعود البطاقةُ كما كانت */
        if (data != null) applyNext(ctx, id, data.optJSONObject("next"))
        data != null
      }
      "movie" -> post(ctx, "/api/v1/widget/movie", token, JSONObject().put("movieTmdbId", id).put("watched", false)) != null
      "start" -> post(ctx, "/api/v1/widget/start", token, JSONObject().put("showTmdbId", id).put("start", false)) != null
      else -> true
    }
    if (!ok) return revert(ctx, ACTION_UNDO)
    LoopzWidget.prefs(ctx).edit().remove(K_UNDO_WAS).apply()
    LoopzWidget.redrawAll(ctx)
  }

  /**
   * W44 — «↶ تراجع» لُمس والفعلُ ما زال معلّقاً (الخادمُ لم يردّ): `undo()` لا يجد ما يُتراجع عنه على الخادم فيتركه،
   * فيصل ردُّ الفعل بعده ويُعيد «↶» والفعلُ قائم. الآن: ردُّ الفعل يرى أنّ صاحبه تراجع (لا `w_undo`، و`w_undo_was`
   * هو السجلُّ المعلّقُ نفسُه) فيعكسه فوراً.
   */
  private fun undoneWhilePending(ctx: Context, kind: String, id: Int): Boolean {
    val prefs = LoopzWidget.prefs(ctx)
    if (prefs.getString(K_UNDO, null) != null) return false
    val was = prefs.getString(K_UNDO_WAS, null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return false
    return was.optBoolean("pending") && was.optString("kind") == kind && was.optInt("id") == id
  }

  private fun settleEarlyUndo(ctx: Context) {
    LoopzWidget.prefs(ctx).edit().remove(K_UNDO_WAS).apply()
    LoopzWidget.redrawAll(ctx)
  }

  private fun clearUndo(ctx: Context) {
    LoopzWidget.prefs(ctx).edit().remove(K_UNDO).apply()
    LoopzWidget.redrawAll(ctx)
  }

  /** نداءٌ برمز الودجت — `data` الردّ، أو `null` لأيِّ فشل */
  private fun post(ctx: Context, path: String, token: String, body: JSONObject): JSONObject? {
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
      val code = conn.responseCode
      diag(ctx, path.substringAfterLast('/'), "http", code.toString())
      if (code !in 200..299) null
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
    private const val K_RATE_WAS = "w_rate_was"
    private const val K_UNDO_WAS = "w_undo_was"
    private const val DIAG = "diag.json"

    /**
     * 🆕 سجلُّ اللمسات للتشخيص (`files/widget/diag.json`، آخرُ ٣٠): ما وصل · لا رمز · ردُّ الخادم · خطأ.
     * التطبيقُ يرسله إلى `runtime_errors` عند فتحه (`sendDiag` في `feed.ts`) ثمّ يفرغه.
     */
    @Synchronized
    fun diag(ctx: Context, action: String, stage: String, detail: String?) {
      try {
        val f = File(WFeed.dir(ctx), DIAG)
        val arr = if (f.exists()) runCatching { org.json.JSONArray(f.readText()) }.getOrNull() ?: org.json.JSONArray() else org.json.JSONArray()
        val row = JSONObject().put("t", System.currentTimeMillis() / 1000).put("a", action).put("s", stage)
        if (detail != null) row.put("d", detail)
        arr.put(row)
        val out = org.json.JSONArray()
        for (n in maxOf(0, arr.length() - 30) until arr.length()) out.put(arr.get(n))
        f.parentFile?.mkdirs()
        f.writeText(out.toString())
      } catch (e: Exception) {
        /* التشخيصُ لا يُسقط شيئاً */
      }
    }

    fun token(ctx: Context): String? = try {
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
      val age = System.currentTimeMillis() - o.optLong("at")
      /* المعلّقُ (الخادمُ لم يردّ) يبقى حتى مهلة الشبكة؛ والمقبولُ خمسَ ثوانٍ */
      return if (age <= (if (o.optBoolean("pending")) 20_000L else UNDO_MS + 400)) o else null
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
    /** سطرُ «أكمل المشاهدة» الحاليّ للمسلسل (الحلقةُ واسمُها) — ما يُعاد إليه عند التراجع */
    private fun contItem(ctx: Context, show: Int): JSONObject? = runCatching {
      val items = JSONObject(File(WFeed.dir(ctx), "feed.json").readText()).optJSONObject("continue")?.optJSONArray("items") ?: return null
      for (n in 0 until items.length()) {
        val it = items.optJSONObject(n) ?: continue
        if (it.optInt("id") == show) return JSONObject().put("season", it.optInt("season")).put("episode", it.optInt("episode")).put("label", it.optString("label"))
      }
      null
    }.getOrNull()

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
