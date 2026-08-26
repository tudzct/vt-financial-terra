import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../account/account.entity';
import { Category } from '../category/category.entity';

export enum TransactionType {
  REVENUE = 'Revenue',
  EXPENSE = 'Expense',
}

export enum TransactionStatus {
  COMPLETE = 'Complete',
  PENDING = 'Pending',
  FAILED = 'Failed',
}

@Entity('Transactions')
export class Transaction {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  transactionId: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: Date;

  @Column({
    name: 'type',
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ name: 'item_description', type: 'varchar', length: 500 })
  itemDescription: string;

  @Column({ name: 'shop_name', type: 'varchar', length: 255, nullable: true })
  shopName: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  amount: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 100, nullable: true })
  paymentMethod: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'receipt_id', type: 'varchar', length: 255, nullable: true })
  receiptId: string | null;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.transactions, {
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  // @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: true })
  // createdAt: Date;

  // @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  // updatedAt: Date;
}

