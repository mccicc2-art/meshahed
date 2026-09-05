# Claude Handoff — Loopz Pre-App Audit

أنت المنفذ في مراجعة Loopz النهائية قبل React Native / Expo، وChatGPT هو المراجع والبوابة التقنية. أحمد خارج دورة الاعتماد التشغيلية اليومية.

## الموقع والملفات

- المستودع: `mccicc2-art/meshahed`
- الموقع: `https://loopztv.com`
- فرع التنسيق: `docs/pre-app-audit`
- مجلد العمل: `docs/pre-app-audit/`

اقرأ بالترتيب:

1. `README.md`
2. `AUDIT_PLAN.md`
3. `SHARED_PROGRESS.md`
4. هذا الملف.

## سير العمل

1. ChatGPT يسجل المهمة ومعيار القبول.
2. Claude ينشئ فرع `audit/phase-XX-short-name`.
3. Claude ينفذ ويختبر ويقدم الأدلة.
4. Claude يضع `READY_FOR_REVIEW`.
5. ChatGPT يضع `VERIFIED` أو `CHANGES_REQUESTED`.
6. بعد `VERIFIED` يدمج Claude إلى `audit/integration`.
7. لا حاجة للرجوع إلى أحمد في هذه الدورة.
8. يبقى `main` وProduction ثابتين حتى اكتمال جميع بوابات التدقيق وقرار GO.

## الصلاحيات

يمكنك دون الرجوع إلى أحمد:

- إنشاء الفروع وPull Requests.
- إصلاح الكود والاختبارات والتوثيق.
- Preview deployments.
- حذف كود ميت مثبت على فرع العمل.
- تنفيذ تغييرات إضافية قابلة للرجوع على Staging بعد توثيق الاختبار.
- الدمج إلى `audit/integration` بعد VERIFIED.

توقف وسجل `BLOCKED` فقط عند:

- حذف بيانات Production.
- Migration تدميرية أو غير قابلة للرجوع على Production.
- سر مكشوف أو حادث أمني جارٍ.
- هدف غير محدد قد يؤثر في بيانات المستخدمين.
- صلاحية مطلوبة غير متاحة.

## قواعد ثابتة

- لا تعديل مباشر على `main` أثناء التدقيق.
- لا تطوير ميزات جديدة داخل جولة التدقيق.
- اختبارات الأمن النشطة على Preview أو Staging فقط.
- لا Secrets أو Tokens أو بيانات مستخدمين في الردود أو الملفات.
- لا حذف كود ميت قبل إثبات عدم استخدامه.
- كل مشكلة `LOOPZ-AUD-XXXX`.
- أنت تضع READY_FOR_REVIEW، وChatGPT يضع VERIFIED.
- المرجع الوحيد للحالة هو `SHARED_PROGRESS.md`.

## التنسيق

- حدث `Claude Check-in` كل 10 دقائق كحد أقصى أثناء العمل النشط.
- عند التسليم اعمل Commit أو Comment في Pull Request التنسيق لتنبيه ChatGPT فوراً.
- استخدم:
  `audit(coord): claude check-in YYYY-MM-DD HH:MM UTC`
- اقرأ أحدث نسخة قبل التعديل.
- لا تعدل الملف بالتزامن مع ChatGPT.
- بعد التسليم غيّر صاحب الدور التالي إلى ChatGPT.

## المهمة الأولى: Phase 0 Baseline

لا تصلح شيئاً الآن. سجل:

- SHA الحالي لـ main.
- حالة الفروع أو التغييرات القائمة.
- إصدارات Node وNext.js وReact وTypeScript والحزم الأساسية.
- Scripts المتاحة للفحص والبناء والاختبار.
- البيئات المعروفة دون كشف القيم.
- آخر Deploy أو Build معروف.
- الأدوار وحسابات الاختبار المطلوبة.
- الموانع.
- أوامر Read-only المقترحة للمرحلة التالية.

ثم:

1. حدّث `SHARED_PROGRESS.md`.
2. ضع `READY_FOR_REVIEW`.
3. أضف Commit SHA والأدلة.
4. سلّم الدور إلى ChatGPT.
5. توقف حتى يراجع ChatGPT Phase 0.
