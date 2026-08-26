import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

/** Handles authenticated account requests, including API-ACCOUNT-CREATE and single account retrieval. */
@Controller(['accounts', 'v1/accounts'])
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Returns accounts that can be selected when creating a transaction. */
  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.accountService.findAllByUserId(request.user.userId);
  }

  /** Returns a single account owned by the authenticated user. */
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const accountId = Number(id);
    if (!Number.isSafeInteger(accountId) || accountId <= 0 || !/^\d+$/.test(id)) {
      throw new BadRequestException('Invalid account ID');
    }
    return this.accountService.findOne(request.user.userId, accountId);
  }

  /** Creates one account owned by the authenticated JWT subject. */
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createAccountDto: CreateAccountDto,
  ) {
    return this.accountService.create(request.user.userId, createAccountDto);
  }
}
