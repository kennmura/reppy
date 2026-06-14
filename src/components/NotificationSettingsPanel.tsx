"use client";

import { useMemo, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function NotificationSettingsPanel({
  vapidPublicKey,
  showFreeCoachEmail = false,
}: {
  vapidPublicKey?: string;
  showFreeCoachEmail?: boolean;
}) {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return Notification.permission;
  });
  const [message, setMessage] = useState<string>("");
  const pushAvailable = useMemo(
    () =>
      Boolean(
        vapidPublicKey &&
          typeof navigator !== "undefined" &&
          typeof window !== "undefined" &&
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window,
      ),
    [vapidPublicKey],
  );

  async function enablePush() {
    setMessage("");

    if (!pushAvailable || !vapidPublicKey) {
      setPermission("unsupported");
      setMessage("Browser push is not available on this device or the VAPID key is missing.");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== "granted") {
      setMessage("Notifications are blocked or were not enabled. You can change this in browser settings.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    setMessage(response.ok ? "Browser push notifications are enabled." : "Could not save this push subscription.");
  }

  async function disablePush() {
    setMessage("");

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
    }

    setMessage("Browser push notifications are disabled for this device.");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Notification delivery</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700">
          <label className="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-4 py-3">
            <span>In-app notifications</span>
            <input type="checkbox" checked readOnly className="h-4 w-4" />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-4 py-3">
            <span>Browser push notifications</span>
            <input type="checkbox" checked={permission === "granted"} readOnly className="h-4 w-4" />
          </label>
          {showFreeCoachEmail ? (
            <label className="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-4 py-3">
              <span>Free-plan locked-request email alerts</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Authentication and account security emails are handled by Supabase Auth and cannot be
          disabled here. Reppy does not offer an email-every-message setting.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          {permission === "granted"
            ? "Notifications enabled"
            : permission === "denied"
              ? "Notifications blocked"
              : pushAvailable
                ? "Notifications available"
                : "Notifications unsupported"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {permission === "denied"
            ? "Use your browser or device settings to allow notifications for Reppy."
            : "Reppy uses generic notification text so private message content does not appear on a lock screen."}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={enablePush}
            className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!pushAvailable || permission === "denied"}
          >
            Enable push
          </button>
          <button
            type="button"
            onClick={disablePush}
            className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Disable on this device
          </button>
        </div>
        {message ? <p className="mt-4 text-sm font-medium text-[#2f6f5e]">{message}</p> : null}
      </div>
    </div>
  );
}
