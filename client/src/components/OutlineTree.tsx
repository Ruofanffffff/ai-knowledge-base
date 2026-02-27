import { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface OutlineNode {
  id: string;
  title: string;
  status: 'filled' | 'gap' | 'generated' | 'user_edited';
  content?: string;
  children: OutlineNode[];
}

interface OutlineTreeProps {
  nodes: OutlineNode[];
  onGenerate?: (nodeId: string, mode: 'full' | 'append' | 'replace') => Promise<void>;
  onContentEdit?: (nodeId: string, content: string) => void;
  editable?: boolean;
  generatingNodeId?: string | null;
}

const STATUS_STYLES = {
  filled: {
    dot: 'text-green-500',
    border: 'border-l-green-500 border-l-2 border-solid',
    label: '已填充',
    DotIcon: Circle,
  },
  gap: {
    dot: 'text-slate-400',
    border: 'border-l-slate-300 border-l-2 border-dashed',
    label: '待补全',
    DotIcon: CircleDashed,
  },
  generated: {
    dot: 'text-blue-500',
    border: 'border-l-blue-500 border-l-2 border-solid',
    label: 'AI 生成',
    DotIcon: CircleDot,
  },
  user_edited: {
    dot: 'text-green-600',
    border: 'border-l-green-600 border-l-2 border-solid',
    label: '已编辑',
    DotIcon: CheckCircle2,
  },
} as const;

export function OutlineTree({
  nodes,
  onGenerate,
  onContentEdit,
  editable = false,
  generatingNodeId = null,
}: OutlineTreeProps) {
  if (nodes.length === 0) {
    return <p className="text-sm text-slate-400">暂无大纲节点</p>;
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <OutlineNodeItem
          key={node.id}
          node={node}
          depth={0}
          onGenerate={onGenerate}
          onContentEdit={onContentEdit}
          editable={editable}
          generatingNodeId={generatingNodeId}
        />
      ))}
    </div>
  );
}


interface OutlineNodeItemProps {
  node: OutlineNode;
  depth: number;
  onGenerate?: (nodeId: string, mode: 'full' | 'append' | 'replace') => Promise<void>;
  onContentEdit?: (nodeId: string, content: string) => void;
  editable: boolean;
  generatingNodeId: string | null;
}

function OutlineNodeItem({
  node,
  depth,
  onGenerate,
  onContentEdit,
  editable,
  generatingNodeId,
}: OutlineNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingContent, setEditingContent] = useState<string | null>(null);

  const style = STATUS_STYLES[node.status];
  const DotIcon = style.DotIcon;
  const hasChildren = node.children.length > 0;
  const isGenerating = generatingNodeId === node.id;
  const isGap = node.status === 'gap';
  const isEditable = editable && (node.status === 'generated' || node.status === 'user_edited');

  const handleToggle = useCallback(() => {
    if (hasChildren) setExpanded((prev) => !prev);
  }, [hasChildren]);

  const handleGenerateClick = useCallback(() => {
    if (onGenerate && isGap) {
      onGenerate(node.id, 'full');
    }
  }, [onGenerate, isGap, node.id]);

  const handleBlur = useCallback(() => {
    if (editingContent !== null && onContentEdit && editingContent !== node.content) {
      onContentEdit(node.id, editingContent);
    }
    setEditingContent(null);
  }, [editingContent, onContentEdit, node.id, node.content]);

  return (
    <div style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}>
      {/* Node row */}
      <div className={`${style.border} pl-3 py-1.5 rounded-r-md hover:bg-slate-50 transition-colors`}>
        <div className="flex items-center gap-2">
          {/* Expand/collapse toggle */}
          <button
            onClick={handleToggle}
            className={`p-0.5 rounded transition-colors ${
              hasChildren ? 'text-slate-400 hover:text-slate-600 cursor-pointer' : 'text-transparent cursor-default'
            }`}
            aria-label={expanded ? '折叠' : '展开'}
            tabIndex={hasChildren ? 0 : -1}
          >
            {hasChildren && expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Status dot */}
          <DotIcon className={`w-4 h-4 shrink-0 ${style.dot}`} />

          {/* Title */}
          <span
            className={`text-sm font-medium flex-1 min-w-0 truncate ${
              isGap ? 'text-slate-400' : 'text-slate-700'
            } ${hasChildren ? 'cursor-pointer' : ''}`}
            onClick={handleToggle}
          >
            {node.title}
          </span>

          {/* Status badge */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
              node.status === 'filled'
                ? 'bg-green-50 text-green-600'
                : node.status === 'gap'
                  ? 'bg-slate-100 text-slate-400'
                  : node.status === 'generated'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-green-50 text-green-700'
            }`}
          >
            {style.label}
          </span>

          {/* Generate button for gap nodes */}
          {editable && isGap && onGenerate && (
            <button
              onClick={handleGenerateClick}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              补全
            </button>
          )}
        </div>

        {/* Content area */}
        {node.content && !isEditable && (
          <div className="mt-1.5 ml-10 text-xs text-slate-500 leading-relaxed whitespace-pre-wrap line-clamp-4">
            {node.content}
          </div>
        )}

        {/* Editable content area */}
        {isEditable && (
          <div className="mt-1.5 ml-10">
            {editingContent !== null ? (
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                onBlur={handleBlur}
                className="w-full text-xs text-slate-600 leading-relaxed p-2 border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y min-h-[60px]"
                rows={3}
                autoFocus
              />
            ) : (
              <div
                onClick={() => setEditingContent(node.content || '')}
                className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap p-2 rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-text min-h-[36px] transition-colors"
              >
                {node.content || '点击编辑内容...'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <OutlineNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onGenerate={onGenerate}
              onContentEdit={onContentEdit}
              editable={editable}
              generatingNodeId={generatingNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
