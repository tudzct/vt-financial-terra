import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountType } from '../account.entity';

/** Validates the fields accepted by API-ACCOUNT-CREATE. */
export class CreateAccountDto {
  @IsString({ message: 'Bank name must be a string.' })
  @IsNotEmpty({ message: 'Bank name is required.' })
  @MaxLength(255, { message: 'Bank name must not exceed 255 characters.' })
  bank_name: string;

  @IsEnum(AccountType, { message: 'Account type is invalid.' })
  account_type: AccountType;

  @IsOptional()
  @IsString({ message: 'Branch name must be a string.' })
  @MaxLength(255, { message: 'Branch name must not exceed 255 characters.' })
  branch_name?: string | null;

  @IsString({ message: 'Account number must be a string.' })
  @Matches(/^\d{8,34}$/, {
    message: 'Account number must contain 8 to 34 digits.',
  })
  account_number_full: string;

  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Balance must be a number.' })
  @Min(0, { message: 'Balance must be greater than or equal to 0.' })
  balance: number;
}

/** Defines the safe account data returned after a successful creation. */
export interface CreateAccountResponseDto {
  success: true;
  message: 'Account created successfully';
  data: {
    account: {
      id: number;
      user_id: number;
      bank_name: string;
      account_type: AccountType;
      branch_name: string | null;
      account_number_last_4: string;
      balance: number;
    };
  };
}
