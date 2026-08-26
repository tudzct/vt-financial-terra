import { BadRequestException } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountType } from './account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

describe('AccountController Unit Tests', () => {
  let controller: AccountController;
  let service: jest.Mocked<AccountService>;

  beforeEach(() => {
    service = {
      findAllByUserId: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AccountService>;

    controller = new AccountController(service);
  });

  describe('findAll', () => {
    it('calls service.findAllByUserId with authenticated userId', async () => {
      const mockRequest = { user: { userId: 42 } } as any;
      const expectedResponse: any = {
        success: true,
        message: 'Accounts fetched successfully',
        data: [],
      };
      service.findAllByUserId.mockResolvedValue(expectedResponse);

      const result = await controller.findAll(mockRequest);

      expect(service.findAllByUserId).toHaveBeenCalledWith(42);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('findOne', () => {
    it('calls service.findOne with userId and parsed positive integer accountId', async () => {
      const mockRequest = { user: { userId: 42 } } as any;
      const expectedResponse: any = {
        success: true,
        message: 'Account fetched successfully',
        data: { account_id: 10, user_id: 42 },
      };
      service.findOne.mockResolvedValue(expectedResponse);

      const result = await controller.findOne(mockRequest, '10');

      expect(service.findOne).toHaveBeenCalledWith(42, 10);
      expect(result).toEqual(expectedResponse);
    });

    it('throws BadRequestException for invalid account ID strings', () => {
      const mockRequest = { user: { userId: 42 } } as any;

      expect(() => controller.findOne(mockRequest, 'abc')).toThrow(BadRequestException);
      expect(() => controller.findOne(mockRequest, '0')).toThrow(BadRequestException);
      expect(() => controller.findOne(mockRequest, '-5')).toThrow(BadRequestException);
      expect(() => controller.findOne(mockRequest, '12.34')).toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('calls service.create with authenticated userId and dto', async () => {
      const mockRequest = { user: { userId: 42 } } as any;
      const dto: CreateAccountDto = {
        bank_name: 'Vietcombank',
        account_type: AccountType.CHECKING,
        account_number_full: '123456789012',
        balance: 1000,
      };

      const expectedResponse: any = {
        success: true,
        message: 'Account created successfully',
        data: { account: { id: 1 } },
      };
      service.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(mockRequest, dto);

      expect(service.create).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
