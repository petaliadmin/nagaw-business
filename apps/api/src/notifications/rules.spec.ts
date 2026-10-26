import {
  addToTally,
  appendLine,
  forecastDaysLeft,
  formatDaysLeft,
  isQuietDay,
  moreSevere,
  nearCreditLimit,
  percentChange,
  recipientsFor,
  stockCrossing,
  summaryText,
  type DaySummary,
  type Member,
} from './rules.js';

describe('stockCrossing', () => {
  it('speaks once, when the line is crossed', () => {
    expect(stockCrossing(12, 9, 10)).toBe('low');
    expect(stockCrossing(9, 8, 10)).toBeNull();
    expect(stockCrossing(10, 9, 10)).toBeNull();
    expect(stockCrossing(3, 0, 10)).toBe('out');
    expect(stockCrossing(3, -2, null)).toBe('out');
    expect(stockCrossing(0, -1, 10)).toBeNull();
  });

  it('never warns when the stock goes up', () => {
    expect(stockCrossing(2, 20, 10)).toBeNull();
    expect(stockCrossing(5, 5, 10)).toBeNull();
  });
});

describe('forecastDaysLeft', () => {
  it('projects the stock at the pace of the window', () => {
    // 28 sold in 14 days: 2 a day; 6 left → 3 days.
    expect(forecastDaysLeft(6, 28, 14)).toBe(3);
    expect(forecastDaysLeft(0, 28, 14)).toBe(0);
  });

  it('has no forecast without sales', () => {
    expect(forecastDaysLeft(6, 0, 14)).toBeNull();
  });

  it('says it in words', () => {
    expect(formatDaysLeft(0.4)).toBe('moins d’un jour');
    expect(formatDaysLeft(1.9)).toBe('environ 1 jour');
    expect(formatDaysLeft(3.2)).toBe('environ 3 jours');
  });
});

describe('percentChange and nearCreditLimit', () => {
  it('compares with last week only when there is a base', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(50, 0)).toBeNull();
  });

  it('warns once when the debt reaches the share of the limit', () => {
    expect(nearCreditLimit(70, 85, 100, 80)).toBe(true);
    expect(nearCreditLimit(85, 90, 100, 80)).toBe(false);
    expect(nearCreditLimit(0, 50, 100, 80)).toBe(false);
    expect(nearCreditLimit(0, 5000, null, 80)).toBe(false);
  });
});

describe('recipientsFor', () => {
  const members: Member[] = [
    { userId: 'owner', role: 'owner' },
    { userId: 'admin', role: 'admin' },
    { userId: 'seller', role: 'member' },
    { userId: 'accountant', role: 'viewer' },
  ];
  const ids = (list: { userId: string }[]) => list.map((r) => r.userId);

  it('follows the rights and the defaults of each role', () => {
    expect(ids(recipientsFor('controls', members, [], {}))).toEqual([
      'owner',
      'admin',
    ]);
    expect(ids(recipientsFor('stock', members, [], {}))).toEqual([
      'owner',
      'admin',
      'seller',
    ]);
    expect(ids(recipientsFor('summary', members, [], {}))).toEqual(['owner']);
  });

  it('leaves out the person who acted', () => {
    expect(
      ids(recipientsFor('controls', members, [], { exceptUserId: 'owner' })),
    ).toEqual(['admin']);
  });

  it('follows each person’s choice, never beyond their rights', () => {
    const preferences = [
      {
        userId: 'owner',
        category: 'controls' as const,
        enabled: false,
        push: true,
      },
      {
        userId: 'accountant',
        category: 'summary' as const,
        enabled: true,
        push: false,
      },
      {
        userId: 'seller',
        category: 'controls' as const,
        enabled: true,
        push: true,
      },
    ];
    const result = recipientsFor('summary', members, preferences, {});
    expect(result).toEqual([
      { userId: 'owner', push: true },
      { userId: 'accountant', push: false },
    ]);
    expect(ids(recipientsFor('controls', members, preferences, {}))).toEqual([
      'admin',
    ]);
  });
});

describe('grouping helpers', () => {
  it('keeps a running tally, whatever the previous data', () => {
    expect(addToTally(undefined, 500)).toEqual({ count: 1, total: 500 });
    expect(addToTally({ count: 2, total: 1000 }, 500)).toEqual({
      count: 3,
      total: 1500,
    });
    expect(addToTally({ count: 'x' }, 1)).toEqual({ count: 1, total: 1 });
  });

  it('keeps the last lines only', () => {
    expect(appendLine(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
    expect(appendLine(null, 'a')).toEqual(['a']);
  });

  it('raises the severity, never lowers it', () => {
    expect(moreSevere('danger', 'warning')).toBe(true);
    expect(moreSevere('info', 'warning')).toBe(false);
  });
});

describe('evening summary', () => {
  const day: DaySummary = {
    dayLabel: 'lundi 26 octobre',
    currency: 'XOF',
    sales: { count: 12, total: 120000, cancelled: 1 },
    lastWeekTotal: 100000,
    credit: 15000,
    topProducts: [{ label: 'Riz', total: 50000 }],
    invoices: { count: 2, total: 80000 },
    expenses: { count: 1, total: 5000 },
    stock: { low: 2, out: 1 },
  };

  it('tells the day in everyday words', () => {
    const { title, body } = summaryText(day);
    expect(title).toBe('Résumé du lundi 26 octobre');
    expect(body).toContain('12 ventes');
    expect(body).toContain('+20 % par rapport à la semaine dernière');
    expect(body).toContain('1 vente annulée');
    expect(body).toContain('Meilleurs produits : Riz');
    expect(body).toContain('2 factures');
    expect(body).toContain('Dépenses');
    expect(body).toContain('À réapprovisionner : 3 produits, dont 1 épuisé.');
  });

  it('stays quiet on a day without activity', () => {
    expect(isQuietDay(day)).toBe(false);
    expect(
      isQuietDay({
        ...day,
        sales: { count: 0, total: 0, cancelled: 0 },
        invoices: { count: 0, total: 0 },
        expenses: { count: 0, total: 0 },
      }),
    ).toBe(true);
  });
});
