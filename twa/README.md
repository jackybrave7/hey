# HEY TWA — Android-обёртка (Trusted Web Activity)

PWA уже работает: с Android Chrome пользователь может «Добавить на главный экран»
и получить standalone-режим. Папка `twa/` нужна когда мы хотим:

- Опубликовать в Google Play.
- Раздавать APK напрямую (sideload).
- Убрать адресную строку Chrome Custom Tabs (через Digital Asset Links).

## Что готово

- `twa-manifest.json` — конфиг для Bubblewrap, привязан к
  `https://hey-messenger.ru/manifest.webmanifest`.
- `nginx` проксирует `https://hey-messenger.ru/.well-known/assetlinks.json`
  с проде — нужен для верификации связки домен↔APK.
- Подписной keystore лежит на проде в `/root/hey-twa/android.keystore`.
  Пароль: `HeyTwa-2026-AABBccdd-keystore`. **Не теряй** — без него
  обновлённый APK не установится поверх уже установленного.

## SHA-256 fingerprint (upload key)

```
DC:98:1E:14:8E:9B:44:44:CA:20:8F:D7:3D:AE:B6:A1:78:C7:8D:5A:76:F9:4B:B8:7F:E1:5F:8E:E6:5A:81:06
```

Этот fingerprint уже подставлен в `/.well-known/assetlinks.json` на проде —
работает для **прямой раздачи APK** (sideload через `adb install` или
скачивание .apk на телефон).

Когда зарегистрируешь приложение в **Google Play Console**, Play App Signing
заменит подпись на свою. Тогда возьми SHA-256 нового сертификата
из «Setup → App integrity → App signing key certificate» и **добавь его
вторым** в `assetlinks.json` (массив можно расширить — оба сертификата
будут валидны одновременно). Это нужно чтобы Custom Tabs убрала
адресную строку.

## Сборка APK (на dev-машине с JDK 17 + Android SDK)

```bash
cd twa
# 1. Сгенерим Android-проект из twa-manifest.json
bubblewrap init --manifest=https://hey-messenger.ru/manifest.webmanifest

# 2. Скопируй сюда подписной keystore с прода
scp root@72.56.16.44:/root/hey-twa/android.keystore .

# 3. Билд (попросит пароли — оба раза: HeyTwa-2026-AABBccdd-keystore)
bubblewrap build

# На выходе:
#   app-release-signed.apk    — для прямой раздачи / sideload
#   app-release-bundle.aab    — для Google Play (.aab вместо APK)
```

Если на dev-машине нет JDK — `bubblewrap doctor` предложит установить
свой JDK + Android SDK (~1–2 ГБ).

## Альтернатива: PWABuilder.com

Зайти на https://www.pwabuilder.com, ввести `https://hey-messenger.ru`,
нажать «Package for stores → Android». Сервис сгенерит подписной APK +
AAB + готовый `assetlinks.json`. Имя пакета: `ru.hey_messenger.twa`.
Подсунет свой keystore — пароли получишь zip-архивом, их потом нельзя
будет восстановить.

## Sideload-инструкция (для тестов без Play)

1. Скачать `app-release-signed.apk` на Android-телефон.
2. Перейти в Settings → Security → Install unknown apps → разрешить
   браузеру / файловому менеджеру.
3. Тапнуть `.apk`, подтвердить установку.
4. Открыть «HEY» с домашнего экрана.

## Версионирование

При выпуске обновления:
- `appVersionName` — semver «1.0.1», виден юзеру.
- `appVersionCode` — целое, **должно расти монотонно** (Play не примет
  apk с тем же или меньшим code).

Обновить версию: отредактируй `twa-manifest.json`, потом
`bubblewrap update && bubblewrap build`.
