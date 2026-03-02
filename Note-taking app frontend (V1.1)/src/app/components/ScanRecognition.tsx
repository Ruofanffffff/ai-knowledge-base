import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  X, ScanLine, FileText, BookOpen, Layout, CreditCard,
  CheckCircle2, AlertCircle, RefreshCw, Save, Tag,
  ChevronRight, Sparkles, Edit3, ArrowLeft,
} from 'lucide-react';
import { useNotes } from './context/NoteContext';

interface ScanRecognitionProps {
  open: boolean;
  onClose: () => void;
}

type Stage = 'viewfinder' | 'processing' | 'result' | 'saving' | 'success' | 'error';

type ScanType = { id: string; label: string; icon: typeof FileText; color: string };

const SCAN_TYPES: ScanType[] = [
  { id: 'doc',   label: '文档',  icon: FileText,   color: '#6366F1' },
  { id: 'book',  label: '书籍',  icon: BookOpen,   color: '#8B5CF6' },
  { id: 'board', label: '白板',  icon: Layout,     color: '#3B82F6' },
  { id: 'card',  label: '名片',  icon: CreditCard, color: '#10B981' },
];

const MOCK_RESULTS: Record<string, { title: string; content: string; tags: string[] }> = {
  doc: {
    title: '产品需求文档 · OCR 识别',
    content: `产品需求文档 v2.3

一、功能概述
本次迭代主要聚焦于用户体验优化，重点解决用户反馈中出现频率最高的三个问题：
1. 搜索响应速度慢（平均 2.3s → 目标 <0.5s）
2. 移动端适配不完善，小屏设备存在溢出问题
3. 黑暗模式切换时存在闪烁现象

二、设计目标
- 保持界面简洁，减少视觉干扰
- 提升操作流畅度，核心路径点击次数 ≤3
- 信息层级清晰，重要内容突出展示`,
    tags: ['产品', '文档', '需求'],
  },
  book: {
    title: '《心流》阅读摘录',
    content: `心流：最优体验心理学
米哈里·契克森米哈伊 著

第三章 享受与生活品质

"当我们全神贯注于某项挑战时，自我意识消失，时间感扭曲，这种状态就是心流。"

心流体验的八个要素：
1. 面对可以完成的工作
2. 能集中精力
3. 明确的目标
4. 及时的反馈
5. 深度的投入，日常烦恼消失
6. 有一种控制感
7. 自我意识消失
8. 时间感改变

—— 第 67 页`,
    tags: ['读书', '心理学', '心流', '摘录'],
  },
  board: {
    title: '白板讨论记录 · 知识图谱设计',
    content: `白板记录 @ 设计工作坊

核心议题：知识图谱的可视化方案

节点分类：
□ 概念节点（圆形）—— 核心知识点
□ 事件节点（菱形）—— 时间相关
□ 人物节点（六边形）—— 人际关系

连线语义：
→ 包含关系
⟷ 相互影响
- - - 弱关联

待办：
☑ 定义节点数据结构
☑ 设计交互手势
○ 实现力导向布局
○ 接入 AI 自动连线`,
    tags: ['白板', '知识图谱', '设计', '笔记'],
  },
  card: {
    title: '名片信息 · AI 结构化',
    content: `姓名：张思远
职位：产品设计师
公司：未来科技有限公司

联系方式：
手机：138-xxxx-8888
邮箱：zhangsr@future.tech
微信：ZhangSiYuan_Design

地址：上海市黄浦区南京东路 100 号
       未来大厦 18F

个人网站：www.zhangsiryuan.design
LinkedIn：linkedin.com/in/zhangsr`,
    tags: ['名片', '联系人', '人脉'],
  },
};

const PROCESSING_STEPS = [
  { label: '边缘检测与透视矫正', duration: 900 },
  { label: 'OCR 文字识别中…',    duration: 1100 },
  { label: 'AI 语义解析与整理',  duration: 800 },
];

