import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCheck, LayoutGrid, GitFork } from 'lucide-react';

interface TextSelectionMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (action: 'generate' | 'proofread' | 'summary' | 'mindmap') => void;
  onClose: () => void;
}

const ACTIONS = [
  {
    id: 'generate' as const,
    icon: Sparkles,
    label: '智能生成',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    glow: 'rgba(99,102,241,0.32)',
    bgLight: 'rgba(99,102,241,0.06)',
  },
  {
    id: 'proofread' as const,
    icon: CheckCheck,
    label: '智能校对',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
    glow: 'rgba(14,165,233,0.32)',
    bgLight: 'rgba(14,165,233,0.06)',
  },
  {
    id: 'summary' as const,
    icon: LayoutGrid,
    label: 'AI 总结',
    gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
    glow: 'rgba(16,185,129,0.32)',
    bgLight: 'rgba(16,185,129,0.06)',
  },
  {
    id: 'mindmap' as const,
    icon: GitFork,
    label: '生成脑图',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
    glow: 'rgba(245,158,11,0.32)',
    bgLight: 'rgba(245,158,11,0.06)',
  },
] as const;

/* ── 估计菜单宽度，用于溢出保护 ── */
const MENU_W  = 220; // 4 × 50px + padding
const MARGIN  = 14;
const ARROW_H = 7;

export function TextSelectionMenu({
  selectedText,
  position,
  onAction,
  onClose,
}: TextSelectionMenuProps) {
  const [visible, setVisible]     = useState(false);
  const [hovered, setHovered]     = useState<string | null>(null);
  const menuRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  /* 防溢出：clamp 以菜单半宽为边界 */
  const halfW  = MENU_W / 2;
  const safeX  = Math.max(halfW + MARGIN, Math.min(position.x, window.innerWidth - halfW - MARGIN));
  const safeY  = Math.max(130, position.y);

  /* 箭头水平偏移（相对于菜单中心，补偿 clamp 造成的位移） */
  const arrowOffset = position.x - safeX;

  const handleAction = (id: typeof ACTIONS[number]['id']) => {
    onAction(id);
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 透明遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* 菜单主体 */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 6 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
            className="fixed z-50"
            style={{
              left: safeX,
              top: safeY - ARROW_H,
              transform: 'translate(-50%, -100%)',
              width: MENU_W,
            }}
          >
            {/* ── 渐变描边容器（1px 渐变 border 技巧） ── */}
            <div
              style={{
                borderRadius: 20,
                padding: 1,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(139,92,246,0.45) 50%, rgba(56,189,248,0.45) 100%)',
                boxShadow: [
                  '0 16px 48px rgba(99,102,241,0.16)',
                  '0 4px 16px rgba(0,0,0,0.08)',
                  '0 0 0 0.5px rgba(255,255,255,0.8) inset',
                ].join(', '),
              }}
            >
              <div
                style={{
                  borderRadius: 19,
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, rgba(253,253,255,0.97) 0%, rgba(248,245,255,0.97) 100%)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                }}
              >
                {/* ── Header：选中文字预览 ── */}
                <div
                  style={{
                    padding: '10px 14px 9px',
                    borderBottom: '1px solid rgba(99,102,241,0.08)',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(139,92,246,0.02) 100%)',
                  }}
                >
                  {/* AI 标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    {/* 呼吸灯 */}
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        boxShadow: '0 0 7px rgba(99,102,241,0.7)',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.09em',
                        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      AI 助手
                    </span>
                  </div>

                  {/* 选中文字截断展示 */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: '#6B7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    「{selectedText.slice(0, 22)}{selectedText.length > 22 ? '…' : ''}」
                  </p>
                </div>

                {/* ── 功能按钮区 ── */}
                <div style={{ display: 'flex', padding: '6px 4px 8px', gap: 0 }}>
                  {ACTIONS.map((action, i) => {
                    const isHovered = hovered === action.id;
                    return (
                      <motion.button
                        key={action.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.045, type: 'spring', stiffness: 300 }}
                        onClick={() => handleAction(action.id)}
                        onMouseEnter={() => setHovered(action.id)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 2px 5px',
                          borderRadius: 12,
                          border: 'none',
                          cursor: 'pointer',
                          background: isHovered ? action.bgLight : 'transparent',
                          transition: 'background 0.18s, transform 0.12s',
                          transform: isHovered ? 'translateY(-1px)' : 'none',
                        }}
                      >
                        {/* 图标圆圈 */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: action.gradient,
                            boxShadow: isHovered
                              ? `0 5px 14px ${action.glow}`
                              : `0 2px 8px ${action.glow}`,
                            transition: 'box-shadow 0.18s',
                          }}
                        >
                          <action.icon size={14} color="white" strokeWidth={2.2} />
                        </div>

                        {/* 标签 */}
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 500,
                            color: isHovered ? '#4F46E5' : '#374151',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.18s',
                          }}
                        >
                          {action.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── 箭头（两层：渐变外层 + 白色内层） ── */}
            <div
              style={{
                position: 'absolute',
                bottom: -6,
                left: `calc(50% + ${arrowOffset}px)`,
                transform: 'translateX(-50%) rotate(45deg)',
                width: 12,
                height: 12,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.45), rgba(56,189,248,0.45))',
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -4,
                left: `calc(50% + ${arrowOffset}px)`,
                transform: 'translateX(-50%) rotate(45deg)',
                width: 10,
                height: 10,
                borderRadius: 1.5,
                background: 'rgba(249,246,255,0.97)',
                zIndex: 2,
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
