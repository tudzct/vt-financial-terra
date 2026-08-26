import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from './transaction.entity';
import { Account, AccountType } from '../account/account.entity';
import { Category } from '../category/category.entity';
import { TransactionListQueryDto } from './dto/transaction-list-query.dto';
import { TransactionDto, TransactionListResponseDto } from './dto/transaction-list-response.dto';
import {
  CreateTransactionDto,
  CreateTransactionResponseDto,
} from './dto/create-transaction.dto';

type TransactionFilterType = 'All' | TransactionType.REVENUE | TransactionType.EXPENSE;

interface ValidatedTransactionListQuery {
  type: TransactionFilterType;
  limit: number;
  offset: number;
}

interface NormalizedCreateTransaction {
  accountId: number;
  transactionDate: string;
  type: TransactionType;
  itemDescription: string;
  categoryId: number | null;
  shopName: string;
  amount: number;
  paymentMethod: string;
  status: TransactionStatus;
}

/** Implements read-only, owner-scoped transaction-history retrieval. */
@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /** Creates a user-owned transaction and its balance adjustment as one database transaction. */
  async create(
    userId: number,
    createTransactionDto: CreateTransactionDto,
  ): Promise<CreateTransactionResponseDto> {
    const transactionData = this.validateAndNormalizeCreate(createTransactionDto);
    const queryRunner = this.transactionRepository.manager.connection.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const account = await queryRunner.manager
        .createQueryBuilder(Account, 'account')
        .setLock('pessimistic_write')
        .where('account.account_id = :accountId', { accountId: transactionData.accountId })
        .andWhere('account.user_id = :userId', { userId })
        .getOne();

      if (!account) {
        throw this.invalidTransactionData();
      }

      if (transactionData.categoryId !== null) {
        const category = await queryRunner.manager.findOne(Category, {
          where: { categoryId: transactionData.categoryId },
          select: { categoryId: true },
        });

        if (!category) {
          throw this.invalidTransactionData();
        }
      }

      const balance = Number(account.balance);
      if (!Number.isFinite(balance)) {
        throw new Error('Account balance is invalid');
      }

      if (transactionData.type === TransactionType.EXPENSE && balance < transactionData.amount) {
        throw this.invalidTransactionData();
      }

      const balanceAdjustment = transactionData.type === TransactionType.REVENUE
        ? transactionData.amount
        : -transactionData.amount;
      account.balance = this.toMoney(balance + balanceAdjustment);

      const transaction = queryRunner.manager.create(Transaction, {
        accountId: transactionData.accountId,
        transactionDate: transactionData.transactionDate as unknown as Date,
        type: transactionData.type,
        itemDescription: transactionData.itemDescription,
        categoryId: transactionData.categoryId,
        shopName: transactionData.shopName,
        amount: transactionData.amount,
        paymentMethod: transactionData.paymentMethod,
        status: transactionData.status,
        receiptId: null,
      } as Partial<Transaction>);

      await queryRunner.manager.save(Account, account);
      const savedTransaction = await queryRunner.manager.save(Transaction, transaction);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Transaction created successfully',
        data: {
          transactionId: savedTransaction.transactionId,
          accountId: savedTransaction.accountId,
          transactionDate: `${transactionData.transactionDate}T00:00:00.000Z`,
          type: savedTransaction.type,
          itemDescription: savedTransaction.itemDescription,
          shopName: savedTransaction.shopName,
          amount: Number(savedTransaction.amount),
          paymentMethod: savedTransaction.paymentMethod,
          status: savedTransaction.status,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: savedTransaction.categoryId ?? null,
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Đã xảy ra lỗi hệ thống khi tạo giao dịch. Vui lòng thử lại sau.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /** Returns a validated page of transactions that belong to the authenticated user. */
  async findAllByUserId(
    userId: number,
    rawQuery: TransactionListQueryDto,
  ): Promise<TransactionListResponseDto> {
    const { type, limit, offset } = this.validateQuery(rawQuery);

    try {
      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.account', 'account', 'account.userId = :userId', { userId });

      if (type !== 'All') {
        queryBuilder.andWhere('transaction.type = :type', { type });
      }

      const total = await queryBuilder.getCount();
      const transactions = await queryBuilder
        .orderBy('transaction.transactionDate', 'DESC')
        .addOrderBy('transaction.transactionId', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany();
      const data = transactions.map((transaction) => this.toDto(transaction));

      return {
        data,
        total,
        hasMore: offset + data.length < total,
      };
    } catch {
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi hệ thống khi lấy danh sách giao dịch. Vui lòng thử lại sau.',
      );
    }
  }

  /** Normalizes defaults and validates all transaction-list query constraints. */
  private validateQuery(rawQuery: TransactionListQueryDto): ValidatedTransactionListQuery {
    const type = rawQuery.type;

    if (
      typeof type !== 'string'
      || ![TransactionType.REVENUE, TransactionType.EXPENSE, 'All'].includes(type)
    ) {
      throw new BadRequestException('Invalid transaction query parameter');
    }

    return {
      type: type as TransactionFilterType,
      limit: this.parseInteger(rawQuery.limit, 10, (value) => value > 0),
      offset: this.parseInteger(rawQuery.offset, 0, (value) => value >= 0),
    };
  }

  /** Enforces BR-TXN-08 and BR-TXN-09 before transactional persistence starts. */
  private validateAndNormalizeCreate(rawDto: CreateTransactionDto): NormalizedCreateTransaction {
    const accountId = this.parsePositiveInteger(rawDto.accountId);
    const transactionDate = this.parseIsoDate(rawDto.transactionDate);
    const type = rawDto.type;
    const status = rawDto.status === undefined ? TransactionStatus.COMPLETE : rawDto.status;
    const itemDescription = this.normalizeRequiredString(rawDto.itemDescription, 500);
    const shopName = this.normalizeRequiredString(rawDto.shopName, 255);
    const paymentMethod = this.normalizeRequiredString(rawDto.paymentMethod, 100);
    const amount = this.parseMoney(rawDto.amount);
    const categoryId = rawDto.category_id === undefined || rawDto.category_id === null
      ? null
      : this.parsePositiveInteger(rawDto.category_id);

    if (!Object.values(TransactionType).includes(type as TransactionType)) {
      throw this.invalidTransactionData();
    }

    if (!Object.values(TransactionStatus).includes(status as TransactionStatus)) {
      throw this.invalidTransactionData();
    }

    return {
      accountId,
      transactionDate,
      type: type as TransactionType,
      itemDescription,
      categoryId,
      shopName,
      amount,
      paymentMethod,
      status: status as TransactionStatus,
    };
  }

  /** Normalizes required text and ensures it fits its persisted column. */
  private normalizeRequiredString(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') {
      throw this.invalidTransactionData();
    }

    const normalizedValue = value.normalize('NFC').trim();
    if (!normalizedValue || normalizedValue.length > maxLength) {
      throw this.invalidTransactionData();
    }

    return normalizedValue;
  }

  /** Accepts a safe, positive integer identifier only. */
  private parsePositiveInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw this.invalidTransactionData();
    }

    return value;
  }

  /** Validates a calendar date without converting it through the server timezone. */
  private parseIsoDate(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw this.invalidTransactionData();
    }

    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (
      parsedDate.getUTCFullYear() !== year
      || parsedDate.getUTCMonth() !== month - 1
      || parsedDate.getUTCDate() !== day
    ) {
      throw this.invalidTransactionData();
    }

    return value;
  }

  /** Converts a valid two-decimal monetary request into a safe persisted amount. */
  private parseMoney(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.01) {
      throw this.invalidTransactionData();
    }

    const cents = Math.round(value * 100);
    if (
      !Number.isSafeInteger(cents)
      || Math.abs(value * 100 - cents) > Number.EPSILON * 100
      || cents > 999999999999999
    ) {
      throw this.invalidTransactionData();
    }

    return cents / 100;
  }

  /** Prevents rounding drift when applying a two-decimal account balance adjustment. */
  private toMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** Returns the contract's safe validation failure response. */
  private invalidTransactionData(): BadRequestException {
    return new BadRequestException('Invalid or missing transaction data');
  }

  /** Parses a non-scientific integer while preserving omitted-query defaults. */
  private parseInteger(
    value: unknown,
    defaultValue: number,
    predicate: (value: number) => boolean,
  ): number {
    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new BadRequestException('Invalid transaction query parameter');
    }

    const parsedValue = Number(value);

    if (!Number.isSafeInteger(parsedValue) || !predicate(parsedValue)) {
      throw new BadRequestException('Invalid transaction query parameter');
    }

    return parsedValue;
  }

  /** Maps only the contract-approved persisted fields into the response DTO. */
  private toDto(transaction: Transaction): TransactionDto {
    return {
      transaction_id: transaction.transactionId,
      account_id: transaction.accountId,
      transaction_date: this.formatTransactionDate(transaction.transactionDate),
      type: transaction.type,
      item_description: transaction.itemDescription,
      shop_name: transaction.shopName,
      amount: Number(transaction.amount),
      payment_method: transaction.paymentMethod,
      status: transaction.status,
    };
  }

  /** Preserves a database DATE as a timezone-neutral ISO calendar date. */
  private formatTransactionDate(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    return value.toISOString().slice(0, 10);
  }

  /** MỌI THỨ DƯỚI ĐÂY LÀ ĐỂ DỄ DÀNG TEST */
  async seedData(userId: number) {
    const queryRunner = this.transactionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let account = await queryRunner.manager.findOne(Account, { where: { userId } });
      if (!account) {
        account = queryRunner.manager.create(Account, {
          userId,
          bankName: 'Test Bank',
          accountType: AccountType.CHECKING,
          accountNumberFull: '123456789',
          accountNumberLast4: '6789',
          balance: 50000,
        });
        account = await queryRunner.manager.save(Account, account);
      }

      const transactions: Partial<Transaction>[] = [
        {
          accountId: account.accountId,
          transactionDate: new Date(),
          type: TransactionType.EXPENSE,
          itemDescription: 'Coffee',
          shopName: 'Starbucks',
          amount: 5.50,
          paymentMethod: 'Credit Card',
          status: TransactionStatus.COMPLETE,
        },
        {
          accountId: account.accountId,
          transactionDate: new Date(),
          type: TransactionType.REVENUE,
          itemDescription: 'Salary',
          shopName: 'Company XYZ',
          amount: 3000.00,
          paymentMethod: 'Bank Transfer',
          status: TransactionStatus.COMPLETE,
        },
        {
          accountId: account.accountId,
          transactionDate: new Date(Date.now() - 86400000), // yesterday
          type: TransactionType.EXPENSE,
          itemDescription: 'Groceries',
          shopName: 'Walmart',
          amount: 120.00,
          paymentMethod: 'Credit Card',
          status: TransactionStatus.COMPLETE,
        }
      ];

      for (const t of transactions) {
        await queryRunner.manager.save(Transaction, this.transactionRepository.create(t));
      }

      await queryRunner.commitTransaction();
      return { success: true, message: 'Seeded 3 transactions successfully' };
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      return { success: false, message: e.message };
    } finally {
      await queryRunner.release();
    }
  }
}
