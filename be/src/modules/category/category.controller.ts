import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoryService } from './category.service';

/** Handles category-list requests for authenticated transaction forms. */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /** Returns categories that can be selected when creating a transaction. */
  @Get()
  findAll() {
    return this.categoryService.findAll();
  }
}
