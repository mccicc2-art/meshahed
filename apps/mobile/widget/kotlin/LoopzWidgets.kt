package com.loopztv.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.loopztv.app.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * ====== 🆕 ودجتُ لوبز الواحد في أندرويد (خطّةُ الودجتات v2، W28–W43) ======
 *
 * 🔑 **مزوّدٌ واحدٌ بكلِّ الأحجام** (W28: صغير ٢×٢ · متوسط ٤×٢ · كبير ٤×٤ · كبير جداً ٤×٦): المقاسُ الحقيقيُّ
 * (`OPTION_APPWIDGET_*`) يختار الحجم، و**الصفوفُ محسومةٌ في التطبيق** (`resolveWidget` في `src/core/widgetLayout.ts`،
 * مكتوبةً في `w2.android`) — فالمعاينةُ في «ودجت لوبز» والودجتُ هنا يرسمان الشيءَ نفسَه (§11.2). هنا رسمٌ فقط.
 *
 * ⚖️ **`LoopzWidget` اسمُ المتوسط القديم** (D-929): من وضعه يجده الودجتَ الجديدَ في مكانه؛ وبقيّةُ الودجتات القديمة
 * تختفي ويُعاد وضعُها باليد (قرارُ أحمد «٢ ب»).
 *
 * RemoteViews لا تبني شجرةً حرّة: كلُّ صفٍّ واجهةٌ معرّفةٌ (`w2_*.xml`) تُضاف إلى `rows` بالترتيب (`addView`).
 * 🆕 الدفعةُ الثانية (W35 · W37): ✓ الحلقة و«✓ شاهدته» للفيلم و«▶ ابدأ» للمسلسل تعمل من الودجت برمزه (`CheckReceiver`)،
 * و«↶ تراجع» ٥ ثوانٍ مكانَ الزرّ، وشريطُ «قيّم الفيلم» تحت البحث بعد الفيلم (قرارُ أحمد «١ ب»). بلا رمز (`check`) تفتح العمل.
 */
class LoopzWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { id -> manager.updateAppWidget(id, W2Render.build(ctx, id)) }
  }

  /** مقاسٌ جديد ⇒ حجمٌ قد يتبدّل، والصورُ تُرسم بمقاسها الجديد (W18) */
  override fun onAppWidgetOptionsChanged(ctx: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    manager.updateAppWidget(id, W2Render.build(ctx, id))
  }

  override fun onDeleted(ctx: Context, ids: IntArray) {
    val e = prefs(ctx).edit()
    ids.forEach { id -> e.remove("tn_$id").remove("cn_$id") }
    e.apply()
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action == ACTION_CYCLE) {
      val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
      if (id >= 0) {
        val p = prefs(ctx)
        /* 🆕 D-1571 — «↻» على «الآن في السينما» يقلّب بعدّاده هو (`cn_`) لا بعدّاد فيلم الليلة */
        val k = (intent.getStringExtra("what") ?: "tn") + "_" + id
        p.edit().putInt(k, p.getInt(k, 0) + 1).apply()
        AppWidgetManager.getInstance(ctx).updateAppWidget(id, W2Render.build(ctx, id))
      }
      return
    }
    super.onReceive(ctx, intent)
  }

  companion object {
    const val PREFS = "loopz_widget_cfg"
    const val ACTION_CYCLE = "com.loopztv.app.widget.TONIGHT_CYCLE"
    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * يعيد رسمَ كلِّ ودجتات لوبز — بعد كلِّ لمسة. 🆕 **مباشرةً** (`updateAppWidget`) كـ«فيلم آخر»: البثُّ الذي كان هنا
     * يؤخّره أندرويد للتطبيق في الخلفيّة، فكانت «↶ تراجع» والحلقةُ التالية تظهران بعد ثوانٍ (تجربةُ أحمد ١٤ أكتوبر).
     */
    fun redrawAll(ctx: Context) {
      val m = AppWidgetManager.getInstance(ctx)
      val ids = m.getAppWidgetIds(ComponentName(ctx, LoopzWidget::class.java))
      ids.forEach { id ->
        try {
          m.updateAppWidget(id, W2Render.build(ctx, id))
        } catch (e: Exception) {
          /* ودجتٌ واحدٌ لا يمنع الباقي */
        }
      }
    }

    fun cycleIntent(ctx: Context, id: Int, code: Int, what: String = "tn"): PendingIntent {
      val i = Intent(ctx, LoopzWidget::class.java).setAction(ACTION_CYCLE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("what", what)
      return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}

/** صفٌّ محسوم كما كتبه المحرّك — `WidgetRow` في `widgetLayout.ts` */
private class Row(val o: JSONObject) {
  val type: String = o.optString("type")
  val key: String = o.optString("key")
  val view: String = o.optString("view")
  val count: Int = o.optInt("count", 2)
  val full: Boolean = o.optBoolean("full")
  val trend: String = o.optString("trend", "list")
  val upLine: Boolean = o.optBoolean("upLine")
  /** 🆕 المتوسطُ وأكملُ المشاهدة وحدَه: بطاقتان أطول (`contTall`) */
  val tall: Boolean = o.optBoolean("tall")
  /** 🆕 أسطرُ القسمين الصغيرين: ٢ أو ٣ — خلاصةٌ أقدمُ بلا العدد ⇒ ٣ كما كانت */
  val pairCount: Int = o.optInt("count", 3)
  /** 🆕 W50 — ما زاده المحرّكُ لكلِّ سطرٍ (والصورةُ معه) من فراغ الودجت؛ و`card` ارتفاعُ بطاقتي «أكمل المشاهدة» كما حُسم */
  val grow: Float = o.optDouble("grow", 0.0).toFloat().coerceAtLeast(0f)
  val card: Float? = o.optDouble("card", Double.NaN).takeIf { !it.isNaN() && it > 0 }?.toFloat()
  /** 🆕 W54 — عددُ البوسترات (٣ · ٤)؛ خلاصةٌ أقدمُ بلا العدد ⇒ ٣ */
  val posters: Int = o.optInt("posters", 3).coerceIn(3, 4)
  val h: Float = o.optDouble("h", 0.0).toFloat()
  val keys: List<String> = o.optJSONArray("keys")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
  /** 🆕 D-1562 — شكلُ كلِّ نصفٍ في صفِّ النصّين («list» · «poster») كما اختاره الشخصُ في خانته؛ خلاصةٌ أقدمُ بلاه ⇒ خياراتُ القسم */
  val views: List<String> = o.optJSONArray("views")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
  /** 🆕 D-1571 — أسطرُ كلِّ نصفٍ قائمة (أربعةٌ مختصرة، و«أصدقاؤك» ثلاثة)، وأيُّ عنصرٍ في السطر المختصر (سطرا نشاطك) */
  val halfRows: List<Int> = o.optJSONArray("rows")?.let { a -> (0 until a.length()).map { a.optInt(it) } } ?: emptyList()
  val index: Int = o.optInt("index", 0)
}

/** سطرٌ في قسم — صورةٌ واسمٌ وسطرٌ ثانٍ ووجهةُ اللمسة */
private data class Line(val t: WTitle?, val name: String, val sub: String?, val link: String, val time: String? = null, val avatar: String? = null)

/** ما يحتاجه الرسمُ في كلِّ صفّ: الخلاصةُ والقسمُ والمقاسُ وعدّادُ رموز النيّات (كلُّ لمسةٍ برمزها — درسُ D-929) */
private class Draw(val ctx: Context, val id: Int, val f: WFeed, val v2: JSONObject, val opts: JSONObject, val wDp: Float, val size: String = "", val look: JSONObject? = null, val s: Float = 1f) {
  /** 🆕 W48 — ما بقي من ارتفاع الودجت تحت الصفوف المحسومة: يأخذه «أكمل المشاهدة» فتلتصق الأقسامُ بخطوطها (أندرويد قبل 12 وحدَه الآن) */
  var extra: Float = 0f
  /** «أكمل المشاهدة» يملأ الباقي (W48) — قبل أندرويد 12، أو صفٌّ واحد (المتوسط) */
  var fill: Boolean = false
  val xl: Boolean get() = size == "xl"
  /**
   * 🆕 **أندرويد 12+ يغيّر مقاسَ العنصر** (`setViewLayoutHeight`، API 31): W50 (الأسطرُ تكبر والبطاقتان بمقاسهما) وW54 (أربعةُ
   * بوسترات بمقاسٍ يملأ العرض) ومقاساتُ الشكل من الخلاصة. وما قبله يرسم كما كان — والتطبيقُ يحسم له بالشرط نفسِه (`ANDROID_RESIZE`).
   */
  val resize: Boolean = Build.VERSION.SDK_INT >= 31
  /** 🆕 رقمٌ من شكل الودجت (`w2.look.android.<الحجم>`) وإلّا الرقمُ المكتوبُ هنا — خلاصةٌ أقدمُ أو بلا شكلٍ ترسم كما كانت */
  fun n(k: String, def: Float): Float = (look?.optDouble(k, Double.NaN)?.takeIf { !it.isNaN() && it > 0 }?.toFloat() ?: def) * s
  /**
   * 🆕 D-1571 — **النسبة** (`s`): عرضُ الودجت الحقيقيّ ÷ عرض التصميم (٣٣٥؛ الصغيرُ ١٦٠). One UI يرسم ودجتَ خالد في مساحة ٤٣٥×٢٣١
   * ثمّ يصغّره، فبنقاطٍ ثابتةٍ ظهرت القطعُ صغيرةً وبينها فراغات. كلُّ مقاسٍ هنا يُضرب فيها (`n` أعلاه للأرقام من الشكل، و`u` لما كُتب
   * بيدٍ) — ٤×٢ عنده يطابق التصميمَ بالضبط. قبل أندرويد 12 لا تغيير مقاس ⇒ النسبةُ ١.
   */
  fun u(dp: Float): Float = dp * s
  /** «الآن في السينما» — 🆕 D-1571 */
  val cinema: List<JSONObject> get() = list(v2.optJSONArray("cinema"))
  private var code = 0
  fun next(): Int = id * 1000 + (code++ % 1000)
  fun open(path: String): PendingIntent = WLinks.open(ctx, path, next())
  fun s2(k: String): String = v2.optJSONObject("strings")?.optString(k, "") ?: ""
  /** 🆕 حالةُ ما بعد اللمسة (W37): الفعلُ الذي عليه «↶ تراجع» الآن، وما شوهد أو بدأ من الودجت فيُخفى حتى تصل خلاصةٌ أحدث */
  val undo: JSONObject? = CheckReceiver.undoNow(ctx)
  val hidden: Set<Int> = CheckReceiver.hidden(ctx, java.io.File(WFeed.dir(ctx), "feed.json").lastModified())
  fun undoOn(kind: String, id: Int): Boolean = undo != null && undo.optString("kind") == kind && undo.optInt("id") == id
  /** «للمشاهدة» بلا ما شوهد أو بدأ للتوّ */
  fun arr(k: String): List<JSONObject> = list(v2.optJSONArray(k)).let { a -> if (k == "towatch") a.filter { it.optInt("id") !in hidden } else a }
  /** «فيلم الليلة» بلا ما شوهد للتوّ — فيأتي الفيلمُ التالي */
  val tonight: List<WMovie> get() = f.tonight.filter { it.t.id !in hidden }
  /** نصٌّ من الخلاصة، وبديلُه للخلاصات الأقدم من الدفعة الثانية */
  fun s2or(k: String, ar: String, en: String): String = s2(k).ifEmpty { if (f.lang == "en") en else ar }
  fun undoText(): String = s2or("undo", "تراجع", "Undo")
  fun list(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }
  fun opt(key: String): JSONObject = opts.optJSONObject(key) ?: JSONObject()
}

object W2Render {
  private const val SETTINGS = "w/settings"
  private const val SEARCH = "w/search"

  /**
   * 🔴 **تسجيلُ أحمد (١٤ أكتوبر، بناء 73)**: «أكمل المشاهدة» مكرّرٌ أربعَ مرّاتٍ والبحثُ بينها، والحفظُ لا يغيّر شيئاً.
   * السبب: حين يبقى الجذرُ نفسُه يُعيد المُشغِّلُ تطبيقَ الأوامر على الودجت القائم (`reapply`) لا يرسمه من الصفر —
   * و`addView` **يُلحق** تحت ما كان، فتتراكم صفوفُ كلِّ رسمةٍ سابقة (أوّلُها بالمقاس المتوسط قبل التمديد). وكذلك
   * الظهورُ والإخفاء: ما لم يُكتب صراحةً يبقى على حال الرسمة السابقة. فكلُّ واجهةٍ هنا **تبدأ نظيفة**: الحاوياتُ
   * تُفرَّغ قبل أوّل إضافة، وعناصرُ الجذر تُكتب حالتُها كلُّها في كلِّ رسمة.
   */
  private fun fresh(ctx: Context, layout: Int): RemoteViews {
    val v = RemoteViews(ctx.packageName, layout)
    when (layout) {
      R.layout.w2_root -> {
        v.removeAllViews(R.id.rows)
        v.setViewVisibility(R.id.rows, View.VISIBLE)
        v.setViewVisibility(R.id.lock, View.GONE)
        v.setViewVisibility(R.id.empty, View.GONE)
      }
      R.layout.w2_list, R.layout.w2_half_list -> v.removeAllViews(R.id.items)
      R.layout.w2_pair, R.layout.w2_pair_2, R.layout.w2_pair_xl -> {
        v.removeAllViews(R.id.half_a)
        v.removeAllViews(R.id.half_b)
      }
      R.layout.loopz_w_small -> {
        v.setViewVisibility(R.id.full_img, View.VISIBLE)
        v.setImageViewResource(R.id.full_img, android.R.color.transparent)
        listOf(R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus, R.id.full_check, R.id.empty)
          .forEach { v.setViewVisibility(it, View.GONE) }
      }
    }
    return v
  }

  fun build(ctx: Context, id: Int): RemoteViews {
    val f = WFeed.load(ctx)
    if (f == WFeed.SIGNED_OUT) return empty(ctx, id, ctx.getString(R.string.w_signed_out))
    if (f !is WFeed) return empty(ctx, id, ctx.getString(R.string.w_open_app))
    val w2all = f.raw.optJSONObject("w2")?.optJSONObject("android")
    /* 🆕 W40 — **كلُّ ودجتٍ بإعداده**: ما خُصّص لهذا الودجت (`byId["aw-<id>"]` يحسمه التطبيق)، وإلّا الإعدادُ الافتراضيّ */
    val w2 = w2all?.optJSONObject("byId")?.optJSONObject("aw-$id") ?: w2all
    val v2 = f.raw.optJSONObject("v2")
    /* خلاصةٌ من تطبيقٍ أقدم (بلا `w2`) ⇒ «افتح لوبز» حتى يكتبها التطبيقُ الجديد */
    if (w2 == null || v2 == null) return empty(ctx, id, ctx.getString(R.string.w_open_app))
    val (w, h) = sizeDp(ctx, id)
    /* 🆕 D-1571 — النسبةُ من العرض، والحجمُ والصفوفُ بنقاط التصميم (الارتفاعُ ÷ النسبة) — المحرّكُ حسم بها */
    val isSmall = w < 230f
    val sc = if (Build.VERSION.SDK_INT >= 31) (w / (if (isSmall) 160f else 335f)).coerceIn(0.8f, 1.7f) else 1f
    val size = if (isSmall) "small" else sizeOf(w / sc, h / sc)
    val v = try {
      /* 🆕 الصفوفُ المحسومةُ لارتفاع الودجت الحقيقيّ (أكبرُ مفتاحٍ لا يزيد عليه) — تسجيلُ أحمد ١٤ أكتوبر */
      /* 🆕 W37 — شريطُ التقييم يأخذ مكانه (٨٠ وفاصل) فتُحسم الصفوفُ لما بقي؛ وإن لم يبقَ ما يتّسع لصفٍّ فالشريطُ وحدَه */
      val rate = if (f.check) CheckReceiver.rateNow(ctx) else null
      val room = if (rate != null) h - RATE_H * sc else h
      val fit = byHeight(w2.optJSONObject("heights"), room / sc)
      val fitSize = fit?.optString("size") ?: size
      /* 🆕 W48 — مقاساتُ الصفوف بحجم الودجت (أصدقاؤك ٥٨ في الكبير و٥٢ في الكبير جداً) كما حسبها المحرّك لأندرويد */
      /* 🆕 شكلُ الودجت بياناتٍ: أرقامُ هذا الحجم كما كتبها التطبيقُ من الخلاصة (`w2.look`) — الصغيرُ بأرقامه هو */
      val look = f.raw.optJSONObject("w2")?.optJSONObject("look")?.optJSONObject("android")?.optJSONObject(if (size == "small") "small" else fitSize)
      val d = Draw(ctx, id, f, v2, w2.optJSONObject("opts") ?: JSONObject(), w, fitSize, look, sc)
      when {
        size == "small" -> small(d, w2.optJSONObject("small") ?: JSONObject(), w, h)
        w2.optJSONObject("locked")?.optBoolean(fitSize) == true -> locked(d)
        rate != null && room / sc < 140f -> rows(d, null, rate)
        fit != null -> rows(d, fit.optJSONArray("rows"), rate, room)
        else -> rows(d, w2.optJSONObject("rows")?.optJSONArray(size), null, h)
      }
    } catch (e: Exception) {
      return empty(ctx, id, ctx.getString(R.string.w_open_app))
    }
    v.setInt(R.id.root, "setLayoutDirection", if (f.rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
    return v
  }

  /** أكبرُ ارتفاعٍ محسومٍ لا يزيد على ارتفاع الودجت — وإن قصر عن كلِّها فأصغرُها */
  private fun byHeight(all: JSONObject?, h: Float): JSONObject? {
    if (all == null) return null
    val keys = all.keys().asSequence().mapNotNull { it.toIntOrNull() }.sorted().toList()
    if (keys.isEmpty()) return null
    val k = keys.lastOrNull { it <= h } ?: keys.first()
    return all.optJSONObject(k.toString())
  }

  /** مقاسُ الودجت بالـdp — عرضُ الوضع العمودي (`MIN_WIDTH`) وارتفاعُه (`MAX_HEIGHT`) */
  private fun sizeDp(ctx: Context, id: Int): Pair<Float, Float> {
    val o = AppWidgetManager.getInstance(ctx).getAppWidgetOptions(id)
    val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
    val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
    return if (w > 0 && h > 0) w.toFloat() to h.toFloat() else 320f to 180f
  }

  /** W28 — العرضُ يفصل الصغيرَ (عمودان)، والارتفاعُ يفصل المتوسطَ والكبيرَ والكبيرَ جداً. 🆕 D-1571 — بنقاط التصميم، حدودُ المحرّك نفسُها */
  private fun sizeOf(w: Float, h: Float): String = when {
    w < 230f -> "small"
    h < 240f -> "medium"
    h < 520f -> "large"
    else -> "xl"
  }

  private fun empty(ctx: Context, id: Int, text: String): RemoteViews {
    val v = fresh(ctx, R.layout.w2_root)
    v.setViewVisibility(R.id.rows, View.GONE)
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    WLinks.launch(ctx, id * 1000 + 999)?.let { v.setOnClickPendingIntent(R.id.root, it) }
    return v
  }

  /* ───────── W41 — القفل ───────── */

  private fun locked(d: Draw): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_root)
    val lapsed = d.v2.optBoolean("lapsed")
    v.setViewVisibility(R.id.rows, View.GONE)
    v.setViewVisibility(R.id.lock, View.VISIBLE)
    v.setTextViewText(R.id.lock_title, d.s2(if (lapsed) "plusLapsedTitle" else "plusLockedTitle"))
    v.setTextViewText(R.id.lock_sub, d.s2(if (lapsed) "plusLapsedSub" else "plusLockedSub"))
    v.setTextViewText(R.id.lock_btn_text, d.s2(if (lapsed) "renew" else "subscribe"))
    v.setOnClickPendingIntent(R.id.root, d.open(SETTINGS))
    return v
  }

  /* ───────── الصفوف ───────── */

  /** شريطُ التقييم (٨٠) وفاصلُه (١٣) — `rateStrip` في `WIDGET_HEIGHTS` */
  private const val RATE_H = 93f

  private fun rows(d: Draw, list: JSONArray?, rate: JSONObject? = null, room: Float = 0f): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_root)
    val rows = d.list(list).map { Row(it) }
    /*
     * 🆕 W48 — قبل أندرويد 12: «أكمل المشاهدة» يأخذ الباقي (W48) كما كان — لا تغييرَ مقاسٍ هناك.
     * 🆕 D-1571 — أندرويد 12+: **كلُّ شيءٍ بالنسبة** (`d.s`)، والفاصلُ ٩ بخطّ (خالد ١٤:٢٤: «الفراغات بين القوائم قللها»)، وما يبقى من
     * الارتفاع **فوق الودجت وتحته** لا بين القوائم — فتبقى القوائمُ متلاصقةً بفواصلها، والصفُّ الوحيدُ في المنتصف.
     */
    val fill = rows.any { it.type == "cont" } && !d.resize
    d.fill = fill
    if (fill) {
      val used = 24f + rows.sumOf { it.o.optDouble("h", 0.0) }.toFloat() + 13f * (rows.size - 1).coerceAtLeast(0)
      d.extra = (room - used).coerceAtLeast(0f)
    }
    if (d.resize) {
      val pad = px(d, d.u(10f))
      v.setViewPadding(R.id.rows, pad, pad, pad, pad)
    }
    if (rate != null && rows.isEmpty()) {
      v.addView(R.id.rows, rateStrip(d, rate))
      return v
    }
    if (rows.isEmpty()) {
      v.setViewVisibility(R.id.rows, View.GONE)
      v.setViewVisibility(R.id.empty, View.VISIBLE)
      v.setTextViewText(R.id.empty, d.ctx.getString(R.string.w_open_app))
      v.setOnClickPendingIntent(R.id.root, d.open(SETTINGS))
      return v
    }
    /* W37 · «١ ب» — الشريطُ تحت البحث إن كان أوّلَ صفّ، وإلّا في الأعلى */
    val stripAfter = if (rows.firstOrNull()?.type == "search") 0 else -1
    if (rate != null && stripAfter < 0) {
      v.addView(R.id.rows, rateStrip(d, rate))
      v.addView(R.id.rows, divider(d, 13f))
    }
    val centre = d.resize && rate == null
    if (centre) v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
    rows.forEachIndexed { i, r ->
      if (rate != null && i == 1 && stripAfter == 0) {
        v.addView(R.id.rows, divider(d, 13f))
        v.addView(R.id.rows, rateStrip(d, rate))
      }
      val child = when (r.type) {
        "search" -> search(d, r)
        "cont" -> cont(d, r)
        "list" -> section(d, r)
        "tonight" -> tonight(d, r)
        "pair" -> pair(d, r)
        "line" -> line(d, r.key, r.index)
        else -> null
      } ?: return@forEachIndexed
      if (i > 0) {
        if (!fill && !d.resize) v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
        v.addView(R.id.rows, divider(d, if (d.resize) 9f else 13f))
        if (!fill && !d.resize) v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
      }
      v.addView(R.id.rows, child)
      /* 🆕 D-1571 — صفُّ «القادم» المختصر ببوستره تحت البطاقتين (لوحة الخطّة ٤×٢): خطٌّ ومسافة ٨ ثمّ ٣٤ */
      if (r.type == "cont" && r.upLine && d.resize) {
        v.addView(R.id.rows, divider(d, 8f))
        line(d, "up", 0, more = true)?.let { v.addView(R.id.rows, it) }
      }
    }
    if (rate != null && stripAfter == 0 && rows.size == 1) {
      v.addView(R.id.rows, divider(d, 13f))
      v.addView(R.id.rows, rateStrip(d, rate))
    }
    if (centre) v.addView(R.id.rows, RemoteViews(d.ctx.packageName, R.layout.w2_flex))
    return v
  }

  /** فاصلٌ بخطّ — بارتفاعه بالنسبة في أندرويد 12+ (`div_root`)، و١٣ قبله */
  private fun divider(d: Draw, dp: Float): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_divider)
    layoutSize(v, R.id.div_root, null, d.u(dp))
    return v
  }

  /** نقاطٌ إلى بكسلات (لـ`setViewPadding`) */
  private fun px(d: Draw, dp: Float): Int = (dp * d.ctx.resources.displayMetrics.density).toInt()

  /** 🆕 D-1571 — رأسُ القسم: ١٨ وتحته ٦، والخطُّ بالنسبة — يُكتب في كلِّ رسم (W47) */
  private fun hdr(d: Draw, v: RemoteViews, text: String, sp: Float = 11.5f) {
    v.setTextViewText(R.id.hdr_title, text)
    v.setTextViewTextSize(R.id.hdr_title, TypedValue.COMPLEX_UNIT_SP, d.u(sp))
    v.setTextViewTextSize(R.id.hdr_all, TypedValue.COMPLEX_UNIT_SP, d.u(10f))
    layoutSize(v, R.id.hdr_row, null, d.u(18f))
  }

  /** عرضُ المحتوى داخل الحشوة — 🆕 D-1571: ١٠×النسبة جانباً في أندرويد 12+ (١٢ قبله) */
  private fun inner(d: Draw) = (d.wDp - if (d.resize) d.u(20f) else 24f).coerceAtLeast(60f)

  /* W31 — البحث */
  private fun search(d: Draw, r: Row): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_search)
    v.setTextViewText(R.id.bar_text, d.s2("searchPlaceholder"))
    v.setOnClickPendingIntent(R.id.bar, d.open(SEARCH))
    if (!r.full) return v
    val trending = d.arr("trending").mapNotNull { d.f.titleFrom(it) }
    v.setViewVisibility(R.id.trend_title, View.VISIBLE)
    v.setTextViewText(R.id.trend_title, d.s2("trendingToday"))
    if (r.trend == "posters") {
      v.setViewVisibility(R.id.trend_posters, View.VISIBLE)
      val slots = intArrayOf(R.id.tp_1, R.id.tp_2, R.id.tp_3)
      val imgs = intArrayOf(R.id.tp_img_1, R.id.tp_img_2, R.id.tp_img_3)
      val ranks = intArrayOf(R.id.tp_rank_1, R.id.tp_rank_2, R.id.tp_rank_3)
      for (n in 0 until 3) {
        val t = trending.getOrNull(n)
        if (t == null) { v.setViewVisibility(slots[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], t.poster, 87f, 130f, 8f)
        v.setTextViewText(ranks[n], "${n + 1}")
        v.setOnClickPendingIntent(slots[n], d.open(WLinks.title(t)))
      }
    } else {
      v.setViewVisibility(R.id.trend_list, View.VISIBLE)
      val slots = intArrayOf(R.id.tl_1, R.id.tl_2)
      val imgs = intArrayOf(R.id.tl_img_1, R.id.tl_img_2)
      val ranks = intArrayOf(R.id.tl_rank_1, R.id.tl_rank_2)
      val names = intArrayOf(R.id.tl_name_1, R.id.tl_name_2)
      for (n in 0 until 2) {
        val t = trending.getOrNull(n)
        if (t == null) { v.setViewVisibility(slots[n], View.INVISIBLE); continue }
        poster(d, v, imgs[n], t.poster, 28f, 40f, 4f)
        v.setTextViewText(ranks[n], "${n + 1}")
        v.setTextViewText(names[n], t.title)
        v.setOnClickPendingIntent(slots[n], d.open(WLinks.title(t)))
      }
    }
    return v
  }

  /* W33 — أكمل المشاهدة: بطاقتان، وسطرُ «القادم» حين يقوله المحرّك */
  private fun cont(d: Draw, r: Row): RemoteViews {
    /* 🆕 W48 — واجهةٌ واحدة: البطاقتان بوزنٍ يملأ ما بقي (كانت ٩٣ ثابتة، و١٢٠ في واجهةٍ ثانيةٍ للمتوسط)
       🆕 W50 — وفي أندرويد 12+ (ما لم يكن صفّاً واحداً) `w2_cont_fixed`: بلا وزن، والبطاقتان بالارتفاع المحسوم */
    val fixed = d.resize && !d.fill
    val v = RemoteViews(d.ctx.packageName, if (fixed) R.layout.w2_cont_fixed else R.layout.w2_cont)
    val f = d.f
    v.setTextViewText(R.id.hdr_title, f.s("continueTitle"))
    v.setTextViewTextSize(R.id.hdr_title, TypedValue.COMPLEX_UNIT_SP, if (d.resize) d.u(13f) else d.n("contHeader", if (d.xl) 13f else 14.5f))
    if (d.resize) {
      /* 🆕 D-1571 — رأسٌ ١٨ ومسافةٌ ٦ والبطاقتان تحته (لوحة الخطّة) */
      layoutSize(v, R.id.hdr_row, null, d.u(18f))
      marginTop(v, R.id.cont_cards, d.u(6f))
      v.setTextViewTextSize(R.id.hdr_all, TypedValue.COMPLEX_UNIT_SP, d.u(10.5f))
    }
    v.setOnClickPendingIntent(R.id.hdr_title, d.open(WLinks.all("continue")))
    if (f.contTotal > 2) {
      v.setViewVisibility(R.id.hdr_all, View.VISIBLE)
      v.setTextViewText(R.id.hdr_all, f.s("allCount").replace("%d", f.contTotal.toString()))
      v.setOnClickPendingIntent(R.id.hdr_all, d.open(WLinks.all("continue")))
    }
    val cardW = ((inner(d) - 9f) / 2f).coerceAtLeast(40f)
    /* الصورةُ تُرسم بمقاس خانتها الحقيقيّ (الأساسُ ٩٣ وما بقي) — فلا مطَّ في `fitXY`.
       🆕 D-1571 — أندرويد 12+: **ارتفاعُ البطاقة من عرضها بنسبة ١٦:٩** (صورةُ الخلفية كاملةً بلا قصٍّ ولا زوم — صورةُ خالد القديمة) */
    val base = if (d.resize) cardW * 9f / 16f else r.card ?: if (r.tall) d.n("contCardTall", 120f) else d.n("contCard", 93f)
    val cardH = base + d.extra
    /* 🆕 W50 — البطاقتان بمقاسهما المحسوم (٤×٢) لا تتمدّدان */
    if (fixed) layoutSize(v, R.id.cont_cards, null, cardH)
    drawCard(d, v, 0, cardW, cardH)
    drawCard(d, v, 1, cardW, cardH)
    if (d.resize) {
      for (n in 0..1) {
        v.setTextViewTextSize(CARD_NAME[n], TypedValue.COMPLEX_UNIT_SP, d.u(11f))
        v.setTextViewTextSize(CARD_SUB[n], TypedValue.COMPLEX_UNIT_SP, d.u(8.5f))
        v.setTextViewTextSize(CARD_PCT[n], TypedValue.COMPLEX_UNIT_SP, d.u(8.5f))
      }
      /* صفُّ «القادم» صار صفّاً مختصراً ببوستره تحت البطاقتين (`rows`) — السطرُ القديمُ هنا يُخفى صراحةً (W47) */
      v.setViewVisibility(R.id.up_block, View.GONE)
      return v
    }
    if (r.upLine) {
      v.setViewVisibility(R.id.up_block, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.up_line, d.open(WLinks.calendar()))
      val u = upcoming(d).firstOrNull()
      if (u == null) {
        v.setViewVisibility(R.id.up_day, View.GONE)
        v.setViewVisibility(R.id.up_name, View.GONE)
        v.setTextViewText(R.id.up_label, d.s2("noUpcoming"))
      } else {
        val date = u.optString("date").takeIf { it.isNotEmpty() && !u.isNull("date") }
        if (date != null) v.setTextViewText(R.id.up_day, d.s2("upLinePrefix").let { p -> if (p.isEmpty()) f.dayLabel(date) else "$p · ${f.dayLabel(date)}" })
        else v.setTextViewText(R.id.up_day, d.s2("upLinePrefix"))
        v.setTextViewText(R.id.up_name, u.optString("title"))
        v.setTextViewText(R.id.up_label, if (u.isNull("label")) "" else u.optString("label"))
      }
    }
    return v
  }

  private val CARD = intArrayOf(R.id.card_1, R.id.card_2)
  private val CARD_IMG = intArrayOf(R.id.card_img_1, R.id.card_img_2)
  private val CARD_PLUS = intArrayOf(R.id.card_plus_1, R.id.card_plus_2)
  private val CARD_CHECK = intArrayOf(R.id.card_check_1, R.id.card_check_2)
  private val CARD_TEXT = intArrayOf(R.id.card_text_1, R.id.card_text_2)
  private val CARD_UNDO = intArrayOf(R.id.card_undo_1, R.id.card_undo_2)
  private val CARD_UNDO_TEXT = intArrayOf(R.id.card_undo_text_1, R.id.card_undo_text_2)
  private val CARD_NAME = intArrayOf(R.id.card_name_1, R.id.card_name_2)
  private val CARD_SUB = intArrayOf(R.id.card_sub_1, R.id.card_sub_2)
  private val CARD_PCT = intArrayOf(R.id.card_pct_1, R.id.card_pct_2)

  /** بطاقةُ الرئيسيّة نفسُها (W17): عملٌ بنسبته و✓، أو باهتةٌ من «للمشاهدة»، أو «ابدأ عملاً» */
  private fun drawCard(d: Draw, v: RemoteViews, i: Int, wDp: Float, hDp: Float) {
    val f = d.f
    val c = f.cont.getOrNull(i)
    val faded = if (c == null) f.towatch.filter { w -> w.t.id !in d.hidden && f.cont.none { it.t.id == w.t.id } }.getOrNull(i - f.cont.size) else null
    v.setViewVisibility(CARD_CHECK[i], View.GONE)
    v.setViewVisibility(CARD_UNDO[i], View.GONE)
    when {
      c != null -> {
        /* 🆕 W47 — ألوانُ البطاقة صريحةٌ هنا: الباهتةُ تغيّرها، والمشغّلُ (One UI) يعيد التطبيقَ على العرض القديم فتبقى باهتةً */
        v.setViewVisibility(CARD_IMG[i], View.VISIBLE)
        v.setViewVisibility(CARD_TEXT[i], View.VISIBLE)
        v.setViewVisibility(CARD_PLUS[i], View.GONE)
        v.setTextColor(CARD_NAME[i], 0xFFFFFFFF.toInt())
        v.setTextColor(CARD_SUB[i], 0xBFFFFFFF.toInt())
        val bmp = WArt.card(d.ctx, c.backdrop, c.t.poster, wDp, hDp, f.rtl, c.pct)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp)
        v.setTextViewText(CARD_NAME[i], c.t.title)
        v.setTextViewText(CARD_SUB[i], c.sub ?: c.label ?: "")
        v.setViewVisibility(CARD_PCT[i], View.VISIBLE)
        v.setTextViewText(CARD_PCT[i], "${c.pct}%")
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.title(c.t)))
        if (f.check && d.undoOn("ep", c.t.id)) {
          /* W37 — البطاقةُ على الحلقة التالية، و«↶ تراجع» مكانَ ✓ خمسَ ثوانٍ */
          v.setViewVisibility(CARD_UNDO[i], View.VISIBLE)
          v.setTextViewText(CARD_UNDO_TEXT[i], d.undoText())
          v.setOnClickPendingIntent(CARD_UNDO[i], CheckReceiver.undoIntent(d.ctx, d.next()))
        } else if (f.check && c.season != null && c.episode != null) {
          v.setViewVisibility(CARD_CHECK[i], View.VISIBLE)
          v.setOnClickPendingIntent(CARD_CHECK[i], CheckReceiver.intent(d.ctx, d.next(), c))
        }
      }
      faded != null -> {
        v.setViewVisibility(CARD_IMG[i], View.VISIBLE)
        v.setViewVisibility(CARD_TEXT[i], View.VISIBLE)
        v.setViewVisibility(CARD_PLUS[i], View.GONE)
        val bmp = WArt.card(d.ctx, null, faded.t.poster, wDp, hDp, f.rtl, null, 140)
        if (bmp != null) v.setImageViewBitmap(CARD_IMG[i], bmp)
        v.setTextViewText(CARD_NAME[i], faded.t.title)
        v.setTextColor(CARD_NAME[i], 0x8CF7F7F7.toInt())
        v.setTextViewText(CARD_SUB[i], f.s("towatchStart"))
        v.setTextColor(CARD_SUB[i], 0xFFFFD400.toInt())
        v.setViewVisibility(CARD_PCT[i], View.GONE)
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.start(faded.t, faded.action)))
      }
      else -> {
        v.setViewVisibility(CARD_IMG[i], View.GONE)
        v.setViewVisibility(CARD_TEXT[i], View.GONE)
        v.setViewVisibility(CARD_PLUS[i], View.VISIBLE)
        v.setTextViewText(CARD_PLUS[i], "+  " + f.s("startSomething"))
        v.setOnClickPendingIntent(CARD[i], d.open(WLinks.discover()))
      }
    }
  }

  /** «القادم» ما لم يمضِ (المسلسلاتُ والأفلام، W32) */
  private fun upcoming(d: Draw): List<JSONObject> =
    d.list(d.v2.optJSONObject("upcoming")?.optJSONArray("items")).filter { u ->
      u.isNull("date") || (d.f.daysFromToday(u.optString("date")) ?: 0) >= 0
    }

  /** عنوانُ القسم بلغة القارئ */
  private fun titleOf(d: Draw, key: String): String = when (key) {
    "cont" -> d.f.s("continueTitle")
    "up" -> d.f.s("comingUpTitle")
    "tonight" -> d.f.s("tonightTitle")
    "tw" -> d.f.s("towatchTitle")
    "friends" -> d.s2("friendsTitle")
    "act" -> d.s2("activityTitle")
    "cine" -> d.s2or("cinemaTitle", "الآن في السينما", "Now in cinemas")
    else -> d.s2("searchPlaceholder")
  }

  private fun headerLink(key: String): String? = when (key) {
    "cont" -> WLinks.all("continue")
    "up" -> WLinks.calendar()
    "tw" -> WLinks.all("towatch")
    "cine" -> WLinks.discover()
    else -> null
  }

  /** أسطرُ القسم — كلُّ قسمٍ يقول ما عنده بالشكل نفسِه */
  private fun lines(d: Draw, key: String): List<Line> {
    val f = d.f
    return when (key) {
      "up" -> upcoming(d).mapNotNull { u ->
        val t = f.titleFrom(u) ?: return@mapNotNull null
        val date = if (u.isNull("date")) null else u.optString("date").takeIf { it.isNotEmpty() }
        val label = if (u.isNull("label")) null else u.optString("label")
        Line(t, t.title, listOfNotNull(date?.let { f.dayLabel(it) }, label).joinToString(" · "), WLinks.title(t))
      }
      "friends" -> d.arr("friends").mapNotNull { x ->
        val t = f.titleFrom(x.optJSONObject("title")) ?: return@mapNotNull null
        /* 🆕 سطران: الاسمُ فوق و«شاهد …» تحته، ومتى مختصراً في الطرف (تسجيلُ أحمد ١٤ أكتوبر: السطرُ الواحدُ صغّر الخط)
           🆕 W51 — والسطرُ الثاني «٣ حلقة · م٢» أو «★ ٨» جاهزاً من الخادم (`line`)؛ خلاصةٌ أقدمُ بلاه: الفعلُ والعنوانُ كما كان */
        val line = if (x.isNull("line")) "" else x.optString("line")
        /* 🆕 D-1562 — صورةُ الصديق جنب اسمه (خالد ٢٨ أكتوبر: «البوستر الصغير … وجنبه افتار الشخص واسمه») — ملفُّها نزّله التطبيق */
        val avatar = if (x.isNull("avatar_url")) null else f.art(x.optString("avatar_url").takeIf { it.isNotEmpty() })
        Line(t, x.optString("name"), line.ifEmpty { "${x.optString("action")} ${t.title}" }, WLinks.title(t), ago(x.optString("at"), f.locale()), avatar)
      }
      "tw" -> d.arr("towatch").mapNotNull { x ->
        val t = f.titleFrom(x) ?: return@mapNotNull null
        val rating = if (x.isNull("rating")) null else "★ " + String.format(f.locale(), "%.1f", x.optDouble("rating"))
        Line(t, t.title, listOfNotNull(x.optString("type_label").takeIf { it.isNotEmpty() }, rating).joinToString(" · "), WLinks.title(t))
      }
      "act" -> d.arr("activity").mapNotNull { x ->
        val t = f.titleFrom(x.optJSONObject("title")) ?: return@mapNotNull null
        /* 🆕 W52 — ومتى في طرف السطر، كـ«أصدقاؤك» */
        Line(t, x.optString("line"), if (x.isNull("sub")) null else x.optString("sub"), WLinks.title(t), ago(x.optString("at"), f.locale()))
      }
      "cont" -> f.cont.map { c -> Line(c.t, c.t.title, c.sub ?: c.label, WLinks.title(c.t)) }
      /* 🆕 D-1571 — «الآن في السينما»: الاسمُ ثمّ «★ ٧٫٨ · رعب» */
      "cine" -> d.cinema.mapNotNull { x ->
        val t = f.titleFrom(x) ?: return@mapNotNull null
        Line(t, t.title, cineMeta(d, x), WLinks.title(t))
      }
      "tonight" -> listOfNotNull(tonightNow(d)?.let { m -> Line(m.t, m.t.title, Tonight.subOf(f, m), WLinks.title(m.t)) })
      else -> emptyList()
    }
  }

  /**
   * «قبل ساعة» بساعة الجهاز وقتَ الرسم — **وبلغة الودجت لا لغة الجهاز** (تسجيلُ أحمد: «أول أمس» في ودجتٍ إنجليزيّ):
   * `DateUtils` يكتب بلغة النظام، و`RelativeDateTimeFormatter` من ICU يقبل لغةً صريحة.
   */
  private fun ago(iso: String, locale: Locale): String? = try {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val t = fmt.parse(iso.take(19))?.time ?: 0L
    if (t <= 0L) null else {
      /* 🆕 الشكلُ المختصر («٥٢ د» · «52 min. ago») — الطويلُ يأكل عرضَ السطر */
      val r = android.icu.text.RelativeDateTimeFormatter.getInstance(
        android.icu.util.ULocale.forLocale(locale), null,
        android.icu.text.RelativeDateTimeFormatter.Style.SHORT, android.icu.text.DisplayContext.CAPITALIZATION_NONE,
      )
      val mins = ((System.currentTimeMillis() - t) / 60_000L).coerceAtLeast(1L)
      val last = android.icu.text.RelativeDateTimeFormatter.Direction.LAST
      when {
        mins < 60 -> r.format(mins.toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.MINUTES)
        mins < 24 * 60 -> r.format((mins / 60).toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.HOURS)
        else -> r.format((mins / (24 * 60)).toDouble(), last, android.icu.text.RelativeDateTimeFormatter.RelativeUnit.DAYS)
      }
    }
  } catch (e: Exception) {
    null
  }

  /* W32 · W35 — قسمُ قائمة كامل */
  private fun section(d: Draw, r: Row): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_list)
    v.setTextViewText(R.id.hdr_title, titleOf(d, r.key))
    /* 🆕 W48 — العناوينُ ١٢٫٥ في الكبير جداً (المقترح ٣)، و«أصدقاؤك» ١٥٫٥ في الكبير (نسخة ٢) — 🆕 D-1571: رأسُ الخطّة ١٨ بالنسبة */
    if (d.resize) hdr(d, v, titleOf(d, r.key))
    else headerSize(d, v, if (r.key == "friends") d.n("friendsHeader", if (d.size == "large") 15.5f else if (d.xl) 12.5f else 14.5f) else null)
    headerLink(r.key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    val items = lines(d, r.key)
    if (r.view == "posters") {
      v.setViewVisibility(R.id.items, View.GONE)
      v.setViewVisibility(R.id.posters, View.VISIBLE)
      posterGrid(d, v, r, items)
      return v
    }
    v.setViewVisibility(R.id.items, View.VISIBLE)
    v.setViewVisibility(R.id.posters, View.GONE)
    val towatch = if (r.key == "tw") d.arr("towatch") else emptyList()
    for (n in 0 until r.count) {
      val it = items.getOrNull(n) ?: break
      /* الصفوفُ متلاصقةٌ بارتفاع ٥٠ (`rowGap` = ٠) — الصورةُ ٣٢×٤٨ تترك بينها مسافتها */
      val friend = r.key == "friends"
      /* 🆕 W48 — صفُّ الأصدقاء بحجم الودجت: ٥٨ (٣٨×٥٤) في الكبير و٥٢ (٣٤×٤٩) في الكبير جداً — `friendRow*` في المحرّك */
      val layout = when {
        !friend -> R.layout.w2_item
        d.size == "large" -> R.layout.w2_item_friend_lg
        d.xl -> R.layout.w2_item_friend_xl
        else -> R.layout.w2_item_friend
      }
      val row = RemoteViews(d.ctx.packageName, layout)
      /* 🆕 مقاساتُ السطر من شكل الودجت (الافتراضيُّ ما في الواجهة)، و🆕 W50 السطرُ وصورتُه يكبران بالقدر نفسِه (`grow`) —
         فالفاصلُ بين الصور ثابت. أندرويد قبل 12 يبقى على مقاس الواجهة (`grow` صفرٌ له من المحرّك) */
      val (rowH, tw, th, nameSp, subSp) = when (layout) {
        R.layout.w2_item_friend_lg -> listOf(d.n("friendRow", 58f), d.n("friendThumbW", 38f), d.n("friendThumbH", 54f), d.n("friendName", 15f), d.n("friendSub", 13.5f))
        R.layout.w2_item_friend_xl -> listOf(d.n("friendRow", 52f), d.n("friendThumbW", 34f), d.n("friendThumbH", 49f), d.n("friendName", 14f), d.n("friendSub", 12.8f))
        R.layout.w2_item_friend -> listOf(d.n("friendRow", 50f), d.n("friendThumbW", 32f), d.n("friendThumbH", 48f), d.n("friendName", 14f), d.n("friendSub", 12f))
        else -> listOf(d.n("listRow", 50f), d.n("listThumbW", 32f), d.n("listThumbH", 48f), d.n("listName", 14f), d.n("listSub", 12f))
      }
      val g = if (d.resize) r.grow else 0f
      val thW = tw + g * 2f / 3f
      val thH = th + g
      poster(d, row, R.id.it_img, it.t?.poster, if (d.resize) thW else tw, if (d.resize) thH else th, if (layout == R.layout.w2_item_friend_lg || layout == R.layout.w2_item_friend_xl) 5f else 4f)
      if (d.resize) {
        layoutSize(row, R.id.item, null, rowH + g)
        layoutSize(row, R.id.it_img, thW, thH)
      }
      row.setTextViewTextSize(R.id.it_name, TypedValue.COMPLEX_UNIT_SP, nameSp)
      row.setTextViewTextSize(R.id.it_sub, TypedValue.COMPLEX_UNIT_SP, subSp)
      row.setTextViewText(R.id.it_name, it.name)
      row.setTextViewText(R.id.it_sub, it.sub ?: "")
      /* 🆕 D-1571 — الصورةُ أكبر بما يناسب الصفّ (خالد ١٤:١٣: «كبر الافتار بشكل يناسبها») */
      if (friend) avatar(d, row, it.avatar, if (d.resize) d.u(24f) else nameSp + 4f)
      /* الوقتُ في الطرف: «أصدقاؤك»، و🆕 W52 «أنشطتك» بالخطّ نفسِه — وبقيّةُ القوائم تخفيه صراحةً (W47) */
      val time = if (friend || r.key == "act") it.time else null
      if (friend || layout == R.layout.w2_item) {
        row.setViewVisibility(R.id.it_time, if (time.isNullOrEmpty()) View.GONE else View.VISIBLE)
        row.setTextViewText(R.id.it_time, time ?: "")
        row.setTextViewTextSize(R.id.it_time, TypedValue.COMPLEX_UNIT_SP, d.n("time", if (d.size == "large") 12.5f else if (d.xl) 12f else 11.5f))
      }
      row.setOnClickPendingIntent(R.id.item, d.open(it.link))
      /* W35 — «▶ ابدأ» للمسلسل والأنمي و«✓ شاهدته» للفيلم بالرقاقة الرماديّة */
      val x = towatch.getOrNull(n)
      if (x != null && it.t != null) {
        row.setViewVisibility(R.id.it_chip, View.VISIBLE)
        val movie = x.optString("action") == "watched"
        val kind = if (movie) "movie" else "start"
        when {
          /* W37 — بعد اللمسة: «✓ شاهدته/بدأته» في السطر الثاني و«↶ تراجع» مكانَ الرقاقة خمسَ ثوانٍ */
          d.f.check && d.undoOn(kind, it.t.id) -> {
            row.setTextViewText(R.id.it_sub, "✓ " + if (movie) d.s2("watched") else d.s2or("started", "بدأته", "Started"))
            row.setTextColor(R.id.it_sub, DONE)
            row.setImageViewResource(R.id.it_chip_icon, R.drawable.widget_ic_undo)
            row.setTextViewText(R.id.it_chip_text, d.undoText())
            row.setOnClickPendingIntent(R.id.it_chip, CheckReceiver.undoIntent(d.ctx, d.next()))
          }
          movie -> {
            row.setTextColor(R.id.it_sub, 0xFFB5B5B5.toInt())
            row.setImageViewResource(R.id.it_chip_icon, R.drawable.widget_ic_check)
            row.setTextViewText(R.id.it_chip_text, d.s2("watched"))
            row.setOnClickPendingIntent(R.id.it_chip, if (d.f.check) CheckReceiver.movieIntent(d.ctx, d.next(), it.t) else d.open(WLinks.title(it.t)))
          }
          else -> {
            row.setTextColor(R.id.it_sub, 0xFFB5B5B5.toInt())
            row.setImageViewResource(R.id.it_chip_icon, R.drawable.widget_ic_play)
            row.setTextViewText(R.id.it_chip_text, d.f.s("start"))
            row.setOnClickPendingIntent(R.id.it_chip, if (d.f.check) CheckReceiver.startIntent(d.ctx, d.next(), it.t) else d.open(WLinks.start(it.t, "start")))
          }
        }
      }
      v.addView(R.id.items, row)
    }
    return v
  }

  /* W34 · W42 — فيلم الليلة: يتبدّل كلَّ يوم، و«فيلم آخر» يقلّب محلّيّاً */
  private fun tonightNow(d: Draw): WMovie? {
    val all = d.tonight
    if (all.isEmpty()) return null
    val day = (System.currentTimeMillis() + TimeZone.getDefault().getOffset(System.currentTimeMillis())) / 86_400_000L
    val n = (day + LoopzWidget.prefs(d.ctx).getInt("tn_${d.id}", 0)).toInt()
    return all[((n % all.size) + all.size) % all.size]
  }

  private fun tonight(d: Draw, r: Row): RemoteViews {
    /* 🆕 D-1571 — أندرويد 12+: خانةٌ كاملةٌ = بوسترٌ وعمود (لوحة الخطّة)، بارتفاع الصفّ المحسوم */
    if (d.resize && r.h > 24f) return posterColumn(d, "tonight", inner(d), d.u(r.h)).also { layoutSize(it, R.id.pc_root, null, d.u(r.h)) }
    val wide = r.view != "poster"
    val v = RemoteViews(d.ctx.packageName, if (wide) R.layout.w2_tonight_wide else R.layout.w2_tonight_poster)
    val m = tonightNow(d)
    v.setTextViewText(R.id.tn_label, d.f.s("tonightTitle"))
    if (m == null) {
      v.setTextViewText(R.id.tn_name, d.f.s("noTowatchMovies"))
      v.setViewVisibility(R.id.tn_check, View.GONE)
      v.setViewVisibility(R.id.tn_another, View.GONE)
      v.setOnClickPendingIntent(R.id.tn_root, d.open(WLinks.discover()))
      return v
    }
    if (wide) {
      val bmp = WArt.card(d.ctx, m.backdrop, m.t.poster, inner(d), 188f, d.f.rtl, null)
      if (bmp != null) v.setImageViewBitmap(R.id.tn_img, bmp)
    } else poster(d, v, R.id.tn_img, m.t.poster, 100f, 150f, 10f)
    v.setTextViewText(R.id.tn_name, m.t.title)
    v.setTextViewText(R.id.tn_sub, Tonight.subOf(d.f, m))
    v.setOnClickPendingIntent(R.id.tn_root, d.open(WLinks.title(m.t)))
    resetCheck(v, R.id.tn_check_icon, R.id.tn_sub, if (wide) 0xFFD6D6D6.toInt() else 0xFFB5B5B5.toInt())
    if (d.f.check && d.undoOn("movie", m.t.id)) {
      /* W37 — «✓ شاهدته» تحت الاسم و«↶ تراجع» مكانَ الرقاقتين خمسَ ثوانٍ، ثمّ فيلمٌ آخر وشريطُ التقييم */
      v.setTextViewText(R.id.tn_sub, "✓ " + d.s2("watched"))
      v.setTextColor(R.id.tn_sub, DONE)
      v.setImageViewResource(R.id.tn_check_icon, R.drawable.widget_ic_undo)
      v.setTextViewText(R.id.tn_check_text, d.undoText())
      v.setOnClickPendingIntent(R.id.tn_check, CheckReceiver.undoIntent(d.ctx, d.next()))
      v.setViewVisibility(R.id.tn_another, View.GONE)
      return v
    }
    v.setTextViewText(R.id.tn_check_text, d.s2("watched"))
    v.setOnClickPendingIntent(R.id.tn_check, if (d.f.check) CheckReceiver.movieIntent(d.ctx, d.next(), m.t) else d.open(WLinks.title(m.t)))
    if (d.tonight.size > 1) {
      v.setTextViewText(R.id.tn_another_text, d.s2("another"))
      v.setOnClickPendingIntent(R.id.tn_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
    } else v.setViewVisibility(R.id.tn_another, View.GONE)
    return v
  }

  /* W30 — قسمان صغيران */
  private fun pair(d: Draw, r: Row): RemoteViews {
    /* 🆕 بثلاثة أسطر (١٧٦) أو بسطرين (١٢٦) كما حسم المحرّك — الجسمُ تحت الرأس (٢٤) */
    val three = r.pairCount >= 3
    /* 🆕 W48 — بسطرين في الكبير جداً ١٥٠ لا ١٢٦ (أحمد «المقترح ٣»، ١٥ أكتوبر) */
    val tall2 = !three && d.xl
    val v = fresh(d.ctx, if (three) R.layout.w2_pair else if (tall2) R.layout.w2_pair_xl else R.layout.w2_pair_2)
    val half = ((inner(d) - 17f) / 2f).coerceAtLeast(60f)
    var body = if (three) 152f else if (tall2) 126f else 102f
    val n = if (three) 3 else 2
    /* 🆕 أندرويد 12+: الصفُّ بارتفاعه المحسوم بالنسبة (D-1571) — والجسمُ تحت رأسٍ ٢٤ */
    if (d.resize && r.h > 24f) {
      layoutSize(v, R.id.pair_root, null, d.u(r.h))
      body = d.u(r.h - 24f)
    }
    val g = if (d.resize) r.grow else 0f
    r.keys.getOrNull(0)?.let { v.addView(R.id.half_a, half(d, it, half, body, r.halfRows.getOrNull(0) ?: n, g, r.views.getOrNull(0))) }
    r.keys.getOrNull(1)?.let { v.addView(R.id.half_b, half(d, it, half, body, r.halfRows.getOrNull(1) ?: n, g, r.views.getOrNull(1))) }
    return v
  }

  /** نصفٌ: فيلم الليلة بوسترٌ وعمود (W34) ما لم يختر القائمة، والبقيّةُ ثلاثةُ أسطرٍ أو بوستران (W30) */
  private fun half(d: Draw, key: String, wDp: Float, bodyDp: Float, count: Int = 3, grow: Float = 0f, view: String? = null): RemoteViews {
    /*
     * 🆕 D-1571 — أندرويد 12+ بالخطّة: النصفُ «بوستر» (وفيلمُ الليلة والسينما دائماً) بوسترٌ ٨٩×١٣٤ وعمود؛ والنصفُ «قائمة» أربعةُ
     * أسطرٍ مختصرة (٢٢×٣٣)، و«أصدقاؤك» ثلاثة (٢٨×٤٢ وصورتُه جنب اسمه).
     */
    /* 🆕 D-1578 — فيلمُ الليلة في النصف بشكل الودجت الصغير (خالد ٢٠:١٥): البوسترُ يملأ النصفَ كلَّه، العنوانُ فوق و↻، والاسمُ والتقييمُ تحت و✓ */
    if (d.resize && key == "tonight") return posterFull(d, "tonight", wDp, bodyDp + d.u(24f))
    if (d.resize) {
      val poster = key == "tonight" || key == "cine" || (key != "act" && (view?.let { it == "poster" || it == "posters" } ?: (d.opt(key).optString("view") == "posters")))
      if (poster) return posterColumn(d, key, wDp, bodyDp)
      return halfList(d, key, bodyDp, count)
    }
    /* فيلم الليلة في النصف: البوسترُ بطول الخانة والتفاصيلُ بجانبه — وشكلُ «القائمة» الشكلُ نفسُه بلا أزرار (بدل سطرٍ صغيرٍ تحته فراغ) */
    if (key == "tonight") return tonightHalf(d, wDp, bodyDp)
    /* 🆕 W45 — أكملُ المشاهدة في النصف «صورة» افتراضاً (أحمد «١ أ»): شكلُ فيلم الليلة نفسُه بأوّل مسلسل؛ و«قائمة» تبقى الأسطرَ الثلاثة */
    if (key == "cont" && d.opt("cont").optString("small", "image") != "list") return contHalf(d, wDp, bodyDp)
    val v = fresh(d.ctx, R.layout.w2_half_list)
    v.setTextViewText(R.id.hdr_title, titleOf(d, key))
    headerSize(d, v)
    headerLink(key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    val items = lines(d, key)
    /* W30 · 🆕 W55 — البوستران في النصف (والودجتِ الصغير) صار خياراً في الإعداد؛ الحالتان تُكتبان صراحةً (W47) */
    /* 🆕 D-1562 — شكلُ هذا النصف من صفِّه (`views`): نصفان من قسمٍ واحدٍ في حجمين قد يختلفان — والخياراتُ المشتركةُ تأخذ آخرَ حجم */
    val chosen = view?.let { it == "poster" || it == "posters" } ?: (d.opt(key).optString("view") == "posters")
    val halfPosters = chosen && key != "tonight" && key != "act"
    v.setViewVisibility(R.id.items, if (halfPosters) View.GONE else View.VISIBLE)
    v.setViewVisibility(R.id.posters, if (halfPosters) View.VISIBLE else View.GONE)
    if (halfPosters) {
      val imgs = intArrayOf(R.id.hp_img_1, R.id.hp_img_2)
      /* ٢:٣ داخل الخانة بلا مطّ: الأقصرُ من عرض النصف وارتفاع الجسم يحكم */
      val ph = minOf((wDp - 8f) / 2f * 1.5f, bodyDp)
      val pw = ph / 1.5f
      for (n in 0 until 2) {
        val it = items.getOrNull(n)
        if (it == null) { v.setViewVisibility(imgs[n], View.INVISIBLE); continue }
        v.setViewVisibility(imgs[n], View.VISIBLE)
        poster(d, v, imgs[n], it.t?.poster, pw, ph, 6f)
        v.setOnClickPendingIntent(imgs[n], d.open(it.link))
      }
      return v
    }
    /* W34 — فيلم الليلة قائمةً: فيلمٌ واحدٌ بلا اقتراحٍ ثانٍ تحته */
    val max = if (key == "tonight") 1 else count
    for (n in 0 until max) {
      val it = items.getOrNull(n) ?: break
      /* الأسطرُ تتقاسم ارتفاعَ الخانة (وزنٌ في الواجهة) — لا مسافاتٍ ثابتة */
      /* 🆕 W48 — في الكبير جداً: صورة ٣٨×٥٦ واسمٌ ١٣ («نشاطك» في المقترح ٣) */
      val row = RemoteViews(d.ctx.packageName, if (d.xl) R.layout.w2_item_small_xl else R.layout.w2_item_small)
      /* 🆕 مقاسُ الصورة من شكل الودجت، و🆕 W50 تكبر بقدر ما كبر السطر (الأسطرُ تتقاسم الجسمَ بالوزن فتكبر وحدَها) */
      val tw = d.n("halfThumbW", if (d.xl) 38f else 30f)
      val th = d.n("halfThumbH", if (d.xl) 56f else 45f)
      val pw = tw + grow * 2f / 3f
      val ph = th + grow
      poster(d, row, R.id.it_img, it.t?.poster, pw, ph, if (d.xl) 5f else 4f)
      if (d.resize) layoutSize(row, R.id.it_img, pw, ph)
      row.setTextViewTextSize(R.id.it_name, TypedValue.COMPLEX_UNIT_SP, d.n("halfName", if (d.xl) 13f else 14f))
      row.setTextViewTextSize(R.id.it_sub, TypedValue.COMPLEX_UNIT_SP, d.n("halfSub", 12f))
      row.setTextViewText(R.id.it_name, it.name)
      row.setTextViewText(R.id.it_sub, it.sub ?: "")
      avatar(d, row, if (key == "friends") it.avatar else null, d.n("halfName", if (d.xl) 13f else 14f) + 3f)
      row.setOnClickPendingIntent(R.id.item, d.open(it.link))
      v.addView(R.id.items, row)
    }
    return v
  }

  /** 🆕 D-1571 — النصفُ «قائمة» بالنسبة: أسطرٌ متساويةٌ تملأ الجسم، والصورةُ والخطُّ بقدر عدد الأسطر */
  private fun halfList(d: Draw, key: String, bodyDp: Float, count: Int): RemoteViews {
    val v = fresh(d.ctx, R.layout.w2_half_list)
    hdr(d, v, titleOf(d, key))
    headerLink(key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    v.setViewVisibility(R.id.items, View.VISIBLE)
    v.setViewVisibility(R.id.posters, View.GONE)
    val friend = key == "friends"
    val n = count.coerceIn(1, 4)
    val rowH = bodyDp / n
    val tw = if (friend) d.u(28f) else d.u(22f)
    val th = if (friend) d.u(42f) else d.u(33f)
    lines(d, key).take(n).forEach {
      val row = RemoteViews(d.ctx.packageName, R.layout.w2_item_small)
      layoutSize(row, R.id.item, null, rowH)
      layoutSize(row, R.id.it_img, tw, th)
      poster(d, row, R.id.it_img, it.t?.poster, tw, th, 3.5f)
      row.setTextViewTextSize(R.id.it_name, TypedValue.COMPLEX_UNIT_SP, d.u(if (friend) 11.5f else 10.5f))
      row.setTextViewTextSize(R.id.it_sub, TypedValue.COMPLEX_UNIT_SP, d.u(if (friend) 9.5f else 9f))
      row.setTextViewText(R.id.it_name, it.name)
      row.setTextViewText(R.id.it_sub, listOfNotNull(it.sub?.takeIf { s -> s.isNotEmpty() }, if (friend) it.time else null).joinToString(" · "))
      avatar(d, row, if (friend) it.avatar else null, d.u(20f))
      row.setOnClickPendingIntent(R.id.item, d.open(it.link))
      v.addView(R.id.items, row)
    }
    return v
  }

  /**
   * 🆕 «فيلم الليلة» في النصف (قرارُ أحمد ١٤ أكتوبر «أ»؛ وبثلاثة أسطر «خل الحجم يكبر ويغطي المساحة»): الهيدرُ ١٦:٩
   * بعرض النصف كاملاً **يذوب في الأسود حتى أسفل الخانة** — يملؤها بلا قصٍّ ولا زوم (W38)، كـ«أكمل المشاهدة» المربّع (W33).
   * الاسمُ والتقييمُ والمدّةُ عليه، و✓ في طرفه السفليّ و🔁 فوق — دائماً، فالبوسترُ الصغيرُ بجانبه فراغٌ كان سببَ البلاغ.
   */
  /** 🆕 W45 — «أكمل المشاهدة» في النصف بشكل فيلم الليلة: الهيدرُ يذوب في الأسود، الاسمُ والحلقة، ✓ (والتراجعُ ٥ ثوانٍ) وشريطُ التقدّم */
  private fun contHalf(d: Draw, wDp: Float, bodyDp: Float): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_half_tonight)
    val f = d.f
    v.setTextViewText(R.id.hdr_title, f.s("continueTitle"))
    headerSize(d, v)
    v.setOnClickPendingIntent(R.id.hdr_title, d.open(WLinks.all("continue")))
    val c = f.cont.firstOrNull()
    if (c == null) {
      v.setTextViewText(R.id.ht_name, f.s("startSomething"))
      v.setOnClickPendingIntent(R.id.ht_root, d.open(WLinks.discover()))
      return v
    }
    WArt.headerFade(d.ctx, c.backdrop ?: c.t.poster, wDp, bodyDp, 12f)?.let { v.setImageViewBitmap(R.id.ht_img, it) }
    v.setTextViewText(R.id.ht_name, c.t.title)
    v.setTextViewText(R.id.ht_meta, c.sub ?: c.label ?: "")
    v.setOnClickPendingIntent(R.id.ht_root, d.open(WLinks.title(c.t)))
    v.setViewVisibility(R.id.ht_bar, View.VISIBLE)
    v.setProgressBar(R.id.ht_bar, 100, c.pct, false)
    resetCheck(v, R.id.ht_check_v, R.id.ht_meta, 0xFFB5B5B5.toInt())
    if (f.check && d.undoOn("ep", c.t.id)) {
      v.setViewVisibility(R.id.ht_check, View.VISIBLE)
      undoCircle(d, v, R.id.ht_check, R.id.ht_check_v, null, "")
    } else if (f.check && c.season != null && c.episode != null) {
      v.setViewVisibility(R.id.ht_check, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.ht_check, CheckReceiver.intent(d.ctx, d.next(), c))
    } else {
      /* 🆕 W47 — لا ✓ ⇒ يُخفى صراحةً: وإلّا بقي «↶» القديمُ بنيّته فيرجع الحلقةَ بلمسة */
      v.setViewVisibility(R.id.ht_check, View.GONE)
    }
    return v
  }

  /**
   * 🆕 W46 — فيلمُ الليلة الصغير «قائمة» (أندرويد «هـ»، أحمد «اعتمد» ١٤ أكتوبر): بوسترٌ ٢:٣ عليه شارةُ التقييم، و🔁 ثمّ ✓
   * في العمود الفاضي فوق يمينه تحت بعض (بينهما مسافة — «عشان ما يغلط باللمس»)، والمدّةُ والتصنيفُ والسنةُ أسفلَه، والاسمُ تحته.
   * الطوليُّ بوستر ٩٦×١٤٤ واسمٌ بسطرين، والمربّعُ ٦٤×٩٦ واسمٌ بسطر.
   */
  private fun tonightSmallList(d: Draw, tall: Boolean): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, if (tall) R.layout.w2_small_tonight_list else R.layout.w2_small_tonight_list_sq)
    v.setTextViewText(R.id.tl_label, d.f.s("tonightTitle"))
    val m = tonightNow(d)
    if (m == null) {
      v.setTextViewText(R.id.tl_name, d.f.s("noTowatchMovies"))
      v.setViewVisibility(R.id.tl_check, View.GONE)
      v.setViewVisibility(R.id.tl_another, View.GONE)
      v.setOnClickPendingIntent(R.id.tl_root, d.open(WLinks.discover()))
      return v
    }
    poster(d, v, R.id.tl_img, m.t.poster, if (tall) 96f else 64f, if (tall) 144f else 96f, 8f)
    if (m.rating != null) {
      v.setViewVisibility(R.id.tl_rating, View.VISIBLE)
      v.setTextViewText(R.id.tl_rating, "★ " + String.format(d.f.locale(), "%.1f", m.rating))
    }
    v.setTextViewText(R.id.tl_name, m.t.title)
    v.setTextViewText(R.id.tl_runtime, d.f.runtime(m.runtime) ?: "")
    v.setTextViewText(R.id.tl_genre, m.genre ?: "")
    v.setTextViewText(R.id.tl_year, m.year?.let { String.format(d.f.locale(), "%d", it) } ?: "")
    v.setOnClickPendingIntent(R.id.tl_root, d.open(WLinks.title(m.t)))
    resetCheck(v, R.id.tl_check_v, R.id.tl_runtime, 0xFFB5B5B5.toInt())
    val undoing = d.f.check && d.undoOn("movie", m.t.id)
    when {
      undoing -> undoCircle(d, v, R.id.tl_check, R.id.tl_check_v, R.id.tl_runtime, "✓ " + d.s2("watched"))
      d.f.check -> v.setOnClickPendingIntent(R.id.tl_check, CheckReceiver.movieIntent(d.ctx, d.next(), m.t))
      else -> v.setOnClickPendingIntent(R.id.tl_check, d.open(WLinks.title(m.t)))
    }
    if (undoing || d.tonight.size < 2) v.setViewVisibility(R.id.tl_another, View.INVISIBLE)
    else v.setOnClickPendingIntent(R.id.tl_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
    return v
  }

  private fun tonightHalf(d: Draw, wDp: Float, bodyDp: Float): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_half_tonight)
    v.setTextViewText(R.id.hdr_title, titleOf(d, "tonight"))
    headerSize(d, v)
    val m = tonightNow(d)
    if (m == null) {
      v.setTextViewText(R.id.ht_name, d.f.s("noTowatchMovies"))
      v.setOnClickPendingIntent(R.id.ht_root, d.open(WLinks.discover()))
      return v
    }
    WArt.headerFade(d.ctx, m.backdrop ?: m.t.poster, wDp, bodyDp, 12f)?.let { v.setImageViewBitmap(R.id.ht_img, it) }
    v.setTextViewText(R.id.ht_name, m.t.title)
    v.setTextViewText(R.id.ht_meta, Tonight.subOf(d.f, m))
    v.setOnClickPendingIntent(R.id.ht_root, d.open(WLinks.title(m.t)))
    v.setViewVisibility(R.id.ht_check, View.VISIBLE)
    resetCheck(v, R.id.ht_check_v, R.id.ht_meta, 0xFFB5B5B5.toInt())
    val undoing = d.f.check && d.undoOn("movie", m.t.id)
    when {
      undoing -> undoCircle(d, v, R.id.ht_check, R.id.ht_check_v, R.id.ht_meta, "✓ " + d.s2("watched"))
      d.f.check -> v.setOnClickPendingIntent(R.id.ht_check, CheckReceiver.movieIntent(d.ctx, d.next(), m.t))
      else -> v.setOnClickPendingIntent(R.id.ht_check, d.open(WLinks.title(m.t)))
    }
    if (!undoing && d.tonight.size > 1) {
      v.setViewVisibility(R.id.ht_another, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.ht_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
    }
    return v
  }

  /** 🆕 D-1571 — «الآن في السينما» الذي يُعرض: الأوّلُ، و«↻» يقلّب بعدّاده (`cn_`) */
  private fun cineNow(d: Draw): JSONObject? {
    val all = d.cinema
    if (all.isEmpty()) return null
    val n = LoopzWidget.prefs(d.ctx).getInt("cn_${d.id}", 0)
    return all[((n % all.size) + all.size) % all.size]
  }

  /** 🆕 D-1571 — «★ ٧٫٨ · رعب» (و«جديد» إن نزل خلال أسبوعين) */
  private fun cineMeta(d: Draw, x: JSONObject): String {
    val rating = if (x.isNull("rating")) null else x.optDouble("rating").takeIf { it > 0 }?.let { "★ " + String.format(d.f.locale(), "%.1f", it) }
    val genre = if (x.isNull("genre")) null else x.optString("genre").takeIf { it.isNotEmpty() }
    val fresh = if (x.optBoolean("is_new")) d.s2or("newTag", "جديد", "New") else null
    return listOfNotNull(rating, genre, fresh).joinToString(" · ")
  }

  /**
   * W34 · W35 · 🆕 D-1571 — بوسترٌ ٢:٣ بطول الخانة وعمودٌ بجانبه، **لكلِّ قسم** (النصفُ «بوستر» والصغيرُ ٢×٢ — لوحة الخطّة):
   * فيلمُ الليلة (↻ و✓)، والسينما (↻ و«+» للمشاهدة)، وللمشاهدة (✓ أو ▶)، وأكملُ المشاهدة (✓ الحلقة)، والبقيّةُ بوسترٌ واسمٌ وسطرٌ.
   * أندرويد 12+: البوسترُ بارتفاع الجسم وعرضُه حتّى ٦٢٪ من الخانة، والخطوطُ بالنسبة.
   */
  private fun posterColumn(d: Draw, key: String, wDp: Float, bodyDp: Float, buttons: Boolean = true): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_half_poster)
    var pw = minOf(bodyDp * 2f / 3f, 80f)
    var ph = pw * 1.5f
    if (d.resize) {
      hdr(d, v, titleOf(d, key))
      val body = (bodyDp - d.u(22f)).coerceAtLeast(40f)
      pw = minOf(body * 2f / 3f, wDp * 0.62f)
      ph = pw * 1.5f
      v.setInt(R.id.pc_img, "setMaxWidth", px(d, pw))
      layoutSize(v, R.id.pc_img, pw, ph)
      v.setTextViewTextSize(R.id.pc_name, TypedValue.COMPLEX_UNIT_SP, d.u(12f))
      v.setTextViewTextSize(R.id.pc_meta, TypedValue.COMPLEX_UNIT_SP, d.u(10f))
    } else {
      v.setTextViewText(R.id.hdr_title, titleOf(d, key))
      headerSize(d, v)
    }
    headerLink(key)?.let { v.setOnClickPendingIntent(R.id.hdr_title, d.open(it)) }
    /* كلُّ رسمٍ يكتب الحالتين (W47): الأيقونةُ واللونُ والظهور */
    v.setViewVisibility(R.id.pc_another, View.GONE)
    v.setViewVisibility(R.id.pc_check, View.GONE)
    v.setImageViewResource(R.id.pc_check_v, R.drawable.widget_ic_check)
    resetCheck(v, R.id.pc_check_v, R.id.pc_meta, 0xFFB5B5B5.toInt())
    fun art(t: WTitle, name: String, meta: String, link: String) {
      poster(d, v, R.id.pc_img, t.poster, pw, ph, 8f)
      v.setOnClickPendingIntent(R.id.pc_img, d.open(link))
      v.setTextViewText(R.id.pc_name, name)
      v.setOnClickPendingIntent(R.id.pc_name, d.open(link))
      v.setTextViewText(R.id.pc_meta, meta)
    }
    fun none(text: String) {
      v.setImageViewResource(R.id.pc_img, R.drawable.widget_poster_ph)
      v.setTextViewText(R.id.pc_name, "")
      v.setTextViewText(R.id.pc_meta, text)
    }
    when (key) {
      "tonight" -> {
        val m = tonightNow(d) ?: return v.also { none(d.f.s("noTowatchMovies")) }
        art(m.t, m.t.title, Tonight.subOf(d.f, m), WLinks.title(m.t))
        if (!buttons) return v
        v.setViewVisibility(R.id.pc_check, View.VISIBLE)
        if (d.f.check && d.undoOn("movie", m.t.id)) {
          undoCircle(d, v, R.id.pc_check, R.id.pc_check_v, R.id.pc_meta, "✓ " + d.s2("watched"))
          return v
        }
        v.setOnClickPendingIntent(R.id.pc_check, if (d.f.check) CheckReceiver.movieIntent(d.ctx, d.next(), m.t) else d.open(WLinks.title(m.t)))
        if (d.tonight.size > 1) {
          v.setViewVisibility(R.id.pc_another, View.VISIBLE)
          v.setOnClickPendingIntent(R.id.pc_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
        }
      }
      "cine" -> {
        val x = cineNow(d)
        val t = d.f.titleFrom(x)
        if (x == null || t == null) return v.also { none("—") }
        art(t, t.title, cineMeta(d, x), WLinks.title(t))
        if (!buttons) return v
        v.setViewVisibility(R.id.pc_check, View.VISIBLE)
        when {
          d.f.check && d.undoOn("towatch", t.id) -> undoCircle(d, v, R.id.pc_check, R.id.pc_check_v, R.id.pc_meta, "✓ " + d.s2or("added", "أُضيف", "Added"))
          /* أُضيف من قبل (أو تابعه/شاهده): ✓ ساكنةٌ تفتح صفحتَه — لا «+» ثانية */
          x.optBoolean("followed") || t.id in d.hidden -> v.setOnClickPendingIntent(R.id.pc_check, d.open(WLinks.title(t)))
          else -> {
            v.setImageViewResource(R.id.pc_check_v, R.drawable.widget_ic_plus)
            v.setOnClickPendingIntent(R.id.pc_check, if (d.f.check) CheckReceiver.towatchIntent(d.ctx, d.next(), t) else d.open(WLinks.title(t)))
          }
        }
        if (d.cinema.size > 1) {
          v.setViewVisibility(R.id.pc_another, View.VISIBLE)
          v.setOnClickPendingIntent(R.id.pc_another, LoopzWidget.cycleIntent(d.ctx, d.id, d.next(), "cn"))
        }
      }
      "tw" -> {
        /* «للمشاهدة» (W35): أحدثُ ما أُضيف، والعددُ الباقي في الرأس */
        val all = d.arr("towatch")
        val x = all.firstOrNull()
        val t = d.f.titleFrom(x)
        if (x == null || t == null) return v.also { none("—") }
        if (all.size > 1) v.setTextViewText(R.id.hdr_title, "${titleOf(d, key)} · ${all.size}")
        val rating = if (x.isNull("rating")) null else "★ " + String.format(d.f.locale(), "%.1f", x.optDouble("rating"))
        art(t, t.title, listOfNotNull(x.optString("type_label").takeIf { it.isNotEmpty() }, rating).joinToString(" · "), WLinks.title(t))
        if (!buttons) return v
        v.setViewVisibility(R.id.pc_check, View.VISIBLE)
        val movie = x.optString("action") == "watched"
        when {
          d.f.check && d.undoOn(if (movie) "movie" else "start", t.id) ->
            undoCircle(d, v, R.id.pc_check, R.id.pc_check_v, R.id.pc_meta, "✓ " + if (movie) d.s2("watched") else d.s2or("started", "بدأته", "Started"))
          movie -> v.setOnClickPendingIntent(R.id.pc_check, if (d.f.check) CheckReceiver.movieIntent(d.ctx, d.next(), t) else d.open(WLinks.title(t)))
          else -> {
            v.setImageViewResource(R.id.pc_check_v, R.drawable.widget_ic_play)
            v.setOnClickPendingIntent(R.id.pc_check, if (d.f.check) CheckReceiver.startIntent(d.ctx, d.next(), t) else d.open(WLinks.start(t, "start")))
          }
        }
      }
      "cont" -> {
        val c = d.f.cont.firstOrNull() ?: return v.also { none(d.f.s("startSomething")) }
        art(c.t, c.t.title, c.sub ?: c.label ?: "", WLinks.title(c.t))
        if (!buttons || !d.f.check) return v
        if (d.undoOn("ep", c.t.id)) {
          v.setViewVisibility(R.id.pc_check, View.VISIBLE)
          undoCircle(d, v, R.id.pc_check, R.id.pc_check_v, null, "")
        } else if (c.season != null && c.episode != null) {
          v.setViewVisibility(R.id.pc_check, View.VISIBLE)
          v.setOnClickPendingIntent(R.id.pc_check, CheckReceiver.intent(d.ctx, d.next(), c))
        }
      }
      else -> {
        /* القادم وأصدقاؤك ونشاطك: أوّلُ سطرٍ بوسترٌ، والاسمُ والسطرُ الثاني (والوقتُ) بجانبه */
        val ln = lines(d, key).firstOrNull()
        val t = ln?.t
        if (ln == null || t == null) return v.also { none(if (key == "up") d.s2("noUpcoming").ifEmpty { "—" } else "—") }
        art(t, ln.name, listOfNotNull(ln.sub?.takeIf { s -> s.isNotEmpty() }, ln.time).joinToString(" · "), ln.link)
      }
    }
    return v
  }

  /*
   * W39 — السطرُ المختصر. 🆕 D-1571 — ٣٤ ببوستر ٢٢×٣٣ وسطرين (لوحة الخطّة): صفُّ «القادم» تحت البطاقتين («القادم · السبت» ثمّ
   * «Black Clover · م٢ ح٥» و«+٢ ←»)، وسطرا نشاطك تحت (`index`: الأحدثُ ثمّ الذي قبله). عنصرٌ غائبٌ في سطرٍ ثانٍ ⇒ لا سطر.
   */
  private fun line(d: Draw, key: String, index: Int = 0, more: Boolean = false): RemoteViews? {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_line)
    if (d.resize) {
      layoutSize(v, R.id.item, null, d.u(34f))
      layoutSize(v, R.id.ln_img, d.u(22f), d.u(33f))
      v.setTextViewTextSize(R.id.ln_label, TypedValue.COMPLEX_UNIT_SP, d.u(9.5f))
      v.setTextViewTextSize(R.id.ln_name, TypedValue.COMPLEX_UNIT_SP, d.u(11f))
      v.setTextViewTextSize(R.id.ln_more, TypedValue.COMPLEX_UNIT_SP, d.u(9.5f))
    }
    v.setViewVisibility(R.id.ln_more, View.GONE)
    v.setTextViewText(R.id.ln_label, titleOf(d, key))
    if (key == "up") {
      val all = upcoming(d)
      val u = all.firstOrNull()
      val t = d.f.titleFrom(u)
      v.setOnClickPendingIntent(R.id.item, d.open(WLinks.calendar()))
      if (u == null || t == null) {
        v.setViewVisibility(R.id.ln_img, View.GONE)
        v.setTextViewText(R.id.ln_name, d.s2("noUpcoming").ifEmpty { "—" })
        return v
      }
      v.setViewVisibility(R.id.ln_img, View.VISIBLE)
      val date = if (u.isNull("date")) null else u.optString("date").takeIf { it.isNotEmpty() }
      v.setTextViewText(R.id.ln_label, listOfNotNull(titleOf(d, "up"), date?.let { d.f.dayLabel(it) }).joinToString(" · "))
      val label = if (u.isNull("label")) null else u.optString("label").takeIf { it.isNotEmpty() }
      v.setTextViewText(R.id.ln_name, listOfNotNull(t.title, label).joinToString(" · "))
      poster(d, v, R.id.ln_img, t.poster, d.u(22f), d.u(33f), 3.5f)
      if (more && all.size > 1) {
        v.setViewVisibility(R.id.ln_more, View.VISIBLE)
        v.setTextViewText(R.id.ln_more, String.format(d.f.locale(), "+%d", all.size - 1) + if (d.f.rtl) " ←" else " →")
      }
      return v
    }
    val it = lines(d, key).getOrNull(index)
    if (it == null) {
      if (index > 0) return null
      v.setViewVisibility(R.id.ln_img, View.GONE)
      v.setTextViewText(R.id.ln_name, "—")
      headerLink(key)?.let { link -> v.setOnClickPendingIntent(R.id.item, d.open(link)) }
      return v
    }
    v.setViewVisibility(R.id.ln_img, View.VISIBLE)
    poster(d, v, R.id.ln_img, it.t?.poster, if (d.resize) d.u(22f) else 28f, if (d.resize) d.u(33f) else 42f, 3.5f)
    v.setTextViewText(R.id.ln_name, listOfNotNull(it.name, it.sub?.takeIf { s -> s.isNotEmpty() }).joinToString(" · "))
    if (it.time != null && d.resize) {
      v.setViewVisibility(R.id.ln_more, View.VISIBLE)
      v.setTextViewText(R.id.ln_more, it.time)
    }
    v.setOnClickPendingIntent(R.id.item, d.open(it.link))
    return v
  }

  /* ───────── الحجمُ الصغير (W33 · W34 · W35 · W43) ───────── */

  private fun small(d: Draw, s: JSONObject, w: Float, h: Float): RemoteViews {
    val key = s.optString("key", "cont")
    /* 🆕 D-1571 — أندرويد 12+ بالخطّة (`v3`): الصغيرُ ٢×٢ بوسترٌ وعمودٌ لكلِّ قسم، والحشوةُ ٨ بالنسبة */
    if (d.resize && s.optString("square") == "posterColumn") {
      return fresh(d.ctx, R.layout.w2_root).also { v ->
        val pad = px(d, d.u(8f))
        v.setViewPadding(R.id.rows, pad, pad, pad, pad)
        v.addView(R.id.rows, posterColumn(d, key, w - d.u(16f), h - d.u(16f)))
      }
    }
    /* الطوليُّ (أغلبُ الجوّالات، S24 ≈ 0.70) أو المربّع — والمحرّكُ حسم الشكلَ لكلٍّ منهما */
    val form = if (h / w > 1.2f) s.optString("tall", "list") else s.optString("square", "list")
    return when (form) {
      "posterFull" -> posterFull(d, key, w, h)
      "headerFade" -> headerFade(d, w, h)
      "posterColumn" -> fresh(d.ctx, R.layout.w2_root).also { v ->
        v.addView(R.id.rows, posterColumn(d, key, w - 24f, (h - 24f - 28f).coerceAtLeast(60f)))
      }
      /* 🆕 W46 — فيلمُ الليلة «قائمة» في الصغير: شكلُه هو (أندرويد «هـ») لا شكلُ نصف العرض — كان يرسم الصورةَ العريضة فلا تظهر القائمة */
      "list" -> if (key == "tonight") fresh(d.ctx, R.layout.w2_root).also { v -> v.addView(R.id.rows, tonightSmallList(d, h / w > 1.2f)) }
      else fresh(d.ctx, R.layout.w2_root).also { v -> v.addView(R.id.rows, half(d, key, w - 24f, h - 24f - 28f)) }
      else -> fresh(d.ctx, R.layout.w2_root).also { v ->
        v.addView(R.id.rows, half(d, key, w - 24f, h - 24f - 28f))
      }
    }
  }

  /** الطوليّ: الملصقُ كلُّه بمقاس الودجت بالشكل المشحون (الشارةُ فوق، والاسمُ تحت) و✓ في الطرف السفليّ */
  private fun posterFull(d: Draw, key: String, w: Float, h: Float): RemoteViews {
    val f = d.f
    val v = fresh(d.ctx, R.layout.loopz_w_small)
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    fun draw(t: WTitle, top: String, sub: String?, link: String) {
      val bmp = WArt.posterFull(d.ctx, t.poster, w, h)
      if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp)
      v.setTextViewText(R.id.full_top, top)
      v.setTextViewText(R.id.full_name, t.title)
      v.setTextViewText(R.id.full_sub, sub ?: "")
      v.setOnClickPendingIntent(R.id.root, d.open(link))
    }
    when (key) {
      "tonight" -> {
        val m = tonightNow(d)
        if (m == null) return emptyText(d, v, f.s("noTowatchMovies"), WLinks.discover())
        draw(m.t, f.s("tonightTitle"), Tonight.subOf(f, m), WLinks.title(m.t))
        if (d.tonight.size > 1) {
          v.setViewVisibility(R.id.full_action, View.VISIBLE)
          v.setImageViewResource(R.id.full_action_v, R.drawable.widget_ic_repeat)
          v.setOnClickPendingIntent(R.id.full_action, LoopzWidget.cycleIntent(d.ctx, d.id, d.next()))
        }
        v.setViewVisibility(R.id.full_check, View.VISIBLE)
        resetCheck(v, R.id.full_check_v, R.id.full_sub, 0xFFD6D6D6.toInt())
        if (f.check && d.undoOn("movie", m.t.id)) undoCircle(d, v, R.id.full_check, R.id.full_check_v, R.id.full_sub, "✓ " + d.s2("watched"))
        else v.setOnClickPendingIntent(R.id.full_check, if (f.check) CheckReceiver.movieIntent(d.ctx, d.next(), m.t) else d.open(WLinks.title(m.t)))
      }
      "tw" -> {
        val all = d.arr("towatch")
        val x = all.firstOrNull()
        val t = d.f.titleFrom(x) ?: return emptyText(d, v, f.s("towatchTitle"), WLinks.discover())
        draw(t, if (all.size > 1) "${f.s("towatchTitle")} · ${all.size}" else f.s("towatchTitle"), x?.optString("type_label"), WLinks.title(t))
      }
      else -> {
        val c = f.cont.firstOrNull()
        if (c == null) return emptyText(d, v, f.s("startSomething"), WLinks.discover())
        val top = if (f.contTotal > 1) "${f.s("continueTitle")} · ${f.contTotal}" else f.s("continueTitle")
        draw(c.t, top, c.sub ?: c.label, WLinks.title(c.t))
        resetCheck(v, R.id.full_check_v, R.id.full_sub, 0xFFD6D6D6.toInt())
        if (f.check && d.undoOn("ep", c.t.id)) {
          v.setViewVisibility(R.id.full_check, View.VISIBLE)
          undoCircle(d, v, R.id.full_check, R.id.full_check_v, null, "")
        } else if (f.check && c.season != null && c.episode != null) {
          v.setViewVisibility(R.id.full_check, View.VISIBLE)
          v.setOnClickPendingIntent(R.id.full_check, CheckReceiver.intent(d.ctx, d.next(), c))
        } else v.setViewVisibility(R.id.full_check, View.GONE)
      }
    }
    return v
  }

  /** المربّع لـ«أكمل المشاهدة»: الهيدرُ كلُّه بالعرض يذوب في الأسود والكلامُ تحته (W33) */
  private fun headerFade(d: Draw, w: Float, h: Float): RemoteViews {
    val f = d.f
    val v = fresh(d.ctx, R.layout.loopz_w_small)
    v.setViewVisibility(R.id.full_scrim, View.GONE)
    v.setInt(R.id.full_top, "setBackgroundResource", 0)
    val c = f.cont.firstOrNull() ?: return emptyText(d, v, f.s("startSomething"), WLinks.discover())
    val bmp = WArt.headerFade(d.ctx, c.backdrop ?: c.t.poster, w, h)
    if (bmp != null) v.setImageViewBitmap(R.id.full_img, bmp)
    v.setViewVisibility(R.id.full_top, View.VISIBLE)
    v.setTextViewText(R.id.full_top, if (f.contTotal > 1) "${f.s("continueTitle")} · ${f.contTotal}" else f.s("continueTitle"))
    v.setViewVisibility(R.id.full_name, View.VISIBLE)
    v.setTextViewText(R.id.full_name, c.t.title)
    v.setViewVisibility(R.id.full_sub, View.VISIBLE)
    v.setTextViewText(R.id.full_sub, c.sub ?: c.label ?: "")
    v.setOnClickPendingIntent(R.id.root, d.open(WLinks.title(c.t)))
    resetCheck(v, R.id.full_check_v, R.id.full_sub, 0xFFD6D6D6.toInt())
    if (f.check && d.undoOn("ep", c.t.id)) {
      v.setViewVisibility(R.id.full_check, View.VISIBLE)
      undoCircle(d, v, R.id.full_check, R.id.full_check_v, null, "")
    } else if (f.check && c.season != null && c.episode != null) {
      v.setViewVisibility(R.id.full_check, View.VISIBLE)
      v.setOnClickPendingIntent(R.id.full_check, CheckReceiver.intent(d.ctx, d.next(), c))
    } else v.setViewVisibility(R.id.full_check, View.GONE)
    return v
  }

  private fun emptyText(d: Draw, v: RemoteViews, text: String, link: String): RemoteViews {
    listOf(R.id.full_img, R.id.full_scrim, R.id.full_top, R.id.full_name, R.id.full_sub, R.id.full_action, R.id.full_plus, R.id.full_check)
      .forEach { v.setViewVisibility(it, View.GONE) }
    v.setViewVisibility(R.id.empty, View.VISIBLE)
    v.setTextViewText(R.id.empty, text)
    v.setOnClickPendingIntent(R.id.root, d.open(link))
    return v
  }

  /** «تمّ» بلون النجاح الواحد (`WColor.success` في الآيفون، #22C55E) — لا أخضرَ ثانٍ */
  private const val DONE = 0xFF22C55E.toInt()

  /** W37 — الزرُّ الدائريُّ صار «↶ تراجع» خمسَ ثوانٍ، وسطرُه يقول ما حدث.
   *  W44 — الزرُّ إطارُ لمسٍ شفّاف (`button`) فيه الدائرةُ المرئيّة (`icon`): الضغطُ على الإطار والأيقونةُ على الدائرة */
  private fun undoCircle(d: Draw, v: RemoteViews, button: Int, icon: Int, line: Int?, text: String) {
    v.setImageViewResource(icon, R.drawable.widget_ic_undo)
    v.setOnClickPendingIntent(button, CheckReceiver.undoIntent(d.ctx, d.next()))
    if (line != null && text.isNotEmpty()) {
      v.setTextViewText(line, text)
      v.setTextColor(line, DONE)
    }
  }

  /**
   * 🆕 W47 — ✓ صريحٌ قبل كلِّ رسم (تسجيلُ أحمد ١٥ أكتوبر: «↶» يبقى بعد التراجع أو بعد الخمس ثوانٍ، والأخضرُ يبقى):
   * `undoCircle` يغيّر الأيقونةَ ولونَ السطر، وفرعُ ✓ كان يكتفي بما في الواجهة — والمشغّلُ يعيد تطبيقَ الرسم على
   * العرض القائم فتبقى «↶» والأخضر. فالأيقونةُ واللونُ يُكتبان في الفرعين كليهما، و`undoCircle` بعدها يغلبهما.
   */
  /**
   * 🆕 W48 — حجمُ عنوان القسم صريحٌ في كلِّ رسم (لا يُترك لما في الواجهة — المشغّلُ يعيد التطبيق): ١٢٫٥ في الكبير جداً
   * (المقترح ٣)، وما يمرّره القسمُ (أصدقاؤك ١٥٫٥ في الكبير)، وإلّا ١٤٫٥ الأصل.
   */
  private fun headerSize(d: Draw, v: RemoteViews, override: Float? = null) {
    v.setTextViewTextSize(R.id.hdr_title, TypedValue.COMPLEX_UNIT_SP, override ?: d.n("header", if (d.xl) 12.5f else 14.5f))
  }

  /**
   * 🆕 مقاسُ عنصرٍ من RemoteViews — أندرويد 12+ وحدَه (`setViewLayout*`، API 31)؛ قبله لا شيء ويبقى مقاسُ الواجهة.
   * `null` = لا يُمسّ. ⚠️ يُنادى بالقيم نفسِها في كلِّ رسم (W47: المشغّلُ يعيد التطبيق على العرض القائم).
   */
  private fun layoutSize(v: RemoteViews, id: Int, wDp: Float?, hDp: Float?) {
    if (Build.VERSION.SDK_INT < 31) return
    if (wDp != null) v.setViewLayoutWidth(id, wDp, TypedValue.COMPLEX_UNIT_DIP)
    if (hDp != null) v.setViewLayoutHeight(id, hDp, TypedValue.COMPLEX_UNIT_DIP)
  }

  /** 🆕 D-1571 — هامشٌ علويّ بالنسبة (أندرويد 12+ وحدَه، `setViewLayoutMargin`) */
  private fun marginTop(v: RemoteViews, id: Int, dp: Float) {
    if (Build.VERSION.SDK_INT < 31) return
    v.setViewLayoutMargin(id, RemoteViews.MARGIN_TOP, dp, TypedValue.COMPLEX_UNIT_DIP)
  }

  private val LP = intArrayOf(R.id.lp_1, R.id.lp_2, R.id.lp_3, R.id.lp_4)
  private val LP_IMG = intArrayOf(R.id.lp_img_1, R.id.lp_img_2, R.id.lp_img_3, R.id.lp_img_4)
  private val LP_STRIP = intArrayOf(R.id.lp_strip_1, R.id.lp_strip_2, R.id.lp_strip_3, R.id.lp_strip_4)
  private val LP_NAME = intArrayOf(R.id.lp_name_1, R.id.lp_name_2, R.id.lp_name_3, R.id.lp_name_4)
  private val LP_TIME = intArrayOf(R.id.lp_time_1, R.id.lp_time_2, R.id.lp_time_3, R.id.lp_time_4)
  private val LP_SUB = intArrayOf(R.id.lp_sub_1, R.id.lp_sub_2, R.id.lp_sub_3, R.id.lp_sub_4)

  /**
   * W35 · 🆕 W54 — شبكةُ بوستراتِ القسم الكامل: ثلاثةٌ أو أربعة (`posters`) بعرضٍ يملأ الودجت (العرضُ ÷ العدد، والارتفاعُ ٢:٣
   * حتّى شبكتِه)، والمسافاتُ بالوزن بينها. قبل أندرويد 12: ٨٧×١٣٠ وثلاثةٌ كما كانت (الواجهةُ ثابتة).
   * 🆕 W53 — بوسترُ «أصدقاؤك» عليه شريطٌ داكن: الاسمُ والوقتُ ثمّ الحلقاتُ أو التقييم. والشريطُ يُخفى صراحةً لغيره (W47).
   */
  private fun posterGrid(d: Draw, v: RemoteViews, r: Row, items: List<Line>) {
    val count = if (d.resize) r.posters else 3
    val gap = d.n("posterGap", 8f)
    /* 🆕 D-1571 — الشبكةُ بارتفاع صفِّها المحسوم ناقصاً الرأس (المحرّكُ حسبه ٢:٣ من عرض التصميم) */
    val gridH = if (d.resize && r.h > 24f) d.u(r.h - 24f) else if (count == 4) d.n("posterGrid4", 116f) else d.n("posterGrid", 130f)
    val pw = if (d.resize) minOf((inner(d) - gap * (count - 1)) / count, gridH / 1.5f).coerceAtLeast(30f) else 87f
    val ph = if (d.resize) pw * 1.5f else 130f
    if (d.resize) layoutSize(v, R.id.posters, null, gridH)
    /* الخانةُ الرابعةُ ومسافتُها لا تظهران إلّا بأربعة */
    v.setViewVisibility(R.id.lp_gap_3, if (count == 4) View.VISIBLE else View.GONE)
    v.setViewVisibility(R.id.lp_4, if (count == 4) View.VISIBLE else View.GONE)
    /* 🆕 D-1571 — «الآن في السينما» عليه الشريطُ نفسُه: الاسمُ ثمّ «★ · التصنيف» */
    val friends = r.key == "friends" || r.key == "cine"
    for (n in 0 until count) {
      val it = items.getOrNull(n)
      v.setViewVisibility(LP_STRIP[n], View.GONE)
      if (it == null) { v.setViewVisibility(LP[n], View.INVISIBLE); continue }
      v.setViewVisibility(LP[n], View.VISIBLE)
      layoutSize(v, LP[n], pw, ph)
      poster(d, v, LP_IMG[n], it.t?.poster, pw, ph, 8f)
      v.setOnClickPendingIntent(LP[n], d.open(it.link))
      if (friends) {
        v.setViewVisibility(LP_STRIP[n], View.VISIBLE)
        v.setTextViewText(LP_NAME[n], it.name)
        v.setTextViewText(LP_TIME[n], it.time ?: "")
        v.setTextViewText(LP_SUB[n], it.sub ?: "")
        v.setTextViewTextSize(LP_NAME[n], TypedValue.COMPLEX_UNIT_SP, d.n("stripName", 11f))
        v.setTextViewTextSize(LP_SUB[n], TypedValue.COMPLEX_UNIT_SP, d.n("stripSub", 10f))
        v.setTextViewTextSize(LP_TIME[n], TypedValue.COMPLEX_UNIT_SP, d.n("stripSub", 10f) - 0.5f)
      }
    }
  }

  private fun resetCheck(v: RemoteViews, icon: Int, line: Int?, color: Int) {
    v.setImageViewResource(icon, R.drawable.widget_ic_check)
    if (line != null) v.setTextColor(line, color)
  }

  private val STARS = intArrayOf(R.id.rs_1, R.id.rs_2, R.id.rs_3, R.id.rs_4, R.id.rs_5, R.id.rs_6, R.id.rs_7, R.id.rs_8, R.id.rs_9, R.id.rs_10)

  /** 🆕 W37 · «١ ب» — شريطُ «قيّم الفيلم» تحت البحث: عشرُ نجومٍ كالتطبيق (كلُّ نجمةٍ رقمُها)، و«تخطَّ» */
  private fun rateStrip(d: Draw, o: JSONObject): RemoteViews {
    val v = RemoteViews(d.ctx.packageName, R.layout.w2_rate)
    val id = o.optInt("id")
    val title = o.optString("title")
    v.setTextViewText(R.id.rt_title, d.s2or("rate", "قيّم %s", "Rate %s").replace("%s", title))
    val poster = o.optString("poster").takeIf { it.isNotEmpty() }
    poster(d, v, R.id.rt_img, poster, 22f, 33f, 3f)
    v.setTextViewText(R.id.rt_skip_text, d.s2or("skip", "تخطَّ", "Skip"))
    v.setOnClickPendingIntent(R.id.rt_skip, CheckReceiver.skipIntent(d.ctx, d.next()))
    STARS.forEachIndexed { n, sid ->
      v.setInt(sid, "setColorFilter", 0xFF6B6B6B.toInt())
      v.setOnClickPendingIntent(sid, CheckReceiver.rateIntent(d.ctx, d.next(), id, n + 1))
    }
    return v
  }

  /**
   * 🆕 D-1562 — دائرةُ صورة الصديق قبل اسمه بقدر سطر الاسم. بلا صورةٍ (لم تُنزَّل بعد، أو بلا صورةٍ أصلاً) تُخفى صراحةً — لا دائرةَ
   * رماديّةً فارغة، والاسمُ يبدأ من مكانه (W47: كلُّ حالةٍ تُكتب في كلِّ رسمة).
   */
  private fun avatar(d: Draw, v: RemoteViews, name: String?, sizeDp: Float) {
    val bmp = if (name == null) null else WPosters.load(d.ctx, name, sizeDp, sizeDp, sizeDp / 2f)
    if (bmp == null) {
      v.setViewVisibility(R.id.it_avatar, View.GONE)
      return
    }
    v.setViewVisibility(R.id.it_avatar, View.VISIBLE)
    v.setImageViewBitmap(R.id.it_avatar, bmp)
    if (d.resize) layoutSize(v, R.id.it_avatar, sizeDp, sizeDp)
  }

  /** بوسترٌ بمقاس خانته (٢:٣ في ٢:٣ — لا زوم، W38)؛ ملصقٌ لم يصل يبقى خانةً فارغة */
  private fun poster(d: Draw, v: RemoteViews, viewId: Int, name: String?, wDp: Float, hDp: Float, r: Float) {
    val bmp = WPosters.load(d.ctx, name, wDp, hDp, r)
    if (bmp != null) v.setImageViewBitmap(viewId, bmp) else v.setImageViewResource(viewId, R.drawable.widget_poster_ph)
  }
}

/* ============ «فيلم الليلة» — سطرُه الثاني ============ */

object Tonight {
  fun subOf(f: WFeed, m: WMovie): String {
    val parts = mutableListOf<String>()
    if (m.rating != null) parts.add("★ " + String.format(f.locale(), "%.1f", m.rating))
    f.runtime(m.runtime)?.let { parts.add(it) }
    return parts.joinToString(" · ")
  }
}
