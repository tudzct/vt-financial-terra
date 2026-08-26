import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Account, AccountType } from './account.entity';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { User } from '../user/user.entity';

describe('AccountService Unit Tests', () => {
  let service: AccountService;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let queryRunnerMock: any;
  let queryBuilderMock: any;

  beforeEach(() => {
    queryBuilderMock = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
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
          if (entityClass === Account) {
            return {
              accountId: 101,
              ...data,
            };
          }
          return data;
        }),
      },
    };

    accountRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
    } as unknown as jest.Mocked<Repository<Account>>;

    service = new AccountService(accountRepository);
  });

  describe('Main Flow: Create Account (Steps 7 - 10)', () => {
    it('creates account, checks owner, checks uniqueness, derives last 4 digits, and commits transaction', async () => {
      const userId = 42;
      const user = new User();
      user.userId = userId;

      queryBuilderMock.getOne.mockResolvedValue(user);
      queryRunnerMock.manager.findOne.mockResolvedValue(null); // No duplicate account

      const dto: CreateAccountDto = {
        bank_name: 'Vietcombank',
        account_type: AccountType.CHECKING,
        branch_name: 'Hanoi Branch',
        account_number_full: '123456789012',
        balance: 500.25,
      };

      const result = await service.create(userId, dto);

      expect(queryRunnerMock.connect).toHaveBeenCalled();
      expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
      expect(queryBuilderMock.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(queryRunnerMock.manager.findOne).toHaveBeenCalledWith(Account, {
        where: { userId, accountNumberFull: '123456789012' },
        select: { accountId: true },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account created successfully');
      expect(result.data.account.bank_name).toBe('Vietcombank');
      expect(result.data.account.account_type).toBe(AccountType.CHECKING);
      expect(result.data.account.branch_name).toBe('Hanoi Branch');
      expect(result.data.account.account_number_last_4).toBe('9012');
      expect(result.data.account.balance).toBe(500.25);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('AF-1: Optional branch omitted', () => {
    it('stores branch_name as null when branch_name is omitted or empty', async () => {
      const userId = 42;
      const user = new User();
      user.userId = userId;

      queryBuilderMock.getOne.mockResolvedValue(user);
      queryRunnerMock.manager.findOne.mockResolvedValue(null);

      const dto: CreateAccountDto = {
        bank_name: 'Techcombank',
        account_type: AccountType.SAVINGS,
        account_number_full: '9876543210',
        balance: 1000.0,
      };

      const result = await service.create(userId, dto);

      expect(result.data.account.branch_name).toBeNull();
      expect(result.data.account.account_number_last_4).toBe('3210');
    });
  });

  describe('EF-2: Duplicate account number for the same user', () => {
    it('throws ConflictException (HTTP 409) when the same user already has an account with that account_number_full', async () => {
      const userId = 42;
      const user = new User();
      user.userId = userId;

      queryBuilderMock.getOne.mockResolvedValue(user);
      queryRunnerMock.manager.findOne.mockResolvedValue({ accountId: 99 }); // Duplicate exists

      const dto: CreateAccountDto = {
        bank_name: 'Vietcombank',
        account_type: AccountType.CHECKING,
        account_number_full: '123456789012',
        balance: 100.0,
      };

      await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
      await expect(service.create(userId, dto)).rejects.toThrow('This account already exists in your account list.');
    });

    it('maps a database duplicate-key error to the safe HTTP 409 response', async () => {
      const user = new User();
      user.userId = 42;
      queryBuilderMock.getOne.mockResolvedValue(user);
      queryRunnerMock.manager.findOne.mockResolvedValue(null);
      queryRunnerMock.isTransactionActive = true;
      queryRunnerMock.manager.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

      await expect(
        service.create(42, {
          bank_name: 'Vietcombank',
          account_type: AccountType.CHECKING,
          account_number_full: '123456789012',
          balance: 100,
        }),
      ).rejects.toThrow('This account already exists in your account list.');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('EF-3: Backend validation failure', () => {
    it('throws BadRequestException when user owner does not exist in database', async () => {
      const userId = 999;
      queryBuilderMock.getOne.mockResolvedValue(null); // User not found

      const dto: CreateAccountDto = {
        bank_name: 'Vietcombank',
        account_type: AccountType.CHECKING,
        account_number_full: '123456789012',
        balance: 100.0,
      };

      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(userId, dto)).rejects.toThrow('Invalid account data.');
    });

    it('throws BadRequestException for invalid account parameters (blank name, invalid type, invalid account number, invalid decimals)', async () => {
      const userId = 42;

      // Blank bank name
      expect(() =>
        (service as any).validateAndNormalizeCreate({
          bank_name: '   ',
          account_type: AccountType.CHECKING,
          account_number_full: '12345678',
          balance: 10,
        }),
      ).toThrow(BadRequestException);

      // Invalid account type
      expect(() =>
        (service as any).validateAndNormalizeCreate({
          bank_name: 'Bank',
          account_type: 'InvalidType' as any,
          account_number_full: '12345678',
          balance: 10,
        }),
      ).toThrow(BadRequestException);

      // Account number with letters or too short (< 8 digits)
      expect(() =>
        (service as any).validateAndNormalizeCreate({
          bank_name: 'Bank',
          account_type: AccountType.CHECKING,
          account_number_full: '12345',
          balance: 10,
        }),
      ).toThrow(BadRequestException);

      // More than two decimals in balance
      expect(() =>
        (service as any).validateAndNormalizeCreate({
          bank_name: 'Bank',
          account_type: AccountType.CHECKING,
          account_number_full: '12345678',
          balance: 10.999,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('EF-4: Storage failure', () => {
    it('rolls back database transaction and throws InternalServerErrorException on unexpected DB error during create', async () => {
      const userId = 42;
      const user = new User();
      user.userId = userId;

      queryBuilderMock.getOne.mockResolvedValue(user);
      queryRunnerMock.manager.findOne.mockResolvedValue(null);
      queryRunnerMock.isTransactionActive = true;
      queryRunnerMock.manager.save.mockRejectedValue(new Error('DB write deadlock'));

      const dto: CreateAccountDto = {
        bank_name: 'Vietcombank',
        account_type: AccountType.CHECKING,
        account_number_full: '123456789012',
        balance: 100.0,
      };

      await expect(service.create(userId, dto)).rejects.toThrow(InternalServerErrorException);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('Account Retrieval (findAllByUserId & findOne with EF-1, EF-2, EF-3, EF-4)', () => {
    it('findAllByUserId returns mapped account list for user', async () => {
      const mockAccounts = [
        {
          accountId: 1,
          userId: 42,
          bankName: 'VCB',
          accountType: AccountType.CHECKING,
          branchName: 'HN',
          accountNumberFull: '12345678',
          accountNumberLast4: '5678',
          balance: 1000,
        } as Account,
      ];
      accountRepository.find.mockResolvedValue(mockAccounts);

      const result = await service.findAllByUserId(42);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].account_id).toBe(1);
      expect(result.data[0].account_number_last_4).toBe('5678');
    });

    it('findOne returns account when account exists and is owned by userId', async () => {
      const mockAccount = {
        accountId: 10,
        userId: 42,
        bankName: 'Vietcombank',
        accountType: AccountType.CHECKING,
        branchName: 'Main Branch',
        accountNumberFull: '123456789012',
        accountNumberLast4: '9012',
        balance: 500.0,
      } as Account;

      accountRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(42, 10);

      expect(result.success).toBe(true);
      expect(result.data.account_id).toBe(10);
      expect(result.data.user_id).toBe(42);
      expect(result.data.bank_name).toBe('Vietcombank');
    });

    it('EF-2: findOne throws NotFoundException (HTTP 404) when account does not exist', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(42, 999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(42, 999)).rejects.toThrow('Account not found');
    });

    it('EF-3: findOne throws ForbiddenException (HTTP 403) when account belongs to another user', async () => {
      const foreignAccount = {
        accountId: 10,
        userId: 99, // Belongs to user 99, not 42
        bankName: 'Vietcombank',
        accountType: AccountType.CHECKING,
        accountNumberLast4: '9012',
        balance: 500.0,
      } as Account;

      accountRepository.findOne.mockResolvedValue(foreignAccount);

      await expect(service.findOne(42, 10)).rejects.toThrow(ForbiddenException);
      await expect(service.findOne(42, 10)).rejects.toThrow('Account belongs to another user');
    });

    it('EF-4: findOne throws InternalServerErrorException (HTTP 500) when database retrieval fails', async () => {
      accountRepository.findOne.mockRejectedValue(new Error('Connection lost'));

      await expect(service.findOne(42, 10)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
