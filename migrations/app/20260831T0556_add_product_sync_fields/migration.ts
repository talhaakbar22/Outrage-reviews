#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/313afba434db8f2796e5d1e2c8134c9ee930b3206447d9db4c4e82a4e866616e/contract';
import startContract from '../../snapshots/313afba434db8f2796e5d1e2c8134c9ee930b3206447d9db4c4e82a4e866616e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c8e727ba2bf87250e1f8ad3fb05ee196cb2b9f4e7e5a35de2c6c7d7ccf91f782/contract';
import endContract from '../../snapshots/c8e727ba2bf87250e1f8ad3fb05ee196cb2b9f4e7e5a35de2c6c7d7ccf91f782/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('avgRating', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('lastSyncedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('reviewCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
