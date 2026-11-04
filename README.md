# Raff · رف

**A clipboard shelf on the edge of your Mac screen.**
Everything you copy — text, links, images, files — waits on a shelf at the edge of the screen. Hover the edge (or press ⌥ Option + C), click a card to paste it, or drag it into any app.

**رف للحافظة على حافة شاشة الماك.** كل ما تنسخه من نصوص وروابط وصور وملفات يُحفظ على رف عند حافة الشاشة. مرّر المؤشر إلى الحافة أو اضغط ⌥ Option + C، ثم انقر أي بطاقة للصقها أو اسحبها إلى أي تطبيق.

Developed by **Mohamed Hassan** · تطوير **محمد حسن**

---

## Download · التنزيل

Get the latest `.dmg` from **[Releases](https://github.com/cdh30234/Raff/releases/latest)** (Apple Silicon).

**First launch** — Raff is not signed with an Apple Developer ID yet, so macOS asks once:
right-click **Raff.app → Open → Open**, or run:

```bash
xattr -dr com.apple.quarantine /Applications/Raff.app
```

To paste with a click, allow Raff in **System Settings → Privacy & Security → Accessibility**.

**أول تشغيل:** انقر بزر الفأرة الأيمن على Raff.app ثم «فتح». وللّصق بالنقر، فعّل Raff في إعدادات النظام ← الخصوصية والأمن ← تسهيلات الاستخدام.

## Updates · التحديثات

Raff checks its releases at launch and every few hours. When a new version is out you get a notification; **Update** downloads it inside the app (checked against the release's SHA-512), and **Restart** installs it and reopens Raff.

يتحقق Raff من وجود إصدار جديد عند التشغيل وكل بضع ساعات، ويصلك إشعار بذلك. زر «تحديث» ينزّل الإصدار داخل التطبيق، وزر «إعادة التشغيل» يثبّته ويعيد فتح التطبيق.

## Build from source · البناء من المصدر

```bash
npm install
npm run build:mac      # → dist/Raff-<version>-mac-arm64.dmg
```

## Publishing a release · نشر إصدار

1. Raise `version` in `package.json` (e.g. `1.0.1`).
2. `npm run release:mac` — builds and uploads the `.dmg`, `.zip` and `latest-mac.yml` to a GitHub release.

Apps already installed see the new version within a few hours (or at their next launch).

## Credits & license · الحقوق والترخيص

Raff is based on **[Edge-Drop](https://github.com/Deepender25/Edge-Drop)** by Deepender25, licensed under the Apache License 2.0. Raff keeps that license (see [LICENSE](LICENSE)) and lists its changes and bundled third-party material in [NOTICE](NOTICE). Raff is not affiliated with or endorsed by Edge-Drop.

The original Edge-Drop README, with its feature tour, is on [the Edge-Drop repository](https://github.com/Deepender25/Edge-Drop#readme).
