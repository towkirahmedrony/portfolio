"use client";

import { Children, useState, type ReactNode } from "react";

export type SettingsTabSpec = {
  id: string;
  label: string;
  description: string;
};

/**
 * Lightweight tab shell for modular settings sections. Each child element
 * maps 1:1 (in order) to the given tab specs — adding a future section is just
 * a new spec + a new child, no page restructuring.
 */
export function SettingsTabs({
  tabs,
  children,
}: {
  tabs: SettingsTabSpec[];
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const panels = Children.toArray(children);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 rounded-3xl border border-card-border bg-card p-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={activeId === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
              activeId === tab.id
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`settings-panel-${tab.id}`}
          aria-labelledby={`settings-tab-${tab.id}`}
          hidden={index !== activeIndex}
          className="mt-6"
        >
          <p className="mb-4 text-sm text-muted">{tab.description}</p>
          {panels[index]}
        </div>
      ))}
    </div>
  );
}
