"use client";

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";

type ZernioConnection = {
  connectionStatus: string;
  whatsappPhoneNumber: string;
  zernioPhoneNumberId?: string | null;
  zernioAccountId?: string | null;
};

export function WhatsappZernioCard() {
  const [zernioConnection, setZernioConnection] = useState<ZernioConnection | null>(null);
  const [zernioLoading, setZernioLoading] = useState(false);

  const loadZernioConnection = async () => {
    const response = await fetch("/api/whatsapp/zernio/status", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setZernioConnection(data.data ?? null);
  };

  useEffect(() => {
    void loadZernioConnection();
  }, []);

  const refreshZernioConnection = async () => {
    setZernioLoading(true);
    try {
      await loadZernioConnection();
    } finally {
      setZernioLoading(false);
    }
  };

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageCircle className="h-4 w-4" />
        WhatsApp (ZERNIO)
      </h2>
      <p className="mt-1 text-xs text-slate-500">This connection is assigned by the system administrator.</p>

      <div className="mt-4 grid gap-2 rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-3 text-sm text-slate-300">
        <div>Connection status: <span className="font-semibold text-white">{zernioConnection?.connectionStatus ?? "DISCONNECTED"}</span></div>
        <div>Connected number: <span className="font-semibold text-white">{zernioConnection?.whatsappPhoneNumber || "Not connected"}</span></div>
        <div>Verification status: <span className="font-semibold text-white">{zernioConnection?.zernioPhoneNumberId ? "VERIFIED" : "PENDING"}</span></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refreshZernioConnection}
          disabled={zernioLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#28d9c6]/50 bg-[#28d9c6]/10 px-4 py-2 text-sm font-semibold text-[#7ff5e9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${zernioLoading ? "animate-spin" : ""}`} /> Refresh status
        </button>
      </div>
    </section>
  );
}
