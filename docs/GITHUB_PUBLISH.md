# نشر Prime Launcher على GitHub

هذا الأرشيف جاهز ليكون محتوى مستودع Git. لا يحتوي على مجلد `.git` ولا يرفع نفسه تلقائياً إلى حسابك.

## 1. أنشئ مستودعاً فارغاً

من GitHub أنشئ مستودعاً باسم `prime-launcher` (أو الاسم الذي تختاره). يفضّل عدم إضافة README أو License من واجهة GitHub لأنهما موجودان هنا بالفعل.

## 2. ارفع المصدر

نفّذ الأوامر من داخل مجلد `prime-launcher` بعد فك الأرشيف:

```bash
git init -b main
git add .
git status --short
git commit -m "chore: prepare Prime Launcher 0.4.0-beta.1"
git remote add origin https://github.com/YOUR-OWNER/YOUR-REPOSITORY.git
git push -u origin main
```

استبدل `YOUR-OWNER/YOUR-REPOSITORY` بعنوان مستودعك. راجع ناتج `git status` وتأكد أن `keys.local.json` وأي أسرار أو ملفات شخصية غير موجودة ضمن الملفات المضافة.

## 3. راجع CI

بعد الرفع، افتح تبويب **Actions** في GitHub. يجب أن ينجح job `quality`، ثم يبني `package` نسختي Windows x64 وLinux x64 عند الدفع إلى `main` أو تشغيل workflow يدوياً. فشل التنزيل من npm أو فشل electron-builder يمنع نشر الإصدار، ولا يعتبر ZIP المصدر نفسه دليلاً على نجاح بناء المثبت.

## 4. أنشئ أول إصدار تجريبي

بعد استكمال `docs/RELEASE_CHECKLIST.md` على جهاز فعلي ونجاح Actions:

```bash
git tag -a v0.4.0-beta.1 -m "Prime Launcher 0.4.0-beta.1"
git push origin v0.4.0-beta.1
```

عند نجاح بناء المنصتين، ينشئ Workflow إصدار GitHub Release تلقائياً ويرفق ملفات التثبيت. أي tag يحتوي `-` مثل `v0.4.1-beta.1` ينشر كـ prerelease.

## 5. أسرار CI (اختيارية)

لا يحتاج بناء المصدر إلى Azure أو CurseForge API keys. إذا أضفت لاحقاً اختبارات تكامل تتطلب مفاتيح، خزّنها في **Settings → Secrets and variables → Actions** واستخدم `${{ secrets.NAME }}` في workflow؛ لا تضعها في YAML أو `keys.json`.

## ملاحظات

- `keys.json` و`keys.local.example.json` ملفات نماذج فارغة. المفاتيح المحلية الفعلية في `keys.local.json` مستثناة من Git.
- لا يوجد `package-lock.json` في هذا الأرشيف لأن npm registry لم يكن متاحاً أثناء إعداد المرحلة. يستخدم CI `npm install` وليس `npm ci`؛ بعد توفر اتصال npm، نفّذ `npm install` محلياً وضمّن `package-lock.json` في commit منفصل لزيادة قابلية إعادة البناء.
- GitHub Actions يبني Linux على Ubuntu وWindows على Windows؛ لا تعتمد على cross-compilation.
