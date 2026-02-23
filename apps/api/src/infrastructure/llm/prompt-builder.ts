import type { TableSchema } from '../connectors/types.js';
import type { SelectTableContext, SelectColumnContext } from '@open-query/db';

interface ContextData {
  tableContexts: SelectTableContext[];
  columnContexts: SelectColumnContext[];
}

export interface AnalysisStatus {
  isComplete: boolean;
  progressPercent: number;
  currentStep: string | null;
  hasAnyContext: boolean;
}

/**
 * Builds the system prompt injected into every chat request.
 * Combines schema structure with business context annotations and analysis status.
 */
export function buildSystemPrompt(
  tables: TableSchema[],
  context: ContextData,
  analysisStatus?: AnalysisStatus,
  dbType?: string
): string {
  const tableContextMap = new Map(
    context.tableContexts.map((t) => [t.tableName, t])
  );

  const schemaLines: string[] = [];

  for (const table of tables) {
    const tableCtx = tableContextMap.get(table.name);
    // For MongoDB, schema = database name — don't prefix it or the LLM will use
    // "database.collection" as the collection name, which doesn't resolve.
    const tableHeader = (table.schema && dbType !== 'mongodb')
      ? `## Table: ${table.schema}.${table.name}`
      : `## Table: ${table.name}`;

    schemaLines.push(tableHeader);

    if (tableCtx?.description) schemaLines.push(`Description: ${tableCtx.description}`);
    if (tableCtx?.businessPurpose) schemaLines.push(`Business purpose: ${tableCtx.businessPurpose}`);
    if (table.rowCount !== null) schemaLines.push(`Row count: ~${table.rowCount.toLocaleString()}`);

    schemaLines.push('');
    schemaLines.push('Columns:');

    const colContexts = context.columnContexts.filter((c) => c.tableName === table.name);
    const colContextMap = new Map(colContexts.map((c) => [c.columnName, c]));

    for (const col of table.columns) {
      const flags: string[] = [];
      if (col.isPrimaryKey) flags.push('PK');
      if (col.isForeignKey) flags.push(`FK → ${col.foreignKeyTable}.${col.foreignKeyColumn}`);
      if (!col.isNullable) flags.push('NOT NULL');

      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      const colCtx = colContextMap.get(col.name);
      const desc = colCtx?.description ? ` — ${colCtx.description}` : '';

      // Inject sample values from data profile
      let sampleStr = '';
      if (colCtx?.dataProfileJson) {
        try {
          const profile = JSON.parse(colCtx.dataProfileJson) as {
            sampleValues?: string[];
            minValue?: string | null;
            maxValue?: string | null;
          };
          if (profile.sampleValues?.length) {
            sampleStr = ` | Sample values: ${profile.sampleValues.slice(0, 8).join(', ')}`;
          } else if (profile.minValue != null) {
            sampleStr = ` | Range: ${profile.minValue} – ${profile.maxValue}`;
          }
        } catch {
          // ignore malformed JSON
        }
      } else if (colCtx?.exampleValues) {
        try {
          const vals = JSON.parse(colCtx.exampleValues) as string[];
          if (vals.length) sampleStr = ` | Sample values: ${vals.slice(0, 8).join(', ')}`;
        } catch {
          // ignore
        }
      }

      schemaLines.push(`  - ${col.name} (${col.dataType})${flagStr}${desc}${sampleStr}`);
    }
    schemaLines.push('');
  }

  // Build database summary from business purposes
  const summaryLines = context.tableContexts
    .filter((t) => t.businessPurpose)
    .map((t) => `- ${t.tableName}: ${t.businessPurpose}`);
  const databaseSummary = summaryLines.length > 0
    ? `\nSUMMARY OF THIS DATABASE:\n${summaryLines.join('\n')}\n`
    : '';

  // Analysis status block
  let analysisBlock = '';
  if (analysisStatus && !analysisStatus.isComplete) {
    analysisBlock = `\nANALYSIS STATUS: ${analysisStatus.progressPercent}% complete${
      analysisStatus.currentStep ? ` — ${analysisStatus.currentStep}` : ''
    }. Context may be incomplete.\n`;
  }

  const queryInstructions = dbType === 'mongodb'
    ? `QUERY FORMAT (MongoDB Aggregation Pipeline):
When generating a query, output it as a JSON object in a \`\`\`json code block with this exact structure:
\`\`\`json
{
  "collection": "<collection_name>",
  "pipeline": [
    { "$match": { ... } },
    { "$group": { ... } },
    { "$sort": { ... } },
    { "$limit": 1000 }
  ]
}
\`\`\`

MONGODB RULES:
1. NEVER use $out or $merge — these write to the database and are blocked
2. Always include a $limit stage (default 1000) unless the user asks for everything
3. Use $match as early as possible to filter before grouping
4. Reference field names with "$fieldName" syntax inside stages`
    : `QUERY RULES:
1. ONLY write SELECT queries — never INSERT, UPDATE, DELETE, DROP, or any write operations
2. Always use proper SQL syntax for the database type
3. Wrap column and table names in appropriate quotes when needed
4. Always LIMIT results to 1000 rows unless the user specifies otherwise
5. When writing a query, wrap it in a \`\`\`sql code block and briefly explain what it does`;

  return `You are a data analyst assistant for open-query, a database exploration tool.

SCOPE RULE: Your ONLY purpose is to answer questions about the connected database — its data, structure, and business meaning. If asked anything unrelated to this database (weather, general knowledge, coding help outside of SQL, etc.), respond: "I can only help with questions about this database. What would you like to know about your data?" Do not answer off-topic questions even if asked politely.
${analysisBlock}${databaseSummary}
DATABASE SCHEMA:
${schemaLines.join('\n')}

${queryInstructions}

REPORT GENERATION:
- When asked for a report or data question and you have sufficient context, generate the query directly
- If you lack context to generate an accurate query, ask the user ONE specific clarifying question: "To generate this report, I need to understand: [specific gap]. Could you tell me [specific question]?"
- After the user answers a clarifying question, emit any newly learned facts in this format at the end of your response:

[CONTEXT_UPDATE]
table: <table_name>
column: <column_name>
fact: <what you learned about this column or table>
[/CONTEXT_UPDATE]

Use [CONTEXT_UPDATE] blocks for table-level facts too (omit the column line for table-level facts).`;
}
