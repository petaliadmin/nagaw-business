import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditActionLabel } from './labels';

const API_SRC = join(__dirname, '../../../api/src');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

describe('history labels', () => {
  it('gives every action the API records a label in French', () => {
    const actions = new Set<string>();
    for (const file of sources(API_SRC)) {
      const text = readFileSync(file, 'utf8');
      // `action: 'invoice.issued'` and `? 'a.b' : 'c.d'` in audit entries.
      for (const match of text.matchAll(
        /action:[^,]*?'([a-z_]+\.[a-z_]+)'(?:\s*:\s*'([a-z_]+\.[a-z_]+)')?/g,
      )) {
        actions.add(match[1]!);
        if (match[2]) actions.add(match[2]);
      }
    }
    expect(actions.size).toBeGreaterThan(40);
    const missing = [...actions].filter((a) => auditActionLabel(a) === a);
    expect(missing).toEqual([]);
  });
});
