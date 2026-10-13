package com.loopztv.app.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
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
data class WContinue(val t: WTitle, val label: String?, val season: Int?, val episode: Int?)
data class WToWatch(val t: WTitle, val action: String)
data class WUpcoming(val t: WTitle, val date: String?, val label: String?, val behind: String?)
data class WMovie(val t: WTitle, val runtime: Int?, val rating: Double?, val suggested: Boolean)
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
) {
  fun s(key: String): String = strings.optString(key, "")

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
        cont = arr(cont?.optJSONArray("items")).map { WContinue(title(it), str(it, "label"), int(it, "season"), int(it, "episode")) },
        contTotal = cont?.optInt("total") ?: 0,
        towatch = arr(o.optJSONArray("towatch_series")).map { WToWatch(title(it), it.optString("action", "start")) },
        towatchAll = arr(o.optJSONArray("towatch_all")).map { title(it) },
        upcoming = arr(up?.optJSONArray("items")).map { WUpcoming(title(it), str(it, "date"), str(it, "label"), str(it, "behind_label")) },
        upTotal = up?.optInt("total") ?: 0,
        tonight = arr(o.optJSONArray("tonight")).map {
          WMovie(title(it), int(it, "runtime"), if (it.isNull("rating")) null else it.optDouble("rating"), it.optString("source") == "suggested")
        },
        lists = arr(o.optJSONArray("lists")).map { l -> WList(l.optString("id"), l.optString("name"), arr(l.optJSONArray("items")).map { title(it) }) },
        check = o.optBoolean("check", false),
        strings = o.optJSONObject("strings") ?: JSONObject(),
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
