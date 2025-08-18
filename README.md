# Interactive Checkout Simulator — Book Purchase (RU)

Однофайловое React‑приложение (Vite + Tailwind), которое **симулирует оформление покупки книги** и показывает, что происходит «под капотом» (идемпотентность, 3‑D Secure, вебхуки).

## Локальный запуск

```bash
npm i
npm run dev
```

## Продакшн-сборка

```bash
npm run build
npm run preview
```

## Развёртывание на GitHub Pages (авто)

1. Залейте проект в новый репозиторий.
2. В Settings → Pages выберите Source: **GitHub Actions**.
3. Запушьте в `main` — сайт соберётся и опубликуется.

URL будет `https://<username>.github.io/<repo>/`.

Vite настроен так, что `base` берётся из `GITHUB_REPOSITORY`.
