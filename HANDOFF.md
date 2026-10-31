# Prime Launcher — Handoff

### المرحلة 1 — GPT-6
- ✅ تم:
  - إنشاء الهيكل الثابت لـ Electron + Vanilla HTML/CSS/JS ES Modules دون React أو خطوة build للواجهة.
  - إضافة `package.json` وسكربتات `start` و`build` و`build:linux` و`check`، مع Electron وelectron-builder.
  - إضافة `.gitignore` و`keys.json` النموذجي (Azure Client ID وCurseForge API key) و`README.md` و`CHANGELOG.md`.
  - إنشاء GitHub Actions لبناء Windows x64 installer وLinux x64 AppImage ورفع مخرجاتهما كـ artifacts.
  - كتابة `docs/API_CONTRACT.md` شاملاً 46 قناة طلب/استجابة وحدثي `launch:progress` و`launch:log`، مع المدخلات والمخرجات وبنى البيانات.
  - تنفيذ `src/preload/index.mjs` عبر `contextBridge` مع `contextIsolation: true` و`nodeIntegration: false`، وكشف `window.prime` وفق العقد فقط.
  - إنشاء `src/main/` لنافذة Electron بلا إطار، أزرار النافذة، سجل التطبيق، التخزين المحلي، وربط IPC بالـ mocks.
  - فصل mocks الحسابات والنسخ والإطلاق وJava والمحتوى والسيرفرات والأخبار والسكنات والتخزين ووقت اللعب والإصدارات في `src/main/mock/`.
  - بناء نظام تصميم OLED/Dark/Light/System، و11 accent جاهزة بالإضافة إلى custom accent، مع CSS variables وlogical properties ودعم RTL/LTR.
  - إضافة تخطيط Modern بثلاثة أقسام وClassic، وشريط عنوان مخصص، شريط جانبي بتنقل وحساب ونسخ سريعة قابلة للتمرير وسهم عند زيادة العناصر، ولوحة أخبار جانبية.
  - إنشاء مكونات UI القابلة لإعادة الاستخدام: Button وToggle وChip وBadge وCard وModal وDropdown وSlider وInput وTooltip وToast وTabs وProgress وSkeleton وEmptyState وContextMenu.
  - إضافة 195 مفتاح i18n متطابقاً في `ar.json` و`en.json`، شاشة الترحيب، تسجيل أوفلاين مع تحقق الاسم وUUID-v3/MD5، قائمة الحساب، وDashboard بأقسامه المطلوبة.
  - إضافة صفحات هيكلية لمركز المحتوى والسيرفرات والتخصيص والمكتبة والنسخة والإعدادات كي يكملها النموذج التالي.
  - إنشاء شعار Prime بصيغ SVG وICO وفق وصف المكعب الأخضر وحرف P، و60 أيقونة SVG، و9 رسومات SVG إضافية للشعار/الصور التجريبية، مع فهرس `docs/ICONS.md`.
  - إضافة `scripts/check-project.js` للتحقق من الاستيرادات والملفات، تساوي مفاتيح اللغتين، قنوات IPC، الأحداث، والأيقونات.
  - اجتياز `node --check` لجميع ملفات JavaScript و`npm run check`.
  - اجتياز smoke tests لمكتبات الـ mocks وقوالب شاشة الترحيب والـ Dashboard والقائمة والحساب والـ modal باللغتين العربية والإنجليزية.
  - اجتياز تحليل XML لملفات SVG التسعة والستين.
- ⚠️ ناقص أو يعمل جزئياً:
  - كل بيانات الأخبار والمشاريع والسيرفرات ووقت اللعب والنسخ وJava والتخزين هي بيانات mock محلية وليست بيانات حية.
  - Microsoft OAuth غير منفذ؛ الزر يقرأ `azureClientId` من `keys.json` ويعرض الحالة فقط، من دون بدء مصادقة فعلية.
  - تشغيل Minecraft الحقيقي، تنزيل ملفات Mojang والتحقق SHA1، Java runtime الحقيقي، تثبيت Fabric/Forge/NeoForge/Quilt، وإدارة جلسات اللعب تقع على النموذج المنفذ للمحرك لاحقاً.
  - صفحات Content Hub وServers وCustomization وLibrary وInstance وSettings هي صفحات هيكلية فقط.
  - رابط الدعم وحسابات التواصل الرسمية لـ Gmu Studios لم تُرفق؛ زر الدعم يعرض تنبيهاً ولا يفتح رابطاً مخترعاً.
  - لم تُرفق ملفات الخطوط Inter أو IBM Plex Sans Arabic/Cairo؛ CSS يطلبها عند توفرها ثم يستخدم خطوط النظام.
  - ملف الشعار الأصلي المنفصل لم يكن متاحاً ضمن الملفات المرفقة عند التنفيذ؛ أنشئ SVG/ICO جديداً بناءً على وصف المكعب الأخضر وحرف P، وليس نسخة من شعار مرجعي.
