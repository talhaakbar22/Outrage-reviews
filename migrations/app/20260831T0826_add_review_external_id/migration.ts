#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c8e727ba2bf87250e1f8ad3fb05ee196cb2b9f4e7e5a35de2c6c7d7ccf91f782/contract';
import startContract from '../../snapshots/c8e727ba2bf87250e1f8ad3fb05ee196cb2b9f4e7e5a35de2c6c7d7ccf91f782/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fbd72312742746acb90b028cc166fd097c90a5c56bf06259fead8a41ec155a25/contract';
import endContract from '../../snapshots/fbd72312742746acb90b028cc166fd097c90a5c56bf06259fead8a41ec155a25/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'review',
        column: col('externalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'review',
        constraint: 'review_shopId_externalId_key',
        columns: ['shopId', 'externalId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
