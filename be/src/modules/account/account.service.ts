import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, AccountType } from './account.entity';
import { AccountListResponseDto } from './dto/account-list-response.dto';
import { CreateAccountDto, CreateAccountResponseDto } from './dto/create-account.dto';
import { User } from '../user/user.entity';

interface NormalizedCreateAccount {
  bankName: string;
  accountType: CreateAccountDto['account_type'];
  branchName: string | null;
  accountNumberFull: string;
  accountNumberLast4: string;
  balance: number;
}

/** Retrieves account data that belongs to the authenticated user. */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /** Creates an account atomically while enforcing all UC-06 account rules. */
  async create(
    userId: number,
    rawDto: CreateAccountDto,
  ): Promise<CreateAccountResponseDto> {
    const accountData = this.validateAndNormalizeCreate(rawDto);
    const queryRunner = this.accountRepository.manager.connection.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Locking the owner serializes same-user creates without requiring a schema change.
      const user = await queryRunner.manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.user_id = :userId', { userId })
        .getOne();

      if (!user) {
        throw new BadRequestException('Invalid account data.');
      }

      const existingAccount = await queryRunner.manager.findOne(Account, {
        where: { userId, accountNumberFull: accountData.accountNumberFull },
        select: { accountId: true },
      });

      if (existingAccount) {
        throw new ConflictException('This account already exists in your account list.');
      }

      const account = queryRunner.manager.create(Account, {
        userId,
        bankName: accountData.bankName,
        accountType: accountData.accountType,
        branchName: accountData.branchName ?? undefined,
        accountNumberFull: accountData.accountNumberFull,
        accountNumberLast4: accountData.accountNumberLast4,
        balance: accountData.balance,
      });
      const savedAccount = await queryRunner.manager.save(Account, account);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Account created successfully',
        data: {
          account: {
            id: savedAccount.accountId,
            user_id: savedAccount.userId,
            bank_name: savedAccount.bankName,
            account_type: savedAccount.accountType,
            branch_name: savedAccount.branchName ?? null,
            account_number_last_4: savedAccount.accountNumberLast4,
            balance: Number(savedAccount.balance),
          },
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('This account already exists in your account list.');
      }

      throw new InternalServerErrorException(
        'Unable to add the account at this time. Please try again later.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /** Returns the current user's accounts in the frontend API contract. */
  async findAllByUserId(userId: number): Promise<AccountListResponseDto> {
    try {
      const accounts = await this.accountRepository.find({
        where: { userId },
        order: { accountId: 'ASC' },
      });

      return {
        success: true,
        message: 'Accounts fetched successfully',
        data: accounts.map((account) => ({
          account_id: account.accountId,
          user_id: account.userId,
          bank_name: account.bankName,
          account_type: account.accountType,
          branch_name: account.branchName ?? undefined,
          account_number_full: account.accountNumberFull ?? undefined,
          account_number_last_4: account.accountNumberLast4,
          balance: Number(account.balance),
        })),
      };
    } catch {
      throw new InternalServerErrorException('Unable to fetch accounts');
    }
  }

  /** Returns a single account owned by the user, throwing 404 if not found, 403 if belonging to another user. */
  async findOne(userId: number, accountId: number) {
    try {
      const account = await this.accountRepository.findOne({
        where: { accountId },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (account.userId !== userId) {
        throw new ForbiddenException('Account belongs to another user');
      }

      return {
        success: true,
        message: 'Account fetched successfully',
        data: {
          account_id: account.accountId,
          user_id: account.userId,
          bank_name: account.bankName,
          account_type: account.accountType,
          branch_name: account.branchName ?? undefined,
          account_number_full: account.accountNumberFull ?? undefined,
          account_number_last_4: account.accountNumberLast4,
          balance: Number(account.balance),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to fetch account');
    }
  }

  /** Normalizes account text and enforces rules that must remain server-authoritative. */
  private validateAndNormalizeCreate(rawDto: CreateAccountDto): NormalizedCreateAccount {
    const bankName = this.normalizeRequiredText(rawDto.bank_name, 255);
    const accountNumberFull = this.normalizeAccountNumber(rawDto.account_number_full);
    const branchName = this.normalizeOptionalText(rawDto.branch_name, 255);
    const balance = this.parseMoney(rawDto.balance);

    if (!Object.values(AccountType).includes(rawDto.account_type)) {
      throw new BadRequestException('Account type is invalid.');
    }

    return {
      bankName,
      accountType: rawDto.account_type,
      branchName,
      accountNumberFull,
      accountNumberLast4: accountNumberFull.slice(-4),
      balance,
    };
  }

  /** NFC-normalizes a required persisted string without accepting blank input. */
  private normalizeRequiredText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Invalid account data.');
    }

    const normalizedValue = value.normalize('NFC').trim();
    if (!normalizedValue || normalizedValue.length > maxLength) {
      throw new BadRequestException('Invalid account data.');
    }

    return normalizedValue;
  }

  /** Treats a blank optional branch as omitted and rejects non-string values. */
  private normalizeOptionalText(value: unknown, maxLength: number): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Branch name must be a string.');
    }

    const normalizedValue = value.normalize('NFC').trim();
    if (normalizedValue.length > maxLength) {
      throw new BadRequestException('Branch name must not exceed 255 characters.');
    }

    return normalizedValue || null;
  }

  /** Restricts account numbers to their contract-defined digit range. */
  private normalizeAccountNumber(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Account number must contain 8 to 34 digits.');
    }

    const normalizedValue = value.normalize('NFC').trim();
    if (!/^\d{8,34}$/.test(normalizedValue)) {
      throw new BadRequestException('Account number must contain 8 to 34 digits.');
    }

    return normalizedValue;
  }

  /** Converts a valid decimal balance to exact cents before persistence. */
  private parseMoney(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Balance must be greater than or equal to 0.');
    }

    const cents = Math.round(value * 100);
    if (
      !Number.isSafeInteger(cents)
      || Math.abs(value * 100 - cents) > Number.EPSILON * 100
      || cents > 999999999999999
    ) {
      throw new BadRequestException('Balance must have up to two decimal places.');
    }

    return cents / 100;
  }

  /** Detects a database uniqueness violation without leaking database details. */
  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: unknown }).code === 'ER_DUP_ENTRY';
  }
}