- 🐞 أخطاء معروفة:
  - أمر `npm install --no-audit --no-fund` لم يكتمل قبل انتهاء مهلة التنفيذ في بيئة الإنشاء؛ لذلك لم تُثبّت `node_modules`، ولم يتم تشغيل `npm start` أو إنتاج installer فعلي في هذه البيئة.
  - محاولة التحقق المرئي عبر Chromium headless لم تكتمل بسبب تعطل جلسة المتصفح في البيئة (رسائل D-Bus ثم انتهاء المهلة). لا أدّعي إجراء اختبار بصري ناجح.
  - يلزم اختبار نافذة Electron فعلياً وبناء Windows x64 على Windows بعد تثبيت الحزم.
  - استيراد/تصدير النسخ وعمليات تثبيت المحتوى داخل mocks لا تنشئ ملفات Minecraft حقيقية؛ المخرجات تجريبية.
  - بيانات مساحة التخزين ووقت اللعب وسيرفرات الشبكة عينات تمثيلية وليست قياساً فعلياً.
- 🔧 افتراضات اتخذتها:
  - اعتمدت العربية RTL وOLED وThe Nether كلغة/مظهر افتراضيين، مع دعم الإنجليزية LTR.
  - استخدمت وصف الشعار النصي لإنشاء علامة Prime الأصلية لأن ملف صورة الشعار لم يكن متاحاً كملف مستقل.
  - تركت المفاتيح السرية فارغة في `keys.json` ولم أنشئ مفاتيح أو بيانات اعتماد غير حقيقية.
  - لم أخترع روابط Gmu Studios الرسمية؛ عناصر التواصل تعرض معلومات توضيحية فقط إلى أن يضيف مالك المشروع الروابط.
  - صممت عقد IPC من الصفر وفق خصائص المرحلة الرئيسية لأن `HANDOFF.md` و`docs/API_CONTRACT.md` لم يكونا موجودين عند بدء المرحلة.
- ▶️ أول ما يسويه النموذج التالي:
  1. اقرأ `docs/API_CONTRACT.md` كاملاً قبل لمس المحرك، وحافظ على أسماء قنوات IPC وبنى المدخلات والمخرجات الحالية.
  2. استبدل mocks فقط داخل `src/main/mock/` بتنفيذ المحرك الحقيقي؛ لا تعد كتابة `src/renderer/` أو `src/preload/` لتجاوز العقد.
  3. نفّذ Mojang manifest والتنزيل والتحقق SHA1 وإدارة Java/loaders ومصادقة Microsoft وفق العقد، واختبر كل حالة فشل.
  4. عند الحاجة إلى قناة جديدة، أضفها في نهاية `docs/API_CONTRACT.md` تحت `Additions` ثم حدّث main وpreload باحترام بقية القنوات.
  5. اختبر `launch:progress` و`launch:log` مع تشغيل/إيقاف جلسة حقيقية، واكتب التغييرات في هذا الملف و`CHANGELOG.md` دون حذف سجل المرحلة الأولى.
  6. أكمل صفحات Kimi الهيكلية اعتماداً على العقد وملفات i18n الحالية، ولا تغيّر تقنية الواجهة إلى React أو Framework آخر.
- 🧪 كيف أختبر:
  - `npm install && npm start`
  - `npm run check`
  - `npm run build` (إنشاء Windows x64 installer على Windows)
  - `npm run build:linux` (إنشاء AppImage على Linux)
  - ملاحظة: `npm run check` وفحوص JavaScript والـ mocks وقوالب renderer وSVG نجحت في بيئة الإنشاء؛ `npm start` والبناء لم يُنفذا بسبب عدم اكتمال تثبيت Electron.


### المرحلة 2 — Replit (انقطع قبل كتابة التسليم) + مراجعة Claude
- ✅ موجود في الكود: محرك حقيقي في src/main (accounts, versions, downloader, java, loaders [Fabric/Quilt/Forge/NeoForge], install, launch, instances, content, servers, skins, storage, playtime, news) وقنوات IPC صارت 59.
- 🔧 أُصلح في المراجعة: خطأ تصريح مكرر في launch.js، وإنشاء launcher_profiles.json قبل installer Forge/NeoForge.
- ⚠️ ناقص: قناة loaders:list غير موجودة (النسخ تُختار تلقائياً داخل loaders.js)؛ نافذة "نسخة جديدة" ما زالت بنسخ ثابتة ولا ترسل loaderVersion؛ مجلد src/main/mock ما زال موجوداً (غير مستخدم).
- 🐞 لم يُختبر أي شيء فعلياً (لا تثبيت حزم ولا تشغيل Electron ولا تشغيل ماينكرافت). الإقلاع الفعلي لـ Vanilla/Fabric/Quilt/Forge/NeoForge غير مؤكد.
- ▶️ التالي: تشغيل npm install && npm start وتسجيل أي خطأ؛ ثم اختبار تثبيت وتشغيل كل loader.

