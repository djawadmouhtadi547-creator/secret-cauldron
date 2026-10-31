# Changelog

## [1.0.0-stage1] — 2026-10-31
- تأسيس Electron ES Modules مع نافذة مخصصة وpreload محدود وآمن.
- إنشاء عقد IPC يغطي 46 قناة request/response مع أحداث تقدم وسجلات التشغيل.
- تنفيذ mocks منفصلة لكل مجال ضمن `src/main/mock/`، بما فيها manifest نسخ تجريبي ومحرك تشغيل تجريبي.
- إضافة نظام التصميم، أربع سمات، 11 accent، RTL/LTR، Modern/Classic وملفات i18n متطابقة المفاتيح.
- إنشاء مكونات الواجهة القابلة لإعادة الاستخدام، شاشة الترحيب، تسجيل الأوفلاين وDashboard.
- إضافة صفحات هيكلية للمراحل التالية، شعار Prime SVG/ICO وفهرس الأيقونات.
- إضافة فحص بنية واستيرادات وملفات SVG، وسير عمل GitHub Actions لـ Windows x64 وLinux x64.
- إصلاح معالجات فتح القوائم المنسدلة وتبديل الإعدادات، وإضافة سهم تمرير اختصارات النسخ عند وجود عناصر مخفية.
- تحسين mocks: معرفات نسخ فريدة، تحديث UUID عند إعادة استخدام اسم حساب أوفلاين بحالة أحرف مختلفة، ترتيب السيرفرات المميزة وإدارة حالة تثبيت Java تجريبياً.
- توحيد تواقيع methods في عقد IPC مع أشكال payload الفعلية، والتحقق آلياً من قنوات العقد وأحداثها وتطابق مفاتيح i18n.

## [1.0.0-stage2-review] — مراجعة Claude
- إصلاح SyntaxError في src/main/launch.js: تصريح `const features` مكرر داخل composeLaunch كان يمنع ipc.js من التحميل وبالتالي يمنع إقلاع التطبيق كاملاً.
- loaders.js: إنشاء launcher_profiles.json قبل تشغيل installer الخاص بـ Forge/NeoForge لأنه يرفض العمل بدونه.
- تنظيف الحزمة: حذف .git وسقالة Replit (artifacts, lib, pnpm...) من الـ ZIP.

## [1.0.0-stage3-renderer] — Phase 3 integration
- استبدال الصفحات الهيكلية بصفحات مركز المحتوى والسيرفرات والتخصيص والمكتبة والنسخة والإعدادات.
- إضافة إعدادات النسخة الافتراضية، مكوّن القائمة الافتراضية، وCSS للصفحات الجديدة.
- استكمال i18n العربية والإنجليزية إلى 476 مفتاحاً وربط الصفحة/المودال lifecycle والتنقل بـ app.js.
- إضافة اختيار instance target لمثبت المحتوى، تصحيح فلاتر المناطق، وإصلاح تحميل قائمة إصدارات مودال إنشاء النسخة.
- حافظ دمج المرحلة 3 الأساسي على عقد IPC؛ ثم أضيفت في 3.1 قناة واحدة متوافقة خلفياً لاختيار ملف الاستيراد، مع توثيقها في العقد وmain وpreload.
- توثيق الميزات غير المكتملة وحدود الاختبار في HANDOFF.md.

### [Phase 3.1] Import/export, launch fixes and local skin viewer readiness
- Added a native ZIP/MRPack import file picker through the documented `instances:select-import-file` IPC channel.
- Added MRPack export action to instance cards in the Library.
- Added pinned `skinview3d@3.4.2` dependency and a postinstall script that copies its browser bundle and MIT license locally.
- Updated renderer CSP for the loopback-only Prime skin texture server.
- Added eight automated Node test cases for translations, renderer templates, escaping, import IPC wiring, skin viewer packaging, launch argument safety and project consistency.
- Connected Java runtime install/remove and per-instance memory/custom Java/JVM arguments to the actual launch command; stored Prime-only settings separately in `prime-options.json`.
- Corrected a modern-version launch argument reference (`base.metadata` → `baseMetadata`), validated resolution token values, fixed per-axis resolution persistence, corrected legacy launch notifications and added translated control labels for supported key bindings.
- Added `npm test` to both Windows and Linux GitHub Actions jobs, and included the project MIT license in source and packaged app files.

## [0.4.0-beta.1] — Phase 4 GitHub readiness
- Sync app/package version and About screen to `0.4.0-beta.1`.
- Upgrade Electron from the end-of-support 33.x line to 45.2.1 and electron-builder to 26.18.1; move CI to Node 22.
- Add repository validation scripts for JavaScript syntax and accidentally committed credentials.
- Restrict IPC calls to the primary local renderer frame; lock renderer navigation and HTTPS-only external windows.
- Tighten renderer Content Security Policy.
- Support ignored `keys.local.json` and private Azure/CurseForge environment variables while keeping public key templates blank.
- Add GitHub Actions validation, native Windows/Linux packaging, and automatic prerelease creation for matching version tags.
- Add Dependabot updates for npm and GitHub Actions.
- Add issue forms, PR template, contribution/security/support docs, and GitHub publishing/release instructions.
