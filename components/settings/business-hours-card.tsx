"use client";

import clsx from "clsx";
import { Clock3 } from "lucide-react";
import type { BusinessHoursDayKey, BusinessHoursSettings } from "@/lib/tenant-settings-store";
import { isValidBusinessHoursDayRange } from "@/lib/business-hours";

const DAY_LABELS: Array<{ key: BusinessHoursDayKey; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
];

export function BusinessHoursCard({
  value,
  onChange,
  onSave
}: {
  value: BusinessHoursSettings;
  onChange: (next: BusinessHoursSettings) => void;
  onSave: () => void;
}) {
  const setDayOpen = (dayKey: BusinessHoursDayKey, isOpen: boolean) => {
    onChange({
      ...value,
      days: {
        ...value.days,
        [dayKey]: {
          ...value.days[dayKey],
          isOpen
        }
      }
    });
  };

  const setDayTime = (dayKey: BusinessHoursDayKey, field: "openTime" | "closeTime", timeValue: string) => {
    onChange({
      ...value,
      days: {
        ...value.days,
        [dayKey]: {
          ...value.days[dayKey],
          [field]: timeValue
        }
      }
    });
  };

  const setReply = (field: "insideReplyEnabled" | "outsideReplyEnabled" | "insideReplyMessage" | "outsideReplyMessage", nextValue: boolean | string) => {
    onChange({
      ...value,
      [field]: nextValue
    });
  };

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4" />Business Hours</h2>
      <p className="mt-1 text-xs text-slate-500">Configure opening times and automatic replies in CEST (Europe/Amsterdam).</p>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</span>
        <span className="rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-2.5 py-1 text-xs font-semibold text-[#77dfd4]">CEST (Europe/Amsterdam)</span>
      </div>

      <div className="mt-4 space-y-2">
        {DAY_LABELS.map((day) => {
          const dayValue = value.days[day.key];
          const hasInvalidRange = dayValue.isOpen && !isValidBusinessHoursDayRange(dayValue);

          return (
            <div key={day.key} className="rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-3">
              <div className="grid gap-3 sm:grid-cols-[120px_auto_1fr_1fr] sm:items-center">
                <div className="text-sm font-medium text-slate-100">{day.label}</div>
                <button
                  type="button"
                  onClick={() => setDayOpen(day.key, !dayValue.isOpen)}
                  className={clsx(
                    "w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold",
                    dayValue.isOpen
                      ? "border-[#2fb2a3] bg-[#2fb2a3]/15 text-[#77dfd4]"
                      : "border-[#3a465f] bg-[#111a2c] text-slate-300"
                  )}
                >
                  {dayValue.isOpen ? "Open" : "Closed"}
                </button>
                <label className="space-y-1 text-xs text-slate-400">
                  <span className="block uppercase tracking-wide text-slate-500">Opens</span>
                  <input
                    type="time"
                    disabled={!dayValue.isOpen}
                    className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    value={dayValue.openTime}
                    onChange={(event) => setDayTime(day.key, "openTime", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-400">
                  <span className="block uppercase tracking-wide text-slate-500">Closes</span>
                  <input
                    type="time"
                    disabled={!dayValue.isOpen}
                    className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    value={dayValue.closeTime}
                    onChange={(event) => setDayTime(day.key, "closeTime", event.target.value)}
                  />
                </label>
              </div>
              {hasInvalidRange ? (
                <p className="mt-2 text-xs text-amber-300">Closing time must be later than opening time. Overnight ranges are currently not supported.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#253149] bg-[#0b1323] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Inside business hours auto-reply</h3>
            <button
              type="button"
              onClick={() => setReply("insideReplyEnabled", !value.insideReplyEnabled)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                value.insideReplyEnabled
                  ? "border-[#2fb2a3] bg-[#2fb2a3]/15 text-[#77dfd4]"
                  : "border-[#3a465f] bg-[#111a2c] text-slate-300"
              )}
            >
              {value.insideReplyEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Sent automatically when a customer message arrives during configured business hours.</p>
          <textarea
            className="mt-3 min-h-[100px] w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200"
            placeholder="Thanks for contacting us during business hours..."
            value={value.insideReplyMessage}
            onChange={(event) => setReply("insideReplyMessage", event.target.value)}
          />
        </div>

        <div className="rounded-xl border border-[#253149] bg-[#0b1323] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Outside business hours auto-reply</h3>
            <button
              type="button"
              onClick={() => setReply("outsideReplyEnabled", !value.outsideReplyEnabled)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                value.outsideReplyEnabled
                  ? "border-[#2fb2a3] bg-[#2fb2a3]/15 text-[#77dfd4]"
                  : "border-[#3a465f] bg-[#111a2c] text-slate-300"
              )}
            >
              {value.outsideReplyEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Sent automatically when a customer message arrives outside configured business hours.</p>
          <textarea
            className="mt-3 min-h-[100px] w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200"
            placeholder="Thanks for your message. We're currently closed..."
            value={value.outsideReplyMessage}
            onChange={(event) => setReply("outsideReplyMessage", event.target.value)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">Cooldown: one automatic inside/outside reply per conversation every {value.cooldownHours} hours.</p>
      <button type="button" onClick={onSave} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">Save Business Hours</button>
    </section>
  );
}
