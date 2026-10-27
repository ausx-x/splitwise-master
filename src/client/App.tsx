import React, { useState, useMemo } from 'react';
import { allocateEqualWithPennies, computeSplitShares } from '../engine/splitCalculator';
import { computeNetBalances, simplifyDebtsGreedyMinCashFlow } from '../engine/debtSimplifier';
import { buildUpiDeepLink } from '../engine/fxConverter';
import { Expense, Group, SplitStrategy, User } from '../types/ledger';

export default function SplitwiseApp() {
  const [activeTab, setActiveTab] = useState<'groups' | 'friends' | 'activity' | 'account'>('groups');
  const [simplifyDebts, setSimplifyDebts] = useState<boolean>(true);
  const [splitStrategy, setSplitStrategy] = useState<SplitStrategy>('EQUAL');

  return (
    <div className="min-h-screen bg-[#F6F6F6] dark:bg-[#121212] text-slate-900 dark:text-slate-100">
      <header className="bg-[#1CC29F] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">Splitwise — Modular React + TypeScript Client</h1>
        <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full">Antigravity IDE Ready</span>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          See <code>preview/splitwise_app.html</code> for the zero-build full interactive bundle, or edit <code>src/engine/</code> and <code>src/client/App.tsx</code> in Antigravity IDE.
        </p>
      </main>
    </div>
  );
}
