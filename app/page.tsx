"use client";

import { useState } from "react";
import { PollCreator } from "@/components/poll/PollCreator";
import { PollResults } from "@/components/poll/PollResults";
import { PollTimer } from "@/components/poll/PollTimer";
import { ChatConnector } from "@/components/chat/ChatConnector";
import { ChatLog } from "@/components/chat/ChatLog";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { OverlayGuide } from "@/components/overlay/OverlayGuide";
import { useOverlaySync } from "@/hooks/useOverlaySync";
import { useSettingsPersistence } from "@/hooks/useSettingsPersistence";
import { useChatConnections } from "@/hooks/useChatConnections";

export default function Home() {
  useOverlaySync();
  const { status: saveStatus } = useSettingsPersistence();
  const chatActions = useChatConnections();
  const [tab, setTab] = useState<"poll" | "settings">("poll");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <h1 className="text-white font-bold text-lg tracking-tight">
          Poll Multistream
        </h1>
        <div className="flex gap-1">
          {(["poll", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "poll" ? "Poll" : "Configurações"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {tab === "poll" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl mx-auto">
            <div className="space-y-4">
              <PollCreator />
              <PollTimer />
              <ChatConnector actions={chatActions} />
              <ChatLog />
            </div>
            <div className="space-y-4">
              <PollResults />
              <OverlayGuide />
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto">
            <SettingsPanel saveStatus={saveStatus} />
          </div>
        )}
      </main>
    </div>
  );
}
