import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, AccountType } from './account.entity';
import { AccountListDataDto, AccountListItemDto } from './dto/account-list-response.dto';

interface AccountListRow {
  account_id: number | string;
  bank_name: string;
  account_type: AccountType;
  branch_name: string | null;
  account_number_last_4: string;
  balance: string | number;
}

/** Contains read-only, ownership-scoped account retrieval logic. */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /** Returns only the authenticated user's safe account-list fields in ID order. */
  async findAllByUserId(userId: number): Promise<AccountListDataDto> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Unauthorized');
    }

    try {
      const rows = await this.accountRepository
        .createQueryBuilder('account')
        .select('account.accountId', 'account_id')
        .addSelect('account.bankName', 'bank_name')
        .addSelect('account.accountType', 'account_type')
        .addSelect('account.branchName', 'branch_name')
        .addSelect('account.accountNumberLast4', 'account_number_last_4')
        .addSelect('account.balance', 'balance')
        .where('account.userId = :userId', { userId })
        .orderBy('account.accountId', 'ASC')
        .getRawMany<AccountListRow>();

      return {
        user_id: userId,
        accounts: rows.map((row) => this.toAccountListItem(row)),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('system error occurred. Please try again later.');
    }
  }

  /** Maps raw selected columns without ever reading or exposing the full account number. */
  private toAccountListItem(row: AccountListRow): AccountListItemDto {
    return {
      id: Number(row.account_id),
      bank_name: row.bank_name,
      account_type: row.account_type,
      branch_name: row.branch_name,
      account_number_last_4: row.account_number_last_4,
      balance: Number(row.balance),
    };
  }
}
