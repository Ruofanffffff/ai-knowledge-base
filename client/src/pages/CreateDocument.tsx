import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, XCircle } from 'lucide-react';
import apiClient from '../api/client';
import KGPipelineModal from '../components/KGPipelineModal';
import RichTextEditor, { RichTextEditorHandle } from '../components/editor/RichTextEditor';

export default function CreateDocument() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [kgModalDocId, setKgModalDocId] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入文档标题');
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const contentJSON = editorRef.current?.getJSON() ?? { type: 'doc', content: [] };
      const response = await apiClient.post('/documents', {
        title: title.trim(),
        content: JSON.stringify(contentJSON),
        type: 'document',
        fileType: '.md'
      });

      const newDocument = response.data;
      setSaveStatus('saved');
      
      if (newDocument.id) {
        setKgModalDocId(newDocument.id.toString());
      } else {
        setTimeout(() => {
          navigate(`/documents/${newDocument.id}`);
        }, 500);
      }
    } catch (error) {
      console.error('创建文档失败:', error);
      setSaveStatus('error');
      alert('创建文档失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50/50">
      <div className="flex items-center justify-between px-8 py-6 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/documents')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">新建文档</h1>
            <p className="text-slate-500 text-sm mt-1">
              {saveStatus === 'saved' && '文档已创建'}
              {saveStatus === 'saving' && '正在保存...'}
              {saveStatus === 'error' && '保存失败'}
              {saveStatus === 'idle' && '开始新的创作'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/documents')}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
          >
            <XCircle size={16} />
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>创建文档</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Scrollable document area — like a Word page */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full bg-white min-h-full shadow-sm">
            {/* Title input */}
            <div className="px-12 pt-8">
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-4xl font-bold text-slate-900 outline-none placeholder:text-slate-300 mb-4"
                placeholder="无标题文档"
              />
            </div>

            {/* RichTextEditor — flows naturally below title */}
            <RichTextEditor ref={editorRef} />
            
            <div className="px-6 py-2 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
              <span>富文本模式</span>
              <span>支持图片粘贴和拖拽</span>
            </div>
          </div>
        </div>

        <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200">
             <h3 className="font-semibold text-slate-700">文档提示</h3>
          </div>
          <div className="p-4 overflow-y-auto space-y-4">
             <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-purple-500" />
                   <span className="text-xs font-bold text-purple-700 uppercase">写作技巧</span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-1">结构化内容</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                   使用标题、列表和段落来组织你的内容，让文档更易读。
                </p>
             </div>

             <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-xs font-bold text-blue-700 uppercase">图片支持</span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-1">插入图片</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                   点击工具栏图片按钮上传，或直接粘贴/拖拽图片到编辑器。
                </p>
             </div>

             <div className="bg-white p-3 rounded-xl border border-green-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-green-500" />
                   <span className="text-xs font-bold text-green-700 uppercase">AI 辅助</span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-1">智能总结</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                   保存后可以使用 AI 生成文档总结。
                </p>
             </div>
          </div>
        </div>
      </div>

      {kgModalDocId && (
        <KGPipelineModal
          docId={kgModalDocId}
          docTitle={title}
          onClose={() => {
            setKgModalDocId(null);
            navigate('/documents');
          }}
        />
      )}
    </div>
  );
}