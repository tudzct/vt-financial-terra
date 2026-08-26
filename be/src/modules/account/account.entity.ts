import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Transaction } from '../transaction/transaction.entity';

export enum AccountType {
  CHECKING = 'Checking',
  CREDIT_CARD = 'Credit Card',
  SAVINGS = 'Savings',
  INVESTMENT = 'Investment',
  LOAN = 'Loan',
}

@Entity('Accounts')
@Unique('UQ_accounts_user_id_account_number_full', ['userId', 'accountNumberFull'])
export class Account {
  @PrimaryGeneratedColumn({ name: 'account_id' })
  accountId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, (user) => user.accounts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'bank_name', type: 'varchar', length: 255 })
  bankName: string;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: AccountType,
  })
  accountType: AccountType;

  @Column({ name: 'branch_name', type: 'varchar', length: 255, nullable: true })
  branchName: string;

  @Column({ name: 'account_number_full', type: 'varchar', length: 255 })
  accountNumberFull: string;

  @Column({ name: 'account_number_last_4', type: 'varchar', length: 4 })
  accountNumberLast4: string;

  @Column({
    name: 'balance',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  balance: number;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];

}

