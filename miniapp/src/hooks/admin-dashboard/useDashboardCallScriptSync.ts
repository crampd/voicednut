import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { CallScriptRow } from '@/pages/AdminDashboard/types';

type UseDashboardCallScriptSelectionSyncOptions = {
  callScripts: CallScriptRow[];
  selectedCallScriptId: number;
  setSelectedCallScriptId: Dispatch<SetStateAction<number>>;
  selectedCallScript: CallScriptRow | null;
  setScriptNameInput: Dispatch<SetStateAction<string>>;
  setScriptDescriptionInput: Dispatch<SetStateAction<string>>;
  setScriptDefaultProfileInput: Dispatch<SetStateAction<string>>;
  setScriptPromptInput: Dispatch<SetStateAction<string>>;
  setScriptFirstMessageInput: Dispatch<SetStateAction<string>>;
  setScriptObjectiveTagsInput: Dispatch<SetStateAction<string>>;
  toInt: (value: unknown, fallback?: number) => number;
  toText: (value: unknown, fallback?: string) => string;
  asStringList: (value: unknown) => string[];
};

export function useDashboardCallScriptSelectionSync({
  callScripts,
  selectedCallScriptId,
  setSelectedCallScriptId,
  selectedCallScript,
  setScriptNameInput,
  setScriptDescriptionInput,
  setScriptDefaultProfileInput,
  setScriptPromptInput,
  setScriptFirstMessageInput,
  setScriptObjectiveTagsInput,
  toInt,
  toText,
  asStringList,
}: UseDashboardCallScriptSelectionSyncOptions): void {
  useEffect(() => {
    if (callScripts.length === 0) {
      setSelectedCallScriptId(0);
      return;
    }
    if (!callScripts.some((script) => toInt(script.id) === selectedCallScriptId)) {
      setSelectedCallScriptId(toInt(callScripts[0]?.id));
    }
  }, [callScripts, selectedCallScriptId, setSelectedCallScriptId, toInt]);

  useEffect(() => {
    if (!selectedCallScript) return;
    setScriptNameInput(toText(selectedCallScript.name, ''));
    setScriptDescriptionInput(toText(selectedCallScript.description, ''));
    setScriptDefaultProfileInput(toText(selectedCallScript.default_profile, ''));
    setScriptPromptInput(toText(selectedCallScript.prompt, ''));
    setScriptFirstMessageInput(toText(selectedCallScript.first_message, ''));
    const tags = asStringList(selectedCallScript.objective_tags);
    setScriptObjectiveTagsInput(tags.join(', '));
  }, [
    asStringList,
    selectedCallScript,
    setScriptDefaultProfileInput,
    setScriptDescriptionInput,
    setScriptFirstMessageInput,
    setScriptNameInput,
    setScriptObjectiveTagsInput,
    setScriptPromptInput,
    toText,
  ]);
}
