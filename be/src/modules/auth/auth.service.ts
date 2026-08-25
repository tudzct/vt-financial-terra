import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { randomUUID } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface NormalizedRegistration {
  fullName: string;
  email: string;
  password: string;
}

interface NormalizedLogin {
  email: string;
  password: string;
}

/** Contains account registration business rules and persistence logic. */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Creates one normalized user and signs a token in the same database transaction. */
  async register(registerDto: RegisterDto) {
    const registration = this.validateAndNormalizeRegistration(registerDto);
    const queryRunner = this.userRepository.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingUser = await queryRunner.manager
        .createQueryBuilder(User, 'user')
        .where('LOWER(TRIM(user.email)) = :email', { email: registration.email })
        .getOne();

      if (existingUser) {
        throw new ConflictException('Conflict / This email is already registered.');
      }

      const passwordHash = await bcrypt.hash(registration.password, 10);
      const user = queryRunner.manager.create(User, {
        fullName: registration.fullName,
        email: registration.email,
        username: this.createUsername(registration.email),
        password: passwordHash,
        totalBalance: 0,
      });
      const savedUser = await queryRunner.manager.save(User, user);
      const accessToken = await this.signAccessToken(savedUser);

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

      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Conflict / This email is already registered.');
      }

      throw new InternalServerErrorException('Internal Server Error');
    } finally {
      await queryRunner.release();
    }
  }

  /** Authenticates valid credentials and returns only the safe session payload. */
  async login(loginDto: LoginDto) {
    const login = this.validateAndNormalizeLogin(loginDto);

    try {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(TRIM(user.email)) = :email', { email: login.email })
        .getOne();

      if (!user || !(await bcrypt.compare(login.password, user.password))) {
        throw new UnauthorizedException('Email or password is incorrect.');
      }

      const accessToken = await this.signAccessToken(user);

      return {
        success: true,
        message: 'Successful Login',
        data: {
          accessToken,
          user: {
            id: user.userId,
            fullName: user.fullName,
            email: user.email,
          },
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  /** Enforces BR-REG-01, BR-REG-02, BR-REG-04, BR-REG-05, and BR-REG-06. */
  private validateAndNormalizeRegistration(registerDto: RegisterDto): NormalizedRegistration {
    const fullName = this.normalize(registerDto.fullName);
    const email = this.normalize(registerDto.email).toLowerCase();
    const { password, confirmPassword } = registerDto;

    if (!fullName || fullName.length < 4 || fullName.length > 25) {
      throw new BadRequestException('Bad Request / Full name must be between 4 and 25 characters.');
    }

    if (!/^[\p{L}]+(?: [\p{L}]+)*$/u.test(fullName)) {
      throw new BadRequestException('Bad Request / Full name may contain letters separated by single spaces only.');
    }

    if (!email || email.length > 255 || !this.isValidEmail(email)) {
      throw new BadRequestException('Bad Request / Please provide a valid email address.');
    }

    if (password !== confirmPassword) {
      throw new BadRequestException('Bad Request / Passwords do not match');
    }

    if (password.length < 8 || password.length > 64) {
      throw new BadRequestException('Bad Request / Password must be between 8 and 64 characters.');
    }

    if (/\s/.test(password)) {
      throw new BadRequestException('Bad Request / Password must not contain whitespace.');
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new BadRequestException('Bad Request / Password must include uppercase, lowercase, and a number.');
    }

    if (!/[!@#$%^&*(){}\-_+=\[\],./<>?\\|:;]/.test(password)) {
      throw new BadRequestException('Bad Request / Password must include a special character.');
    }

    if (!/^[A-Za-z0-9!@#$%^&*(){}_=+\[\],./<>?\\|:;\-]+$/.test(password)) {
      throw new BadRequestException('Bad Request / Password contains unsupported characters.');
    }

    return { fullName, email, password };
  }

  /** Enforces BR-LOG-01 and BR-LOG-02 before attempting authentication. */
  private validateAndNormalizeLogin(loginDto: LoginDto): NormalizedLogin {
    const email = this.normalize(loginDto.email).toLowerCase();

    if (!email || !this.isValidEmail(email)) {
      throw new BadRequestException('Bad Request / Please provide a valid email address.');
    }

    if (!loginDto.password) {
      throw new BadRequestException('Bad Request / Password is required.');
    }

    return { email, password: loginDto.password };
  }

  /** Applies NFC and trim normalization required before validation and storage. */
  private normalize(value: string): string {
    return value.normalize('NFC').trim();
  }

  /** Performs an email-format check on an already normalized address. */
  private isValidEmail(email: string): boolean {
    return isEmail(email);
  }

  /** Derives a unique, non-sensitive username from the email prefix. */
  private createUsername(email: string): string {
    const emailPrefix = email.split('@')[0] || 'user';
    const base = emailPrefix.slice(0, 218);

    return `${base}-${randomUUID()}`;
  }

  /** Signs a JWT only after the user has been persisted within the transaction. */
  private async signAccessToken(user: User): Promise<string> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }

    return this.jwtService.signAsync(
      { sub: user.userId, email: user.email },
      {
        secret: jwtSecret,
        expiresIn: '1h',
      },
    );
  }

  /** Identifies database uniqueness violations produced during concurrent registration. */
  private isDuplicateKeyError(error: unknown): boolean {
    return error instanceof QueryFailedError
      && (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY';
  }
}
