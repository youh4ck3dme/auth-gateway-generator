# Auth Gateway Generator

Statická PWA, ktorá lokálne v prehliadači vygeneruje predajný auth ZIP. Cena produktu je **49 € jednorazovo, lifetime pre túto verziu**. Checkout URL je jediný konfiguračný payment hook v `index.html` (`CHECKOUT_URL`). Aplikácia nemá účty, licenčný backend ani predstierané webhook overenie.

## Spustenie

```bash
npx serve .
```

## Testy

```bash
node tests/regression.test.js
```

Očakávaný výsledok: `10/10`.

## Next.js ZIP

Root archívu je `auth-gateway/` a predajný ZIP obsahuje:

- `lib/auth.ts`
- `lib/prisma.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`
- `components/sign-in-form.tsx`
- `middleware.ts`
- `prisma/schema.prisma`
- `.env.example`
- `INSTALL.md`

`preview/login.html` slúži iba pre UI generátora a do predajného ZIPu nejde. SQLite nastaví Prisma provider `sqlite` a `DATABASE_URL=file:./dev.db`; každý iný výber pre Next.js ostáva `postgresql`, vrátane voľby MySQL v UI.

## PHP ZIP

Vždy obsahuje:

- `config.php`
- `auth.php`
- `login.php`
- `register.php`
- `dashboard.php`
- `logout.php`
- `schema.sql`
- `assets/auth.css`
- `INSTALL.md`

Ak je zapnutý Google alebo GitHub, pridá sa `oauth.php` s authorize redirectom, `hash_equals` kontrolou state, server-side token exchange, načítaním emailu, upsertom používateľa, `login_user()` a redirectom na dashboard. Bez social providerov `oauth.php` nevznikne.

## ZIP a PWA

ZIP sa skladá lokálne cez `vendor/jszip.min.js`; produkcia nepoužíva CDN pre ZIP knižnicu. Service worker precacheuje `generator.js` aj vendored ZIP knižnicu.

## Pred ostrým predajom

V `index.html` nahraď `https://buy.stripe.com/REPLACE` reálnym Stripe Payment Linkom alebo Gumroad URL a doplň obchodné meno, IČO a povinné právne údaje. Repozitár žiadne IČO nevymýšľa.
