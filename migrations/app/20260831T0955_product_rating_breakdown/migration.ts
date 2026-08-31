#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5f60471eb2a8686124b8d07a79070eb9777d552d5fbdb436361b7feb9dc87d0f/contract';
import startContract from '../../snapshots/5f60471eb2a8686124b8d07a79070eb9777d552d5fbdb436361b7feb9dc87d0f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b41e2437cefdcefb96eec5608c89eea1fcbf05c69e5f61641424808c573b4ff7/contract';
import endContract from '../../snapshots/b41e2437cefdcefb96eec5608c89eea1fcbf05c69e5f61641424808c573b4ff7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('ratingBreakdown', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
