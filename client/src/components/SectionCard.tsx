import { motion } from 'framer-motion';
import { Sparkles, GitBranch, BookOpen, Layers } from 'lucide-react';
import type { IndexSection, ConceptItem, RelationItem } from '../types/document-index';

interface SectionCardProps {
  section: IndexSection;
  index: number;
}

const SECTION_META: Record<string, {
  icon: React.ReactNode;
  titleColor: string;
  iconColor: string;
  iconBg: string;
  headerBg: string;
  headerBorder: string;
  accentColor: string;
}> = {
  summary: {
    icon: <BookOpen style={{ width: 14, height: 14 }} />,
    titleColor: '#6d28d9',
    iconColor: '#8b5cf6',
    iconBg: '#f5f3ff',
    headerBg: 'linear-gradient(to right, rgba(245,243,255,0.85), transparent)',
    headerBorder: 'rgba(221,214,254,0.6)',
    accentColor: '#7c3aed',
  },
  concepts: {
    icon: <Sparkles style={{ width: 14, height: 14 }} />,
    titleColor: '#b45309',
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
    headerBg: 'linear-gradient(to right, rgba(255,251,235,0.85), transparent)',
    headerBorder: 'rgba(253,230,138,0.6)',
    accentColor: '#d97706',
  },
  relations: {
    icon: <GitBranch style={{ width: 14, height: 14 }} />,
    titleColor: '#0f766e',
    iconColor: '#14b8a6',
    iconBg: '#f0fdfa',
    headerBg: 'linear-gradient(to right, rgba(240,253,250,0.85), transparent)',
    headerBorder: 'rgba(153,246,228,0.6)',
    accentColor: '#0d9488',
  },
  other: {
    icon: <Layers style={{ width: 14, height: 14 }} />,
    titleColor: '#475569',
    iconColor: '#94a3b8',
    iconBg: '#f8fafc',
    headerBg: 'linear-gradient(to right, rgba(248,250,252,0.85), transparent)',
    headerBorder: 'rgba(226,232,240,0.6)',
    accentColor: '#64748b',
  },
};

function getMeta(type: string) {
  return SECTION_META[type] || SECTION_META.other;
}

/* ── Summary ── */
function SummaryContent({ content }: { content: string }) {
  const paragraphs = content.trim().split(/\n\s*\n|\n/).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize: 13, lineHeight: 1.95, color: '#4b5563', margin: 0 }}>
          {p.trim()}
        </p>
      ))}
    </div>
  );
}

/* ── Single Concept Card ── */
function ConceptCard({ item, i }: { item: ConceptItem; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: i * 0.04 }}
      style={{
        borderRadius: 10,
        border: '1px solid rgba(253,230,138,0.5)',
        background: 'rgba(255,251,235,0.25)',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{item.name}</span>
        {item.role && (
          <span style={{
            fontSize: 10.5,
            padding: '2px 7px',
            borderRadius: 4,
            background: 'rgba(245,158,11,0.12)',
            color: '#d97706',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}>
            {item.role}
          </span>
        )}
      </div>
      {item.description && (
        <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.8, margin: 0 }}>{item.description}</p>
      )}
    </motion.div>
  );
}

function ConceptsContent({ items }: { items?: ConceptItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <ConceptCard key={i} item={item} i={i} />
      ))}
    </div>
  );
}

/* ── Single Relation Card ── */
function RelationCard({ item, i }: { item: RelationItem; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: i * 0.04 }}
      style={{
        borderRadius: 10,
        border: '1px solid rgba(153,246,228,0.5)',
        background: 'rgba(240,253,250,0.25)',
        padding: '12px 14px',
      }}
    >
      <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>
        {item.label}
      </span>
      <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.8, margin: 0 }}>{item.description}</p>
    </motion.div>
  );
}

/* ── Relations: structured or fallback ── */
function RelationsContent({ section }: { section: IndexSection }) {
  if (section.relationItems && section.relationItems.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {section.relationItems.map((item, i) => (
          <RelationCard key={i} item={item} i={i} />
        ))}
      </div>
    );
  }
  const lines = section.content
    .trim()
    .split('\n')
    .map((l) => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.03 }}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}
        >
          <div style={{ marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.8, margin: 0 }}>{line}</p>
        </motion.div>
      ))}
    </div>
  );
}

function SectionBody({ section }: { section: IndexSection }) {
  switch (section.type) {
    case 'summary':
      return <SummaryContent content={section.content} />;
    case 'concepts':
      return <ConceptsContent items={section.items} />;
    case 'relations':
      return <RelationsContent section={section} />;
    default:
      return (
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
          {section.content}
        </p>
      );
  }
}

export default function SectionCard({ section, index }: SectionCardProps) {
  const meta = getMeta(section.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        borderRadius: 16,
        background: '#fff',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        background: meta.headerBg,
        borderBottom: `1px solid ${meta.headerBorder}`,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: meta.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: meta.iconColor,
        }}>
          {meta.icon}
        </div>
        <h3 style={{
          fontSize: 14,
          fontWeight: 700,
          color: meta.titleColor,
          letterSpacing: '-0.01em',
          margin: 0,
        }}>
          {section.title}
        </h3>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px' }}>
        <SectionBody section={section} />
      </div>
    </motion.div>
  );
}
