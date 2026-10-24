import { fileURLToPath } from 'node:url';

/**
 * Loads `apps/api/.env` for local development. Variables already set in the
 * environment win (Node's loadEnvFile does not overwrite them), and there is
 * no such file on Vercel, where variables come from the project settings.
 */
export function loadLocalEnvFile(
  path = fileURLToPath(new URL('../../.env', import.meta.url)),
): 'loaded' | 'absent' {
  try {
    process.loadEnvFile(path);
    return 'loaded';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent';
    throw new Error(`Lecture de ${path} impossible`, { cause: error });
  }
}
