const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AuthGateway = require('../generator.js');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`ok ${passed} - ${name}`); } catch (e) { console.error(`not ok - ${name}`); throw e; } }
function map(result){ return Object.fromEntries(result.files.map(f => [f.path, f.content])); }

test('Next default emits every README path', () => {
  const r = AuthGateway.build({ stack:'next', name:'my-app', db:'postgresql', email:true, google:true, github:true });
  const got = new Set(AuthGateway.sellableFiles(r).map(f=>f.path));
  ['lib/auth.ts','lib/prisma.ts','lib/auth-client.ts','app/api/auth/[...all]/route.ts','components/sign-in-form.tsx','middleware.ts','prisma/schema.prisma','.env.example','INSTALL.md'].forEach(p=>assert.ok(got.has(p), p));
});

test('sqlite switches provider and DATABASE_URL', () => {
  const f=map(AuthGateway.build({stack:'next',db:'sqlite',email:true}));
  assert.match(f['lib/auth.ts'], /provider: "sqlite"/); assert.match(f['prisma/schema.prisma'], /provider = "sqlite"/); assert.match(f['.env.example'], /DATABASE_URL=file:\.\/dev\.db/);
});

test('email off disables Better Auth and removes signIn.email form handler', () => {
  const f=map(AuthGateway.build({stack:'next',email:false,google:true}));
  assert.match(f['lib/auth.ts'], /emailAndPassword: \{ enabled: false \}/); assert.doesNotMatch(f['components/sign-in-form.tsx'], /signIn\.email/); assert.doesNotMatch(f['components/sign-in-form.tsx'], /name="email"/);
});

test('zero providers returns ok:false and no files', () => {
  const r=AuthGateway.build({stack:'next',email:false,google:false,github:false}); assert.equal(r.ok,false); assert.deepEqual(r.files,[]); assert.deepEqual(AuthGateway.sellableFiles(r),[]);
});

test('hostile project name cannot inject HTML or PHP', () => {
  const hostile="a';system('id');//"; const r=AuthGateway.build({stack:'php',name:hostile,db:'mysql',email:true}); const f=map(r);
  assert.equal(r.slug,'a-system-id'); assert.doesNotMatch(f['config.php'], /system\s*\(/); assert.match(f['config.php'], /dbname=a_system_id/); assert.doesNotMatch(f['preview/login.html'], /system\('id'\)/);
});

test('PHP has security primitives, logout exit, and driver-correct schema', () => {
  const s=map(AuthGateway.build({stack:'php',db:'sqlite',email:true})); const m=map(AuthGateway.build({stack:'php',db:'mysql',email:true}));
  assert.match(s['auth.php'], /hash_equals/); assert.match(s['register.php'], /password_hash/); assert.match(s['login.php'], /password_verify/); assert.match(s['auth.php'], /session_regenerate_id\(true\)/); assert.match(s['logout.php'], /exit;/); assert.match(s['schema.sql'], /AUTOINCREMENT/); assert.doesNotMatch(s['schema.sql'], /ENGINE=InnoDB/); assert.match(m['schema.sql'], /AUTO_INCREMENT/); assert.match(m['schema.sql'], /ENGINE=InnoDB/);
});

test('oauth.php only exists with social and completes token flow', () => {
  const off=map(AuthGateway.build({stack:'php',email:true,google:false,github:false})); const on=map(AuthGateway.build({stack:'php',email:true,google:true,github:false}));
  assert.equal(off['oauth.php'],undefined); assert.ok(on['oauth.php']); assert.match(on['oauth.php'], /oauth2\.googleapis\.com\/token/); assert.match(on['oauth.php'], /hash_equals/); assert.match(on['oauth.php'], /login_user\(/); assert.match(on['oauth.php'], /dashboard\.php/); assert.doesNotMatch(on['oauth.php'], /TODO|not implemented|placeholder/i);
});

test('sellable file list excludes preview/login.html', () => {
  const r=AuthGateway.build({stack:'next',email:true}); assert.ok(r.files.some(f=>f.path==='preview/login.html')); assert.ok(!AuthGateway.sellableFiles(r).some(f=>f.path==='preview/login.html'));
});

test('mysql on Next stays postgresql', () => {
  const r=AuthGateway.build({stack:'next',db:'mysql',email:true}); const f=map(r); assert.equal(r.config.db,'postgresql'); assert.match(f['lib/auth.ts'], /provider: "postgresql"/); assert.match(f['prisma/schema.prisma'], /provider = "postgresql"/);
});

test('checkout constant exists and page shows 49 €', () => {
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'); assert.match(html,/const CHECKOUT_URL\s*=\s*"https:\/\/buy\.stripe\.com\/REPLACE"/); assert.match(html,/49 €/); assert.doesNotMatch(html,/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip/); assert.match(html,/vendor\/jszip\.min\.js/);
});

console.log(`${passed}/10`);
assert.equal(passed,10);
