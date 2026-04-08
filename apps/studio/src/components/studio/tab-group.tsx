"use client";

import { useState } from "react";

export type StudioTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export function TabGroup({ tabs }: { tabs: StudioTab[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!active) {
    return null;
  }

  return (
    <div className="tab-group">
      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active.id ? "tab-button tab-button-active" : "tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{active.content}</div>
    </div>
  );
}
