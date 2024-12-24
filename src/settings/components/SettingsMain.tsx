import { ResetSettingsConfirmModal } from "@/components/modals/ResetSettingsConfirmModal";
import CopilotPlugin from "@/main";
import { resetSettings } from "@/settings/model";
import React from "react";
import ApiSettings from "./ApiSettings";
import CopilotPlusSettings from "./CopilotPlusSettings";
import GeneralSettings from "./GeneralSettings";
import QASettings from "./QASettings";

interface SettingsMainProps {
  plugin: CopilotPlugin;
}

const SettingsMain: React.FC<SettingsMainProps> = ({ plugin }) => {
  return (
    <div>
      <button
        onClick={() => new ResetSettingsConfirmModal(plugin.app, () => resetSettings()).open()}
      >
        Reset to Default Settings
      </button>
      <CopilotPlusSettings plugin={plugin} />
      <GeneralSettings plugin={plugin} />
      <ApiSettings plugin={plugin} />
      <QASettings vectorStoreManager={plugin.vectorStoreManager} plugin={plugin} />
    </div>
  );
};

export default SettingsMain;
