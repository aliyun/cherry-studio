import React from 'react'

// Box 组件
export const Box: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { padding?: number; border?: string; borderStyle?: string; className?: string }
> = ({ padding: p, border, borderStyle, className, style, ...props }) => (
  <div
    className={className}
    style={{
      padding: p ? `${p}px` : undefined,
      border: border,
      borderStyle: borderStyle,
      ...style
    }}
    {...props}
  />
)

// SimpleGrid 组件
export const SimpleGrid: React.FC<{
  columns?: number
  templateColumns?: string
  children: React.ReactNode
  leftSpace?: number
}> = ({ columns, templateColumns, children, leftSpace = 0, ...props }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: templateColumns || (columns ? `repeat(${columns}, 1fr)` : undefined),
      gap: '1px',
      paddingLeft: leftSpace
    }}
    {...props}>
    {children}
  </div>
)

// Text 组件
export const Text: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ style, ...props }) => (
  <span
    style={{ fontSize: 12, ...style, cursor: props.onClick ? 'pointer' : undefined }}
    {...props}
    onClick={props.onClick ? props.onClick : undefined}
  />
)

// VStack 组件
export const VStack: React.FC<{ grap?: number; align?: string; children: React.ReactNode }> = ({
  grap = 5,
  align = 'stretch',
  children,
  ...props
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: align,
      gap: `${grap}px`
    }}
    {...props}>
    {children}
  </div>
)

// GridItem 组件
export const GridItem: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { colSpan?: number; rowSpan?: number; padding?: number }
> = ({ colSpan, rowSpan, padding, style, ...props }) => (
  <div
    style={{
      gridColumn: colSpan ? `span ${colSpan}` : undefined,
      gridRow: rowSpan ? `span ${rowSpan}` : undefined,
      padding: padding ? `${padding}px` : undefined,
      ...style
    }}
    {...props}
  />
)

// HStack 组件
export const HStack: React.FC<{ grap?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  grap,
  children,
  style,
  ...props
}) => (
  <div
    style={{
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: grap ? `${grap}px` : '5px',
      ...style
    }}
    {...props}>
    {children}
  </div>
)

// IconButton 组件
export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md'; fontSize?: string }
> = ({ size = 'md', fontSize = '12px', style, ...props }) => (
  <button
    type="button"
    style={{
      width: size === 'sm' ? 16 : 24,
      height: size === 'sm' ? 16 : 24,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontSize,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style
    }}
    {...props}>
    {props.children || (props['aria-label'] === 'Toggle' ? (props['aria-expanded'] ? '▼' : '▶') : '🔘')}
  </button>
)

// 自定义 Button 组件
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ style, ...props }) => (
  <button
    type="button"
    style={{
      padding: '5px 10px',
      border: 'none',
      cursor: 'pointer',
      ...style
    }}
    {...props}
  />
)
