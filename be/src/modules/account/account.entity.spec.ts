import { getMetadataArgsStorage } from 'typeorm';
import { Account } from './account.entity';

describe('Account entity metadata', () => {
  it('declares account numbers as unique per user, not globally unique', () => {
    const uniqueConstraint = getMetadataArgsStorage().uniques.find(
      (constraint) =>
        constraint.target === Account
        && constraint.name === 'UQ_accounts_user_id_account_number_full',
    );

    expect(uniqueConstraint?.columns).toEqual(['userId', 'accountNumberFull']);
  });
});
