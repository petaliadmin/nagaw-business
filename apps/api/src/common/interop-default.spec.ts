import { interopDefault } from './interop-default.js';

describe('interopDefault', () => {
  const fn = () => 'ok';

  it.each([
    ['a function', fn],
    ['a namespace with default', { default: fn }],
    ['a doubly wrapped default', { default: { default: fn } }],
  ])('unwraps %s', (_label, mod) => {
    expect(interopDefault<typeof fn>(mod, 'x')()).toBe('ok');
  });

  it('throws with the module name when nothing is callable', () => {
    expect(() => interopDefault({ default: 42 }, 'helmet')).toThrow(/helmet/);
  });
});
