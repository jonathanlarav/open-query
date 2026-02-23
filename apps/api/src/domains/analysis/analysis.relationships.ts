import type { Database } from '@open-query/db';
import { findTableContext, upsertTableContext } from '@open-query/db';
import type { TableSchema } from '../../infrastructure/connectors/types.js';

/**
 * Enriches table context with foreign-key relationship notes.
 * Only updates tables that don't already have a businessPurpose.
 */
export function enrichWithRelationships(
  db: Database,
  connectionId: string,
  tables: TableSchema[]
): void {
  for (const table of tables) {
    const fkCols = table.columns.filter((c) => c.isForeignKey && c.foreignKeyTable);
    if (fkCols.length === 0) continue;

    const existing = findTableContext(db, connectionId, table.name);
    if (existing?.businessPurpose) continue; // don't overwrite AI-generated purpose

    const relatedTables = [...new Set(fkCols.map((c) => c.foreignKeyTable!))];
    upsertTableContext(db, {
      connectionId,
      tableName: table.name,
      businessPurpose: `References: ${relatedTables.join(', ')}`,
      isInferred: true,
    });
  }
}