### المرحلة 3 — دمج Kimi ومراجعة تكامل الواجهة
- ✅ تم دمجه فوق مشروع المرحلة 2:
  - استبدال الصفحات الهيكلية بصفحات Content Hub وServers وCustomization وLibrary وInstance وSettings.
  - إضافة `src/renderer/components/virtual-list.js` ومودال `src/renderer/modals/instance-settings.js` وتحديث مودال `new-instance.js`.
  - إضافة `src/renderer/styles/pages/pages.css` وربطه من `index.html`.
  - استكمال مفاتيح الترجمة العربية والإنجليزية إلى 476 مفتاحاً متطابقاً.
  - ربط التنقل وmount/cleanup للصفحات من `app.js`، وربط فتح النسخة وإعداداتها وقائمة السياق والتكرار والحذف ودخول السيرفر.
  - ربط اختيار النسخة المستهدفة عند تثبيت المحتوى، وتصحيح فلاتر مناطق السيرفرات لتطابق قيم المحرك الفعلية.
  - إضافة منتقي ملفات نظامي لاستيراد MRPack/ZIP بقناة `instances:select-import-file` موثقة ومكشوفة في preload؛ أصبح الاستيراد لا يحتاج كتابة المسار يدوياً.
  - إضافة زر تصدير النسخة من المكتبة إلى MRPack، مع رسالة تعرض مسار الملف الناتج.
  - توصيل إدارة Java العامة بتثبيت وإزالة Temurin من صفحة الإعدادات.
  - توصيل إعداد الذاكرة، ومسار Java المخصص، ووسائط JVM من إعدادات النسخة بأمر تشغيل Minecraft؛ تُحفظ خيارات Prime في `prime-options.json` منفصلاً عن `options.txt` الخاص باللعبة.
  - إصلاح مرجع غير معرّف في تجميع وسيطات Minecraft الحديثة (`base.metadata`)، والتحقق من أبعاد النافذة قبل إدراجها في tokens أو arguments، والسماح بحفظ العرض والارتفاع كلٌّ على حدة.
  - تصحيح أسماء مفاتيح التحكم لتتوافق مع مفاتيح Minecraft المخزنة في `options.txt`.
  - إضافة اعتماد `skinview3d@3.4.2` (MIT) و`postinstall` لنسخ browser bundle والترخيص محلياً إلى `src/renderer/vendor/`؛ تحميل العارض الفعلي يتم محلياً بعد `npm install`.
  - تحديث CSP للسماح للعارض بقراءة صور السكن من خادم Prime المحلي على `127.0.0.1` فقط.
  - إصلاح اختيار/تحميل إصدارات Minecraft في مودال النسخة الجديدة؛ التحميل يبدأ بعد تركيب النافذة في DOM.
  - جعل إعدادات النافذة ومفاتيح التحكم المدعومة تُحفظ في `options.txt`، وتحديث اسم/إصدار/loader النسخة عبر واجهات instances الموجودة.
  - أضيفت قناة واحدة متوافقة خلفياً لاستدعاء نافذة اختيار ملف الاستيراد: `instances:select-import-file`؛ عدد قنوات الطلب الموثقة أصبح 60.
- 🔧 تعديلات/تحفظات بالمقارنة مع النص المنقول من Kimi:
  - ملف عارض السكن لا يُضمّن في المصدر الخام؛ يتم تنزيل اعتماده ونسخ bundle محلياً أثناء `npm install` عبر `postinstall`. لم يتسنّ التحقق من ذلك هنا لأن اتصال npm غير متاح في بيئة التنفيذ.
  - تبويبات Java المتقدمة وأوامر ما قبل/بعد التشغيل وبعض خيارات Legacy لا تُحفظ ولا يُدّعى أنها فعالة؛ تعرض ملاحظة بأنها قيد التطوير. تبويبا الخصوصية والإشعارات يغيّران فقط الخيارات المدعومة فعلياً في `state.js`.
  - تبويبات ريسورس باك/شيدرز/داتا باك، النسخ الاحتياطي للعوالم، مستكشف الملفات داخل التطبيق، وفحص التحديثات ما زالت محدودة أو غير متاحة، وتظهر كميزات قيد التطوير بدلاً من أزرار نجاح شكلية.
