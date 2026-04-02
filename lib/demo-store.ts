"use client";

import { useEffect, useMemo, useState } from "react";
import { demoAssets, demoCustomers, demoTemplates, demoThreads, demoWorkItems } from "@/lib/dummy-data";

export type DemoCustomer = { id: string; fullName: string; phone: string; email: string };
export type DemoAsset = { id: string; customerId: string; type: string; displayName: string; identifier: string };
export type DemoWorkItem = { id: string; title: string; customerId: string; assetId: string; stage: string; priority: string };
export type DemoTemplate = { id: string; name: string; category: string; language: string };
export type DemoThread = { id: string; customerId: string; preview: string; unread: number; updatedAt: string };

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
      else localStorage.setItem(key, JSON.stringify(initial));
    } finally {
      setReady(true);
    }
  }, [initial, key]);

  const update = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };

  return { value, update, ready };
}

export function useDemoStore() {
  const customers = usePersistentState<DemoCustomer[]>("demo_customers", demoCustomers);
  const assets = usePersistentState<DemoAsset[]>("demo_assets", demoAssets);
  const workItems = usePersistentState<DemoWorkItem[]>("demo_work_items", demoWorkItems);
  const templates = usePersistentState<DemoTemplate[]>("demo_templates", demoTemplates);
  const threads = usePersistentState<DemoThread[]>("demo_threads", demoThreads);

  const isReady = customers.ready && assets.ready && workItems.ready && templates.ready && threads.ready;

  const dashboard = useMemo(
    () => ({
      activeWorkItems: workItems.value.length,
      waitingApproval: workItems.value.filter((x) => x.stage.toLowerCase().includes("approval")).length,
      customers: customers.value.length,
      unread: threads.value.reduce((sum, t) => sum + t.unread, 0)
    }),
    [customers.value, threads.value, workItems.value]
  );

  return { customers, assets, workItems, templates, threads, dashboard, isReady };
}
