package com.loopztv.app.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Path
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * ====== 🆕 بياناتُ الودجتات كما كتبها التطبيق (خطّةُ الودجتات §2.1) ======
 *
 * 🔑 **لا مصادقةَ هنا ولا شبكة** (D-929 باقية): التطبيقُ يكتب `files/widget/feed.json` والملصقاتِ بجانبه، والودجتُ
 * يرسم آخرَ ما كُتب. **والفشلُ صمت**: ملفٌّ ناقصٌ أو تالفٌ يعني «افتح لوبز ليتحدّث الودجت»، لا شاشةً تسقط.
 *
 * ⚠️ **التواريخُ تُحسب وقتَ الرسم لا وقتَ الكتابة**: ما كُتب أمسِ «غداً» صار اليومَ «اليوم» — والودجتُ يُعاد رسمُه
 * كلَّ نصف ساعة من الملفّ نفسِه، فالشارةُ تتبدّل بلا فتح التطبيق.
 */
data class WTitle(val kind: String, val id: Int, val title: String, val poster: String?)
/** 🆕 W17 — `backdrop` اسمُ ملفّ الصورة العريضة، `sub` سطرُ البطاقة الثاني كما في التطبيق، `pct` نسبتُها */
data class WContinue(val t: WTitle, val label: String?, val season: Int?, val episode: Int?, val backdrop: String?, val sub: String?, val pct: Int)
data class WToWatch(val t: WTitle, val action: String)
data class WUpcoming(val t: WTitle, val date: String?, val label: String?, val behind: String?)
/** 🆕 v2 — `backdrop` اسمُ ملفّ الهيدر لبطاقة فيلم الليلة العريضة (W42) */
data class WMovie(val t: WTitle, val runtime: Int?, val rating: Double?, val suggested: Boolean, val backdrop: String? = null)
data class WList(val id: String, val name: String, val items: List<WTitle>)

