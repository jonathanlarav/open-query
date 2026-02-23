import { z } from 'zod';
import {
  findTableContexts,
  findAllColumnContexts,
  upsertTableContext,
  upsertColumnContext,
  findLatestSnapshot,
} from '@open-query/db';
import type { Database } from '@open-query/db';
import { getLanguageModel } from '../../infrastructure/llm/provider-factory.js';
import { findSettings } from '@open-query/db';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import type { TableInfo } from '@open-query/shared';
import { generateText } from 'ai';

export const UpdateContextSchema = z.object({
  tables: z.array(
    z.object({
      tableName: z.string(),
      description: z.string().optional(),
      businessPurpose: z.string().optional(),
      columns: z
        .array(
          z.object({
            columnName: z.string(),
            description: z.string().optional(),
            exampleValues: z.array(z.string()).optional(),
          })
        )
        .optional(),
    })
  ),
});

export type UpdateContextInput = z.infer<typeof UpdateContextSchema>;

export class ContextService {
  constructor(private readonly db: Database) {}

  getContext(connectionId: string) {
    const tableContexts = findTableContexts(this.db, connectionId);
    const columnContexts = findAllColumnContexts(this.db, connectionId);
    return { tableContexts, columnContexts };
  }

  updateContext(connectionId: string, input: UpdateContextInput) {
    for (const table of input.tables) {
      upsertTableContext(this.db, {
        connectionId,
        tableName: table.tableName,
        description: table.description,
        businessPurpose: table.businessPurpose,
        isInferred: false,
      });

      for (const col of table.columns ?? []) {
        upsertColumnContext(this.db, {
          connectionId,
          tableName: table.tableName,
          columnName: col.columnName,
          description: col.description,
          exampleValues: col.exampleValues ? JSON.stringify(col.exampleValues) : undefined,
          isInferred: false,
        });
      }
    }
    return this.getContext(connectionId);
  }

  async inferContext(connectionId: string) {
    const snapshot = findLatestSnapshot(this.db, connectionId);
    if (!snapshot) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'No schema snapshot found. Run a schema scan first.',
        statusCode: 404,
      });
    }

    const settings = findSettings(this.db);
    if (!settings) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: 'LLM settings not configured',
        statusCode: 400,
      });
    }

    const tables = JSON.parse(snapshot.tablesJson) as TableInfo[];
    const model = getLanguageModel(settings);

    const tableListText = tables
      .map((t) => `- ${t.name}: ${t.columns.map((c) => `${c.name} (${c.dataType})`).join(', ')}`)
      .join('\n');

    const { text } = await generateText({
      model,
      prompt: `Given this database schema, infer business context descriptions for each table and key columns.

Tables:
${tableListText}

Respond with JSON in this exact format:
{
  "tables": [
    {
      "tableName": "string",
      "description": "1-2 sentence plain English description",
      "businessPurpose": "what business question this table helps answer",
      "columns": [
        { "columnName": "string", "description": "brief column description" }
      ]
    }
  ]
}`,
    });

    // Parse the LLM response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch?.[0]) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: 'LLM returned unexpected response format',
        statusCode: 500,
      });
    }

    const parsed = UpdateContextSchema.parse(JSON.parse(jsonMatch[0]));
    return this.updateContext(connectionId, { ...parsed, tables: parsed.tables.map((t) => ({ ...t, isInferred: true })) });
  }
}