export function ScanRecognition({ open, onClose }: ScanRecognitionProps) {
  const navigate = useNavigate();
  const { addNote } = useNotes();

  const [stage, setStage]           = useState<Stage>('viewfinder');
  const [scanType, setScanType]     = useState<string>('doc');
  const [processingStep, setStep]   = useState(0);
  const [processingPct, setPct]     = useState(0);
  const [editTitle, setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags]     = useState<string[]>([]);
  const [newTag, setNewTag]         = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const scanLineRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStage('viewfinder');
      setScanType('doc');
      setStep(0);
      setPct(0);
    }
  }, [open]);

  // Cleanup
  useEffect(() => {
    return () => { if (scanLineRef.current) clearInterval(scanLineRef.current); };
  }, []);

  // Mock "shutter" → processing → result
  const handleCapture = async () => {
    setStage('processing');
    setStep(0);
    setPct(0);

    // Simulate random error (15% chance)
    const willFail = Math.random() < 0.15;

    let accumulated = 0;
    const total = PROCESSING_STEPS.reduce((s, st) => s + st.duration, 0);

    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setStep(i);
      const stepMs = PROCESSING_STEPS[i].duration;
      const ticks = 20;
      for (let t = 0; t < ticks; t++) {
        await new Promise(r => setTimeout(r, stepMs / ticks));
        accumulated += stepMs / ticks;
        setPct(Math.min(99, Math.round((accumulated / total) * 100)));
      }
    }

    if (willFail) {
      setStage('error');
    } else {
      const result = MOCK_RESULTS[scanType] || MOCK_RESULTS.doc;
      setEditTitle(result.title);
      setEditContent(result.content);
      setEditTags([...result.tags]);
      setStage('result');
    }
  };

  const handleSave = async () => {
    setStage('saving');
    await new Promise(r => setTimeout(r, 700));
    addNote({
      title: editTitle,
      content: editContent,
      type: 'text',
      tags: editTags,
      structuredData: { source: 'scan', scanType },
    });
    setStage('success');
  };

  const handleRetry = () => {
    setStage('viewfinder');
    setStep(0);
    setPct(0);
  };

  const removeTag = (t: string) => setEditTags(prev => prev.filter(x => x !== t));
  const addTag = () => {
    const t = newTag.trim();
    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t]);
    setNewTag('');
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="scan-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(8,4,28,0.72)', backdropFilter: 'blur(8px)' }}
            onClick={stage === 'viewfinder' ? onClose : undefined}
          />

          {/* Panel — slides up */}
          <motion.div
            key="scan-panel"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
            style={{
              height: '92vh',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              background: stage === 'viewfinder' || stage === 'processing'
                ? 'linear-gradient(180deg, #0D0A1E 0%, #0F0C24 100%)'
                : 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 40%, #F3F8FF 100%)',
              overflow: 'hidden',
            }}
          >

            {/* ──────────────────────────────────────── */}
            {/* STAGE: VIEWFINDER                        */}
            {/* ──────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {stage === 'viewfinder' && (
                <motion.div
                  key="viewfinder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full"
                >
                  {/* Top bar */}
                  <div className="flex items-center justify-between px-5 pt-6 pb-4">
                    <button
                      onClick={onClose}
                      className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
                      style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                      <X size={18} color="white" />
                    </button>
                    <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>扫描识别</span>
                    <div className="w-9" />
                  </div>

                  {/* Scan type selector */}
                  <div className="flex gap-2 px-5 pb-4 overflow-x-auto scrollbar-hide">
                    {SCAN_TYPES.map(t => (
                      <motion.button
                        key={t.id}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setScanType(t.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
                        style={{
                          background: scanType === t.id ? t.color : 'rgba(255,255,255,0.1)',
                          border: `1px solid ${scanType === t.id ? t.color : 'rgba(255,255,255,0.15)'}`,
                        }}
                      >
                        <t.icon size={11} color={scanType === t.id ? 'white' : 'rgba(255,255,255,0.6)'} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: scanType === t.id ? 'white' : 'rgba(255,255,255,0.6)' }}>
                          {t.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Viewfinder area */}
                  <div className="flex-1 relative flex items-center justify-center px-8">
                    {/* Dark vignette */}
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />

                    {/* Scan frame */}
                    <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '52vh' }}>
                      {/* Corner brackets */}
                      {[
                        ['top-0 left-0', 'border-t-2 border-l-2 rounded-tl-lg'],
                        ['top-0 right-0', 'border-t-2 border-r-2 rounded-tr-lg'],
                        ['bottom-0 left-0', 'border-b-2 border-l-2 rounded-bl-lg'],
                        ['bottom-0 right-0', 'border-b-2 border-r-2 rounded-br-lg'],
                      ].map(([pos, cls], i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className={`absolute w-8 h-8 ${pos} ${cls}`}
                          style={{ borderColor: '#F59E0B' }}
                        />
                      ))}

                      {/* Scan line */}
                      <motion.div
                        className="absolute inset-x-0"
                        style={{
                          height: 2,
                          background: 'linear-gradient(90deg, transparent, #F59E0B, rgba(245,158,11,0.6), #F59E0B, transparent)',
                          boxShadow: '0 0 12px 3px rgba(245,158,11,0.5)',
                        }}
                        animate={{ top: ['5%', '92%', '5%'] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* Grid lines */}
                      <div className="absolute inset-0" style={{
                        backgroundImage: 'linear-gradient(rgba(245,158,11,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.06) 1px, transparent 1px)',
                        backgroundSize: '25% 25%',
                      }} />

                      {/* Center crosshair */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div
                          animate={{ opacity: [0.4, 0.9, 0.4] }}
                          transition={{ duration: 1.8, repeat: Infinity }}
                          className="relative"
                        >
                          <div style={{ width: 20, height: 2, background: 'rgba(245,158,11,0.6)' }} />
                          <div style={{ width: 2, height: 20, background: 'rgba(245,158,11,0.6)', position: 'absolute', top: -9, left: 9 }} />
                        </motion.div>
                      </div>

                      {/* Focus hint */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="absolute bottom-3 inset-x-0 flex justify-center"
                      >
                        <span style={{ color: 'rgba(245,158,11,0.8)', fontSize: '11px', fontWeight: 500 }}>
                          将文字对准取景框
                        </span>
                      </motion.div>
                    </div>
                  </div>

                  {/* Capture button area */}
                  <div className="px-8 py-6 flex items-center justify-center gap-10">
                    <div className="w-10" />
                    {/* Shutter */}
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCapture}
                      className="relative flex items-center justify-center"
                      style={{ width: 72, height: 72 }}
                    >
                      {/* Outer ring */}
                      <div className="absolute inset-0 rounded-full" style={{ border: '3px solid rgba(255,255,255,0.5)' }} />
                      {/* Inner fill */}
                      <motion.div
                        whileHover={{ scale: 0.9 }}
                        className="w-14 h-14 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', boxShadow: '0 0 24px rgba(245,158,11,0.6)' }}
                      />
                      <ScanLine size={22} color="white" style={{ position: 'absolute' }} />
                    </motion.button>

                    {/* Gallery hint */}
                    <button className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <Layout size={16} color="rgba(255,255,255,0.7)" />
                    </button>
                  </div>

                  <div className="h-8" />
                </motion.div>
              )}

              {/* ──────────────────────────────────────── */}
              {/* STAGE: PROCESSING                        */}
              {/* ──────────────────────────────────────── */}
              {stage === 'processing' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full items-center justify-center px-10"
                >
                  {/* Animated scan icon */}
                  <div className="relative mb-8">
                    <motion.div
                      className="w-24 h-24 rounded-3xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.3)' }}
                      animate={{ boxShadow: ['0 0 0px rgba(245,158,11,0)', '0 0 40px rgba(245,158,11,0.4)', '0 0 0px rgba(245,158,11,0)'] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                      >
                        <ScanLine size={38} color="#F59E0B" />
                      </motion.div>
                    </motion.div>
                    {/* Orbit ring */}
                    <motion.div
                      className="absolute inset-0 rounded-3xl"
                      style={{ border: '2px solid rgba(245,158,11,0.25)' }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  </div>

                  {/* Steps */}
                  <div className="w-full space-y-3 mb-8">
                    {PROCESSING_STEPS.map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        {/* Status dot */}
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                          {processingStep > i ? (
                            <CheckCircle2 size={18} color="#10B981" />
                          ) : processingStep === i ? (
                            <motion.div
                              className="w-4 h-4 rounded-full"
                              style={{ background: '#F59E0B' }}
                              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                              transition={{ duration: 0.7, repeat: Infinity }}
                            />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                          )}
                        </div>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: processingStep === i ? 600 : 400,
                          color: processingStep > i ? '#10B981' : processingStep === i ? '#F59E0B' : 'rgba(255,255,255,0.35)',
                          transition: 'color 0.3s',
                        }}>
                          {step.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full">
                    <div className="flex justify-between mb-2">
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>识别进度</span>
                      <span style={{ color: '#F59E0B', fontSize: '11px', fontWeight: 700 }}>{processingPct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }}
                        animate={{ width: `${processingPct}%` }}
                        transition={{ duration: 0.15 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ──────────────────────────────────────── */}
              {/* STAGE: RESULT                            */}
              {/* ──────────────────────────────────────── */}
              {stage === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 px-5 pt-6 pb-4"
                    style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
                  >
                    <button
                      onClick={handleRetry}
                      className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
                      style={{ background: 'rgba(99,102,241,0.08)' }}
                    >
                      <ArrowLeft size={16} style={{ color: '#6366F1' }} />
                    </button>
                    <div className="flex-1">
                      <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 700 }}>识别结果</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                        <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 500 }}>识别成功 · 点击内容可编辑</span>
                      </div>
                    </div>
                    <div
                      className="px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      <Sparkles size={10} style={{ color: '#F59E0B' }} />
                      <span style={{ color: '#F59E0B', fontSize: '10px', fontWeight: 700 }}>AI 整理</span>
                    </div>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Title */}
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(99,102,241,0.12)', boxShadow: '0 2px 8px rgba(99,102,241,0.06)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={12} style={{ color: '#6366F1' }} />
                        <span style={{ color: '#9CA3AF', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em' }}>标题</span>
                        <Edit3 size={10} style={{ color: '#C4C9D4', marginLeft: 'auto' }} />
                      </div>
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full bg-transparent outline-none"
                        style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}
                      />
                    </div>

                    {/* Tags */}
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(139,92,246,0.12)', boxShadow: '0 2px 8px rgba(139,92,246,0.05)' }}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <Tag size={12} style={{ color: '#8B5CF6' }} />
                        <span style={{ color: '#9CA3AF', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em' }}>AI 建议标签</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {editTags.map(tag => (
                          <motion.div
                            key={tag}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                          >
                            <span style={{ color: '#7C3AED', fontSize: '11.5px', fontWeight: 600 }}>#{tag}</span>
                            <button
                              onClick={() => removeTag(tag)}
                              className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center active:scale-90"
                              style={{ background: 'rgba(139,92,246,0.2)' }}
                            >
                              <X size={8} style={{ color: '#7C3AED' }} />
                            </button>
                          </motion.div>
                        ))}
                        {/* Add tag input */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ border: '1px dashed rgba(139,92,246,0.3)' }}>
                          <input
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
                            placeholder="+ 添加标签"
                            className="bg-transparent outline-none"
                            style={{ color: '#8B5CF6', fontSize: '11.5px', width: newTag ? `${newTag.length * 9 + 16}px` : 56, minWidth: 56, maxWidth: 100 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Recognized text */}
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(99,102,241,0.1)', boxShadow: '0 2px 8px rgba(99,102,241,0.05)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ScanLine size={12} style={{ color: '#F59E0B' }} />
                        <span style={{ color: '#9CA3AF', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em' }}>识别内容</span>
                        <span style={{ color: '#C4C9D4', fontSize: '10px', marginLeft: 'auto' }}>{editContent.length} 字</span>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={10}
                        className="w-full bg-transparent outline-none resize-none"
                        style={{ color: '#374151', fontSize: '13px', lineHeight: 1.75 }}
                      />
                    </div>
                  </div>

                  {/* Save bar */}
                  <div
                    className="px-5 py-4 flex gap-3"
                    style={{ borderTop: '1px solid rgba(99,102,241,0.08)', background: 'rgba(253,253,255,0.9)', backdropFilter: 'blur(20px)' }}
                  >
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl active:scale-95 transition-all"
                      style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.14)' }}
                    >
                      <RefreshCw size={15} style={{ color: '#6366F1' }} />
                      <span style={{ color: '#6366F1', fontSize: '13px', fontWeight: 600 }}>重新扫描</span>
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
                    >
                      <Save size={16} color="white" />
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>保存到思库</span>
                    </motion.button>
                  </div>
                  <div className="h-4" />
                </motion.div>
              )}

              {/* ──────────────────────────────────────── */}
              {/* STAGE: SAVING                            */}
              {/* ──────────────────────────────────────── */}
              {stage === 'saving' && (
                <motion.div
                  key="saving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full items-center justify-center gap-4"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-full"
                    style={{ border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366F1' }}
                  />
                  <p style={{ color: '#6366F1', fontSize: '14px', fontWeight: 600 }}>正在保存…</p>
                </motion.div>
              )}

              {/* ──────────────────────────────────────── */}
              {/* STAGE: SUCCESS                           */}
              {/* ──────────────────────────────────────── */}
              {stage === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col h-full items-center justify-center px-8 gap-5"
                >
                  {/* Green checkmark */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 20 }}
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                      border: '2px solid rgba(16,185,129,0.3)',
                      boxShadow: '0 0 40px rgba(16,185,129,0.2)',
                    }}
                  >
                    <CheckCircle2 size={48} style={{ color: '#10B981' }} />
                  </motion.div>

                  {/* Confetti dots */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ['#6366F1','#8B5CF6','#10B981','#F59E0B','#3B82F6','#EC4899','#6366F1','#10B981'][i],
                        top: '35%', left: '50%',
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: (Math.cos((i / 8) * Math.PI * 2) * 100),
                        y: (Math.sin((i / 8) * Math.PI * 2) * 80),
                        opacity: 0,
                        scale: 0.5,
                      }}
                      transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
                    />
                  ))}

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="text-center"
                  >
                    <p style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 800, marginBottom: 8 }}>保存成功！</p>
                    <p style={{ color: '#6B7280', fontSize: '13.5px', lineHeight: 1.6 }}>
                      「{editTitle}」<br />已成功保存到你的思库
                    </p>
                  </motion.div>

                  {/* Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full flex flex-col gap-3 mt-4"
                  >
                    <button
                      onClick={() => { navigate('/siku'); onClose(); }}
                      className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-97 transition-all"
                      style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
                    >
                      <ChevronRight size={16} color="white" />
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>前往思库查看</span>
                    </button>
                    <button
                      onClick={handleRetry}
                      className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-97 transition-all"
                      style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
                    >
                      <ScanLine size={15} style={{ color: '#6366F1' }} />
                      <span style={{ color: '#6366F1', fontSize: '13px', fontWeight: 600 }}>继续扫描</span>
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* ──────────────────────────────────────── */}
              {/* STAGE: ERROR                             */}
              {/* ──────────────────────────────────────── */}
              {stage === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col h-full items-center justify-center px-8 gap-5"
                >
                  {/* Error icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
                      border: '2px solid rgba(239,68,68,0.25)',
                    }}
                  >
                    <AlertCircle size={48} style={{ color: '#EF4444' }} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center"
                  >
                    <p style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 800, marginBottom: 8 }}>识别失败</p>
                    <p style={{ color: '#6B7280', fontSize: '13px', lineHeight: 1.7 }}>
                      图像质量不佳或光线不足，<br />
                      请确保文字清晰后重试。
                    </p>
                  </motion.div>

                  {/* Tips */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full rounded-2xl px-4 py-3.5 space-y-2"
                    style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}
                  >
                    <p style={{ color: '#EF4444', fontSize: '11.5px', fontWeight: 700, marginBottom: 6 }}>改善建议</p>
                    {['保持手机与文字平行，避免斜角', '确保光线充足，避免强光反射', '文字尽量填满取景框'].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#F87171' }} />
                        <span style={{ color: '#7F1D1D', fontSize: '12px', lineHeight: 1.5 }}>{tip}</span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full flex flex-col gap-3 mt-2"
                  >
                    <button
                      onClick={handleRetry}
                      className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-97 transition-all"
                      style={{ background: 'linear-gradient(135deg, #EF4444, #F87171)', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}
                    >
                      <RefreshCw size={16} color="white" />
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>重新扫描</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-3 rounded-2xl flex items-center justify-center active:scale-97 transition-all"
                      style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                      <span style={{ color: '#6B7280', fontSize: '13px', fontWeight: 600 }}>稍后再试</span>
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