class WFeed(
  val rtl: Boolean,
  val lang: String,
  val cont: List<WContinue>,
  val contTotal: Int,
  val towatch: List<WToWatch>,
  val towatchAll: List<WTitle>,
  val upcoming: List<WUpcoming>,
  val upTotal: Int,
  val tonight: List<WMovie>,
  val lists: List<WList>,
  val check: Boolean,
  private val strings: JSONObject,
  /** 🆕 الودجت الواحد — الملفُّ كما كُتب: `v2` (الأقسام) و`w2` (الصفوفُ المحسومة) يقرؤهما `W2Render` */
  val raw: JSONObject,
  private val posters: JSONObject,
) {
  fun s(key: String): String = strings.optString(key, "")

  /** اسمُ الملفّ المحلّيّ لمسار TMDB — `null` إن لم يُنزَّل */
  fun art(path: String?): String? = if (path == null) null else posters.optString(path, "").takeIf { it.isNotEmpty() }

  /** عملٌ من كائنٍ في `v2` — الشكلُ نفسُه (`kind · id · title · poster_path`) */
  fun titleFrom(x: JSONObject?): WTitle? {
    if (x == null) return null
    val path = if (x.isNull("poster_path")) null else x.optString("poster_path").takeIf { it.isNotEmpty() }
    return WTitle(x.optString("kind", "tv"), x.optInt("id"), x.optString("title", "—"), art(path))
  }

  companion object {
    const val SCHEME = "com.loopztv.app"

    fun dir(ctx: Context): File = File(ctx.filesDir, "widget")

    /** `null` = لا ملفَّ بعد · `SIGNED_OUT` = خرج صاحبُه */
    fun load(ctx: Context): Any? {
      return try {
        val f = File(dir(ctx), "feed.json")
        if (!f.exists()) return null
        val o = JSONObject(f.readText())
        if (o.optBoolean("signed_out", false)) return SIGNED_OUT
        parse(o)
      } catch (e: Exception) {
        null
      }
    }

    val SIGNED_OUT = Any()

    private fun str(o: JSONObject, k: String): String? = if (o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }
    private fun int(o: JSONObject, k: String): Int? = if (o.isNull(k) || !o.has(k)) null else o.optInt(k)

    private fun parse(o: JSONObject): WFeed {
      val posters = o.optJSONObject("posters") ?: JSONObject()
      fun title(x: JSONObject): WTitle {
        val path = str(x, "poster_path")
        return WTitle(
          x.optString("kind", "tv"),
          x.optInt("id"),
          x.optString("title", "—"),
          if (path != null) str(posters, path) else null,
        )
      }
      fun arr(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }

      val cont = o.optJSONObject("continue")
      val up = o.optJSONObject("upcoming")
      return WFeed(
        rtl = o.optString("dir") == "rtl",
        lang = o.optString("lang", "ar"),
        cont = arr(cont?.optJSONArray("items")).map {
          val bd = str(it, "backdrop_path")
          WContinue(title(it), str(it, "label"), int(it, "season"), int(it, "episode"), if (bd != null) str(posters, bd) else null, str(it, "sub"), it.optInt("pct", 0).coerceIn(0, 100))
        },
        contTotal = cont?.optInt("total") ?: 0,
        towatch = arr(o.optJSONArray("towatch_series")).map { WToWatch(title(it), it.optString("action", "start")) },
        towatchAll = arr(o.optJSONArray("towatch_all")).map { title(it) },
        upcoming = arr(up?.optJSONArray("items")).map { WUpcoming(title(it), str(it, "date"), str(it, "label"), str(it, "behind_label")) },
        upTotal = up?.optInt("total") ?: 0,
        tonight = arr(o.optJSONArray("tonight")).map {
          val bd = str(it, "backdrop_path")
          WMovie(title(it), int(it, "runtime"), if (it.isNull("rating")) null else it.optDouble("rating"), it.optString("source") == "suggested", if (bd != null) str(posters, bd) else null)
        },
        lists = arr(o.optJSONArray("lists")).map { l -> WList(l.optString("id"), l.optString("name"), arr(l.optJSONArray("items")).map { title(it) }) },
        check = o.optBoolean("check", false),
        strings = o.optJSONObject("strings") ?: JSONObject(),
        raw = o,
        posters = posters,
      )
    }
  }

  fun locale(): Locale = if (lang == "en") Locale.ENGLISH else Locale("ar")

  /** فرقُ الأيّام بين يوم الجهاز الآن وتاريخٍ نصّيّ — `null` إن لم يُقرأ */
  fun daysFromToday(date: String): Int? {
    return try {
      val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }
      val target = fmt.parse(date) ?: return null
      val now = Calendar.getInstance()
      val today = Calendar.getInstance().apply {
        clear()
        set(now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH))
      }
      Math.round((target.time - today.timeInMillis) / 86_400_000.0).toInt()
    } catch (e: Exception) {
      null
    }
  }

  /** «اليوم» · «غداً» · اسمُ اليوم في الأسبوع · «٢٢ نوفمبر» */
  fun dayLabel(date: String): String {
    val d = daysFromToday(date) ?: return date
    return when {
      d <= 0 -> s("today")
      d == 1 -> s("tomorrow")
      d < 7 -> SimpleDateFormat("EEEE", locale()).format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date)!!)
      else -> SimpleDateFormat("d MMMM", locale()).format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date)!!)
    }
  }

  /** ما لم يمضِ بعد — موعدٌ كُتب أمسِ ونزل اليوم يبقى؛ ما مضى يسقط (التقويمُ نفسُه يُسقطه، D-828) */
  fun upcomingNow(): List<WUpcoming> = upcoming.filter { it.date == null || (daysFromToday(it.date) ?: 0) >= 0 }

  fun runtime(min: Int?): String? {
    if (min == null || min <= 0) return null
    val h = min / 60
    val m = min % 60
    return if (lang == "en") (if (h > 0) "${h}h ${m}m" else "${m}m") else (if (h > 0) "$h س $m د" else "$m د")
  }
}

/** روابطُ الودجت — كلُّها إلى `WidgetGate` في التطبيق (`com.loopztv.app://w/…`)، لا `web?u=` */
object WLinks {
  fun title(t: WTitle) = "w/title?k=${if (t.kind == "movie") "movie" else "tv"}&id=${t.id}"
  fun all(section: String) = "w/all?s=$section"
  fun calendar() = "w/calendar"
  fun discover() = "w/discover"
  fun list(id: String) = "w/list?id=${Uri.encode(id)}"
  fun start(t: WTitle, action: String) = "w/start?id=${t.id}&a=${Uri.encode(action)}&t=${Uri.encode(t.title)}"

