import React from 'react';

interface UsageStatsProps {
  lastTokensUsed: number;
  lastCost: number;
  totalCost: number;
}

const UsageStats: React.FC<UsageStatsProps> = ({ lastTokensUsed, lastCost, totalCost }) => {
  return (
    <div className="text-xs text-[var(--color-text-secondary)] px-4 pb-2 text-center -mt-2">
      <p>
        Last Turn: <span className="font-semibold text-[var(--color-text-primary)]">{lastTokensUsed} tokens</span> (~${lastCost.toFixed(6)})
        <span className="mx-2 text-[var(--color-text-tertiary)]">|</span>
        Session Total: <span className="font-semibold text-[var(--color-text-primary)]">~${totalCost.toFixed(6)}</span>
      </p>
    </div>
  );
};

export default UsageStats;