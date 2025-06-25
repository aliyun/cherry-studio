import React from 'react'

export interface ProgressBarProps {
  start: number // 起始进度值（0-100）
  progress: number // 当前进度值（0-100）
  height?: number // 可选：进度条高度
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ start = 0, progress, height = 6 }) => {
  // 计算实际显示进度（从start开始）
  const displayProgress = Math.max(0, progress)

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#e0e0e0',
        borderRadius: height,
        overflow: 'hidden',
        marginTop: '8px'
      }}>
      <div
        style={{
          width: `${displayProgress}%`,
          height: height,
          backgroundColor: '#4CAF50',
          borderRadius: height,
          transition: 'width 0.3s ease',
          marginLeft: `${start}%`
        }}
      />
    </div>
  )
}
