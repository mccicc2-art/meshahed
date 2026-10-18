package com.loopztv.app.widget

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PersistableBundle

/**
 * ====== 🆕 نداءُ أفعال الودجت مهمّةً مستعجلة (سجلُّ لمسات أحمد، ١٤ أكتوبر، بناء 78) ======
 *
 * 🔴 **السبب**: كلُّ ✓ من الودجت سقط بـ`UnknownHostException: Unable to resolve host "loopztv.com"` — أندرويد (One UI هنا)
 * يقطع الشبكةَ عن مستقبِلٍ يعمل والتطبيقُ في الخلفيّة. وحين جعل أحمد التطبيقَ «غير مقيّد» وصلت اللمساتُ الخادمَ ونُفّذت.
 *
 * 🔑 **المهمّةُ المستعجلة** (`setExpedited`، أندرويد 12+) هي الطريقُ الموثَّق لعملٍ قصيرٍ يبدؤه المستخدم: تُعطى الشبكةَ
 * والتطبيقُ في الخلفيّة، وشرطُ «أيِّ شبكة» يجعلها **تنتظر** الشبكةَ إن غابت بدل أن تفشل — فلا تضيع لمسة.
 * ولا يطلب أحدٌ من المستخدمين تغييرَ إعدادات البطارية.
 */
class WidgetJobService : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    val ctx = applicationContext
    val args = params.extras
    Thread {
      try {
        /* 🆕 1.12.7 — زرّا إشعار الرسالة (`DmPush.kt`) يمرّان من هنا أيضاً: الدرسُ نفسُه — مستقبِلٌ في الخلفية لا شبكةَ له */
        val token = CheckReceiver.token(ctx)
        if ((args.getString("action") ?: "").startsWith(DmPush.ACTION_PREFIX)) DmPush.perform(ctx, args)
        else if (token == null) CheckReceiver.diag(ctx, (args.getString("action") ?: "").substringAfterLast('.'), "no_token", "job")
        else CheckReceiver().perform(ctx, args, token)
      } finally {
        jobFinished(params, false)
      }
    }.start()
    return true
  }

  /** النظامُ أوقفها قبل أن تتمّ — لا إعادة: اللمسةُ إمّا وصلت أو أُعيد الودجتُ كما كان */
  override fun onStopJob(params: JobParameters): Boolean = false

  companion object {
    private const val BASE_ID = 47_000

    /** يسلّم الفعلَ مهمّةً؛ `false` إن رفضها النظام (فيُنفَّذ في المستقبِل كما كان) */
    fun enqueue(ctx: Context, args: PersistableBundle): Boolean = try {
      val prefs = LoopzWidget.prefs(ctx)
      val n = (prefs.getInt("w_job_n", 0) + 1) % 500
      prefs.edit().putInt("w_job_n", n).apply()
      val b = JobInfo.Builder(BASE_ID + n, ComponentName(ctx, WidgetJobService::class.java))
        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
        .setExtras(args)
      if (Build.VERSION.SDK_INT >= 31) b.setExpedited(true)
      val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
      js.schedule(b.build()) == JobScheduler.RESULT_SUCCESS
    } catch (e: Exception) {
      false
    }
  }
}
