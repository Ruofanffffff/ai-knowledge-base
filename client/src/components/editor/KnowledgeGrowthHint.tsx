import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import apiClient from '../../api/client';

interface KnowledgeBody {
  id: string;
  themeName: string;
  themeDescription: string;
  confidenceScore: number;
  growthPhase: 'discovery' | 'skeleton' | 'flesh' | 'mature';
  fragmentCount: number;
}

interface KnowledgeGrowthHintProps {
  documentId?: string;
}

const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  skeleton: { label: '骨架', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  flesh: { label: '血肉', className: 'bg-purple-50 text-purple-600 border-purple-200' },
  mature: { label: '成熟', className: 'bg-green-50 text-green-600 border-green-200' },
};

/**
 * Knowledge Growth Hint component for InsightPanel.
 *
 * Shows active knowledge bodies (skeleton/flesh/mature phase) as hints
 * in the AI Insights panel, allowing users to navigate to related
 * knowledge body detail pages.
 *
 * Validates: Requirements 9.8, 9.9, 9.10
 */
export function KnowledgeGrowthHint({ documentId }: KnowledgeGrowthHintProps) {
  const navigate = useNavigate();
  const [bodies, setBodies] = useState<KnowledgeBody[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBodies = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/knowledge-growth/bodies');
        if (res.data?.success && Array.isArray(res.data.data)) {
          // Filter to show only skeleton/flesh/mature phase bodies
          // These are the bodies that have progressed beyond discovery
          // and are semantically relevant hints for the user
          const activeBodies = res.data.data.filter(
            (b: KnowledgeBody) => b.growthPhase !== 'discovery'
          );
          setBodies(activeBodies);
        }
      } catch {
        // Silently fail — this is a non-critical hint feature
      } finally {
        setLoading(false);
      }
    };

    fetchBodies();
  }, [documentId]);

  if (loading || bodies.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-3 rounded-xl border border-lime-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sprout size={14} className="text-lime-600" />
        <span className="text-xs font-bold text-lime-700 uppercase">知识生长</span>
      </div>
      <div className="space-y-2">
        {bodies.map((body) => {
          const badge = PHASE_BADGE[body.growthPhase];
          return (
            <div
              key={body.id}
              onClick={() => navigate(`/knowledge-growth/${body.id}`)}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-lime-50 cursor-pointer transition-colors group"
            >
              <span className="text-sm text-slate-700 group-hover:text-lime-800 truncate">
                {body.themeName}
              </span>
              {badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
