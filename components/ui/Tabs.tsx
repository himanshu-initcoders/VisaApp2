'use client';

import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { AnimatedTabs, type AnimatedTabItem } from '@/components/ui/AnimatedTabs';
import { cn } from '@/lib/utils';

export interface TabsPanelProps {
  /** Must match an item id from the parent Tabs `items` list. */
  id: string;
  children: ReactNode;
  className?: string;
}

/** Panel content for a Tabs item. Only the active panel is shown. */
export function TabsPanel({ children, className }: TabsPanelProps) {
  return <div className={cn('mt-6 space-y-6', className)}>{children}</div>;
}
TabsPanel.displayName = 'TabsPanel';

interface TabsProps {
  items: AnimatedTabItem[];
  /** Uncontrolled initial tab id. Defaults to first item. */
  defaultValue?: string;
  /** Controlled active tab id. */
  value?: string;
  onChange?: (id: string) => void;
  tone?: 'dark' | 'light';
  ariaLabel?: string;
  /** Unique layout id for the animated pill (required by AnimatedTabs). */
  layoutId: string;
  className?: string;
  tabListClassName?: string;
  /** TabsPanel children only. */
  children: ReactNode;
}

function getPanelId(child: ReactNode): string | null {
  if (!isValidElement(child)) return null;
  const props = child.props as Partial<TabsPanelProps>;
  return typeof props.id === 'string' ? props.id : null;
}

/**
 * Reusable tabbed layout: AnimatedTabs bar + matching TabsPanel content.
 *
 * @example
 * ```tsx
 * <Tabs
 *   items={[
 *     { id: 'info', label: 'Application information' },
 *     { id: 'logs', label: 'Call logs' },
 *   ]}
 *   layoutId="example-tabs"
 *   tone="light"
 * >
 *   <TabsPanel id="info">…</TabsPanel>
 *   <TabsPanel id="logs">…</TabsPanel>
 * </Tabs>
 * ```
 */
export function Tabs({
  items,
  defaultValue,
  value: controlledValue,
  onChange,
  tone = 'light',
  ariaLabel,
  layoutId,
  className,
  tabListClassName,
  children,
}: TabsProps) {
  const initial =
    defaultValue && items.some((item) => item.id === defaultValue)
      ? defaultValue
      : items[0]?.id ?? '';

  const [uncontrolled, setUncontrolled] = useState(initial);
  const active = controlledValue ?? uncontrolled;

  const handleChange = (id: string) => {
    if (controlledValue === undefined) {
      setUncontrolled(id);
    }
    onChange?.(id);
  };

  const itemIds = new Set(items.map((item) => item.id));
  const panels = Children.toArray(children).filter(
    (child): child is ReactElement<TabsPanelProps> => {
      const id = getPanelId(child);
      return id != null && itemIds.has(id);
    }
  );

  return (
    <div className={cn('w-full', className)}>
      <AnimatedTabs
        items={items}
        value={active}
        onChange={handleChange}
        tone={tone}
        ariaLabel={ariaLabel}
        layoutId={layoutId}
        className={tabListClassName}
      />
      {panels.map((panel) => {
        if (panel.props.id !== active) return null;
        return (
          <div
            key={panel.props.id}
            role="tabpanel"
            id={`tabpanel-${panel.props.id}`}
            aria-labelledby={panel.props.id}
          >
            {panel}
          </div>
        );
      })}
    </div>
  );
}
