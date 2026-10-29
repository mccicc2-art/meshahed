package com.loopztv.app.widget

import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.TextPaint
import android.text.TextUtils
import org.json.JSONObject
import java.io.File

/** 🆕 v4 — عنصرٌ في بطاقة: صورتاه والكلامُ والوجهةُ وزرُّ الفعل (✓ · ▶ · + · ↶)؛ `line2` سطرُ صفّ القادم المكبّر */
internal class I4(
  val poster: String?,
  val backdrop: String?,
  val name: String,
  val line: String,
  val avatar: String?,
  val link: String,
  val bar: Int? = null,
  val btn: String? = null,
  val act: PendingIntent? = null,
  val faded: Boolean = false,
  val line2: String? = null,
)

/**
 * ====== 🆕 v4 — رسمُ بطاقة المعمل على `Canvas` (خالد ٣٠ أكتوبر) ======
 *
 * البطاقةُ نفسُها في كلِّ شكل: الصورةُ تغطّي مربّعها (مطٌّ حتّى `lim` ثمّ قصٌّ `cropTop` من فوق والباقي من تحت)، والعنوانُ الأصفرُ
 * داخلها فوق، والاسمُ وسطرُه تحت، وزرُّ الفعل في الزاوية، و↻ فوق في الطرف. كلُّ رقمٍ من `draw` (أرقامُ المحرّك من الخلاصة) بنقاط
 * التصميم، و`P` نقاطُ الصورة لكلِّ نقطة تصميم. لا رقمَ مقاسٍ هنا إلّا الافتراضيُّ المطابقُ للمحرّك (`widgetTiles.ts` · `DRAW_BASE`).
 */
internal object W4Paint {
  private const val ACCENT = 0xFFFFD400.toInt()
  private const val SUCCESS = 0xFF22C55E.toInt()

  private fun dn(o: JSONObject?, k: String, def: Float): Float = o?.optDouble(k, Double.NaN)?.takeIf { !it.isNaN() && it >= 0 }?.toFloat() ?: def

  /** يقرأ الصورةَ مصغّرةً إلى ما يكفي مربّعها (`inSampleSize`) — لا صورةَ كاملةَ في ذاكرة الودجت */
  private fun decode(ctx: Context, name: String?, w: Int, h: Int): Bitmap? {
    if (name == null) return null
    return try {
      val f = File(WFeed.dir(ctx), name)
      if (!f.exists()) return null
      val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(f.path, b)
      var sample = 1
      while (b.outWidth / (sample * 2) >= w && b.outHeight / (sample * 2) >= h) sample *= 2
      BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (e: Exception) {
      null
    }
  }

  private fun text(size: Float, color: Int, bold: Boolean): TextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = size
    this.color = color
    typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
  }

  /** سطرٌ واحدٌ مقطوعٌ بـ«…» في عرضه، من اليسار أو من اليمين */
  private fun line(c: Canvas, s: String, p: TextPaint, left: Float, right: Float, baseline: Float, rtl: Boolean) {
    if (s.isEmpty() || right <= left) return
    val t = TextUtils.ellipsize(s, p, right - left, TextUtils.TruncateAt.END).toString()
    val w = p.measureText(t)
    c.drawText(t, if (rtl) right - w else left, baseline, p)
  }

