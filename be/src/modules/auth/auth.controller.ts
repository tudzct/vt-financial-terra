import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Registration successful' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid registration input' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with an email address and password' })
  @ApiConsumes('application/json')
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid login input' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  async login(
    @Headers('content-type') contentType: string | undefined,
    @Body() dto: LoginDto,
  ) {
    if (!contentType?.toLowerCase().startsWith('application/json')) {
      throw new BadRequestException({
        success: false,
        message: 'Content-Type must be application/json.',
      });
    }

    return this.authService.login(dto);
  }
}
