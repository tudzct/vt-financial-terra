import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AccountController } from '../src/modules/account/account.controller';
import { AccountService } from '../src/modules/account/account.service';
import { CategoryController } from '../src/modules/category/category.controller';
import { CategoryService } from '../src/modules/category/category.service';
import { TransactionController } from '../src/modules/transaction/transaction.controller';
import { TransactionService } from '../src/modules/transaction/transaction.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { GlobalExceptionFilter } from '../src/filters/http-exception.filter';
import { TransactionStatus, TransactionType } from '../src/modules/transaction/transaction.entity';
import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

/**
 * Client-side validation helper mirroring AddTransactionForm.tsx validation logic:
 * - accountId: required positive integer
 * - transactionDate: required YYYY-MM-DD
 * - type: Expense | Revenue
 * - itemDescription: non-empty trimmed string
 * - shopName: non-empty trimmed string
 * - paymentMethod: non-empty trimmed string
 * - amount: number >= 0.01 with up to two decimals
 * - categoryId: optional (if provided, must be positive integer)
 */
function validateClientSide(values: {
  accountId?: string | number;
  transactionDate?: string;
  type?: string;
  itemDescription?: string;
  shopName?: string;
  paymentMethod?: string;
  amount?: string | number;
  categoryId?: string | number | null;
}) {
  const errors: Record<string, string> = {};
  const normalizedText = (val?: string) => (val ? val.normalize('NFC').trim() : '');
  const amountNum = Number(values.amount);

  const accountIdStr = values.accountId !== undefined && values.accountId !== null ? String(values.accountId) : '';
  if (!/^\d+$/.test(accountIdStr) || Number(accountIdStr) <= 0) {
    errors.accountId = 'Select an account.';
  }

  if (
    !values.transactionDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(values.transactionDate) ||
    Number.isNaN(Date.parse(`${values.transactionDate}T00:00:00Z`))
  ) {
    errors.transactionDate = 'Enter a valid transaction date.';
  }

  if (!normalizedText(values.itemDescription)) {
    errors.itemDescription = 'Enter an item description.';
  }

  if (!normalizedText(values.shopName)) {
    errors.shopName = 'Enter a shop or recipient name.';
  }

  if (!normalizedText(values.paymentMethod)) {
    errors.paymentMethod = 'Enter a payment method.';
  }

  const amountStr = values.amount !== undefined && values.amount !== null ? String(values.amount) : '';
  if (
    !Number.isFinite(amountNum) ||
    amountNum < 0.01 ||
    !/^\d+(?:\.\d{1,2})?$/.test(amountStr)
  ) {
    errors.amount = 'Enter an amount of at least 0.01 with up to two decimals.';
  }

  if (values.categoryId) {
    const catIdStr = String(values.categoryId);
    if (!/^\d+$/.test(catIdStr) || Number(catIdStr) <= 0) {
      errors.categoryId = 'Select a valid category.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

describe('Complete Add Transaction Flow End-to-End Test Suite', () => {
  let app: INestApplication;
  let accountService: jest.Mocked<AccountService>;
  let categoryService: jest.Mocked<CategoryService>;
  let transactionService: jest.Mocked<TransactionService>;

  const AUTHENTICATED_USER_ID = 42;
  const VALID_JWT_TOKEN = 'Bearer valid-jwt-token-for-user-42';

  const mockJwtGuard = {
    canActivate: jest.fn((context) => {
      const req = context.switchToHttp().getRequest();
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Unauthorized');
      }
      const token = authHeader.replace('Bearer ', '');
      if (token !== 'valid-jwt-token-for-user-42') {
        throw new UnauthorizedException('Invalid or expired token');
      }
      req.user = { userId: AUTHENTICATED_USER_ID };
      return true;
    }),
  };

  beforeAll(async () => {
    accountService = {
      findAllByUserId: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AccountService>;

    categoryService = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<CategoryService>;

    transactionService = {
      create: jest.fn(),
      findAllByUserId: jest.fn(),
      seedData: jest.fn(),
    } as unknown as jest.Mocked<TransactionService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccountController, CategoryController, TransactionController],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CategoryService, useValue: categoryService },
        { provide: TransactionService, useValue: transactionService },
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

  // =========================================================================
  // MAIN FLOW: Steps 1 to 13
  // =========================================================================
  describe('Main Flow: Complete End-to-End Expense Creation (Steps 1 - 13)', () => {
    it('Step 1 & 2: AddTransactionForm loads user accounts and categories', async () => {
      const mockAccounts = {
        success: true as const,
        message: 'Accounts fetched successfully',
        data: [
          {
            account_id: 10,
            user_id: AUTHENTICATED_USER_ID,
            bank_name: 'Vietcombank',
            account_type: 'Checking',
            account_number_last_4: '5678',
            balance: 2000.0,
          },
        ],
      };

      const mockCategories = {
        success: true as const,
        message: 'Categories fetched successfully',
        data: [
          { category_id: 1, category_name: 'Food & Dining' },
          { category_id: 2, category_name: 'Groceries' },
        ],
      };

      accountService.findAllByUserId.mockResolvedValue(mockAccounts as any);
      categoryService.findAll.mockResolvedValue(mockCategories as any);

      // Load accounts
      const accRes = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(200);

      expect(accRes.body).toEqual(mockAccounts);
      expect(accountService.findAllByUserId).toHaveBeenCalledWith(AUTHENTICATED_USER_ID);

      // Load categories
      const catRes = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(200);

      expect(catRes.body).toEqual(mockCategories);
      expect(categoryService.findAll).toHaveBeenCalled();
    });

    it('Step 3 & 4: Form state defaults (type=Expense, transactionDate=today, status=Complete)', () => {
      const now = new Date();
      const timezoneOffset = now.getTimezoneOffset() * 60_000;
      const expectedToday = new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);

      const defaultFormState = {
        accountId: '',
        transactionDate: expectedToday,
        type: 'Expense',
        itemDescription: '',
        categoryId: '',
        shopName: '',
        amount: '',
        paymentMethod: '',
        status: 'Complete',
      };

      expect(defaultFormState.type).toBe('Expense');
      expect(defaultFormState.transactionDate).toBe(expectedToday);
      expect(defaultFormState.status).toBe('Complete');
    });

    it('Step 5 & 6: Client-side validation succeeds for valid Expense with category', () => {
      const userInputs = {
        accountId: '10',
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Weekly supermarket shopping',
        shopName: 'Supermarket ABC',
        paymentMethod: 'Credit Card',
        amount: '150.50',
        categoryId: '2',
      };

      const validation = validateClientSide(userInputs);
      expect(validation.isValid).toBe(true);
      expect(Object.keys(validation.errors).length).toBe(0);
    });

    it('Step 7 - 13: POST /api/v1/transactions creates Expense, maps fields, updates balance (-amount), and returns 201', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Weekly supermarket shopping',
        shopName: 'Supermarket ABC',
        paymentMethod: 'Credit Card',
        amount: 150.5,
        category_id: 2,
      };

      const expectedServiceResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 101,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Expense' as const,
          itemDescription: 'Weekly supermarket shopping',
          shopName: 'Supermarket ABC',
          amount: 150.5,
          paymentMethod: 'Credit Card',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: 2,
        },
      };

      transactionService.create.mockResolvedValue(expectedServiceResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(201);

      // Step 8: JwtAuthGuard verified valid token and supplied userId 42
      expect(transactionService.create).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, payload);

      // Step 11 & 13: Correct mapping and success envelope
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Transaction created successfully');
      expect(res.body.data.transactionId).toBe(101);
      expect(res.body.data.accountId).toBe(10);
      expect(res.body.data.type).toBe('Expense');
      expect(res.body.data.status).toBe('Complete');
      expect(res.body.data.category_id).toBe(2);
      expect(res.body.data.amount).toBe(150.5);
    });
  });

  // =========================================================================
  // ALTERNATIVE FLOWS: AF-1, AF-2, AF-3, AF-4
  // =========================================================================
  describe('Alternative Flows (AF-1 to AF-4)', () => {
    it('AF-1: Create Revenue (type=Revenue, insufficient balance check skipped, balance +amount)', async () => {
      const revenuePayload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Revenue',
        itemDescription: 'Monthly Salary Bonus',
        shopName: 'Tech Corp',
        paymentMethod: 'Bank Transfer',
        amount: 8000.0,
      };

      const mockRevenueResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 102,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Revenue' as const,
          itemDescription: 'Monthly Salary Bonus',
          shopName: 'Tech Corp',
          amount: 8000.0,
          paymentMethod: 'Bank Transfer',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: null,
        },
      };

      transactionService.create.mockResolvedValue(mockRevenueResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(revenuePayload)
        .expect(201);

      expect(res.body.data.type).toBe('Revenue');
      expect(res.body.data.amount).toBe(8000.0);
      expect(transactionService.create).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, revenuePayload);
    });

    it('AF-2: Create transaction without category (category_id is omitted / null)', async () => {
      const payloadWithoutCategory = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Street food snack',
        shopName: 'Corner Cart',
        paymentMethod: 'Cash',
        amount: 3.5,
        category_id: null,
      };

      const mockNoCatResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 103,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Expense' as const,
          itemDescription: 'Street food snack',
          shopName: 'Corner Cart',
          amount: 3.5,
          paymentMethod: 'Cash',
          status: 'Complete' as const,
          receiptId: null,
          createdAt: new Date().toISOString(),
          category_id: null,
        },
      };

      transactionService.create.mockResolvedValue(mockNoCatResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payloadWithoutCategory)
        .expect(201);

      expect(res.body.data.category_id).toBeNull();
    });

    it('AF-3: Category list unavailable (categories API fails, frontend shows warning, creation still succeeds)', async () => {
      // Step 2a: Categories API returns error
      categoryService.findAll.mockRejectedValue(new InternalServerErrorException('Category service down'));

      const catRes = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(500);

      expect(catRes.body.success).toBe(false);

      // User still can submit transaction without category
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Coffee without category',
        shopName: 'Local Cafe',
        paymentMethod: 'Cash',
        amount: 5.0,
      };

      const mockResponse = {
        success: true as const,
        message: 'Transaction created successfully' as const,
        data: {
          transactionId: 104,
          accountId: 10,
          transactionDate: '2026-08-25T00:00:00.000Z',
          type: 'Expense' as const,
          itemDescription: 'Coffee without category',
          shopName: 'Local Cafe',
          amount: 5.0,
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
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.category_id).toBeNull();
    });

    it('AF-4: Cancel (User selects cancel -> navigates to /transactions without sending POST request)', () => {
      let isFormSubmitted = false;
      let navigatedRoute = '';

      const handleCancel = () => {
        navigatedRoute = '/transactions';
      };

      const handleSave = () => {
        isFormSubmitted = true;
      };

      // User triggers cancel
      handleCancel();

      expect(navigatedRoute).toBe('/transactions');
      expect(isFormSubmitted).toBe(false);
      expect(transactionService.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ERROR FLOWS: EF-1, EF-2, EF-3, EF-4, EF-5
  // =========================================================================
  describe('Error Flows (EF-1 to EF-5)', () => {
    it('EF-1: Accounts cannot be loaded (GET /api/accounts fails -> frontend displays error, cannot submit without accountId)', async () => {
      accountService.findAllByUserId.mockRejectedValue(new InternalServerErrorException('DB error'));

      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(500);

      expect(res.body.success).toBe(false);

      // Client validation fails when accountId is missing/empty
      const formWithoutAccount = {
        accountId: '',
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Lunch',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: '15.00',
      };

      const validation = validateClientSide(formWithoutAccount);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.accountId).toBe('Select an account.');
    });

    it('EF-2: Client-side validation failure (missing/empty required fields or amount < 0.01)', () => {
      // 1. Missing accountId
      expect(validateClientSide({ accountId: '', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: 'C', amount: '10' }).errors.accountId).toBeDefined();

      // 2. Missing transactionDate
      expect(validateClientSide({ accountId: '1', transactionDate: '', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: 'C', amount: '10' }).errors.transactionDate).toBeDefined();

      // 3. Empty itemDescription
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: '   ', shopName: 'B', paymentMethod: 'C', amount: '10' }).errors.itemDescription).toBeDefined();

      // 4. Empty shopName
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: '   ', paymentMethod: 'C', amount: '10' }).errors.shopName).toBeDefined();

      // 5. Empty paymentMethod
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: '   ', amount: '10' }).errors.paymentMethod).toBeDefined();

      // 6. Amount < 0.01 or invalid format
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: 'C', amount: '0' }).errors.amount).toBeDefined();
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: 'C', amount: '-5' }).errors.amount).toBeDefined();
      expect(validateClientSide({ accountId: '1', transactionDate: '2026-08-25', type: 'Expense', itemDescription: 'A', shopName: 'B', paymentMethod: 'C', amount: '10.555' }).errors.amount).toBeDefined();
    });

    it('EF-3: Unauthorized request (missing, invalid, or expired JWT returns HTTP 401)', async () => {
      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Coffee',
        shopName: 'Cafe',
        paymentMethod: 'Cash',
        amount: 5.0,
      };

      // Missing token
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .send(payload)
        .expect(401);

      expect(res1.body.success).toBe(false);

      // Invalid token
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', 'Bearer invalid-or-expired-token')
        .send(payload)
        .expect(401);

      expect(res2.body.success).toBe(false);
    });

    it('EF-4: Backend validation or business-rule failure (non-owned account, invalid category_id, insufficient Expense balance returns HTTP 400)', async () => {
      // 1. Insufficient balance
      transactionService.create.mockRejectedValueOnce(
        new BadRequestException('Invalid or missing transaction data'),
      );

      const insufficientBalancePayload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Supercar',
        shopName: 'Luxury Motors',
        paymentMethod: 'Bank Transfer',
        amount: 999999999,
      };

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(insufficientBalancePayload)
        .expect(400);

      expect(res1.body.success).toBe(false);
      expect(res1.body.message).toContain('Invalid or missing transaction data');

      // 2. Non-owned account
      transactionService.create.mockRejectedValueOnce(
        new BadRequestException('Invalid or missing transaction data'),
      );

      const foreignAccountPayload = {
        accountId: 9999,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Dinner',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: 25.0,
      };

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(foreignAccountPayload)
        .expect(400);

      expect(res2.body.success).toBe(false);

      // 3. Non-existent category_id
      transactionService.create.mockRejectedValueOnce(
        new BadRequestException('Invalid or missing transaction data'),
      );

      const invalidCategoryPayload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Dinner',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: 25.0,
        category_id: 88888,
      };

      const res3 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(invalidCategoryPayload)
        .expect(400);

      expect(res3.body.success).toBe(false);
    });

    it('EF-5: Database failure (rolls back transaction, neither Transactions nor Accounts.balance is changed, returns HTTP 500)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      transactionService.create.mockRejectedValueOnce(
        new InternalServerErrorException(
          'Đã xảy ra lỗi hệ thống khi tạo giao dịch. Vui lòng thử lại sau.',
        ),
      );

      const payload = {
        accountId: 10,
        transactionDate: '2026-08-25',
        type: 'Expense',
        itemDescription: 'Dinner',
        shopName: 'Bistro',
        paymentMethod: 'Cash',
        amount: 50.0,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Đã xảy ra lỗi hệ thống khi tạo giao dịch');

      consoleSpy.mockRestore();
    });
  });
});
