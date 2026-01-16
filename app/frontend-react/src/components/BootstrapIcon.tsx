import React from 'react';

interface BootstrapIconProps {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const BootstrapIcon: React.FC<BootstrapIconProps> = ({ name, className = '', size, style }) => {
  const defaultStyle = size ? { 
    fontSize: `${size}px`, 
    width: `${size}px`, 
    height: `${size}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  } : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
  
  const mergedStyle = style ? { ...defaultStyle, ...style } : defaultStyle;
  
  return <i className={`bi bi-${name} ${className}`} style={mergedStyle}></i>;
};

