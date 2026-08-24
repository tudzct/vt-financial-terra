import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { RegisterDto } from './dto/register.dto';

type RegistrationErrorField =
  | 'fullName'
  | 'email'
  | 'password'
  | 'confirmPassword';

interface NormalizedRegistration {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: true;
  message: 'Registration successful';
  data: {
    accessToken: string;
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  };
}

@Injectable()
export class AuthService {
  private static readonly BCRYPT_SALT_ROUNDS = 10;
  private static readonly NAME_PATTERN = /^[\p{L}]+(?: [\p{L}]+)*$/u;
  private static readonly PASSWORD_ALLOWED_PATTERN =
    /^[A-Za-z0-9!@#$%^&*(){}_=+\[\],./<>?\\|:;\-]+$/;
  private static readonly PASSWORD_SPECIAL_PATTERN =
    /[!@#$%^&*(){}\-_+=\[\],./<>?\\|:;]/;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    // BR-REG-01, BR-REG-02, and BR-REG-04 through BR-REG-06.
    const registration = this.normalizeAndValidate(dto);

    // BR-REG-03: an early normalized-email check improves the ordinary path;
    // the database unique constraint remains authoritative for concurrent requests.
    if (await this.emailExists(registration.email)) {
      this.throwConflict();
    }

    // BR-REG-09: the only password value that reaches persistence is a bcrypt hash.
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(
        registration.password,
        AuthService.BCRYPT_SALT_ROUNDS,
      );
    } catch {
      throw new InternalServerErrorException({
        success: false,
        message: 'Registration failed. Please try again.',
      });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const queryRunner = this.dataSource.createQueryRunner();

      try {
        // BR-REG-08, BR-REG-10, and BR-REG-11: persistence and token issuance
        // share one transaction, so token failure cannot leave a usable account.
        await queryRunner.connect();
        await queryRunner.startTransaction();

        if (await this.emailExists(registration.email, queryRunner.manager)) {
          this.throwConflict();
        }

        const user = queryRunner.manager.create(User, {
          fullName: registration.fullName,
          email: registration.email,
          username: await this.createUniqueUsername(
            registration.email,
            queryRunner.manager,
          ),
          password: passwordHash,
          totalBalance: 0,
        });
        const savedUser = await queryRunner.manager.save(user);
        const accessToken = await this.jwtService.signAsync({
          sub: savedUser.userId,
          email: savedUser.email,
        });

        await queryRunner.commitTransaction();

        return {
          success: true,
          message: 'Registration successful',
          data: {
            accessToken,
            user: {
              id: savedUser.userId,
              fullName: savedUser.fullName,
              email: savedUser.email,
            },
          },
        };
      } catch (error) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }

        if (error instanceof BadRequestException || error instanceof ConflictException) {
          throw error;
        }

        if (this.isDuplicateEntryError(error)) {
          if (await this.emailExists(registration.email)) {
            this.throwConflict();
          }

          if (attempt < 2) {
            continue;
          }
        }

        throw new InternalServerErrorException({
          success: false,
          message: 'Registration failed. Please try again.',
        });
      } finally {
        await queryRunner.release();
      }
    }

    throw new InternalServerErrorException({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }

  private normalizeAndValidate(dto: RegisterDto): NormalizedRegistration {
    if (typeof dto?.fullName !== 'string') {
      this.throwBadRequest('fullName', 'Name is required.');
    }
    const fullName = dto.fullName.normalize('NFC').trim();
    const nameLength = Array.from(fullName).length;
    if (nameLength < 4 || nameLength > 25) {
      this.throwBadRequest('fullName', 'Name must be between 4 and 25 characters.');
    }
    if (!AuthService.NAME_PATTERN.test(fullName)) {
      this.throwBadRequest(
        'fullName',
        'Name may contain only letters separated by single spaces.',
      );
    }

    if (typeof dto?.email !== 'string') {
      this.throwBadRequest('email', 'Email address is required.');
    }
    const email = dto.email.trim().toLowerCase();
    if (email.length === 0 || email.length > 255 || !this.isEmail(email)) {
      this.throwBadRequest('email', 'Enter a valid email address.');
    }

    if (typeof dto?.password !== 'string') {
      this.throwBadRequest('password', 'Password is required.');
    }
    if (dto.password.length < 8 || dto.password.length > 64) {
      this.throwBadRequest('password', 'Password must be between 8 and 64 characters.');
    }
    if (/\s/.test(dto.password)) {
      this.throwBadRequest('password', 'Password must not contain whitespace.');
    }
    if (!AuthService.PASSWORD_ALLOWED_PATTERN.test(dto.password)) {
      this.throwBadRequest('password', 'Password contains unsupported characters.');
    }
    if (
      !/[a-z]/.test(dto.password) ||
      !/[A-Z]/.test(dto.password) ||
      !/[0-9]/.test(dto.password) ||
      !AuthService.PASSWORD_SPECIAL_PATTERN.test(dto.password)
    ) {
      this.throwBadRequest(
        'password',
        'Password must include uppercase, lowercase, number, and special character.',
      );
    }

    if (typeof dto?.confirmPassword !== 'string' || dto.confirmPassword.length === 0) {
      this.throwBadRequest('confirmPassword', 'Please confirm your password.');
    }
    if (dto.confirmPassword !== dto.password) {
      this.throwBadRequest('confirmPassword', 'Passwords do not match.');
    }

    return { fullName, email, password: dto.password };
  }

  private isEmail(value: string): boolean {
    return isEmail(value);
  }

  private async emailExists(email: string, manager?: EntityManager): Promise<boolean> {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    return repository
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = :email', { email })
      .getExists();
  }

  private async createUniqueUsername(
    email: string,
    manager: EntityManager,
  ): Promise<string> {
    const localPart = email.slice(0, email.indexOf('@'));
    const base =
      localPart
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .slice(0, 240) || 'user';
    const repository = manager.getRepository(User);

    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const suffixText = suffix === 0 ? '' : `-${suffix}`;
      const username = `${base.slice(0, 255 - suffixText.length)}${suffixText}`;
      const existingUser = await repository.findOne({
        where: { username },
        select: { userId: true },
      });
      if (!existingUser) {
        return username;
      }
    }

    throw new Error('Unable to allocate username');
  }

  private throwBadRequest(field: RegistrationErrorField, message: string): never {
    throw new BadRequestException({ success: false, message, error: field });
  }

  private throwConflict(): never {
    throw new ConflictException({
      success: false,
      message: 'This email is already registered.',
      error: 'email',
    });
  }

  private isDuplicateEntryError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ((error as { code?: string }).code === 'ER_DUP_ENTRY' ||
        (error as { code?: string }).code === '23505')
    );
  }

}
