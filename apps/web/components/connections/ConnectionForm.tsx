'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateConnection, useTestRawCredentials } from '@/hooks/useConnections';
import { ActionableError } from '@/components/shared/ActionableError';
import { parseApiError } from '@/lib/parse-api-error';
import { CreateConnectionSchema, CONNECTION_TYPE_LABELS } from '@open-query/shared';
import type { ConnectionType, CreateConnectionInput } from '@open-query/shared';
import { z } from 'zod';

type FormValues = CreateConnectionInput;

const DB_TYPES: ConnectionType[] = ['postgres', 'mysql', 'sqlite', 'mongodb'];

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function ConnectionForm() {
  const router = useRouter();
  const { mutate: createConn, isPending, error } = useCreateConnection();
  const { mutate: testCreds } = useTestRawCredentials();
  const [selectedType, setSelectedType] = useState<ConnectionType>('postgres');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateConnectionSchema),
    defaultValues: {
      name: '',
      type: 'postgres',
      credentials: { host: 'localhost', port: 5432, database: '', username: '', password: '', ssl: false },
    } as FormValues,
  });

  const onSubmit = (values: FormValues) => {
    createConn(values, {
      onSuccess: () => router.push('/connections'),
    });
  };

  const handleTest = () => {
    const values = form.getValues();
    const parsed = CreateConnectionSchema.safeParse(values);
    if (!parsed.success) {
      setTestStatus('error');
      setTestError('Please fill in all required fields before testing.');
      return;
    }
    setTestStatus('testing');
    setTestError(null);
    testCreds(parsed.data, {
      onSuccess: () => setTestStatus('success'),
      onError: (err) => {
        setTestStatus('error');
        setTestError(parseApiError(err).message);
      },
    });
  };

  const handleTypeChange = (type: ConnectionType) => {
    setSelectedType(type);
    setTestStatus('idle');
    setTestError(null);
    form.setValue('type', type as FormValues['type']);
    // Reset credentials for the new type
    if (type === 'postgres') {
      form.setValue('credentials' as keyof FormValues, { host: 'localhost', port: 5432, database: '', username: '', password: '', ssl: false } as FormValues['credentials']);
    } else if (type === 'mysql') {
      form.setValue('credentials' as keyof FormValues, { host: 'localhost', port: 3306, database: '', username: '', password: '', ssl: false } as FormValues['credentials']);
    } else if (type === 'sqlite') {
      form.setValue('credentials' as keyof FormValues, { filePath: '' } as FormValues['credentials']);
    } else if (type === 'mongodb') {
      form.setValue('credentials' as keyof FormValues, { uri: '', database: '' } as FormValues['credentials']);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* DB Type selector */}
      <div>
        <label className="text-label font-medium text-[var(--color-text-primary)] block mb-2">
          Database Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DB_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2.5 text-sm rounded-lg border text-left transition-colors ${
                selectedType === type
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {CONNECTION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Connection name */}
      <div>
        <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
          Connection Name
        </label>
        <input
          {...form.register('name')}
          placeholder="My Production DB"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
        />
        {form.formState.errors.name && (
          <p className="text-label text-[var(--color-error)] mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* Credentials — vary by type */}
      {(selectedType === 'postgres' || selectedType === 'mysql') && (
        <HostCredentialFields form={form} />
      )}
      {selectedType === 'sqlite' && (
        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
            File Path
          </label>
          <input
            {...form.register('credentials.filePath' as Parameters<typeof form.register>[0])}
            placeholder="/data/mydb.sqlite"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
      )}
      {selectedType === 'mongodb' && (
        <div className="space-y-4">
          <div>
            <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
              Connection URI
            </label>
            <input
              {...form.register('credentials.uri' as Parameters<typeof form.register>[0])}
              placeholder="mongodb://user:pass@localhost:27017"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
            />
          </div>
          <div>
            <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
              Database Name
            </label>
            <input
              {...form.register('credentials.database' as Parameters<typeof form.register>[0])}
              placeholder="mydb"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
            />
          </div>
        </div>
      )}

      {/* Security tip */}
      <div className="p-3 rounded-lg bg-[var(--brand-primary-light)] border border-[var(--brand-primary)] border-opacity-20">
        <p className="text-label text-[var(--brand-primary)]">
          <strong>Security tip:</strong> Use a read-only database user to prevent accidental writes.
        </p>
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
          {isPending ? 'Creating…' : 'Create Connection'}
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
    </form>
  );
}

function HostCredentialFields({ form }: { form: ReturnType<typeof useForm<CreateConnectionInput>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Host</label>
          <input
            {...form.register('credentials.host' as Parameters<typeof form.register>[0])}
            placeholder="localhost"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Port</label>
          <input
            {...form.register('credentials.port' as Parameters<typeof form.register>[0], { valueAsNumber: true })}
            type="number"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
      </div>
      <div>
        <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Database</label>
        <input
          {...form.register('credentials.database' as Parameters<typeof form.register>[0])}
          placeholder="mydb"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Username</label>
          <input
            {...form.register('credentials.username' as Parameters<typeof form.register>[0])}
            placeholder="readonly_user"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">Password</label>
          <input
            {...form.register('credentials.password' as Parameters<typeof form.register>[0])}
            type="password"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
      </div>
    </div>
  );
}
