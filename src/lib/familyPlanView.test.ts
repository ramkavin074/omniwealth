import { describe, expect, it } from 'vitest';
import { serializeBeneficiaries } from './beneficiaries';
import { buildPlanAccounts } from './familyPlanView';

const row = (o: any) => ({ assetType: 'STOCK', accountCategory: 'IRA', accountNumber: '1234', nativeCurrency: 'USD', nativeValue: '100', user: { fullName: 'Kavin' }, ...o });

describe('buildPlanAccounts', () => {
  it('groups holdings into accounts and sums value', () => {
    const { accounts } = buildPlanAccounts([row({ name: 'A', nativeValue: '100' }), row({ name: 'B', nativeValue: '50' })], 'USD', { USD: 1 }, null);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ label: 'Traditional IRA · 1234', value: 150, holdings: ['A', 'B'], owners: ['Kavin'] });
  });

  it('converts currencies and separates debts', () => {
    const { accounts, debts } = buildPlanAccounts(
      [row({ accountNumber: 'DEFAULT', nativeCurrency: 'INR', nativeValue: '8000' }), row({ assetType: 'LIABILITY', name: 'Mortgage', nativeValue: '500' })],
      'USD',
      { USD: 1, INR: 80 },
      null,
    );
    expect(accounts[0].value).toBe(100);
    expect(debts).toEqual([{ name: 'Mortgage', value: 500 }]);
  });

  it('takes beneficiaries, access notes and instructions from the account', () => {
    const ben = serializeBeneficiaries([{ name: 'Priya', relationship: 'Spouse', percent: 70 }]);
    const { accounts } = buildPlanAccounts(
      [row({ beneficiary: ben, accessNotes: 'Safe, top shelf' }), row({ name: 'second' })],
      'USD',
      { USD: 1 },
      JSON.stringify({ 'IRA|1234': 'Call Fidelity first' }),
    );
    expect(accounts[0].beneficiaries[0].name).toBe('Priya');
    expect(accounts[0].status).toBe('shares');
    expect(accounts[0].accessNotes).toEqual(['Safe, top shelf']);
    expect(accounts[0].instructions).toBe('Call Fidelity first');
  });
});
