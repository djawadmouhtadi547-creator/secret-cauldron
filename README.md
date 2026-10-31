# Prime Launcher

**Prime Launcher** لانشر مستقل لـ Minecraft Java بواجهة عربية أولاً (RTL)، من تطوير **Gmu Studios**. المشروع حالياً **نسخة تجريبية قبل الإصدار العام (0.4.0-beta.1)**؛ بعض وظائف Minecraft الحقيقية موجودة في المحرك، وبعض الصفحات أو الخدمات لا تزال تجريبية أو محدودة. اقرأ `HANDOFF.md` و`docs/TEST_REPORT.md` قبل اعتبار أي ميزة جاهزة للإنتاج.

> Prime Launcher غير تابع لـ Mojang Studios أو Microsoft ولا يحظى باعتماد منهما. Minecraft علامة تجارية مملوكة لأصحابها.

## المتطلبات

- Windows 10/11 x64 أو Linux x64 حديث.
- Node.js 22.12 أو أحدث، وnpm 10 أو أحدث.
- اتصال إنترنت لتثبيت الاعتمادات وتنزيل إصدارات Minecraft والمحتوى.
- لا تضع مفاتيح API أو أسرار OAuth في مستودع GitHub.

## التشغيل من المصدر

```bash
npm install
npm run validate
npm start
```

ينفذ `npm install` سكربت `postinstall` لنسخ حزمة `skinview3d` المحلية قبل تشغيل العارض. يجب أن ينتهي التثبيت بنجاح.

## إعداد مفاتيح الخدمات الاختيارية

اترك `keys.json` كما هو؛ فهو ملف نموذجي فارغ. أنشئ نسخة خاصة محلية باسم `keys.local.json` في جذر المشروع، أو ضع الملف نفسه في مجلد بيانات التطبيق `.primelauncher`. هذا الملف مستثنى من Git بواسطة `.gitignore`.

ابدأ من القالب:

```bash
# Windows PowerShell
Copy-Item keys.local.example.json keys.local.json

# Linux
cp keys.local.example.json keys.local.json
```

ثم أضف القيم محلياً:

```json
{
  "azureClientId": "YOUR_AZURE_CLIENT_ID",
  "curseForgeApiKey": "YOUR_CURSEFORGE_API_KEY"
}
```

يمكن بدلاً من ذلك استخدام متغيرات البيئة `PRIME_AZURE_CLIENT_ID` و`PRIME_CURSEFORGE_API_KEY`؛ متغيرات البيئة لها الأولوية على ملفات JSON. لا تحفظ المفاتيح في issue أو pull request أو سجل تشغيل.

## الفحص والبناء

```bash
npm run validate
npm test
npm run build       # Windows x64 NSIS installer — build on Windows
npm run build:linux # Linux x64 AppImage — build on Linux
```

`npm run validate` يجمع فحص بنية المشروع وعقد IPC والترجمة، وصياغة JavaScript، وفحص الأسرار، والاختبارات. لا تدّعي هذه الفحوص وحدها أن Electron أو Minecraft يعملان فعلياً.

## النشر على GitHub

راجع `docs/GITHUB_PUBLISH.md` للحصول على أوامر إنشاء المستودع ورفع المصدر. فحوص GitHub Actions تعمل على Pull Requests ودفعات `main`/`master`. عند دفع tag بصيغة `v*`، يبني GitHub مثبّت Windows وملف Linux AppImage ثم ينشئ GitHub Release ويرفق المخرجات تلقائياً.

أول tag معدّ لهذا الخط هو `v0.4.0-beta.1`. يمكن وضعه بعد مراجعة `docs/RELEASE_CHECKLIST.md` واجتياز اختبارات القبول على جهاز حقيقي.

## الميزات والحالة الحالية

- **Electron + Vanilla JS:** واجهة متعددة الصفحات، عربية RTL وإنجليزية LTR، وثيمات/ألوان وتخطيط قابل للتغيير.
- **المحرك:** تنزيل manifest وإصدارات اللعبة، إدارة نسخ ومحملات، Java، خيارات تشغيل، جلسات وسجلات؛ لم يتم إثبات كل إصدار ومحمّل باختبار لعب end-to-end في بيئة إعداد الأرشيف.
- **الحسابات:** الحساب الأوفلاين متاح. Microsoft OAuth يحتاج Azure app وإكمال التحقق واختبار حساب حقيقي.
- **مركز المحتوى:** يعتمد على Modrinth وCurseForge؛ بعض عمليات التثبيت تعتمد على اتصال الشبكة ومفتاح CurseForge صالح.
- **المكتبة والاستيراد:** دعم استيراد/تصدير MRPack/ZIP موجود في المحرك، لكن يجب اختباره بملفات حقيقية.
- **السكن:** عارض `skinview3d` ينسخ من الاعتماد بعد `npm install`. تطبيق السكن الأوفلاين وخادم السكن يحتاجان تحققاً فعلياً مع العميل.
- **ميزات غير مكتملة/محدودة:** انظر قسم النواقص في `HANDOFF.md` وتقرير `docs/TEST_REPORT.md`.

## المعمارية

- `src/main/`: Electron main process ومحرك تنزيل Minecraft وIPC.
- `src/preload/`: جسر `contextBridge` محدود بواجهات `window.prime`.
- `src/renderer/`: HTML/CSS/JavaScript ES Modules دون framework.
- `docs/API_CONTRACT.md`: العقد المرجعي لقنوات IPC وأشكال البيانات؛ لا تغيّر القنوات من طرف واحد.
- `.github/dependabot.yml`: تحديثات أسبوعية للاعتمادات وإجراءات GitHub.
- `.github/workflows/build.yml`: فحوص المصدر وبناء المثبتات ونشر GitHub Releases.

## التطوير والمساهمة والأمان

- اقرأ `CONTRIBUTING.md` قبل فتح Pull Request.
- أبلغ عن الثغرات باتباع `SECURITY.md`، ولا تنشر تفاصيل قابلة للاستغلال في issue عام.
- الدعم والمشكلات المعروفة موضحة في `SUPPORT.md` و`HANDOFF.md`.
- كود Prime Launcher مرخّص وفق MIT في `LICENSE`؛ راجع `THIRD_PARTY_NOTICES.md` لتراخيص الاعتمادات.