- 🧪 فحوص تمت في بيئة التسليم:
  - أضيف `docs/TEST_REPORT.md` ليحفظ نتائج الفحص المنفذة وحدود التحقق وخطوات القبول على جهاز حقيقي.
  - `node scripts/check-project.js` نجح: الهيكل والاستيرادات النسبية، تساوي 476 مفتاح i18n، 60 استدعاء IPC، 3 أحداث، و60 أيقونة SVG.
  - `node --check` لكل ملفات `.js` و`.mjs` نجح، وJSON اللغتين صالح.
  - نجح استيراد وحدات صفحات الواجهة ونجح smoke test لتوليد قوالب 8 صفحات/نوافذ.
  - `npm test` أصبح يشغّل 8 اختبارات آلية: تطابق الترجمة، بناء قوالب الصفحات والنوافذ، الهروب من HTML، ربط منتقي الاستيراد، إعداد عارض السكن، ربط إعدادات Java/RAM بمحرك الإطلاق، وفحص المشروع؛ جميعها نجحت في آخر تشغيل.
  - تمت إضافة `npm test` إلى CI لويندوز ولينكس، وإضافة ملف ترخيص MIT للمشروع وتضمينه في ملفات التطبيق المنشور.
  - لم يتم تشغيل `npm install` أو `npm start` أو فتح Electron فعلياً؛ لذلك لم يتم تأكيد واجهة التشغيل بصرياً أو تشغيل Minecraft من هذا الأرشيف.
- ▶️ الخطوة التالية للنموذج/المراجع:
  1. اقرأ هذا الملف و`docs/API_CONTRACT.md` أولاً.
  2. نفّذ `npm install && npm start` على جهاز يدعم Electron، وراجع أخطاء console وDevTools.
  3. اختبر كل صفحة باللغتين، ومودال إنشاء نسخة Vanilla وFabric وForge وNeoForge وQuilt، وتثبيت محتوى Modrinth وCurseForge (مع API key صالح)، وتغيير سكن أوفلاين.
  4. أصلح أخطاء التشغيل دون إعادة تسمية قنوات IPC أو توسيع العقد بلا داعٍ.
  5. تحقّق من تنفيذ `postinstall` ووجود `src/renderer/vendor/skinview3d.bundle.min.js` بعد `npm install`، واختبر WebGL في Electron.
  6. اختبر Java manager وخيارات RAM/Java/JVM على عدة إصدارات Minecraft، وتحقق من عدم فقد إعدادات اللعبة في `options.txt`.
  7. أكمل دعم Microsoft OAuth بعد إعداد Azure Client ID ومراجعة متطلبات Mojang/Microsoft.
- 🧪 أوامر الاختبار:
  - `npm run check`
  - `npm test`
  - `npm install && npm start`
  - `npm run build` على Windows، و`npm run build:linux` على Linux.

### المرحلة 4 — GitHub readiness / integration review
- ✅ تم: تحديث الإصدار إلى `0.4.0-beta.1`، توحيد الإصدار في الواجهة والحزمة، إضافة فحوص syntax/secrets، وتوسيع الاختبارات لتشمل حدود IPC وأمان النافذة وسياسة المفاتيح وGitHub Releases.
- ✅ تم: قبول IPC فقط من مستند renderer المحلي الرئيسي، قفل التنقل داخل نافذة التطبيق، السماح بالنوافذ الخارجية لـ HTTPS فقط، وتشديد CSP.
- ✅ تم: دعم `keys.local.json` غير المتعقب ومتغيرات البيئة `PRIME_AZURE_CLIENT_ID` و`PRIME_CURSEFORGE_API_KEY` مع إبقاء قوالب المفاتيح العامة فارغة.
- ✅ تم: إضافة GitHub Actions لفحص المصدر والاختبارات وبناء Windows NSIS وLinux AppImage ثم إنشاء GitHub Release تلقائياً عند دفع tag يطابق إصدار `package.json`، وإضافة Dependabot لتحديث اعتمادات npm وGitHub Actions.
- ✅ تم: إضافة README محدث، دليل النشر `docs/GITHUB_PUBLISH.md`، checklist إصدار، سياسة أمان، مساهمة، دعم، Code of Conduct، وقوالب issues وPR.
- ⚠️ غير متحقق: لا يتوفر اتصال بـ npm registry في بيئة التسليم، لذلك لم يتم تثبيت إصدارات Electron 45 أو تشغيل التطبيق أو بناء installer. لم يتم اختبار IPC trust check داخل تطبيق معبأ بعد، والترقية من Electron 33 تحتاج اختبار قبول.
- ⚠️ `package-lock.json` غير موجود. أنشئه بواسطة `npm install` على جهاز متصل بالشبكة وأضفه قبل الإصدار المستقر؛ CI يستخدم npm install حالياً.
- ▶️ التالي: ارفع محتويات هذا المجلد إلى مستودع GitHub حسب `docs/GITHUB_PUBLISH.md`، راقب Actions، نفذ checklist على أجهزة Windows/Linux، ثم أنشئ tag `v0.4.0-beta.1`.
