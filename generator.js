(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AuthGateway = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const htmlEscape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function slugify(value) {
    return String(value || 'my-app')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'my-app';
  }

  function normalize(input) {
    const c = input || {};
    const stack = c.stack === 'php' ? 'php' : 'next';
    const db = c.db === 'sqlite' ? 'sqlite' : (stack === 'php' && c.db === 'mysql' ? 'mysql' : 'postgresql');
    return {
      stack,
      name: String(c.name || 'my-app'),
      slug: slugify(c.name || 'my-app'),
      db,
      email: c.email !== false,
      google: !!c.google,
      github: !!c.github,
    };
  }

  function previewHtml(c) {
    const name = htmlEscape(c.name);
    const social = [
      c.google ? '<button type="button">Pokračovať cez Google</button>' : '',
      c.github ? '<button type="button">Pokračovať cez GitHub</button>' : '',
    ].join('');
    const form = c.email ? '<form><label>Email<input type="email" autocomplete="email"></label><label>Heslo<input type="password" autocomplete="current-password"></label><button>Prihlásiť sa</button></form>' : '';
    return `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#181611;color:#f4eee4;font:15px system-ui}.card{width:min(390px,90vw);padding:28px;border:1px solid #66543c;border-radius:18px;background:#0f0e0c}h1{margin:0 0 8px}form,label{display:grid;gap:8px}form{margin-top:14px}input,button{padding:11px;border-radius:10px;border:1px solid #66543c;background:#17140f;color:inherit}button{margin-top:8px;cursor:pointer}</style></head><body><main class="card"><h1>${name}</h1><p>${c.stack === 'php' ? 'PHP session brána' : 'Better Auth brána'}</p>${social}${form}</main></body></html>`;
  }

  function nextFiles(c) {
    const provider = c.db === 'sqlite' ? 'sqlite' : 'postgresql';
    const dbUrl = provider === 'sqlite' ? 'file:./dev.db' : 'postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public';
    const socialLines = [];
    if (c.google) socialLines.push('    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }');
    if (c.github) socialLines.push('    github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! }');
    const socialBlock = socialLines.length ? `\n  socialProviders: {\n${socialLines.join(',\n')}\n  },` : '';

    const auth = `import { betterAuth } from "better-auth";\nimport { prismaAdapter } from "better-auth/adapters/prisma";\nimport { nextCookies } from "better-auth/next-js";\nimport { prisma } from "@/lib/prisma";\n\nexport const auth = betterAuth({\n  database: prismaAdapter(prisma, { provider: "${provider}" }),\n  emailAndPassword: { enabled: ${c.email} },${socialBlock}\n  plugins: [nextCookies()],\n});\n`;

    const prismaLib = `import { PrismaClient } from "@prisma/client";\n\nconst globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };\n\nexport const prisma = globalForPrisma.prisma ?? new PrismaClient();\n\nif (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;\n`;

    const authClient = `import { createAuthClient } from "better-auth/react";\n\nexport const authClient = createAuthClient();\nexport const { signIn, signUp, signOut, useSession } = authClient;\n`;

    const route = `import { auth } from "@/lib/auth";\nimport { toNextJsHandler } from "better-auth/next-js";\n\nexport const { GET, POST } = toNextJsHandler(auth);\n`;

    const emailUi = c.email ? `\n      <form\n        className="space-y-3"\n        onSubmit={async (event) => {\n          event.preventDefault();\n          const data = new FormData(event.currentTarget);\n          await signIn.email({\n            email: String(data.get("email") || ""),\n            password: String(data.get("password") || ""),\n          });\n        }}\n      >\n        <input name="email" type="email" autoComplete="email" required placeholder="email@firma.sk" />\n        <input name="password" type="password" autoComplete="current-password" required placeholder="Heslo" />\n        <button type="submit">Prihlásiť sa</button>\n      </form>` : '';
    const googleUi = c.google ? '\n      <button type="button" onClick={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}>Google</button>' : '';
    const githubUi = c.github ? '\n      <button type="button" onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}>GitHub</button>' : '';
    const signInImport = (c.google || c.github || c.email) ? 'import { signIn } from "@/lib/auth-client";\n\n' : '';
    const form = `"use client";\n\n${signInImport}export function SignInForm() {\n  return (\n    <div className="space-y-3">${googleUi}${githubUi}${emailUi}\n    </div>\n  );\n}\n`;

    const middleware = `import { NextRequest, NextResponse } from "next/server";\nimport { getSessionCookie } from "better-auth/cookies";\n\nexport function middleware(request: NextRequest) {\n  const sessionCookie = getSessionCookie(request);\n  if (!sessionCookie) {\n    const url = new URL("/", request.url);\n    url.searchParams.set("next", request.nextUrl.pathname);\n    return NextResponse.redirect(url);\n  }\n  return NextResponse.next();\n}\n\nexport const config = { matcher: ["/dashboard/:path*"] };\n`;

    const schema = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}\n\nmodel User {\n  id            String    @id\n  name          String\n  email         String    @unique\n  emailVerified Boolean   @default(false)\n  image         String?\n  createdAt     DateTime  @default(now())\n  updatedAt     DateTime  @updatedAt\n  sessions      Session[]\n  accounts      Account[]\n\n  @@map("user")\n}\n\nmodel Session {\n  id        String   @id\n  expiresAt DateTime\n  token     String   @unique\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  ipAddress String?\n  userAgent String?\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@map("session")\n}\n\nmodel Account {\n  id                    String    @id\n  accountId             String\n  providerId            String\n  userId                String\n  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  accessToken           String?\n  refreshToken          String?\n  idToken               String?\n  accessTokenExpiresAt  DateTime?\n  refreshTokenExpiresAt DateTime?\n  scope                 String?\n  password              String?\n  createdAt             DateTime  @default(now())\n  updatedAt             DateTime  @updatedAt\n\n  @@map("account")\n}\n\nmodel Verification {\n  id         String   @id\n  identifier String\n  value      String\n  expiresAt  DateTime\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  @@map("verification")\n}\n`;

    const env = `BETTER_AUTH_SECRET=replace-me\nBETTER_AUTH_URL=http://localhost:3000\nDATABASE_URL=${dbUrl}\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nGITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET=\n`;

    const install = `# INSTALL\n\n1. Copy the auth-gateway folder contents into your Next.js App Router project.\n2. Install runtime packages:\n\n   npm i better-auth @prisma/client\n\n3. Install Prisma as a dev dependency:\n\n   npm i -D prisma\n\n4. Copy .env.example to .env and create a secret:\n\n   openssl rand -base64 32\n\n5. Set BETTER_AUTH_URL, DATABASE_URL and any enabled OAuth client credentials.\n6. Apply the included schema and generate the client:\n\n   npx prisma db push\n   npx prisma generate\n\n7. Start your app and test sign-in before deployment.\n\nDatabase mode selected by this ZIP: ${provider}. Selecting MySQL in the generator never switches the Next.js stack to MySQL; non-SQLite Next.js output stays PostgreSQL.\n\nBetter Auth schemas evolve. If your installed Better Auth version produces a different schema, \`npx @better-auth/cli generate\` wins over this bundled schema. Review the diff before applying it.\n`;

    return [
      ['lib/auth.ts', auth],
      ['lib/prisma.ts', prismaLib],
      ['lib/auth-client.ts', authClient],
      ['app/api/auth/[...all]/route.ts', route],
      ['components/sign-in-form.tsx', form],
      ['middleware.ts', middleware],
      ['prisma/schema.prisma', schema],
      ['.env.example', env],
      ['INSTALL.md', install],
      ['preview/login.html', previewHtml(c)],
    ].map(([path, content]) => ({ path, content }));
  }

  function phpFiles(c) {
    const driver = c.db === 'sqlite' ? 'sqlite' : 'mysql';
    const sqliteDsn = `sqlite:${c.slug}.sqlite`;
    const mysqlDsn = `mysql:host=127.0.0.1;dbname=${c.slug.replace(/-/g, '_')};charset=utf8mb4`;
    const config = `<?php\ndeclare(strict_types=1);\n\nreturn [\n  'db' => [\n    'driver' => '${driver}',\n    'dsn' => getenv('DATABASE_URL') ?: '${driver === 'sqlite' ? sqliteDsn : mysqlDsn}',\n    'user' => getenv('DB_USER') ?: 'root',\n    'pass' => getenv('DB_PASS') ?: '',\n  ],\n  'app_url' => rtrim(getenv('APP_URL') ?: 'http://localhost:8000', '/'),\n  'google' => [\n    'enabled' => ${c.google ? 'true' : 'false'},\n    'id' => getenv('GOOGLE_CLIENT_ID') ?: '',\n    'secret' => getenv('GOOGLE_CLIENT_SECRET') ?: '',\n  ],\n  'github' => [\n    'enabled' => ${c.github ? 'true' : 'false'},\n    'id' => getenv('GITHUB_CLIENT_ID') ?: '',\n    'secret' => getenv('GITHUB_CLIENT_SECRET') ?: '',\n  ],\n];\n`;

    const auth = `<?php\ndeclare(strict_types=1);\n\nfunction config(): array { static $c; return $c ??= require __DIR__ . '/config.php'; }\n\nfunction db(): PDO {\n  static $pdo;\n  if ($pdo instanceof PDO) return $pdo;\n  $c = config()['db'];\n  $pdo = new PDO($c['dsn'], $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);\n  return $pdo;\n}\n\nfunction start_session(): void {\n  if (session_status() !== PHP_SESSION_ACTIVE) {\n    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']), 'samesite' => 'Lax']);\n    session_start();\n  }\n}\n\nfunction csrf_token(): string {\n  start_session();\n  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));\n  return (string) $_SESSION['csrf'];\n}\n\nfunction csrf_check(): void {\n  start_session();\n  if (!isset($_POST['csrf'], $_SESSION['csrf']) || !hash_equals((string) $_SESSION['csrf'], (string) $_POST['csrf'])) { http_response_code(419); exit('CSRF'); }\n}\n\nfunction current_user(): ?array {\n  start_session();\n  if (empty($_SESSION['uid'])) return null;\n  $st = db()->prepare('SELECT id, email, name FROM users WHERE id = ?');\n  $st->execute([$_SESSION['uid']]);\n  return $st->fetch() ?: null;\n}\n\nfunction login_user(int $id): void {\n  start_session();\n  session_regenerate_id(true);\n  $_SESSION['uid'] = $id;\n}\n\nfunction require_user(): array {\n  $u = current_user();\n  if (!$u) { header('Location: login.php'); exit; }\n  return $u;\n}\n\nfunction h(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }\n`;

    const loginSocial = c.google || c.github ? `\n<div class="social">${c.google ? '<a class="button" href="oauth.php?provider=google">Google</a>' : ''}${c.github ? '<a class="button" href="oauth.php?provider=github">GitHub</a>' : ''}</div>` : '';
    const loginEmail = c.email ? `\n<form method="post"><input type="hidden" name="csrf" value="<?= h($token) ?>"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Heslo<input name="password" type="password" required autocomplete="current-password"></label><button type="submit">Prihlásiť sa</button></form><p><a href="register.php">Vytvoriť účet</a></p>` : '';
    const login = `<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/auth.php';\nstart_session();\nif (current_user()) { header('Location: dashboard.php'); exit; }\n$error = '';\n${c.email ? `if ($_SERVER['REQUEST_METHOD'] === 'POST') {\n  csrf_check();\n  $email = strtolower(trim((string) ($_POST['email'] ?? '')));\n  $password = (string) ($_POST['password'] ?? '');\n  $st = db()->prepare('SELECT id, password_hash FROM users WHERE email = ?');\n  $st->execute([$email]);\n  $user = $st->fetch();\n  if ($user && !empty($user['password_hash']) && password_verify($password, (string) $user['password_hash'])) { login_user((int) $user['id']); header('Location: dashboard.php'); exit; }\n  $error = 'Nesprávny email alebo heslo';\n}\n` : ''}$token = csrf_token();\n?>\n<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="assets/auth.css"><title>Prihlásenie</title></head><body><main class="card"><h1>Prihlásenie</h1><?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>${loginSocial}${loginEmail}</main></body></html>\n`;

    const register = `<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/auth.php';\nstart_session();\n$error = '';\nif ($_SERVER['REQUEST_METHOD'] === 'POST') {\n  csrf_check();\n  $email = strtolower(trim((string) ($_POST['email'] ?? '')));\n  $name = trim((string) ($_POST['name'] ?? ''));\n  $password = (string) ($_POST['password'] ?? '');\n  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) { $error = 'Použi platný email a heslo s aspoň 8 znakmi.'; }\n  else {\n    $hash = password_hash($password, PASSWORD_DEFAULT);\n    try {\n      $st = db()->prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');\n      $st->execute([$email, $name ?: $email, $hash]);\n      login_user((int) db()->lastInsertId());\n      header('Location: dashboard.php'); exit;\n    } catch (PDOException $e) { $error = 'Účet s týmto emailom už môže existovať.'; }\n  }\n}\n$token = csrf_token();\n?>\n<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="assets/auth.css"><title>Registrácia</title></head><body><main class="card"><h1>Registrácia</h1><?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?><form method="post"><input type="hidden" name="csrf" value="<?= h($token) ?>"><label>Meno<input name="name" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Heslo<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button type="submit">Vytvoriť účet</button></form></main></body></html>\n`;

    const dashboard = `<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/auth.php';\n$user = require_user();\n?>\n<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="assets/auth.css"><title>Dashboard</title></head><body><main class="card"><h1>Dashboard</h1><p>Prihlásený: <?= h((string) $user['email']) ?></p><a class="button" href="logout.php">Odhlásiť</a></main></body></html>\n`;

    const logout = `<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/auth.php';\nstart_session();\n$_SESSION = [];\nif (ini_get('session.use_cookies')) { $p = session_get_cookie_params(); setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']); }\nsession_destroy();\nheader('Location: login.php');\nexit;\n`;

    const sqliteSchema = `CREATE TABLE IF NOT EXISTS users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  email TEXT NOT NULL UNIQUE,\n  name TEXT NOT NULL,\n  password_hash TEXT NULL,\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n`;
    const mysqlSchema = `CREATE TABLE IF NOT EXISTS users (\n  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,\n  email VARCHAR(320) NOT NULL,\n  name VARCHAR(191) NOT NULL,\n  password_hash VARCHAR(255) NULL,\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  PRIMARY KEY (id),\n  UNIQUE KEY users_email_unique (email)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`;

    const css = `:root{font-family:Inter,system-ui,sans-serif;color:#f5efe5;background:#171510}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(420px,100%);background:#0f0e0c;border:1px solid #5e4b34;border-radius:18px;padding:28px}form,label{display:grid;gap:8px}form{gap:14px;margin-top:16px}input,button,.button{font:inherit;padding:11px 12px;border-radius:10px;border:1px solid #5e4b34;background:#19160f;color:inherit}button,.button{cursor:pointer;text-decoration:none;display:inline-block;text-align:center}.social{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.error{color:#ffb4a8}a{color:#e5bd80}`;

    const install = `# INSTALL\n\n1. Copy all files from auth-gateway into a PHP 8.1+ web root.\n2. Create the database and run schema.sql.\n3. Configure environment variables as needed:\n\n   DATABASE_URL\n   DB_USER\n   DB_PASS\n   APP_URL\n   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET\n   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET\n\n4. For SQLite, make the directory writable by PHP. For MySQL, create the database named ${c.slug.replace(/-/g, '_')} or override DATABASE_URL.\n5. OAuth callback URL for enabled social providers is APP_URL/oauth.php?provider=google or APP_URL/oauth.php?provider=github.\n6. Use HTTPS in production.\n\nThis is a compact authentication gateway starter, not a certified security audit. Review deployment headers, rate limiting, mail verification and your privacy/legal requirements for the target app.\n`;

    const files = [
      ['config.php', config], ['auth.php', auth], ['login.php', login], ['register.php', register],
      ['dashboard.php', dashboard], ['logout.php', logout], ['schema.sql', driver === 'sqlite' ? sqliteSchema : mysqlSchema],
      ['assets/auth.css', css], ['INSTALL.md', install], ['preview/login.html', previewHtml(c)],
    ];

    if (c.google || c.github) {
      const oauth = `<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/auth.php';\nstart_session();\n\n$provider = (string) ($_GET['provider'] ?? '');\nif (!in_array($provider, ['google', 'github'], true) || empty(config()[$provider]['enabled'])) { http_response_code(404); exit('OAuth provider disabled'); }\n$c = config();\n$clientId = (string) $c[$provider]['id'];\n$clientSecret = (string) $c[$provider]['secret'];\nif ($clientId === '' || $clientSecret === '') { http_response_code(500); exit('OAuth client configuration missing'); }\n$redirectUri = $c['app_url'] . '/oauth.php?provider=' . rawurlencode($provider);\n\nfunction http_post_form(string $url, array $fields, array $headers = []): array {\n  $ch = curl_init($url);\n  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields), CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers), CURLOPT_TIMEOUT => 15]);\n  $body = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);\n  if (!is_string($body) || $status < 200 || $status >= 300) { http_response_code(502); exit('OAuth token exchange failed'); }\n  $json = json_decode($body, true); return is_array($json) ? $json : [];\n}\nfunction http_get_json(string $url, array $headers): array {\n  $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers), CURLOPT_TIMEOUT => 15, CURLOPT_USERAGENT => 'auth-gateway']);\n  $body = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);\n  if (!is_string($body) || $status < 200 || $status >= 300) { http_response_code(502); exit('OAuth profile request failed'); }\n  $json = json_decode($body, true); return is_array($json) ? $json : [];\n}\n\nif (!isset($_GET['code'])) {\n  $state = bin2hex(random_bytes(32)); $_SESSION['oauth_state'] = $state; $_SESSION['oauth_provider'] = $provider;\n  if ($provider === 'google') {\n    $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query(['client_id' => $clientId, 'redirect_uri' => $redirectUri, 'response_type' => 'code', 'scope' => 'openid email profile', 'state' => $state, 'access_type' => 'online']);\n  } else {\n    $url = 'https://github.com/login/oauth/authorize?' . http_build_query(['client_id' => $clientId, 'redirect_uri' => $redirectUri, 'scope' => 'read:user user:email', 'state' => $state]);\n  }\n  header('Location: ' . $url); exit;\n}\n\n$state = (string) ($_GET['state'] ?? '');\nif (empty($_SESSION['oauth_state']) || empty($_SESSION['oauth_provider']) || !hash_equals((string) $_SESSION['oauth_state'], $state) || !hash_equals((string) $_SESSION['oauth_provider'], $provider)) { http_response_code(419); exit('OAuth state mismatch'); }\nunset($_SESSION['oauth_state'], $_SESSION['oauth_provider']);\n$code = (string) $_GET['code'];\n\nif ($provider === 'google') {\n  $token = http_post_form('https://oauth2.googleapis.com/token', ['client_id' => $clientId, 'client_secret' => $clientSecret, 'code' => $code, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirectUri]);\n  $access = (string) ($token['access_token'] ?? '');\n  $profile = http_get_json('https://openidconnect.googleapis.com/v1/userinfo', ['Authorization: Bearer ' . $access]);\n  $email = strtolower(trim((string) ($profile['email'] ?? ''))); $name = trim((string) ($profile['name'] ?? $email));\n} else {\n  $token = http_post_form('https://github.com/login/oauth/access_token', ['client_id' => $clientId, 'client_secret' => $clientSecret, 'code' => $code, 'redirect_uri' => $redirectUri]);\n  $access = (string) ($token['access_token'] ?? '');\n  $profile = http_get_json('https://api.github.com/user', ['Authorization: Bearer ' . $access]);\n  $email = strtolower(trim((string) ($profile['email'] ?? '')));\n  if ($email === '') {\n    $emails = http_get_json('https://api.github.com/user/emails', ['Authorization: Bearer ' . $access]);\n    foreach ($emails as $item) { if (!empty($item['primary']) && !empty($item['verified']) && !empty($item['email'])) { $email = strtolower((string) $item['email']); break; } }\n  }\n  $name = trim((string) ($profile['name'] ?? $profile['login'] ?? $email));\n}\nif (!filter_var($email, FILTER_VALIDATE_EMAIL)) { http_response_code(422); exit('OAuth provider did not return a usable email'); }\n\n$st = db()->prepare('SELECT id FROM users WHERE email = ?'); $st->execute([$email]); $user = $st->fetch();\nif ($user) { $uid = (int) $user['id']; }\nelse { $ins = db()->prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, NULL)'); $ins->execute([$email, $name ?: $email]); $uid = (int) db()->lastInsertId(); }\nlogin_user($uid); header('Location: dashboard.php'); exit;\n`;
      files.splice(8, 0, ['oauth.php', oauth]);
    }

    return files.map(([path, content]) => ({ path, content }));
  }

  function build(input) {
    const c = normalize(input);
    if (!c.email && !c.google && !c.github) return { ok: false, files: [], config: c, slug: c.slug, filename: `${c.slug}-${c.stack}-auth.zip` };
    const files = c.stack === 'php' ? phpFiles(c) : nextFiles(c);
    return { ok: true, files, config: c, slug: c.slug, filename: `${c.slug}-${c.stack}-auth.zip` };
  }

  function sellableFiles(input) {
    const result = input && Array.isArray(input.files) ? input : build(input);
    if (!result.ok) return [];
    return result.files.filter((file) => file.path !== 'preview/login.html');
  }

  return { build, sellableFiles, slugify, htmlEscape };
});
