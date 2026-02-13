import { useState, useEffect } from 'react';
import { Drawer, Skeleton } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileSearch, RefreshCw, BookOpen } from 'lucide-react';
import { useDocumentIndex } from '../hooks/useDocumentIndex';
import SectionCard from './SectionCard';
import MetadataPanel from './MetadataPanel';

interface DocumentIndexDrawerProps {
  docId: string | null;
  docTitle?: string;
  onClose: () => void;
}

function useIsMobileDrawer() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          borderRadius: 16, background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.6)', padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f3f4f6' }} />
            <div style={{ height: 16, width: 96, borderRadius: 4, background: '#f3f4f6' }} />
          </div>
          <Skeleton active paragraph={{ rows: i === 1 ? 2 : 3 }} title={false} />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <AlertCircle style={{ width: 28, height: 28, color: '#f87171' }} />
      </div>
      <p style={{ color: '#1f2937', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>加载失败</p>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32, maxWidth: 240, lineHeight: 1.6 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500,
          color: '#7c3aed', background: '#f5f3ff', border: 'none', cursor: 'pointer',
        }}
      >
        <RefreshCw style={{ width: 16, height: 16 }} />
        重试
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <FileSearch style={{ width: 28, height: 28, color: '#a78bfa' }} />
      </div>
      <p style={{ color: '#1f2937', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>暂无索引</p>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 240, lineHeight: 1.6 }}>
        该文档尚未生成压缩索引，索引将在文档上传处理时自动生成。
      </p>
    </div>
  );
}

function DrawerTitle({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 12,
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }}>
        <BookOpen style={{ width: 16, height: 16, color: '#fff' }} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.3, margin: 0, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, margin: '2px 0 0 0' }}>文档压缩索引</p>
      </div>
    </div>
  );
}

export default function DocumentIndexDrawer({ docId, docTitle, onClose }: DocumentIndexDrawerProps) {
  const open = docId !== null;
  const isMobile = useIsMobileDrawer();
  const { sections, metadata, isLoading, error, rawData, retry } =
    useDocumentIndex(open ? docId : null);

  const isEmpty = !isLoading && !error && sections.length === 0 && rawData === null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={<DrawerTitle title={docTitle ?? '文档索引'} />}
      width={isMobile ? '100%' : 540}
      placement="right"
      destroyOnClose
      styles={{
        body: { padding: '20px 20px 32px', background: '#f7f7f8' },
        header: { borderBottom: '1px solid #f0f0f0', padding: '16px 20px', background: '#fff' },
      }}
    >
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <LoadingSkeleton />
          </motion.div>
        )}
        {!isLoading && error && (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ErrorState message={error} onRetry={retry} />
          </motion.div>
        )}
        {!isLoading && !error && isEmpty && (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <EmptyState />
          </motion.div>
        )}
        {!isLoading && !error && !isEmpty && (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}
          >
            {sections.map((section, i) => (
              <SectionCard key={`${section.type}-${i}`} section={section} index={i} />
            ))}
            <MetadataPanel metadata={metadata} />
          </motion.div>
        )}
      </AnimatePresence>
    </Drawer>
  );
}
