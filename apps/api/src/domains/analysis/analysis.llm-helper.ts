import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { TableSchema } from '../../infrastructure/connectors/types.js';
import type { TableProfile } from './data-sampler.js';

export interface LLMContextResult {
  tableName: string;
  description: string;
  businessPurpose: string;
  columns: Array<{ columnName: string; description: string }>;
}

export async function generateContextWithSamples(
  tables: TableSchema[],
  profiles: Map<string, TableProfile>,
  model: LanguageModel
): Promise<LLMContextResult[]> {
  const tableListText = tables
    .map((t) => {
      const profile = profiles.get(t.name);
      const colLines = t.columns.map((c) => {
        const cp = profile?.columns.find((p) => p.columnName === c.name);
        let extra = '';
        if (cp?.sampleValues && cp.sampleValues.length > 0) {
          extra = ` | samples: ${cp.sampleValues.slice(0, 5).join(', ')}`;
        } else if (cp?.minValue != null) {
          extra = ` | range: ${cp.minValue} – ${cp.maxValue}`;
        }
        return `  - ${c.name} (${c.dataType})${extra}`;
      });
      return `### ${t.name}\n${colLines.join('\n')}`;
    })
    .join('\n\n');

  const { text } = await generateText({
    model,
    prompt: `Analyze this database schema and generate business context descriptions.

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

  const match = text.match(/\{[\s\S]*\}/);
  if (!match?.[0]) return [];

  try {
    const parsed = JSON.parse(match[0]) as { tables: LLMContextResult[] };
    return parsed.tables ?? [];
  } catch {
    return [];
  }
}
