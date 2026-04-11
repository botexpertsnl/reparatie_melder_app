"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

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

  const handleZernioConnect = async () => {
    setZernioLoading(true);
    try {
      const response = await fetch("/api/whatsapp/zernio/connect", { method: "POST" });
      if (!response.ok) return;
      const payload = await response.json();
      const connectUrl = payload?.data?.connectUrl as string | undefined;
      if (connectUrl) window.location.href = connectUrl;
    } finally {
      setZernioLoading(false);
    }
  };

  const handleZernioDisconnect = async () => {
    setZernioLoading(true);
    try {
      await fetch("/api/whatsapp/zernio/disconnect", { method: "POST" });
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
      <p className="mt-1 text-xs text-slate-500">Manage tenant-level WhatsApp connection via ZERNIO.</p>

      <div className="mt-4 grid gap-2 rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-3 text-sm text-slate-300">
        <div>Connection status: <span className="font-semibold text-white">{zernioConnection?.connectionStatus ?? "DISCONNECTED"}</span></div>
        <div>Connected number: <span className="font-semibold text-white">{zernioConnection?.whatsappPhoneNumber || "Not connected"}</span></div>
        <div>Verification status: <span className="font-semibold text-white">{zernioConnection?.zernioPhoneNumberId ? "VERIFIED" : "PENDING"}</span></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleZernioConnect}
          disabled={zernioLoading}
          className="rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {zernioConnection ? "Reconnect" : "Connect"}
        </button>
        <button
          type="button"
          onClick={handleZernioDisconnect}
          disabled={zernioLoading || !zernioConnection}
          className="rounded-xl border border-red-500/70 px-4 py-2 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Disconnect
        </button>
      </div>
    </section>
  );
}
