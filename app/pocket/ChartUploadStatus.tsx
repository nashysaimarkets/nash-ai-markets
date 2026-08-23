'use client';

import type { ChangeEvent } from 'react';

type Props = {
  hasChart: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function ChartUploadStatus({ hasChart, onFileChange }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-sm font-semibold tracking-wide text-white">
        {hasChart ? '🎯 CHART LOADED' : 'LOAD A CHART'}
      </div>
      <div className="mt-1 text-base text-white/75">
        {hasChart ? 'Ready to analyse' : 'Upload a chart screenshot to get started.'}
      </div>
      {!hasChart && (
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/15 px-4 text-base font-semibold text-white">
          Choose chart
          <input type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
        </label>
      )}
    </div>
  );
}
