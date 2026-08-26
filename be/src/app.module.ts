import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { AccountModule } from './modules/account/account.module';
import { CategoryModule } from './modules/category/category.module';

@Module({
  imports: [DatabaseModule, AuthModule, TransactionModule, AccountModule, CategoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
