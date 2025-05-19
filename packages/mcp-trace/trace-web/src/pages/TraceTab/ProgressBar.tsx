import { motion } from 'framer-motion';
import { cn } from '../../utils/classUtil';

interface ProgressBarProps {
  progress: number; // 目标进度值
  start?: number; // 起始位置（百分比），默认为 0
  className?: string; // 额外的类名
}

export function ProgressBar({
  progress,
  start = 0,
  className,
}: ProgressBarProps) {
  // 确保起始位置和目标进度值在合理范围
  const clampedStart = Math.max(0, Math.min(100, start));
  const clampedProgress = Math.max(0, Math.min(100 - clampedStart, progress));
  return (
    <div
      className={cn(
        'relative h-1.5 bg-gradient-to-r from-gray-200/50 to-gray-300/50 dark:from-gray-800/50 dark:to-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm',
        className,
      )}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(37,99,235,0.1),transparent)] dark:bg-[radial-gradient(closest-side,rgba(37,99,235,0.15),transparent)] animate-pulse" />

      {/* 进度条指示器 */}
      <motion.div
        initial={{ width: 0, left: `${clampedStart}%` }} // 从设定的起始位置开始填充
        animate={{ width: `${clampedProgress}%`, left: `${clampedStart}%` }} // 控制进度条的宽度和位置
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="absolute left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700"
      >
        {/* 光泽效果 */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-shine" />
      </motion.div>
    </div>
  );
}
