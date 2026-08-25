"use client";

import { useEffect, useState } from "react";
import { Sidebar, NavSection } from "@/components/layout/Sidebar";
import { PollCreator } from "@/components/poll/PollCreator";
import { PollResults } from "@/components/poll/PollResults";
import { PollTimer } from "@/components/poll/PollTimer";
import { PollTemplates } from "@/components/poll/PollTemplates";
import { PollHistory } from "@/components/poll/PollHistory";
import { ChatConnector } from "@/components/chat/ChatConnector";
import { ChatLog } from "@/components/chat/ChatLog";
import { ConnectionsView } from "@/components/connections/ConnectionsView";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { OverlayGuide } from "@/components/overlay/OverlayGuide";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useOverlaySync } from "@/hooks/useOverlaySync";
import { useSettingsPersistence } from "@/hooks/useSettingsPersistence";
import { usePollsPersistence } from "@/hooks/usePollsPersistence";
import { useChatConnections } from "@/hooks/useChatConnections";
import { attachConsoleLog } from "@/lib/logging/attachConsoleLog";
import { checkForUpdate } from "@/lib/version/checkForUpdate";
import { PollTemplate } from "@/lib/poll/types";

export default function Home() {
  useEffect(() => {
    attachConsoleLog();
    checkForUpdate();
  }, []);
  useOverlaySync();
  const { status: saveStatus } = useSettingsPersistence();
  usePollsPersistence();
  const chatActions = useChatConnections();
  const [section, setSection] = useState<NavSection>("nova-poll");
  const [prefill, setPrefill] = useState<PollTemplate | null>(null);

  function useTemplate(template: PollTemplate) {
    setPrefill(template);
    setSection("nova-poll");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={section} onChange={setSection} />

      <main className="flex-1 overflow-y-auto p-6">
        {section === "nova-poll" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto items-start">
            <div className="space-y-4">
              <PollCreator prefill={prefill} />
              <PollTimer />
              <ChatConnector actions={chatActions} onOpenConnections={() => setSection("conexoes")} />
            </div>
            <div className="space-y-4">
              <PollResults />
              <ChatLog />
              <OverlayGuide />
            </div>
          </div>
        )}

        {section === "minhas-polls" && <PollTemplates onUse={useTemplate} />}
        {section === "historico" && <PollHistory />}
        {section === "conexoes" && <ConnectionsView actions={chatActions} />}
        {section === "configuracoes" && <SettingsPanel saveStatus={saveStatus} />}
      </main>

      <ToastContainer />
    </div>
  );
}
