import type { Database } from '../client';
import { llmSettings, type InsertLLMSettings, type SelectLLMSettings } from '../schema/llm-settings';

export function findSettings(db: Database): SelectLLMSettings | undefined {
  return db.select().from(llmSettings).get();
}

export function upsertSettings(
  db: Database,
  data: Partial<InsertLLMSettings>
): SelectLLMSettings {
  return db
    .insert(llmSettings)
    .values({ id: 'singleton', ...data } as InsertLLMSettings)
    .onConflictDoUpdate({
      target: llmSettings.id,
      set: {
        ...data,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get();
}
