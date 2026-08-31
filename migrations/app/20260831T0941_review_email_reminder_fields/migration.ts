#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5f60471eb2a8686124b8d07a79070eb9777d552d5fbdb436361b7feb9dc87d0f/contract';
import endContract from '../../snapshots/5f60471eb2a8686124b8d07a79070eb9777d552d5fbdb436361b7feb9dc87d0f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7cc1b868dd00c550f5d0d310f763625c522cfc11e42e7c6a7f327c9cc5520910/contract';
import startContract from '../../snapshots/7cc1b868dd00c550f5d0d310f763625c522cfc11e42e7c6a7f327c9cc5520910/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'review_request',
        column: col('remindedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'shop_settings',
        column: col('reminderDelayDays', 'int4', {
          notNull: true,
          default: lit(7),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
