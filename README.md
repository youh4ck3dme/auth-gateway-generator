# Auth Gateway Generator

Statický PWA blueprint. Jedným tlačidlom vygeneruje platnú Better Auth bránu pre Next.js App Router.

Tento priečinok je **samotný generátor**. ZIP, ktorý appka vypľuje, je **auth kód do nového projektu**.

## Spustenie lokálne

Otvor `index.html` v prehliadači, alebo:

```bash
npx serve .
```

## Deploy na store / hosting (generátor)

Všetko je statické. Žiadny backend.

### Vercel
```bash
npx vercel .
```

### Netlify
```bash
npx netlify deploy --prod --dir .
```

### GitHub Pages
1. Push tento priečinok do repo
2. Settings → Pages → Deploy from branch `/` alebo `/docs`
3. Ak je projekt v podpriečinku, skontroluj relatívne cesty (`./sw.js`, `./manifest.webmanifest`)

### Cloudflare Pages
Upload priečinka alebo napoj Git. Build command nechaj prázdny, output `.`

### Capacitor → Play Store / App Store
```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init AuthGate com.example.authgate --web-dir .
npx cap add android
npx cap add ios
npx cap sync
```
Potom otvor Android Studio / Xcode a buildni store bundle.

### PWA install
HTTPS hosting + manifest + service worker. Tlačidlo „Nainštalovať PWA“ sa ukáže, keď prehliadač pošle `beforeinstallprompt`.

## Čo brána obsahuje

- `lib/auth.ts` — Better Auth + Prisma adapter + `nextCookies`
- `app/api/auth/[...all]/route.ts` — oficiálny Next handler
- `lib/auth-client.ts` — React client
- `components/sign-in-form.tsx` — Google / GitHub / email
- `middleware.ts` — ochrana `/dashboard` cez session cookie
- `prisma/schema.prisma` — Better Auth tabuľky
- `.env.example` + `INSTALL.md`

## Stack brány

Next.js App Router · TypeScript · Better Auth · Prisma · PostgreSQL alebo SQLite
