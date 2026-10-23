import { describe, expect, it } from 'vitest';
import {
  AGENT_ROLE_LABELS,
  agentConfigurationSchema,
  buildAgentBrief,
  canTransition,
  checkAgentConfiguration,
  createAgentSchema,
  ERROR_POLICY_LABELS,
  updateAgentSchema,
} from './agents.js';

const caps = { maxSteps: 20, maxDurationSeconds: 600 };
const good = {
  instructions: 'Relancer les devis restés sans réponse depuis 7 jours.',
  objectives: 'Aucun devis sans suivi.',
  maxSteps: 10,
  maxDurationSeconds: 300,
  tools: [],
};

describe('agentConfigurationSchema', () => {
  it('trims text, coerces numbers and defaults tools', () => {
    expect(
      agentConfigurationSchema.parse({
        instructions: '  Faire X  ',
        objectives: ' Y ',
        maxSteps: '5',
        maxDurationSeconds: '60',
        errorPolicy: 'stop',
      }),
    ).toEqual({
      instructions: 'Faire X',
      objectives: 'Y',
      maxSteps: 5,
      maxDurationSeconds: 60,
      errorPolicy: 'stop',
      tools: [],
    });
  });

  it('rejects unknown and duplicate tools, out-of-bound limits and extra fields', () => {
    const base = { ...good, errorPolicy: 'stop' };
    for (const value of [
      { ...base, tools: ['shell.exec'] },
      { ...base, tools: ['email.send', 'email.send'] },
      { ...base, maxSteps: 0 },
      { ...base, maxDurationSeconds: 99_999 },
      { ...base, model: 'gpt' },
    ]) {
      expect(agentConfigurationSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('createAgentSchema / updateAgentSchema', () => {
  it('requires a known role and a name', () => {
    expect(
      createAgentSchema.safeParse({
        name: 'A',
        description: '',
        roleKey: 'sales',
        configuration: { ...good, errorPolicy: 'stop' },
      }).success,
    ).toBe(false);
    expect(
      createAgentSchema.safeParse({
        name: 'Agent commercial',
        description: '',
        roleKey: 'wizard',
        configuration: { ...good, errorPolicy: 'stop' },
      }).success,
    ).toBe(false);
  });

  it('refuses status or organization in an identity update', () => {
    expect(updateAgentSchema.safeParse({}).success).toBe(false);
    expect(updateAgentSchema.safeParse({ status: 'active' }).success).toBe(
      false,
    );
    expect(updateAgentSchema.safeParse({ name: 'Nouveau nom' }).success).toBe(
      true,
    );
  });
});

describe('checkAgentConfiguration', () => {
  it('passes a complete configuration, with honest warnings', () => {
    const checks = checkAgentConfiguration({ status: 'draft' }, good, caps);
    expect(checks.filter((c) => c.severity === 'error')).toEqual([]);
    expect(checks.map((c) => c.code)).toEqual(['NO_AI_MODEL', 'NO_TOOLS']);
  });

  it('blocks short instructions, missing objectives, caps and unavailable tools', () => {
    const checks = checkAgentConfiguration(
      { status: 'archived' },
      {
        instructions: 'trop court',
        objectives: '  ',
        maxSteps: 50,
        maxDurationSeconds: 900,
        tools: ['email.send'],
      },
      caps,
    );
    expect(
      checks.filter((c) => c.severity === 'error').map((c) => c.code),
    ).toEqual([
      'AGENT_ARCHIVED',
      'INSTRUCTIONS_TOO_SHORT',
      'OBJECTIVES_MISSING',
      'TOOL_UNAVAILABLE',
      'MAX_STEPS_ABOVE_CAP',
      'MAX_DURATION_ABOVE_CAP',
    ]);
  });
});

describe('canTransition', () => {
  it('follows the agent life cycle; archiving is final', () => {
    expect(canTransition('draft', 'active')).toBe(true);
    expect(canTransition('active', 'suspended')).toBe(true);
    expect(canTransition('suspended', 'active')).toBe(true);
    expect(canTransition('active', 'draft')).toBe(false);
    expect(canTransition('draft', 'suspended')).toBe(false);
    for (const to of ['draft', 'active', 'suspended'] as const) {
      expect(canTransition('archived', to)).toBe(false);
    }
  });
});

describe('buildAgentBrief', () => {
  it('assembles the configuration without inventing anything', () => {
    const brief = buildAgentBrief(
      { name: 'Awa', roleKey: 'sales' },
      { ...good, errorPolicy: 'escalate' },
      { role: AGENT_ROLE_LABELS, errorPolicy: ERROR_POLICY_LABELS },
    );
    expect(brief).toContain('Agent : Awa (Commercial)');
    expect(brief).toContain(good.instructions);
    expect(brief).toContain('Outils autorisés : aucun');
    expect(brief).toContain('10 étapes, 300 secondes');
    expect(brief).toContain('arrêter et prévenir un responsable');
  });
});
