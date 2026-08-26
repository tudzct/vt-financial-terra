import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountController } from './account.controller';
import { Account } from './account.entity';
import { AccountService } from './account.service';

/** Groups authenticated account retrieval dependencies. */
@Module({
  imports: [TypeOrmModule.forFeature([Account, User]), JwtModule.register({})],
  controllers: [AccountController],
  providers: [AccountService, JwtAuthGuard],
})
export class AccountModule {}
