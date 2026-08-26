/** Category shape returned to the transaction form. */
export interface CategoryListItemDto {
  category_id: number;
  category_name: string;
}

/** Standard API envelope for a category-list response. */
export interface CategoryListResponseDto {
  success: true;
  message: string;
  data: CategoryListItemDto[];
}
