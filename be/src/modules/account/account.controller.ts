import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

/** Exposes protected, read-only account-list operations. */
@Controller('v1/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Returns safe account list data belonging only to the JWT subject. */
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() request: AuthenticatedRequest) {
    const data = await this.accountService.findAllByUserId(request.user.userId);

    return {
      success: true,
      message: 'Account list retrieved successfully.',
      data,
    };
  }
}
