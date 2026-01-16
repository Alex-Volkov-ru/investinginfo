import React from 'react';

interface BootstrapIconProps {
  name: string;
  className?: string;
  size?: number;
}

export const BootstrapIcon: React.FC<BootstrapIconProps> = ({ name, className = '', size }) => {
  const style = size ? { 
    fontSize: `${size}px`, 
    width: `${size}px`, 
    height: `${size}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  } : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
  return <i className={`bi bi-${name} ${className}`} style={style}></i>;
};

