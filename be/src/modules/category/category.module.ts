import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoryController } from './category.controller';
import { Category } from './category.entity';
import { CategoryService } from './category.service';

/** Groups authenticated category retrieval dependencies. */
@Module({
  imports: [TypeOrmModule.forFeature([Category, User]), JwtModule.register({})],
  controllers: [CategoryController],
  providers: [CategoryService, JwtAuthGuard],
})
export class CategoryModule {}
