interface GrowthProgressBarProps {
  confidenceScore: number; // 0-1
  growthPhase: 'discovery' | 'skeleton' | 'flesh' | 'mature';
  showLabel?: boolean; // whether to show the phase label, default true
  size?: 'sm' | 'md'; // bar height, default 'sm'
}

const PHASE_COLORS: Record<string, { label: string; text: string; bg: string; border: string; bar: string }> = {
  discovery: { label: '发现中', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400' },
  skeleton: { label: '骨架', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', bar: 'bg-blue-500' },
  flesh: { label: '血肉', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', bar: 'bg-purple-500' },
  mature: { label: '成熟', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', bar: 'bg-green-500' },
};

export function GrowthProgressBar({
  confidenceScore,
  growthPhase,
  showLabel = true,
  size = 'sm',
}: GrowthProgressBarProps) {
  const phase = PHASE_COLORS[growthPhase] || PHASE_COLORS.discovery;
  const percentage = Math.round(confidenceScore * 100);
  const barHeight = size === 'md' ? 'h-2.5' : 'h-1.5';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        {showLabel && (
          <span className={`px-2 py-0.5 rounded-full border ${phase.text} ${phase.bg} ${phase.border}`}>
            {phase.label}
          </span>
        )}
        <span className="text-slate-600 font-medium ml-auto">{percentage}%</span>
      </div>
      <div className={`w-full ${barHeight} bg-slate-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${phase.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
