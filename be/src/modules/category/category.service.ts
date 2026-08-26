import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CategoryListResponseDto } from './dto/category-list-response.dto';

/** Retrieves categories available for transaction classification. */
@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  /** Returns all categories in the frontend API contract. */
  async findAll(): Promise<CategoryListResponseDto> {
    try {
      const categories = await this.categoryRepository.find({
        order: { categoryName: 'ASC' },
      });

      return {
        success: true,
        message: 'Categories fetched successfully',
        data: categories.map((category) => ({
          category_id: category.categoryId,
          category_name: category.categoryName,
        })),
      };
    } catch {
      throw new InternalServerErrorException('Unable to fetch categories');
    }
  }
}
