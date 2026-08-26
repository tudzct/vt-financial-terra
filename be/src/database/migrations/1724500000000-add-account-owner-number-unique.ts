import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enforces account-number uniqueness within each account owner at the database level. */
export class AddAccountOwnerNumberUnique1724500000000 implements MigrationInterface {
  name = 'AddAccountOwnerNumberUnique1724500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `Accounts` ADD CONSTRAINT `UQ_accounts_user_id_account_number_full` UNIQUE (`user_id`, `account_number_full`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `Accounts` DROP INDEX `UQ_accounts_user_id_account_number_full`',
    );
  }
}
