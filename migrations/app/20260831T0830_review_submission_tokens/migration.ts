#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7cc1b868dd00c550f5d0d310f763625c522cfc11e42e7c6a7f327c9cc5520910/contract';
import endContract from '../../snapshots/7cc1b868dd00c550f5d0d310f763625c522cfc11e42e7c6a7f327c9cc5520910/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fbd72312742746acb90b028cc166fd097c90a5c56bf06259fead8a41ec155a25/contract';
import startContract from '../../snapshots/fbd72312742746acb90b028cc166fd097c90a5c56bf06259fead8a41ec155a25/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'review_request',
        constraint: 'review_request_token_key',
      }),
      this.dropColumn({ schema: 'public', table: 'review_request', column: 'token' }),
      this.addColumn({
        schema: 'public',
        table: 'review_request',
        column: col('tokenHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'review',
        constraint: 'review_orderLineItemId_key',
        columns: ['orderLineItemId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'review_request',
        constraint: 'review_request_tokenHash_key',
        columns: ['tokenHash'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
