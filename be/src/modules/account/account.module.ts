import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AccountController } from './account.controller';
import { Account } from './account.entity';
import { AccountService } from './account.service';

/** Groups the protected account controller with its persistence service. */
@Module({
  imports: [TypeOrmModule.forFeature([Account]), AuthModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
