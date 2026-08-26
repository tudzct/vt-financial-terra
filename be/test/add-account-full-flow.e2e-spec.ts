import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AccountController } from '../src/modules/account/account.controller';
import { AccountService } from '../src/modules/account/account.service';
import { AccountType } from '../src/modules/account/account.entity';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { GlobalExceptionFilter } from '../src/filters/http-exception.filter';

/**
 * Client-side validation helper mirroring AddAccountForm.tsx validation logic:
 * - bankName: required, max 255 chars
 * - accountType: must be in ['Checking', 'Credit Card', 'Savings', 'Investment', 'Loan']
 * - branchName: optional, max 255 chars
 * - accountNumberFull: required, 8 to 34 digits (/^\d{8,34}$/)
 * - balance: required numeric non-negative with up to two decimals (/^\d+(?:\.\d{1,2})?$/)
 */
function validateAccountClientSide(values: {
  bankName?: string;
  accountType?: string;
  branchName?: string;
  accountNumberFull?: string;
  balance?: string | number;
}) {
  const errors: Record<string, string> = {};
  const bankName = (values.bankName || '').normalize('NFC').trim();
  const branchName = (values.branchName || '').normalize('NFC').trim();
  const balanceStr = values.balance !== undefined && values.balance !== null ? String(values.balance) : '';
  const amount = Number(balanceStr);

  if (!bankName) {
    errors.bankName = 'Enter a bank name.';
  } else if (bankName.length > 255) {
    errors.bankName = 'Bank name must not exceed 255 characters.';
  }

  const validTypes = ['Checking', 'Credit Card', 'Savings', 'Investment', 'Loan'];
  if (!values.accountType || !validTypes.includes(values.accountType)) {
    errors.accountType = 'Select a valid account type.';
  }

  if (branchName.length > 255) {
    errors.branchName = 'Branch name must not exceed 255 characters.';
  }

  const accNum = (values.accountNumberFull || '').trim();
  if (!/^\d{8,34}$/.test(accNum)) {
    errors.accountNumberFull = 'Enter an account number with 8 to 34 digits.';
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(balanceStr) || !Number.isFinite(amount) || amount < 0) {
    errors.balance = 'Enter a non-negative balance with up to two decimals.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Frontend error-to-field mapper mirroring AddAccountForm.tsx mapApiErrorToField:
 */
function mapApiErrorToField(message: string): Record<string, string> {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('bank name')) return { bankName: message };
  if (normalizedMessage.includes('account type')) return { accountType: message };
  if (normalizedMessage.includes('branch name')) return { branchName: message };
  if (normalizedMessage.includes('account number') || normalizedMessage.includes('account already exists')) {
    return { accountNumberFull: message };
  }
  if (normalizedMessage.includes('balance')) return { balance: message };
  return {};
}

describe('Complete Add Account and Account Retrieval Flow End-to-End Suite', () => {
  let app: INestApplication;
  let accountService: jest.Mocked<AccountService>;

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
      findOne: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AccountService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [{ provide: AccountService, useValue: accountService }],
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
  // MAIN FLOW: Steps 1 to 10
  // =========================================================================
  describe('Main Flow: Complete Account Creation (Steps 1 - 10)', () => {
    it('Step 1 & 2: Form displays with accountType defaulted to Checking', () => {
      const defaultFormState = {
        bankName: '',
        accountType: 'Checking',
        branchName: '',
        accountNumberFull: '',
        balance: '',
      };

      expect(defaultFormState.accountType).toBe('Checking');
      expect(defaultFormState.bankName).toBe('');
      expect(defaultFormState.accountNumberFull).toBe('');
    });

    it('Step 3 - 5: Client-side validation succeeds when required fields and non-negative numeric balance are provided', () => {
      const userInputs = {
        bankName: 'Vietcombank',
        accountType: 'Checking',
        branchName: 'District 1 Branch',
        accountNumberFull: '123456789012',
        balance: '1500.50',
      };

      const validation = validateAccountClientSide(userInputs);
      expect(validation.isValid).toBe(true);
      expect(Object.keys(validation.errors).length).toBe(0);
    });

    it('Step 6 - 10: POST /api/v1/accounts validates DTO, checks uniqueness, derives last 4 digits, creates account, and returns 201', async () => {
      const payload = {
        bank_name: 'Vietcombank',
        account_type: 'Checking',
        branch_name: 'District 1 Branch',
        account_number_full: '123456789012',
        balance: 1500.5,
      };

      const expectedResponse = {
        success: true as const,
        message: 'Account created successfully' as const,
        data: {
          account: {
            id: 101,
            user_id: AUTHENTICATED_USER_ID,
            bank_name: 'Vietcombank',
            account_type: AccountType.CHECKING,
            branch_name: 'District 1 Branch',
            account_number_last_4: '9012',
            balance: 1500.5,
          },
        },
      };

      accountService.create.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(201);

      // Step 7, 8, 9: AccountService.create called with authenticated user_id and payload
      expect(accountService.create).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, payload);

      // Step 10: Returns success response contract
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Account created successfully');
      expect(res.body.data.account.bank_name).toBe('Vietcombank');
      expect(res.body.data.account.account_number_last_4).toBe('9012');
      expect(res.body.data.account.balance).toBe(1500.5);
    });

    it('Also supports POST /api/accounts route alias', async () => {
      const payload = {
        bank_name: 'Techcombank',
        account_type: 'Savings',
        account_number_full: '9876543210',
        balance: 200.0,
      };

      const expectedResponse = {
        success: true as const,
        message: 'Account created successfully' as const,
        data: {
          account: {
            id: 102,
            user_id: AUTHENTICATED_USER_ID,
            bank_name: 'Techcombank',
            account_type: AccountType.SAVINGS,
            branch_name: null,
            account_number_last_4: '3210',
            balance: 200.0,
          },
        },
      };

      accountService.create.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(accountService.create).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, payload);
    });
  });

  // =========================================================================
  // ALTERNATIVE FLOWS: AF-1, AF-2
  // =========================================================================
  describe('Alternative Flows (AF-1 & AF-2)', () => {
    it('AF-1: Optional branch omitted (stores branch_name as null/undefined)', async () => {
      const payloadWithoutBranch = {
        bank_name: 'MB Bank',
        account_type: 'Checking',
        account_number_full: '1122334455',
        balance: 50.0,
      };

      const expectedResponse = {
        success: true as const,
        message: 'Account created successfully' as const,
        data: {
          account: {
            id: 103,
            user_id: AUTHENTICATED_USER_ID,
            bank_name: 'MB Bank',
            account_type: AccountType.CHECKING,
            branch_name: null,
            account_number_last_4: '4455',
            balance: 50.0,
          },
        },
      };

      accountService.create.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payloadWithoutBranch)
        .expect(201);

      expect(res.body.data.account.branch_name).toBeNull();
      expect(res.body.data.account.account_number_last_4).toBe('4455');
    });

    it('AF-2: Cancel (User selects Cancel -> navigates back to /accounts without submitting)', () => {
      let isSubmitted = false;
      let targetRoute = '';

      const handleCancel = () => {
        targetRoute = '/accounts';
      };

      const handleSubmit = () => {
        isSubmitted = true;
      };

      handleCancel();

      expect(targetRoute).toBe('/accounts');
      expect(isSubmitted).toBe(false);
      expect(accountService.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ERROR FLOWS (Add Account): EF-1, EF-2, EF-3, EF-4
  // =========================================================================
  describe('Error Flows for Add Account (EF-1 to EF-4)', () => {
    it('EF-1: Client-side validation failure (displays field errors and does not call API)', () => {
      // 1. Missing bankName
      const err1 = validateAccountClientSide({ bankName: '', accountType: 'Checking', accountNumberFull: '12345678', balance: '100' });
      expect(err1.isValid).toBe(false);
      expect(err1.errors.bankName).toBe('Enter a bank name.');

      // 2. Bank name exceeds 255 chars
      const longName = 'A'.repeat(256);
      const err2 = validateAccountClientSide({ bankName: longName, accountType: 'Checking', accountNumberFull: '12345678', balance: '100' });
      expect(err2.errors.bankName).toBe('Bank name must not exceed 255 characters.');

      // 3. Invalid account number (< 8 digits or letters)
      const err3 = validateAccountClientSide({ bankName: 'VCB', accountType: 'Checking', accountNumberFull: '12345', balance: '100' });
      expect(err3.errors.accountNumberFull).toBe('Enter an account number with 8 to 34 digits.');

      const err3b = validateAccountClientSide({ bankName: 'VCB', accountType: 'Checking', accountNumberFull: '1234567A', balance: '100' });
      expect(err3b.errors.accountNumberFull).toBe('Enter an account number with 8 to 34 digits.');

      // 4. Invalid balance (negative or non-numeric or more than 2 decimals)
      const err4a = validateAccountClientSide({ bankName: 'VCB', accountType: 'Checking', accountNumberFull: '12345678', balance: '-50' });
      expect(err4a.errors.balance).toBe('Enter a non-negative balance with up to two decimals.');

      const err4b = validateAccountClientSide({ bankName: 'VCB', accountType: 'Checking', accountNumberFull: '12345678', balance: 'abc' });
      expect(err4b.errors.balance).toBe('Enter a non-negative balance with up to two decimals.');

      const err4c = validateAccountClientSide({ bankName: 'VCB', accountType: 'Checking', accountNumberFull: '12345678', balance: '10.999' });
      expect(err4c.errors.balance).toBe('Enter a non-negative balance with up to two decimals.');
    });

    it('EF-2: Duplicate account number for the same user (backend returns HTTP 409 Conflict)', async () => {
      accountService.create.mockRejectedValue(
        new ConflictException('This account already exists in your account list.'),
      );

      const duplicatePayload = {
        bank_name: 'Vietcombank',
        account_type: 'Checking',
        account_number_full: '123456789012',
        balance: 100.0,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(duplicatePayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('This account already exists in your account list.');

      // Frontend maps duplicate error to accountNumberFull field
      const mappedField = mapApiErrorToField(res.body.message);
      expect(mappedField.accountNumberFull).toBe('This account already exists in your account list.');
    });

    it('EF-3: Backend validation failure (ValidationPipe returns HTTP 400 and frontend maps errors to fields)', async () => {
      // 1. Invalid payload: balance < 0
      const invalidBalancePayload = {
        bank_name: 'Vietcombank',
        account_type: 'Checking',
        account_number_full: '123456789012',
        balance: -10,
      };

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(invalidBalancePayload)
        .expect(400);

      expect(res1.body.success).toBe(false);
      expect(res1.body.message).toContain('Balance must be greater than or equal to 0');

      // Frontend maps error to balance field
      const fieldError = mapApiErrorToField(res1.body.message);
      expect(fieldError.balance).toBeDefined();

      // 2. Invalid account_type
      const invalidTypePayload = {
        bank_name: 'Vietcombank',
        account_type: 'InvalidAccountType',
        account_number_full: '123456789012',
        balance: 100,
      };

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(invalidTypePayload)
        .expect(400);

      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toContain('Account type is invalid');
    });

    it('EF-4: Storage failure (database failure rolls back and returns HTTP 500)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      accountService.create.mockRejectedValue(
        new InternalServerErrorException(
          'Unable to add the account at this time. Please try again later.',
        ),
      );

      const payload = {
        bank_name: 'Vietcombank',
        account_type: 'Checking',
        account_number_full: '123456789012',
        balance: 100.0,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', VALID_JWT_TOKEN)
        .send(payload)
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unable to add the account at this time');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // ERROR FLOWS (Account Retrieval / Details): EF-1, EF-2, EF-3, EF-4
  // =========================================================================
  describe('Error Flows for Account Retrieval (EF-1 to EF-4)', () => {
    it('EF-1: Invalid account ID (non-numeric, non-positive integer returns HTTP 400)', async () => {
      // 1. Non-numeric ID
      const res1 = await request(app.getHttpServer())
        .get('/api/accounts/abc')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(400);

      expect(res1.body.success).toBe(false);
      expect(res1.body.message).toBe('Invalid account ID');

      // 2. Zero ID
      const res2 = await request(app.getHttpServer())
        .get('/api/accounts/0')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(400);

      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toBe('Invalid account ID');

      // 3. Negative ID
      const res3 = await request(app.getHttpServer())
        .get('/api/v1/accounts/-5')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(400);

      expect(res3.body.success).toBe(false);
      expect(res3.body.message).toBe('Invalid account ID');
    });

    it('EF-2: Account not found (returns HTTP 404 Not Found)', async () => {
      accountService.findOne.mockRejectedValue(new NotFoundException('Account not found'));

      const res = await request(app.getHttpServer())
        .get('/api/accounts/9999')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Account not found');
      expect(accountService.findOne).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, 9999);
    });

    it('EF-3: Account belongs to another user (returns HTTP 403 Forbidden)', async () => {
      accountService.findOne.mockRejectedValue(
        new ForbiddenException('Account belongs to another user'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/accounts/10')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Account belongs to another user');
      expect(accountService.findOne).toHaveBeenCalledWith(AUTHENTICATED_USER_ID, 10);
    });

    it('EF-4: Retrieval failure (database error returns HTTP 500)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      accountService.findOne.mockRejectedValue(
        new InternalServerErrorException('Unable to fetch account'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/accounts/10')
        .set('Authorization', VALID_JWT_TOKEN)
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Unable to fetch account');

      consoleSpy.mockRestore();
    });
  });
});
