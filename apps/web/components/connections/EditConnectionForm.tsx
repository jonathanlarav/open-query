'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useConnection, useConnectionCredentials, useUpdateConnection, useTestRawCredentials } from '@/hooks/useConnections';
import { useAnalysis, useTriggerAnalysis, useRetriggerAnalysis } from '@/hooks/useAnalysis';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';
import { ActionableError } from '@/components/shared/ActionableError';
import { parseApiError } from '@/lib/parse-api-error';
import { RefreshCw } from 'lucide-react';
import type { ConnectionType } from '@open-query/shared';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const EditFormSchema = z.object({
  name: z.string().min(1).max(100),
  // credential fields — flat for simplicity, filtered by type on submit
  host: z.string().optional(),
  port: z.coerce.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
  filePath: z.string().optional(),
  uri: z.string().optional(),
});

type EditFormValues = z.infer<typeof EditFormSchema>;

interface EditConnectionFormProps {
  connectionId: string;
}

export function EditConnectionForm({ connectionId }: EditConnectionFormProps) {
  const router = useRouter();
  const { data: connection, isLoading: loadingConn } = useConnection(connectionId);
  const { data: storedCreds, isLoading: loadingCreds } = useConnectionCredentials(connectionId);
  const { mutate: updateConn, isPending, error } = useUpdateConnection(connectionId);
  const { mutate: testCreds } = useTestRawCredentials();
  const { data: analysisJob } = useAnalysis(connectionId);
  const { mutate: triggerAnalysis, isPending: triggering } = useTriggerAnalysis();
  const { mutate: retriggerAnalysis, isPending: retriggering } = useRetriggerAnalysis();
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const isAnalysisBusy = triggering || retriggering || analysisJob?.status === 'running' || analysisJob?.status === 'pending';
  const handleReanalyze = () => {
    if (analysisJob) retriggerAnalysis(connectionId);
    else triggerAnalysis(connectionId);
  };

  const form = useForm<EditFormValues>({
    resolver: zodResolver(EditFormSchema),
    defaultValues: { name: '' },
  });

  // Pre-fill all fields once both connection meta and credentials load
  useEffect(() => {
    if (!connection || !storedCreds) return;
    const c = storedCreds.credentials;
    form.reset({
      name: connection.name,
      host: (c['host'] as string) ?? '',
      port: (c['port'] as number) ?? undefined,
      database: (c['database'] as string) ?? '',
      username: (c['username'] as string) ?? '',
      password: (c['password'] as string) ?? '',
      ssl: (c['ssl'] as boolean) ?? false,
      filePath: (c['filePath'] as string) ?? '',
      uri: (c['uri'] as string) ?? '',
    });
  }, [connection, storedCreds, form]);

  const isLoading = loadingConn || loadingCreds;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]" />
        ))}
      </div>
    );
  }

  if (!connection) {
    return (
      <p className="text-sm text-[var(--color-error)]">Connection not found.</p>
    );
  }

  const type = connection.type as ConnectionType;

  const onSubmit = (values: EditFormValues) => {
    // Always send both name and credentials (fields are pre-filled)
    const payload: { name: string; credentials: Record<string, unknown> } = {
      name: values.name,
      credentials: {},
    };

    if (type === 'postgres' || type === 'mysql') {
      payload.credentials = {
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
        ssl: values.ssl ?? false,
      };
    } else if (type === 'sqlite') {
      payload.credentials = { filePath: values.filePath };
    } else if (type === 'mongodb') {
      payload.credentials = { uri: values.uri, database: values.database };
    }

    updateConn(payload, {
      onSuccess: () => router.push('/connections'),
    });
  };

  const handleTest = () => {
    const values = form.getValues();
    // Build the same payload shape as CreateConnectionSchema
    let testPayload: { type: string; name: string; credentials: Record<string, unknown> } | null = null;
    if (type === 'postgres' || type === 'mysql') {
      testPayload = { type, name: values.name, credentials: { host: values.host, port: values.port, database: values.database, username: values.username, password: values.password, ssl: values.ssl ?? false } };
    } else if (type === 'sqlite') {
      testPayload = { type, name: values.name, credentials: { filePath: values.filePath } };
    } else if (type === 'mongodb') {
      testPayload = { type, name: values.name, credentials: { uri: values.uri, database: values.database } };
    }
    if (!testPayload) return;

    setTestStatus('testing');
    setTestError(null);
    testCreds(testPayload as Parameters<typeof testCreds>[0], {
      onSuccess: () => setTestStatus('success'),
      onError: (err) => {
        setTestStatus('error');
        setTestError(parseApiError(err).message);
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Type badge — read-only */}
      <div className="flex items-center gap-2 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Database type:</span>
        <ConnectionBadge type={type} />
        <span className="text-label text-[var(--color-text-muted)] ml-auto">Cannot be changed</span>
      </div>

      {/* Name */}
      <div>
        <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
          Connection Name
        </label>
        <input
          {...form.register('name')}
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
        />
        {form.formState.errors.name && (
          <p className="text-label text-[var(--color-error)] mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* Credentials section */}
      <div>
        <h3 className="font-medium text-sm text-[var(--color-text-primary)] mb-3">
          Credentials
        </h3>

        {(type === 'postgres' || type === 'mysql') && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Host</label>
                <input
                  {...form.register('host')}
                  placeholder="localhost"
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Port</label>
                <input
                  {...form.register('port', { valueAsNumber: true })}
                  type="number"
                  placeholder={type === 'postgres' ? '5432' : '3306'}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
                />
              </div>
            </div>
            <div>
              <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Database</label>
              <input
                {...form.register('database')}
                placeholder="mydb"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Username</label>
                <input
                  {...form.register('username')}
                  placeholder="readonly_user"
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Password</label>
                <input
                  {...form.register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
                />
              </div>
            </div>
          </div>
        )}

        {type === 'sqlite' && (
          <div>
            <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">File Path</label>
            <input
              {...form.register('filePath')}
              placeholder="/data/mydb.sqlite"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
            />
          </div>
        )}

        {type === 'mongodb' && (
          <div className="space-y-4">
            <div>
              <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Connection URI</label>
              <input
                {...form.register('uri')}
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Database Name</label>
              <input
                {...form.register('database')}
                placeholder="mydb"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Test result feedback */}
      {testStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
          <span className="text-sm text-green-700 font-medium">✓ Connection successful</span>
        </div>
      )}
      {testStatus === 'error' && testError && (
        <ActionableError message={testError} />
      )}

      {error && (
        <ActionableError
          message={parseApiError(error).message}
          action={parseApiError(error).action}
        />
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testStatus === 'testing'}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50"
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
        >
          Cancel
        </button>
      </div>

      {/* Analysis section */}
      <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Database Analysis</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {!analysisJob && 'Not yet analyzed'}
            {analysisJob?.status === 'pending' && 'Queued…'}
            {analysisJob?.status === 'running' && `Analyzing… ${analysisJob.progressPercent ?? 0}%`}
            {analysisJob?.status === 'completed' && 'Analysis complete ✓'}
            {analysisJob?.status === 'failed' && `Failed${analysisJob.error ? `: ${analysisJob.error}` : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReanalyze}
          disabled={isAnalysisBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isAnalysisBusy ? 'animate-spin' : ''}`} />
          {isAnalysisBusy ? 'Running…' : analysisJob ? 'Re-run Analysis' : 'Run Analysis'}
        </button>
      </div>
    </form>
  );
}
