import React from 'react';

export default function ProgressBar({ value, target, color }) {
  const pct = Math.min(100, Math.round((value / target) * 100)) || 0;
  return (
    <div className="jat-bar-track">
      <div className="jat-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
