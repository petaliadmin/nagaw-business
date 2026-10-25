#!/usr/bin/env node
// Fails when a privileged secret reaches what a browser can download from
// the web app: client JavaScript and prerendered pages (MVP criterion,
// docs/ROADMAP.md). CI builds the web app with the CANARIES below set as
// environment variables; none of them may appear in the output.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CANARIES = {
  API_PROTECTION_BYPASS: 'canary-api-protection-bypass-7f3a91',
  SUPABASE_SERVICE_ROLE_KEY: 'canary-supabase-service-role-2c8e40',
  SUPABASE_SECRET_KEY: 'canary-supabase-secret-key-9b1d72',
  DATABASE_URL:
    'postgres://canary:canary-db-password-5e6f13@db.invalid:5432/postgres',
};

/**
 * Base64 of `text` wherever it starts in the encoded data: three shifts,
 * without the edge characters that depend on the neighbouring bytes.
 */
function base64Variants(text) {
  return [0, 1, 2].map((shift) => {
    const encoded = Buffer.from('x'.repeat(shift) + text).toString('base64');
    const start = Math.ceil((shift * 4) / 3);
    const end = Math.floor(((shift + text.length) * 4) / 3);
    // Standard or URL-safe alphabet (JWTs use the latter).
    return encoded
      .slice(start, end)
      .replace(/[+/]/g, (c) => (c === '+' ? '[+-]' : '[/_]'));
  });
}

// Shapes of privileged keys, whatever their value.
const SERVICE_ROLE = base64Variants('"role":"service_role"').join('|');
const PATTERNS = [
  {
    name: 'Supabase service_role JWT',
    re: new RegExp(`${SERVICE_ROLE}|"role"\\s*:\\s*"service_role"`),
  },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  {
    name: 'Postgres connection string',
    re: /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`@]+@/,
  },
];

/** Names of the secrets found in `text`: canaries and key shapes. */
export function findSecrets(text) {
  return [
    ...Object.entries(CANARIES)
      .filter(([, value]) => text.includes(value))
      .map(([name]) => `valeur de ${name}`),
    ...PATTERNS.filter(({ re }) => re.test(text)).map(({ name }) => name),
  ];
}

const EXTENSIONS = /\.(js|mjs|css|html|rsc|body|json|txt|map)$/;

function files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return EXTENSIONS.test(name) ? [path] : [];
  });
}

function main(root) {
  // What is served to browsers: static assets and prerendered pages.
  const scanned = [join(root, 'static'), join(root, 'server', 'app')]
    .flatMap(files)
    .filter(
      // Server bundles of route handlers run on the server only.
      (path) => !path.includes(join('server', 'app')) || !path.endsWith('.js'),
    );
  if (scanned.length === 0) {
    console.error(
      `Aucun fichier à vérifier dans ${root} : lancez d'abord le build.`,
    );
    process.exit(2);
  }
  const findings = scanned.flatMap((path) =>
    findSecrets(readFileSync(path, 'utf8')).map(
      (finding) => `${relative('.', path)} : ${finding}`,
    ),
  );
  if (findings.length > 0) {
    console.error('Secret trouvé dans ce que le navigateur télécharge :');
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exit(1);
  }
  console.log(
    `Aucun secret dans ${scanned.length} fichiers servis au navigateur.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv[2] ?? 'apps/web/.next');
