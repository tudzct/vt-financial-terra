import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Account, AccountType } from '../account/account.entity';
import { Category } from '../category/category.entity';
import { Transaction, TransactionStatus, TransactionType } from './transaction.entity';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionService.create (Main Flow, AF-1, AF-2, EF-4, EF-5)', () => {
  let service: TransactionService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let queryRunnerMock: any;
  let queryBuilderMock: any;

  beforeEach(() => {
    queryBuilderMock = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      isTransactionActive: false,
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
        findOne: jest.fn(),
        create: jest.fn((entityClass, data) => data),
        save: jest.fn((entityClass, data) => {
          if (entityClass === Transaction) {
            return {
              transactionId: 101,
              ...data,
            };
          }
          return data;
        }),
      },
    };

    transactionRepository = {
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
    } as unknown as jest.Mocked<Repository<Transaction>>;

    service = new TransactionService(transactionRepository);
  });

  const mockAccount = (balance: number = 1000): Account => {
    const acc = new Account();
    acc.accountId = 10;
    acc.userId = 1;
    acc.bankName = 'Test Bank';
    acc.accountType = AccountType.CHECKING;
    acc.accountNumberFull = '123456789';
    acc.accountNumberLast4 = '6789';
    acc.balance = balance;
    return acc;
  };

  describe('Main Flow: Create Expense with Category', () => {
    it('successfully creates Expense transaction, updates balance with -amount, defaults status to Complete', async () => {
      const account = mockAccount(500.0);
      queryBuilderMock.getOne.mockResolvedValue(account);
      queryRunnerMock.manager.findOne.mockResolvedValue({ categoryId: 2, categoryName: 'Food' });

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: '  Lunch with team  ',
        category_id: 2,
        shopName: '  Restaurant ABC  ',
        amount: 150.25,
        paymentMethod: '  Credit Card  ',
      };

      const result = await service.create(1, dto);

      expect(queryRunnerMock.connect).toHaveBeenCalled();
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryBuilderMock.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(account.balance).toBe(349.75); // 500 - 150.25
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(Account, account);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(TransactionStatus.COMPLETE);
      expect(result.data.amount).toBe(150.25);
      expect(result.data.itemDescription).toBe('Lunch with team');
      expect(result.data.shopName).toBe('Restaurant ABC');
      expect(result.data.paymentMethod).toBe('Credit Card');
      expect(result.data.category_id).toBe(2);
    });
  });

  describe('AF-1: Create Revenue', () => {
    it('creates Revenue transaction, increases balance by +amount, does not check for insufficient balance', async () => {
      const account = mockAccount(50.0);
      queryBuilderMock.getOne.mockResolvedValue(account);

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.REVENUE,
        itemDescription: 'Monthly Salary',
        shopName: 'Tech Corp',
        amount: 3000.0,
        paymentMethod: 'Bank Transfer',
      };

      const result = await service.create(1, dto);

      expect(account.balance).toBe(3050.0); // 50 + 3000
      expect(result.success).toBe(true);
      expect(result.data.type).toBe(TransactionType.REVENUE);
      expect(result.data.amount).toBe(3000.0);
    });
  });

  describe('AF-2: Create transaction without category', () => {
    it('creates transaction with category_id = null when category_id is undefined or null', async () => {
      const account = mockAccount(500.0);
      queryBuilderMock.getOne.mockResolvedValue(account);

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Snacks',
        shopName: '7-Eleven',
        amount: 20.0,
        paymentMethod: 'Cash',
        category_id: null,
      };

      const result = await service.create(1, dto);

      // Does not look up category
      expect(queryRunnerMock.manager.findOne).not.toHaveBeenCalled();
      expect(result.data.category_id).toBeNull();
    });
  });

  describe('EF-4: Backend validation or business-rule failure', () => {
    it('throws BadRequestException if account is not found or not owned by user', async () => {
      queryBuilderMock.getOne.mockResolvedValue(null);

      const dto: CreateTransactionDto = {
        accountId: 99,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Snacks',
        shopName: 'Store',
        amount: 20.0,
        paymentMethod: 'Cash',
      };

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if supplied category_id does not exist', async () => {
      const account = mockAccount(500.0);
      queryBuilderMock.getOne.mockResolvedValue(account);
      queryRunnerMock.manager.findOne.mockResolvedValue(null); // Category not found

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Snacks',
        category_id: 999,
        shopName: 'Store',
        amount: 20.0,
        paymentMethod: 'Cash',
      };

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if Expense amount exceeds account balance', async () => {
      const account = mockAccount(100.0); // balance is 100
      queryBuilderMock.getOne.mockResolvedValue(account);

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Luxury Dinner',
        shopName: 'Fine Dining',
        amount: 250.0, // 250 > 100
        paymentMethod: 'Credit Card',
      };

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid input values (e.g. amount < 0.01, blank itemDescription)', async () => {
      const invalidDto1: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: '   ',
        shopName: 'Store',
        amount: 50.0,
        paymentMethod: 'Cash',
      };

      await expect(service.create(1, invalidDto1)).rejects.toThrow(BadRequestException);

      const invalidDto2: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Valid description',
        shopName: 'Store',
        amount: 0.005,
        paymentMethod: 'Cash',
      };

      await expect(service.create(1, invalidDto2)).rejects.toThrow(BadRequestException);
    });
  });

  describe('EF-5: Database failure & rollback', () => {
    it('rolls back database transaction and throws InternalServerErrorException on unexpected DB error', async () => {
      const account = mockAccount(500.0);
      queryBuilderMock.getOne.mockResolvedValue(account);
      queryRunnerMock.isTransactionActive = true;
      queryRunnerMock.manager.save.mockRejectedValue(new Error('Deadlock detected'));

      const dto: CreateTransactionDto = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: TransactionType.EXPENSE,
        itemDescription: 'Lunch',
        shopName: 'Cafe',
        amount: 50.0,
        paymentMethod: 'Cash',
      };

      await expect(service.create(1, dto)).rejects.toThrow(InternalServerErrorException);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });
});
