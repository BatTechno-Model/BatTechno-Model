# حل مشكلة حقل Avatar في قاعدة البيانات

## المشكلة
حقل `avatar` غير موجود في جدول `Profile` في قاعدة البيانات، مما يسبب خطأ 500 عند محاولة رفع الصورة الشخصية.

## الحلول المتاحة

### الحل 1: استخدام Prisma (الأسهل والأسرع)

افتح Terminal في مجلد `backend` وقم بتنفيذ:

```bash
cd backend
npx prisma db push
```

هذا الأمر سيضيف حقل `avatar` تلقائياً إلى قاعدة البيانات.

### الحل 2: استخدام SQL مباشرة في Neon

1. افتح Neon Console
2. اذهب إلى SQL Editor
3. انسخ والصق الكود التالي:

```sql
-- Add avatar column to Profile table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Profile' 
        AND column_name = 'avatar'
    ) THEN
        ALTER TABLE "Profile" ADD COLUMN "avatar" TEXT;
    END IF;
END $$;
```

4. اضغط Run

### الحل 3: استخدام ملف SQL الموجود

استخدم الملف `database/add_avatar_column.sql`:

1. افتح Neon Console
2. اذهب إلى SQL Editor
3. افتح ملف `database/add_avatar_column.sql`
4. انسخ المحتوى والصقه في SQL Editor
5. اضغط Run

## التحقق من نجاح العملية

بعد تنفيذ أي من الحلول أعلاه، يمكنك التحقق من نجاح العملية:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Profile' 
AND column_name = 'avatar';
```

إذا ظهرت النتيجة، فالحقل موجود بنجاح.

## بعد إضافة الحقل

1. أعد تشغيل الخادم (Backend Server)
2. جرّب رفع الصورة الشخصية مرة أخرى
3. يجب أن تعمل الميزة الآن بدون مشاكل

## ملاحظات

- الحقل `avatar` من نوع `TEXT` ويمكن أن يكون `NULL`
- الصور تُحفظ في مجلد `backend/uploads`
- رابط الصورة يُحفظ في قاعدة البيانات بصيغة `/api/v1/uploads/filename.jpg`
