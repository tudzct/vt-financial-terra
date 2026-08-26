import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AccountController } from '../src/modules/account/account.controller';
import { AccountService } from '../src/modules/account/account.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { CategoryController } from '../src/modules/category/category.controller';
import { CategoryService } from '../src/modules/category/category.service';
import { GlobalExceptionFilter } from '../src/filters/http-exception.filter';

describe('Transaction form option APIs', () => {
  let app: INestApplication;
  let accountService: jest.Mocked<AccountService>;
  let categoryService: jest.Mocked<CategoryService>;

  const mockJwtGuard = {
    canActivate: jest.fn((context) => {
      context.switchToHttp().getRequest().user = { userId: 7 };
      return true;
    }),
  };

  beforeAll(async () => {
    accountService = {
      findAllByUserId: jest.fn(),
    } as unknown as jest.Mocked<AccountService>;
    categoryService = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<CategoryService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccountController, CategoryController],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CategoryService, useValue: categoryService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves user-owned accounts at GET /api/accounts', async () => {
    const expectedResponse = {
      success: true as const,
      message: 'Accounts fetched successfully',
      data: [{
        account_id: 12,
        user_id: 7,
        bank_name: 'Vietcombank',
        account_type: 'Checking',
        account_number_last_4: '1234',
        balance: 250000,
      }],
    };
    accountService.findAllByUserId.mockResolvedValue(expectedResponse);

    const response = await request(app.getHttpServer()).get('/api/accounts').expect(200);

    expect(response.body).toEqual(expectedResponse);
    expect(accountService.findAllByUserId).toHaveBeenCalledWith(7);
  });

  it('serves categories at GET /api/categories', async () => {
    const expectedResponse = {
      success: true as const,
      message: 'Categories fetched successfully',
      data: [{ category_id: 3, category_name: 'Food' }],
    };
    categoryService.findAll.mockResolvedValue(expectedResponse);

    const response = await request(app.getHttpServer()).get('/api/categories').expect(200);

    expect(response.body).toEqual(expectedResponse);
    expect(categoryService.findAll).toHaveBeenCalledTimes(1);
  });
});
