import { Clock, Brain, Hash, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import type { IndexMetadata } from '../types/document-index';

interface MetadataPanelProps {
  metadata: IndexMetadata | null;
}

interface MetadataItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}

function formatGeneratedAt(raw?: string): string {
  if (!raw) return '—';
  try {
    const date = new Date(raw);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function buildItems(metadata: IndexMetadata | null): MetadataItem[] {
  return [
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: '生成时间',
      value: formatGeneratedAt(metadata?.generated_at),
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      icon: <Brain className="w-3.5 h-3.5" />,
      label: '模型',
      value: metadata?.llm_model ?? '—',
      color: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    {
      icon: <Hash className="w-3.5 h-3.5" />,
      label: 'Tokens',
      value: metadata?.token_count != null ? metadata.token_count.toLocaleString() : '—',
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: '事实数',
      value: metadata?.fact_count != null ? String(metadata.fact_count) : '—',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
  ];
}

export default function MetadataPanel({ metadata }: MetadataPanelProps) {
  const items = buildItems(metadata);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-xl bg-gray-50/80 px-3 py-2.5"
          >
            <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center ${item.color} flex-shrink-0`}>
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 leading-none mb-0.5">{item.label}</p>
              <p className="text-[13px] font-medium text-gray-800 truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
