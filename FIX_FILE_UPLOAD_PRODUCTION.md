# إصلاح مشكلة رفع وتحميل الملفات في الإنتاج

## المشكلة
كانت الملفات تعمل بشكل صحيح على localhost ولكن لا تعمل في الإنتاج (live/production).

## الإصلاحات المطبقة

### 1. إصلاح إعدادات CORS للملفات الثابتة
- تم تحديث middleware لخدمة الملفات الثابتة (`/api/v1/uploads`) لدعم CORS بشكل ديناميكي
- الآن يتحقق من `origin` في الطلب ويطابقه مع `FRONTEND_URL`
- إضافة دعم لـ preflight requests (OPTIONS)

### 2. تحسين CORS الرئيسي
- تحديث إعدادات CORS الرئيسية لدعم عدة origins (مفصولة بفواصل)
- إضافة `Content-Disposition` و `Content-Length` إلى `exposedHeaders` للسماح بالوصول إليها من الـ frontend

### 3. إصلاح تحميل الملفات
- إضافة CORS headers في route تحميل الملفات (`/assignment-resources/:id/download`)
- تحسين معالجة الأخطاء عند stream الملفات

### 4. تحسين معالجة الأخطاء والـ logging
- إضافة logging مفصل لعمليات رفع الملفات
- التحقق من وجود الملفات بعد الرفع
- رسائل خطأ أوضح في وضع التطوير

## الإعدادات المطلوبة في الإنتاج

### متغيرات البيئة (Environment Variables)

#### Backend (.env)
```env
# URL الخاص بالـ frontend (يمكن إضافة عدة URLs مفصولة بفواصل)
FRONTEND_URL=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# مسار مجلد الرفع (اختياري - افتراضي: backend/uploads)
UPLOAD_DIR=/path/to/uploads

# حجم الملف الأقصى بالبايت (اختياري - افتراضي: 100MB)
MAX_FILE_SIZE=104857600
```

#### Frontend (.env)
```env
# URL الخاص بالـ backend API
VITE_API_URL=https://your-backend-domain.com/api/v1
```

## ملاحظات مهمة

### 1. مسار الرفع في الإنتاج
- في منصات مثل Heroku أو Vercel، نظام الملفات مؤقت (ephemeral)
- الملفات المرفوعة قد تُفقد عند إعادة تشغيل الخادم
- **الحل المقترح**: استخدام خدمة تخزين سحابية مثل AWS S3 أو Cloudinary

### 2. CORS Origins
- تأكد من أن `FRONTEND_URL` يحتوي على الـ URL الكامل للـ frontend (مع https://)
- يمكن إضافة عدة URLs مفصولة بفواصل إذا كان لديك عدة domains

### 3. SSL/HTTPS
- تأكد من أن كلا من الـ frontend والـ backend يستخدمان HTTPS في الإنتاج
- بعض المتصفحات تمنع طلبات CORS بين HTTP و HTTPS

### 4. حجم الملفات
- تأكد من أن `MAX_FILE_SIZE` مناسب لحجم الملفات التي تريد رفعها
- قد تحتاج أيضاً لتعديل إعدادات الخادم (nginx/apache) إذا كان موجوداً

## اختبار الإصلاحات

### 1. اختبار الرفع
```bash
# في الـ backend console، يجب أن ترى logs مثل:
Create resource request: { assignmentId: '...', type: 'FILE', hasFile: true, ... }
File saved successfully: /path/to/file
Resource created successfully: ...
```

### 2. اختبار التحميل
- جرب تحميل ملف مرفوع مسبقاً
- تحقق من console في المتصفح لمعرفة أي أخطاء CORS

### 3. التحقق من CORS Headers
افتح Developer Tools > Network tab وتحقق من:
- `Access-Control-Allow-Origin` يحتوي على الـ URL الصحيح
- `Access-Control-Allow-Credentials: true`
- لا توجد أخطاء CORS في console

## الخطوات التالية (اختياري)

1. **التخزين السحابي**: فكر في استخدام AWS S3 أو Cloudinary للملفات
2. **CDN**: استخدم CDN لخدمة الملفات الثابتة بشكل أسرع
3. **Compression**: أضف ضغط للملفات الكبيرة
4. **Virus Scanning**: أضف فحص الفيروسات للملفات المرفوعة

## الدعم
إذا استمرت المشكلة:
1. تحقق من console logs في الـ backend
2. تحقق من Network tab في المتصفح
3. تأكد من أن متغيرات البيئة صحيحة
4. تحقق من أن الخادم يدعم رفع الملفات (file size limits)
