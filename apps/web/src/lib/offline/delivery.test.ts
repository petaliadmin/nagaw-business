import { describe, expect, it } from 'vitest';
import { classifyAnswer, nextAttemptAt, randomTicketPrefix } from './delivery';

describe('classifyAnswer', () => {
  it('never takes a refusal for a network problem', () => {
    expect(classifyAnswer(400)).toBe('invalid');
    expect(classifyAnswer(413)).toBe('invalid');
    expect(classifyAnswer(422)).toBe('invalid');
  });

  it('keeps for later what says nothing about the operations', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504])
      expect(classifyAnswer(status)).toBe('later');
  });

  it('separates the session from the device', () => {
    expect(classifyAnswer(401)).toBe('session');
    expect(classifyAnswer(0)).toBe('session');
    expect(classifyAnswer(403)).toBe('device');
    expect(classifyAnswer(404)).toBe('device');
  });

  it('reads the results of a success', () => {
    expect(classifyAnswer(200)).toBe('results');
  });
});

describe('nextAttemptAt', () => {
  it('waits longer each time, one hour at most', () => {
    expect(nextAttemptAt(1, 0)).toBe(60_000);
    expect(nextAttemptAt(2, 0)).toBe(120_000);
    expect(nextAttemptAt(40, 0)).toBe(3_600_000);
  });
});

describe('randomTicketPrefix', () => {
  it('fits the ticket format', () => {
    expect(randomTicketPrefix()).toMatch(/^[A-Z]{3}$/);
  });
});
