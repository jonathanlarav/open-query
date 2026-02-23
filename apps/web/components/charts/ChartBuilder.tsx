'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { QueryResult } from '@open-query/shared';

interface ChartBuilderProps {
  result: QueryResult;
  connectionId: string;
}

type ChartType = 'bar' | 'line' | 'pie';

const CHART_COLORS = [
  'var(--brand-primary)',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
];

export function ChartBuilder({ result }: ChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xAxis, setXAxis] = useState<string>(result.columns[0]?.name ?? '');
  const [yAxis, setYAxis] = useState<string>(result.columns[1]?.name ?? '');

  const numericColumns = result.columns.filter((col) => {
    const sample = result.rows[0]?.[col.name];
    return typeof sample === 'number' || (typeof sample === 'string' && !isNaN(Number(sample)));
  });

  const stringColumns = result.columns.filter((col) => {
    const sample = result.rows[0]?.[col.name];
    return typeof sample === 'string' && isNaN(Number(sample));
  });

  const chartData = result.rows.slice(0, 500).map((row) => {
    const raw = row[yAxis];
    const n = raw === null || raw === undefined || raw === '' ? 0 : Number(raw);
    return { ...row, [yAxis]: isNaN(n) ? 0 : n };
  });

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
          {(['bar', 'line', 'pie'] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`px-3 py-1 text-sm capitalize ${
                chartType === type
                  ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-label text-[var(--color-text-secondary)]">X:</label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value)}
            className="text-sm border border-[var(--color-border)] rounded px-2 py-1"
          >
            {result.columns.map((col) => (
              <option key={col.name} value={col.name}>{col.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-label text-[var(--color-text-secondary)]">Y:</label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value)}
            className="text-sm border border-[var(--color-border)] rounded px-2 py-1"
          >
            {result.columns.map((col) => (
              <option key={col.name} value={col.name}>{col.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => (isNaN(v) ? '—' : v)} />
              <Bar dataKey={yAxis} fill="var(--brand-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => (isNaN(v) ? '—' : v)} />
              <Line
                type="monotone"
                dataKey={yAxis}
                stroke="var(--brand-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData.slice(0, 10)}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius="70%"
                label={({ name }: { name: string }) => name}
              >
                {chartData.slice(0, 10).map((_entry, index) => (
                  <Cell
                    key={index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => (isNaN(v) ? '—' : v)} />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
