import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { motion, AnimatePresence } from 'motion/react';

export function HelpTips() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 z-40 max-w-xs"
      >
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">使用提示</h3>
              <ul className="text-xs text-gray-700 space-y-1.5">
                <li>• 输入文字后选中文本可使用AI功能</li>
                <li>• 移动端请长按选中的文本</li>
                <li>• 上传图片可自动识别文字</li>
                <li>• 生成的表格和脑图可单独查看</li>
              </ul>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
