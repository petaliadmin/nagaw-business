import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalEnvFile } from './load-env-file.js';

describe('loadLocalEnvFile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nagaw-env-'));

  afterEach(() => {
    delete process.env.NAGAW_TEST_FROM_FILE;
    delete process.env.NAGAW_TEST_ALREADY_SET;
  });

  it('loads the file without overriding variables already set', () => {
    const file = join(dir, '.env');
    writeFileSync(
      file,
      'NAGAW_TEST_FROM_FILE=fichier\nNAGAW_TEST_ALREADY_SET=fichier\n',
    );
    process.env.NAGAW_TEST_ALREADY_SET = 'environnement';
    expect(loadLocalEnvFile(file)).toBe('loaded');
    expect(process.env.NAGAW_TEST_FROM_FILE).toBe('fichier');
    expect(process.env.NAGAW_TEST_ALREADY_SET).toBe('environnement');
  });

  it('is a no-op when there is no file (Vercel)', () => {
    expect(loadLocalEnvFile(join(dir, 'absent.env'))).toBe('absent');
  });

  it('reports a file that exists but cannot be read', () => {
    expect(() => loadLocalEnvFile(dir)).toThrow(/Lecture de/);
  });
});
