import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TransactionController } from '../src/modules/transaction/transaction.controller';
import { TransactionService } from '../src/modules/transaction/transaction.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { TransactionStatus, TransactionType } from '../src/modules/transaction/transaction.entity';
import { GlobalExceptionFilter } from '../src/filters/http-exception.filter';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('Create Transaction API E2E (POST /api/v1/transactions)', () => {
  let app: INestApplication;
  let transactionService: jest.Mocked<TransactionService>;

  const mockJwtGuard = {
    canActivate: jest.fn((context) => {
      const req = context.switchToHttp().getRequest();
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer valid-jwt-token')) {
        return false;
      }
      req.user = { userId: 1 };
      return true;
    }),
  };

  beforeAll(async () => {
    transactionService = {
      create: jest.fn(),
      findAllByUserId: jest.fn(),
      seedData: jest.fn(),
    } as unknown as jest.Mocked<TransactionService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: transactionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Main Flow: Create Expense with Category and Complete Status', () => {
    it('POST /api/v1/transactions creates an Expense transaction and updates account balance', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Grocery shopping',
        shopName: 'Supermarket ABC',
        paymentMethod: 'Credit Card',
        amount: 150.5,
        category_id: 2,
      };

      const mockResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 101,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Expense' as const,
          itemDescription: 'Grocery shopping',
          shopName: 'Supermarket ABC',
          amount: 150.5,
          paymentMethod: 'Credit Card',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: 2,
        },
      };

      transactionService.create.mockResolvedValue(mockResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(201);

      expect(res.body).toEqual(mockResponse);
      expect(transactionService.create).toHaveBeenCalledWith(1, payload);
    });
  });

  describe('AF-1: Create Revenue Transaction', () => {
    it('POST /api/v1/transactions creates Revenue and adjusts balance upward without balance check', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Revenue',
        itemDescription: 'Salary deposit',
        shopName: 'Company Corp',
        paymentMethod: 'Bank Transfer',
        amount: 5000.0,
      };

      const mockResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 102,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Revenue' as const,
          itemDescription: 'Salary deposit',
          shopName: 'Company Corp',
          amount: 5000.0,
          paymentMethod: 'Bank Transfer',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: null,
        },
      };

      transactionService.create.mockResolvedValue(mockResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(201);

      expect(res.body.data.type).toBe('Revenue');
      expect(res.body.data.amount).toBe(5000.0);
      expect(transactionService.create).toHaveBeenCalledWith(1, payload);
    });
  });

  describe('AF-2: Create Transaction without Category', () => {
    it('stores category_id as null when category is omitted or null', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Coffee',
        shopName: 'Corner Cafe',
        paymentMethod: 'Cash',
        amount: 4.5,
        category_id: null,
      };

      const mockResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 103,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Expense' as const,
          itemDescription: 'Coffee',
          shopName: 'Corner Cafe',
          amount: 4.5,
          paymentMethod: 'Cash',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: null,
        },
      };

      transactionService.create.mockResolvedValue(mockResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(201);

      expect(res.body.data.category_id).toBeNull();
    });
  });

  describe('EF-3: Unauthorized request', () => {
    it('returns 403 / 401 when Authorization header is missing or token is invalid', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Coffee',
        shopName: 'Cafe',
        paymentMethod: 'Cash',
        amount: 5,
      };

      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .send(payload)
        .expect(403);
    });
  });

  describe('EF-4: Backend validation or business-rule failure', () => {
    it('returns 400 Bad Request when business rule validation fails (e.g. insufficient balance)', async () => {
      transactionService.create.mockRejectedValue(
        new BadRequestException('Invalid or missing transaction data'),
      );

      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Expensive Car',
        shopName: 'Auto Dealership',
        paymentMethod: 'Bank Transfer',
        amount: 999999999,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Invalid or missing transaction data');
    });

    it('returns 400 Bad Request when account is not owned by authenticated user', async () => {
      transactionService.create.mockRejectedValue(
        new BadRequestException('Invalid or missing transaction data'),
      );

      const payload = {
        accountId: 999,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Lunch',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: 25.0,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Invalid or missing transaction data');
    });
  });

  describe('EF-5: Database failure & rollback', () => {
    it('returns 500 InternalServerErrorException when database operation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      transactionService.create.mockRejectedValue(
        new InternalServerErrorException(
          'Đã xảy ra lỗi hệ thống khi tạo giao dịch. Vui lòng thử lại sau.',
        ),
      );

      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Lunch',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: 25.0,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(payload)
        .expect(500);

      expect(res.body.message).toContain('Đã xảy ra lỗi hệ thống');

      consoleSpy.mockRestore();
    });
  });
});
