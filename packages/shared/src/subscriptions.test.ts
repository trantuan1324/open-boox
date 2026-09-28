import { describe, expect, it } from 'vitest';
import { classifyPlanChange, planCodeInputSchema } from './subscriptions';

const basic = { code: 'basic', monthlyPrice: 79_000 };
const standard = { code: 'standard', monthlyPrice: 119_000 };
const cheapTwin = { code: 'basic-promo', monthlyPrice: 79_000 };

describe('classifyPlanChange', () => {
  it('keeps the same plan', () => {
    expect(classifyPlanChange(standard, standard)).toBe('KEEP');
  });

  it('upgrades to a pricier plan', () => {
    expect(classifyPlanChange(basic, standard)).toBe('UPGRADE');
  });

  it('downgrades to a cheaper plan', () => {
    expect(classifyPlanChange(standard, basic)).toBe('DOWNGRADE');
  });

  it('treats a different plan at the same price as a downgrade (applies from the next period)', () => {
    expect(classifyPlanChange(basic, cheapTwin)).toBe('DOWNGRADE');
  });
});

describe('planCodeInputSchema', () => {
  it('trims the code', () => {
    expect(planCodeInputSchema.parse({ planCode: ' basic ' })).toEqual({ planCode: 'basic' });
  });

  it.each([{}, { planCode: '' }, { planCode: '   ' }, { planCode: 1 }])('rejects %j', (input) => {
    expect(planCodeInputSchema.safeParse(input).success).toBe(false);
  });
});
