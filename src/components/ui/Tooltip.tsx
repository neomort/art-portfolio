import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  className?: string;
}

// Utility to get the tooltip root, or create it if it doesn't exist
function getTooltipRoot() {
  let root = document.getElementById('tooltip-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tooltip-root';
    root.style.position = 'fixed';
    root.style.zIndex = '9999';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
  }
  return root;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  offset = 8,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0, left = 0;
    if (placement === 'top') {
      top = rect.top - offset;
      left = rect.left + rect.width / 2;
    } else if (placement === 'bottom') {
      top = rect.bottom + offset;
      left = rect.left + rect.width / 2;
    } else if (placement === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - offset;
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + offset;
    }
    setCoords({ top, left });
  }, [visible, placement, offset]);

    // Compose ref forwarding for child
  function composeRefs(...refs: any[]) {
    return (node: HTMLElement | null) => {
      triggerRef.current = node;
      refs.forEach(ref => {
        if (!ref) return;
        if (typeof ref === 'function') ref(node);
        else if ('current' in ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      });
    };
  }

  const childProps: any = {
    onMouseEnter: (e: React.MouseEvent) => {
      setVisible(true);
      if (children.props.onMouseEnter) children.props.onMouseEnter(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      setVisible(false);
      if (children.props.onMouseLeave) children.props.onMouseLeave(e);
    },
    onFocus: (e: React.FocusEvent) => {
      setVisible(true);
      if (children.props.onFocus) children.props.onFocus(e);
    },
    onBlur: (e: React.FocusEvent) => {
      setVisible(false);
      if (children.props.onBlur) children.props.onBlur(e);
    },
  };
  if ((children as any).ref !== undefined) {
    childProps.ref = composeRefs((children as any).ref);
  } else {
    childProps.ref = triggerRef;
  }

  const childWithProps = React.cloneElement(children, childProps);

  const portal = visible && coords
    ? createPortal(
        <div
          ref={tooltipRef}
          className={`pointer-events-none z-[9999] fixed px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 text-white shadow-lg whitespace-nowrap transition-opacity duration-150 ${className}`}
          style={{
            top: placement === 'top' || placement === 'bottom' ? coords.top : coords.top,
            left: placement === 'top' || placement === 'bottom' ? coords.left : coords.left,
            transform:
              placement === 'top' || placement === 'bottom'
                ? 'translate(-50%, -100%)'
                : 'translate(0, -50%)',
            opacity: visible ? 1 : 0,
          }}
        >
          {content}
        </div>,
        getTooltipRoot()
      )
    : null;

  return (
    <>
      {childWithProps}
      {portal}
    </>
  );
};
