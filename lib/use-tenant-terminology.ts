"use client";

import { useEffect, useState } from "react";
import { defaultTenantSettings, getActiveRepairLabel } from "@/lib/tenant-settings-store";

export function useTenantRepairLabel() {
  const [repairLabel, setRepairLabel] = useState(defaultTenantSettings.repairLabel);

  useEffect(() => {
    const refresh = () => setRepairLabel(getActiveRepairLabel());
    refresh();
    window.addEventListener("tenant-settings:changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tenant-settings:changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return repairLabel;
}

export function pluralizeLabel(label: string) {
  return label.endsWith("s") ? label : `${label}s`;
}