  private fun circle(c: Canvas, cx: Float, cy: Float, d: Float, glyph: String, P: Float) {
    c.drawCircle(cx, cy, d / 2f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(140, 0, 0, 0) })
    c.drawCircle(cx, cy, d / 2f - 0.5f * P, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = P; color = Color.argb(77, 255, 255, 255) })
    val p = text(d * 0.46f, if (glyph == "↶") SUCCESS else Color.WHITE, true)
    val w = p.measureText(glyph)
    val fm = p.fontMetrics
    c.drawText(glyph, cx - w / 2f, cy - (fm.ascent + fm.descent) / 2f, p)
  }

  private fun round(ctx: Context, name: String?, size: Int): Bitmap? {
    val src = decode(ctx, name, size, size) ?: return null
    val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val sc = maxOf(size.toFloat() / src.width, size.toFloat() / src.height)
    val m = Matrix().apply { setScale(sc, sc); postTranslate((size - src.width * sc) / 2f, (size - src.height * sc) / 2f) }
    Canvas(out).drawCircle(size / 2f, size / 2f, size / 2f, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      shader = BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { setLocalMatrix(m) }
    })
    src.recycle()
    return out
  }

  /**
   * بطاقةٌ في `(x,y,w,h)` بنقاط التصميم. `it` = null ⇒ خانةٌ فارغةٌ داكنة. `small` الصغيرُ (أرقامُه الأكبر)، `cyc` ↻ فوق في الطرف،
   * `topBtn` زرُّ الفعل فوق (بطاقةُ أكمل المشاهدة العريضة كالتطبيق)، `wide` الصورةُ العريضة، `zoom` زومٌ أوت فوق وتحت (الصغير).
   */
  fun card(
    ctx: Context, c: Canvas, P: Float, x: Float, y: Float, w: Float, h: Float, it: I4?, label: String?,
    small: Boolean, cyc: Boolean, topBtn: Boolean, bar: Boolean, wide: Boolean, zoom: Float, rtl: Boolean, draw: JSONObject?,
  ) {
    val L = x * P
    val T = y * P
    val Wp = w * P
    val Hp = h * P
    val r = if (small) 0f else dn(draw, "radius", 10f) * P
    c.save()
    c.clipPath(Path().apply { addRoundRect(RectF(L, T, L + Wp, T + Hp), r, r, Path.Direction.CW) })
    c.drawColor(0xFF111111.toInt())
    if (it == null) {
      /* خانةٌ داكنةٌ بلا عنصر — وعنوانُ القسم يبقى إن كان لها */
      if (label != null) {
        val p = text((if (small) dn(draw, "labelSmall", 11.5f) else dn(draw, "label", 10.5f)) * P, ACCENT, true)
        val pad0 = (if (small) dn(draw, "textPadSmall", 10f) else dn(draw, "textPad", 8f)) * P
        line(c, label, p, L + pad0, L + Wp - pad0, T + (if (small) 9f else 7f) * P - p.fontMetrics.ascent, rtl)
      }
      c.restore()
      return
    }
    /* الصورةُ تغطّي مربّعها: مطٌّ حتّى الحدّ، ثمّ قصٌّ أغلبُه من تحت — وزومُ الصغير فوق وتحت */
    val src = decode(ctx, if (wide) it.backdrop ?: it.poster else it.poster, Wp.toInt().coerceAtLeast(1), Hp.toInt().coerceAtLeast(1))
    if (src != null) {
      val lim = dn(draw, "lim", 0.25f)
      val cropTop = dn(draw, "cropTop", 0.35f)
      val a = src.width.toFloat() / src.height
      val b = Wp / Hp
      val s = b.coerceIn(a / (1f + lim), a * (1f + lim))
      var iw: Float
      var ih: Float
      var l = 0f
      var t = 0f
      if (b >= s) { iw = Wp; ih = Wp / s; t = -(ih - Hp) * cropTop } else { ih = Hp; iw = Hp * s; l = -(iw - Wp) / 2f }
      if (zoom > 0f) { ih = maxOf(Hp, ih * (1f - zoom)); t = -(ih - Hp) * cropTop }
      c.drawBitmap(src, null, RectF(L + l, T + t, L + l + iw, T + t + ih), Paint(Paint.FILTER_BITMAP_FLAG).apply { alpha = if (it.faded) 140 else 255 })
      src.recycle()
    }
    /* ظلٌّ خفيفٌ فوق للعنوان، وأغمقُ تحت للاسم */
    c.drawRect(L, T, L + Wp, T + Hp, Paint().apply {
      shader = LinearGradient(0f, T, 0f, T + Hp, intArrayOf(Color.argb(140, 0, 0, 0), Color.TRANSPARENT, Color.TRANSPARENT, Color.argb(235, 0, 0, 0)), floatArrayOf(0f, 0.28f, 0.5f, 1f), Shader.TileMode.CLAMP)
    })
    val cd = (if (small) dn(draw, "circleSmall", 26f) else dn(draw, "circle", 24f)) * P
    val inset = (if (small) 7f else 4f) * P
    val pad = (if (small) dn(draw, "textPadSmall", 10f) else dn(draw, "textPad", 8f)) * P
    val hasTop = cyc || (topBtn && it.btn != null)
    if (label != null) {
      val p = text((if (small) dn(draw, "labelSmall", 11.5f) else dn(draw, "label", 10.5f)) * P, ACCENT, true).apply { setShadowLayer(3f * P, 0f, P, Color.BLACK) }
      val top = (if (small) 9f else 7f) * P
      val reserve = if (hasTop) cd + 10f * P else pad
      line(c, label, p, if (rtl) L + reserve else L + pad, if (rtl) L + Wp - pad else L + Wp - reserve, T + top - p.fontMetrics.ascent, rtl)
    }
    if (cyc) circle(c, if (rtl) L + 4f * P + cd / 2f else L + Wp - 4f * P - cd / 2f, T + 4f * P + cd / 2f, cd, "↻", P)
    else if (topBtn && it.btn != null) circle(c, if (rtl) L + 4f * P + cd / 2f else L + Wp - 4f * P - cd / 2f, T + 4f * P + cd / 2f, cd, it.btn, P)
    val bottomBtn = !topBtn && it.btn != null
    if (bottomBtn) circle(c, if (rtl) L + inset + cd / 2f else L + Wp - inset - cd / 2f, T + Hp - inset - cd / 2f, cd, it.btn!!, P)
    /* الاسمُ وسطرُه تحت — والصديقُ بصورته جنب اسمه */
    val nameP = text((if (small) dn(draw, "nameSmall", 13f) else if (w > 120f) dn(draw, "nameBig", 12.5f) else dn(draw, "name", 11.5f)) * P, if (it.faded) 0x8CF7F7F7.toInt() else Color.WHITE, true)
    val lineP = text((if (small) dn(draw, "lineSmall", 10f) else dn(draw, "line", 9f)) * P, if (it.faded) ACCENT else 0xFFDDDDDD.toInt(), false)
    val left = if (rtl) L + (if (bottomBtn) cd + (if (small) 14f else 10f) * P else pad) else L + pad
    val right = if (rtl) L + Wp - pad else L + Wp - (if (bottomBtn) cd + (if (small) 14f else 10f) * P else pad)
    val bottom = T + Hp - (if (small) dn(draw, "textBottomSmall", 11f) else dn(draw, "textBottom", 7f)) * P
    val lineBase = bottom - lineP.fontMetrics.descent
    line(c, it.line, lineP, left, right, lineBase, rtl)
    val nameBase = lineBase + lineP.fontMetrics.ascent - P - nameP.fontMetrics.descent
    var nl = left
    var nr = right
    if (it.avatar != null) {
      val av = ((if (small) dn(draw, "avatarSmall", 18f) else dn(draw, "avatar", 16f)) * P).toInt().coerceAtLeast(1)
      round(ctx, it.avatar, av)?.let { bmp ->
        val ay = nameBase + (nameP.fontMetrics.ascent + nameP.fontMetrics.descent) / 2f - av / 2f
        val ax = if (rtl) right - av else left
        c.drawBitmap(bmp, ax, ay, null)
        bmp.recycle()
        if (rtl) nr -= av + 4f * P else nl += av + 4f * P
      }
    }
    line(c, it.name, nameP, nl, nr, nameBase, rtl)
    if (bar && it.bar != null) {
      val bh = dn(draw, "bar", 2.5f) * P
      c.drawRect(L, T + Hp - bh, L + Wp, T + Hp, Paint().apply { color = Color.argb(38, 255, 255, 255) })
      val fw = Wp * (it.bar.coerceIn(0, 100) / 100f)
      val fill = Paint().apply { color = if (it.bar >= 99) SUCCESS else ACCENT }
      if (rtl) c.drawRect(L + Wp - fw, T + Hp - bh, L + Wp, T + Hp, fill) else c.drawRect(L, T + Hp - bh, L + fw, T + Hp, fill)
    }
    c.restore()
  }

  /** صفُّ القادم المكبّر (٤٤ ببوستر ٢٩×٤٤) أو سطرُه النحيل — وحين لا قادم: آخرُ نشاطٍ لأصدقائك بصورة الصديق */
  fun row(ctx: Context, c: Canvas, P: Float, x: Float, y: Float, w: Float, h: Float, it: I4?, head: String, tail: String, slim: Boolean, friends: Boolean, rtl: Boolean, draw: JSONObject?) {
    val L = x * P
    val T = y * P
    val R = (x + w) * P
    val mid = T + h * P / 2f
    val second = if (it == null) "" else if (friends) listOfNotNull(it.name, it.line.removeSuffix(" · $tail").removeSuffix(tail).takeIf { s -> s.isNotEmpty() }).joinToString(" · ") else listOfNotNull(it.name, it.line2?.takeIf { s -> s.isNotEmpty() }).joinToString(" · ")
    if (slim) {
      val f = dn(draw, "slimFont", 11f) * P
      val yp = text(f, ACCENT, true)
      val wp = text(f, Color.WHITE, false)
      val base = mid - (yp.fontMetrics.ascent + yp.fontMetrics.descent) / 2f
      val hw = minOf(yp.measureText(head), w * P * 0.5f)
      line(c, head, yp, if (rtl) R - hw else L, if (rtl) R else L + hw, base, rtl)
      var start = hw + 6f * P
      if (friends && it?.avatar != null) {
        val av = (dn(draw, "slimAvatar", 14f) * P).toInt().coerceAtLeast(1)
        round(ctx, it.avatar, av)?.let { b ->
          c.drawBitmap(b, if (rtl) R - start - av else L + start, mid - av / 2f, null)
          b.recycle()
          start += av + 6f * P
        }
      }
      line(c, second, wp, if (rtl) L else L + start, if (rtl) R - start else R, base, rtl)
      return
    }
    val tw = dn(draw, "upThumbW", 29f) * P
    val th = dn(draw, "upThumbH", 44f) * P
    val src = decode(ctx, it?.poster, tw.toInt().coerceAtLeast(1), th.toInt().coerceAtLeast(1))
    val tx = if (rtl) R - tw else L
    val ty = mid - th / 2f
    c.save()
    c.clipPath(Path().apply { addRoundRect(RectF(tx, ty, tx + tw, ty + th), 4f * P, 4f * P, Path.Direction.CW) })
    c.drawColor(0xFF111111.toInt())
    if (src != null) {
      val sc = maxOf(tw / src.width, th / src.height)
      c.drawBitmap(src, Matrix().apply { setScale(sc, sc); postTranslate(tx + (tw - src.width * sc) / 2f, ty + (th - src.height * sc) / 2f) }, Paint(Paint.FILTER_BITMAP_FLAG))
      src.recycle()
    }
    c.restore()
    val tailP = text(dn(draw, "upTail", 10f) * P, 0xFF9C9C9C.toInt(), false)
    val tailW = if (tail.isEmpty()) 0f else tailP.measureText(tail) + 6f * P
    val l0 = if (rtl) L + tailW else L + tw + 9f * P
    val r0 = if (rtl) R - tw - 9f * P else R - tailW
    val hp = text(dn(draw, "upTitle", 10.5f) * P, ACCENT, true)
    val np = text(dn(draw, "upName", 12f) * P, Color.WHITE, false)
    val total = (hp.fontMetrics.descent - hp.fontMetrics.ascent) + (np.fontMetrics.descent - np.fontMetrics.ascent)
    val b1 = mid - total / 2f - hp.fontMetrics.ascent
    line(c, head, hp, l0, r0, b1, rtl)
    val b2 = b1 + hp.fontMetrics.descent - np.fontMetrics.ascent
    var sl = l0
    var sr = r0
    if (friends && it?.avatar != null) {
      val av = (dn(draw, "avatar", 16f) * P).toInt().coerceAtLeast(1)
      round(ctx, it.avatar, av)?.let { b ->
        val ay = b2 + (np.fontMetrics.ascent + np.fontMetrics.descent) / 2f - av / 2f
        c.drawBitmap(b, if (rtl) sr - av else sl, ay, null)
        b.recycle()
        if (rtl) sr -= av + 4f * P else sl += av + 4f * P
      }
    }
    line(c, second, np, sl, sr, b2, rtl)
    if (tail.isNotEmpty()) {
      val base = mid - (tailP.fontMetrics.ascent + tailP.fontMetrics.descent) / 2f
      c.drawText(tail, if (rtl) L else R - tailP.measureText(tail), base, tailP)
    }
  }
}
