import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface TableViewProps {
  data: {
    table_type: string;
    columns: string[];
    rows: string[][];
    summary: string;
  };
  onClose: () => void;
}

export function TableView({ data, onClose }: TableViewProps) {
  const [copied, setCopied] = useState(false);

  const copyAsText = () => {
    const header = data.columns.join('\t');
    const rows = data.rows.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${rows}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-2xl mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden"
        style={{ background: '#FFFFFF', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 flex items-start justify-between"
          style={{ borderBottom: '1px solid #F3F1EE' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              <LayoutGrid size={20} color="white" />
            </div>
            <div>
              <p style={{ color: '#1A1A2E', fontSize: '16px', fontWeight: 700 }}>
                {data.table_type}
              </p>
              <p style={{ color: '#9999AA', fontSize: '12px', marginTop: '2px' }}>
                {data.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAsText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all active:scale-95"
              style={{
                background: copied ? '#ECFDF5' : '#F3F1EE',
                color: copied ? '#059669' : '#7A7A8F',
                fontSize: '13px',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: '#F3F1EE' }}
            >
              <X size={16} style={{ color: '#7A7A8F' }} />
            </button>
          </div>
        </div>

        {/* AI tag */}
        <div className="px-6 py-2.5 flex items-center gap-2" style={{ background: '#F9F8FF', borderBottom: '1px solid #EDE9FE' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#7C3AED' }} />
          <span style={{ color: '#7C3AED', fontSize: '12px' }}>AI 智能生成 · 数据仅供参考</span>
        </div>

        {/* Table */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                {data.columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-5 py-3.5 text-left"
                    style={{
                      color: '#1A1A2E',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderBottom: '2px solid #E8E6E2',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <motion.tr
                  key={ri}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: ri * 0.06 + 0.1 }}
                  style={{
                    borderBottom: '1px solid #F3F1EE',
                    background: ri % 2 === 0 ? '#FFFFFF' : '#FAFAF8',
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-5 py-3.5"
                      style={{
                        color: ci === 0 ? '#1A1A2E' : '#5A5A70',
                        fontSize: '13px',
                        fontWeight: ci === 0 ? 500 : 400,
                        verticalAlign: 'top',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: '1px solid #F3F1EE' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ background: '#F3F1EE', color: '#5A5A70' }}
          >
            关闭
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}