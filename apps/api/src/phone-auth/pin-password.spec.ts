import { pinPassword } from './pin-password.js';

const PEPPER = 'p'.repeat(32);

describe('pinPassword', () => {
  it('is stable for a number and a code', () => {
    expect(pinPassword(PEPPER, '221771234567', '1357')).toBe(
      pinPassword(PEPPER, '221771234567', '1357'),
    );
  });

  it('changes with the code, the number and the secret', () => {
    const base = pinPassword(PEPPER, '221771234567', '1357');
    expect(pinPassword(PEPPER, '221771234567', '1358')).not.toBe(base);
    expect(pinPassword(PEPPER, '221771234568', '1357')).not.toBe(base);
    expect(pinPassword('q'.repeat(32), '221771234567', '1357')).not.toBe(base);
  });

  it('never contains the code and fits a bcrypt password', () => {
    const password = pinPassword(PEPPER, '221771234567', '1357');
    expect(password).not.toContain('1357');
    expect(password).toMatch(/^Ng1-[A-Za-z0-9_-]{43}$/);
    expect(password.length).toBeLessThanOrEqual(72);
  });
});