  /**
   * ⚠️ **رمزُ الطلب يجب أن يختلف لكلِّ لمسةٍ ولكلِّ ودجت** (درسُ D-929): نيّتان معلّقتان برمزٍ واحدٍ تتطابقان عند
   * أندرويد فتفتح اللمساتُ كلُّها الوجهةَ نفسَها.
   */
  fun open(ctx: Context, path: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${WFeed.SCHEME}://$path")).setPackage(ctx.packageName)
    return PendingIntent.getActivity(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun launch(ctx: Context, code: Int): PendingIntent? {
    val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    return PendingIntent.getActivity(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}

/**
 * 🆕 W17 · W18 · W21 — **الصورُ تُرسم هنا بمقاس خانتها بالضبط**، فـ`fitXY` في الواجهة لا يمطّ ولا يقصّ شيئاً:
 * - `card`: بطاقةُ «أكمل المشاهدة» كما في الرئيسيّة (`Cards.tsx`) — الصورةُ تملأ البطاقة ويبقى أعلاها (`contentPosition="top"`)،
 *   وحجابُ `poster-veil` على ستّين بالمئة من أسفلها، وشريطُ ٤dp من جهة البداية، وإطارٌ رفيع، ونصفُ قطر ١٢.
 * - `posterFull`: الملصقُ **كلُّه** بمقاس الودجت (قرارُ أحمد: «الصورة كاملة … عادي تمطها») — والتظليلُ خلف الكلام فقط فوق وتحت
 *   بالدرجة الوسط التي اعتمدها («اعتمد ب»)، ووسطُ الملصق صافٍ.
 * ⚠️ **الحدُّ حدُّ RemoteViews**: الصورةُ تُقرأ مصغّرةً (`inSampleSize`) إلى ما يكفي المقاسَ لا أكبر.
 */
object WArt {
  private const val ACCENT = 0xFFFFD400.toInt()
  private const val SUCCESS = 0xFF22C55E.toInt()
  private const val TRACK = 0x1FFFFFFF
  private const val BORDER = 0x24FFFFFF

  private fun px(ctx: Context, dp: Float) = dp * ctx.resources.displayMetrics.density

  private fun decode(ctx: Context, name: String?, w: Int, h: Int): Bitmap? {
    if (name == null) return null
    return try {
      val f = File(WFeed.dir(ctx), name)
      if (!f.exists()) return null
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(f.path, bounds)
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= w && bounds.outHeight / (sample * 2) >= h) sample *= 2
      BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (e: Exception) {
      null
    }
  }

  private fun canvasFor(w: Int, h: Int, r: Float): Pair<Bitmap, Canvas> {
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(out)
    c.clipPath(Path().apply { addRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), r, r, Path.Direction.CW) })
    return out to c
  }

  private fun border(ctx: Context, c: Canvas, w: Int, h: Int, r: Float) {
    val sw = px(ctx, 1f)
    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = sw; color = BORDER }
    c.drawRoundRect(RectF(sw / 2, sw / 2, w - sw / 2, h - sw / 2), r, r, p)
  }

  /** بطاقة «أكمل المشاهدة». `pct` = null لا شريط (مصدرُ قائمة/«للمشاهدة»)، `alpha` < 255 للخانة الباهتة */
  fun card(ctx: Context, backdrop: String?, poster: String?, wDp: Float, hDp: Float, rtl: Boolean, pct: Int?, alpha: Int = 255): Bitmap? {
    return try {
      val w = px(ctx, wDp).toInt().coerceAtLeast(1)
      val h = px(ctx, hDp).toInt().coerceAtLeast(1)
      val r = px(ctx, 12f)
      val (out, c) = canvasFor(w, h, r)
      c.drawColor(0xFF1A1A1A.toInt())
      val src = decode(ctx, backdrop, w, h) ?: decode(ctx, poster, w, h)
      if (src != null) {
        /* تملأ البطاقة ويبقى أعلاها — كـ`contentFit="cover" contentPosition="top"` في الرئيسيّة */
        val scale = maxOf(w.toFloat() / src.width, h.toFloat() / src.height)
        val m = Matrix().apply {
          setScale(scale, scale)
          postTranslate((w - src.width * scale) / 2f, 0f)
        }
        c.drawBitmap(src, m, Paint(Paint.FILTER_BITMAP_FLAG).apply { this.alpha = alpha })
        src.recycle()
      }
      /* حجابُ `poster-veil`: من أسود ٨٥٪ عند القاع إلى ٢٥٪ ثمّ إلى لا شيء، على ستّين بالمئة من الارتفاع */
      val top = h * 0.4f
      c.drawRect(0f, top, w.toFloat(), h.toFloat(), Paint().apply {
        shader = LinearGradient(0f, h.toFloat(), 0f, top, intArrayOf(Color.argb(217, 0, 0, 0), Color.argb(64, 0, 0, 0), Color.TRANSPARENT), floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
      })
      if (pct != null) {
        val bh = px(ctx, 4f)
        c.drawRect(0f, h - bh, w.toFloat(), h.toFloat(), Paint().apply { color = TRACK })
        val fw = w * (pct.coerceIn(0, 100) / 100f)
        val fill = Paint().apply { color = if (pct >= 100) SUCCESS else ACCENT }
        /* من جهة البداية كما يرسمه التطبيق: يسارٌ في الإنجليزيّة، يمينٌ في العربيّة */
        if (rtl) c.drawRect(w - fw, h - bh, w.toFloat(), h.toFloat(), fill) else c.drawRect(0f, h - bh, fw, h.toFloat(), fill)
      }
      border(ctx, c, w, h, r)
      out
    } catch (e: Exception) {
      null
    }
  }

  /**
   * 🆕 W33 · W43 — الصغيرُ المربّع لـ«أكمل المشاهدة»: **الهيدرُ كلُّه بعرض الودجت** (لا قصّ، مطٌّ ≤ ٥٪ حين تختلف النسبةُ قليلاً)
   * أعلى الودجت، يذوب في أسود الودجت تحته — والكلامُ على الأسود. لا زوم (W38).
   */
  fun headerFade(ctx: Context, backdrop: String?, wDp: Float, hDp: Float, radiusDp: Float = 16f): Bitmap? {
    return try {
      val w = px(ctx, wDp).toInt().coerceAtLeast(1)
      val h = px(ctx, hDp).toInt().coerceAtLeast(1)
      val r = px(ctx, radiusDp)
      val (out, c) = canvasFor(w, h, r)
      c.drawColor(0xFF050505.toInt())
      val ih = (w * 9f / 16f).coerceAtMost(h.toFloat())
      val src = decode(ctx, backdrop, w, ih.toInt())
      if (src != null) {
        c.drawBitmap(src, null, RectF(0f, 0f, w.toFloat(), ih), Paint(Paint.FILTER_BITMAP_FLAG))
        src.recycle()
      }
      val fadeTop = ih * 0.45f
      c.drawRect(0f, fadeTop, w.toFloat(), ih + 1f, Paint().apply {
        shader = LinearGradient(0f, fadeTop, 0f, ih, Color.TRANSPARENT, 0xFF050505.toInt(), Shader.TileMode.CLAMP)
      })
      border(ctx, c, w, h, r)
      out
    } catch (e: Exception) {
      null
    }
  }

  /** الملصقُ كلُّه بمقاس الودجت، والتظليلُ خلف الكلام فقط (فوق وتحت) */
  fun posterFull(ctx: Context, poster: String?, wDp: Float, hDp: Float, alpha: Int = 255): Bitmap? {
    return try {
      val w = px(ctx, wDp).toInt().coerceAtLeast(1)
      val h = px(ctx, hDp).toInt().coerceAtLeast(1)
      val r = px(ctx, 16f)
      val (out, c) = canvasFor(w, h, r)
      c.drawColor(0xFF1A1A1A.toInt())
      val src = decode(ctx, poster, w, h)
      if (src != null) {
        c.drawBitmap(src, null, RectF(0f, 0f, w.toFloat(), h.toFloat()), Paint(Paint.FILTER_BITMAP_FLAG).apply { this.alpha = alpha })
        src.recycle()
      }
      val topEnd = h * 0.21f
      c.drawRect(0f, 0f, w.toFloat(), topEnd, Paint().apply {
        shader = LinearGradient(0f, 0f, 0f, topEnd, Color.argb(128, 0, 0, 0), Color.TRANSPARENT, Shader.TileMode.CLAMP)
      })
      val botStart = h * 0.62f
      c.drawRect(0f, botStart, w.toFloat(), h.toFloat(), Paint().apply {
        shader = LinearGradient(0f, h.toFloat(), 0f, botStart, intArrayOf(Color.argb(191, 0, 0, 0), Color.argb(107, 0, 0, 0), Color.TRANSPARENT), floatArrayOf(0f, 0.47f, 1f), Shader.TileMode.CLAMP)
      })
      border(ctx, c, w, h, r)
      out
    } catch (e: Exception) {
      null
    }
  }
}

/** الملصقاتُ: تُقرأ بحجمها المطلوب ثمّ تُقصّ وتُدوَّر — لا صورةَ كاملةَ في ذاكرة الودجت (حدُّ RemoteViews) */
object WPosters {
  fun load(ctx: Context, name: String?, wDp: Float, hDp: Float, radiusDp: Float): Bitmap? {
    if (name == null) return null
    return try {
      val f = File(WFeed.dir(ctx), name)
      if (!f.exists()) return null
      val dm = ctx.resources.displayMetrics
      val w = (wDp * dm.density).toInt().coerceAtLeast(1)
      val h = (hDp * dm.density).toInt().coerceAtLeast(1)
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(f.path, bounds)
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= w && bounds.outHeight / (sample * 2) >= h) sample *= 2
      val src = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
      /* قصٌّ من الوسط بنسبة الخانة — `centerCrop` في الرسم نفسِه، فالزوايا المدوّرةُ على الصورة لا على ما خلفها */
      val scale = maxOf(w.toFloat() / src.width, h.toFloat() / src.height)
      val m = Matrix().apply {
        setScale(scale, scale)
        postTranslate((w - src.width * scale) / 2f, (h - src.height * scale) / 2f)
      }
      val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
        shader = BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { setLocalMatrix(m) }
      }
      val r = radiusDp * dm.density
      Canvas(out).drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), r, r, paint)
      src.recycle()
      out
    } catch (e: Exception) {
      null
    }
  }
}
