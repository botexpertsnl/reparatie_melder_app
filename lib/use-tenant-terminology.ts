"use client";

import { useEffect, useState } from "react";
import { defaultTenantSettings, getActiveAssetLabel, getActiveRepairLabel } from "@/lib/tenant-settings-store";

function useTenantLabel(defaultLabel: string, getActiveLabel: () => string) {
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    const refresh = () => setLabel(getActiveLabel());
    refresh();
    window.addEventListener("tenant-settings:changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tenant-settings:changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [getActiveLabel]);

  return label;
}

export function useTenantRepairLabel() {
  return useTenantLabel(defaultTenantSettings.repairLabel, getActiveRepairLabel);
}

export function useTenantAssetLabel() {
  return useTenantLabel(defaultTenantSettings.assetLabel, getActiveAssetLabel);
}

export function pluralizeLabel(label: string) {
  return label.endsWith("s") ? label : `${label}s`;
}
