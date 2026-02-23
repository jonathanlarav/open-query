import type { Database, SelectAnalysisJob } from '@open-query/db';
import {
  insertAnalysisJob,
  findLatestAnalysisJob,
  updateAnalysisJob,
  findConnectionById,
  findSettings,
  upsertTableContext,
  upsertColumnContext,
  insertSnapshot,
  deleteSnapshotsForConnection,
} from '@open-query/db';
import { getConnector } from '../../infrastructure/connectors/factory.js';
import { getLanguageModel } from '../../infrastructure/llm/provider-factory.js';
import { DataSampler } from './data-sampler.js';
import type { TableProfile } from './data-sampler.js';
import { generateContextWithSamples } from './analysis.llm-helper.js';
import { enrichWithRelationships } from './analysis.relationships.js';

export class AnalysisService {
  constructor(private readonly db: Database) {}

  getJobStatus(connectionId: string): SelectAnalysisJob | null {
    return findLatestAnalysisJob(this.db, connectionId) ?? null;
  }

  triggerAnalysis(connectionId: string): SelectAnalysisJob {
    const job = insertAnalysisJob(this.db, {
      connectionId,
      status: 'pending',
      progressPercent: 0,
      totalTables: 0,
      processedTables: 0,
    });
    void this.runPipeline(job.id, connectionId);
    return job;
  }

  retriggerAnalysis(connectionId: string): SelectAnalysisJob {
    const existing = findLatestAnalysisJob(this.db, connectionId);
    if (existing && existing.status === 'running') {
      updateAnalysisJob(this.db, existing.id, {
        status: 'failed',
        error: 'Superseded by retrigger',
      });
    }
    return this.triggerAnalysis(connectionId);
  }

  private setProgress(
    jobId: string,
    percent: number,
    step: string | null,
    extra?: Partial<SelectAnalysisJob>
  ) {
    updateAnalysisJob(this.db, jobId, { progressPercent: percent, currentStep: step, ...extra });
  }

  private async runPipeline(jobId: string, connectionId: string): Promise<void> {
    try {
      updateAnalysisJob(this.db, jobId, { status: 'running', startedAt: new Date() });

      // Step 1: Schema scan (0–10%)
      this.setProgress(jobId, 5, 'Scanning schema…');
      const conn = findConnectionById(this.db, connectionId);
      if (!conn) throw new Error('Connection not found');

      const connector = getConnector(conn);
      const tables = await connector.scanSchema();

      // Persist snapshot so useSchema / chat prompt builder can read it
      deleteSnapshotsForConnection(this.db, connectionId);
      insertSnapshot(this.db, {
        connectionId,
        tablesJson: JSON.stringify(tables),
        scannedAt: new Date(),
      });

      this.setProgress(jobId, 10, 'Schema scan complete', { totalTables: tables.length });

      // Step 2: Data profiling (10–70%)
      const sampler = new DataSampler(connector, conn.type);
      const profiles = new Map<string, TableProfile>();
      const perTable = tables.length > 0 ? 60 / tables.length : 60;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i]!;
        this.setProgress(
          jobId,
          Math.round(10 + i * perTable),
          `Profiling table ${table.name} (${i + 1}/${tables.length})`,
          { processedTables: i }
        );
        const profile = await sampler.profileTable(table);
        if (profile) {
          profiles.set(table.name, profile);
          for (const cp of profile.columns) {
            upsertColumnContext(this.db, {
              connectionId,
              tableName: table.name,
              columnName: cp.columnName,
              dataProfileJson: JSON.stringify({
                sampleValues: cp.sampleValues,
                distinctCount: cp.distinctCount,
                nullRate: cp.nullRate,
                minValue: cp.minValue,
                maxValue: cp.maxValue,
              }),
              isInferred: true,
            });
          }
        }
      }

      this.setProgress(jobId, 70, 'Data profiling complete', { processedTables: tables.length });

      // Step 3: LLM context generation (70–95%)
      this.setProgress(jobId, 72, 'Generating business context with AI…');
      const settings = findSettings(this.db);
      if (settings) {
        try {
          const model = getLanguageModel(settings);
          const results = await generateContextWithSamples(tables, profiles, model);
          for (const r of results) {
            upsertTableContext(this.db, {
              connectionId,
              tableName: r.tableName,
              description: r.description,
              businessPurpose: r.businessPurpose,
              isInferred: true,
            });
            for (const c of r.columns) {
              upsertColumnContext(this.db, {
                connectionId,
                tableName: r.tableName,
                columnName: c.columnName,
                description: c.description,
                isInferred: true,
              });
            }
          }
        } catch {
          // LLM failure is non-fatal — analysis still completes with profiling data
        }
      }

      this.setProgress(jobId, 95, 'Enriching relationship context…');
      enrichWithRelationships(this.db, connectionId, tables);

      await connector.close();
      updateAnalysisJob(this.db, jobId, {
        status: 'completed',
        progressPercent: 100,
        currentStep: 'Complete',
        completedAt: new Date(),
      });
    } catch (err) {
      updateAnalysisJob(this.db, jobId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
