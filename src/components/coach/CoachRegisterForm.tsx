"use client";

import Link from "next/link";
import { useState } from "react";
import { registerCoach } from "@/lib/authActions";

export function CoachRegisterForm() {
  const [locationMessage, setLocationMessage] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");

  function useCurrentLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Current location is not available on this device. Enter city, state, and ZIP manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocationMessage("Location captured. Please still confirm city, state, and ZIP.");
      },
      () => {
        setLocationMessage("Location permission was declined or unavailable. Enter city, state, and ZIP manually.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <form action={registerCoach} className="mt-6 grid gap-4">
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <input type="hidden" name="timezone" value={timezone} />
      <Field label="Full name" name="display_name" autoComplete="name" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">Coach location</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Used for nearby coach search. You can use current location once or enter details manually.
        </p>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="mt-3 inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
        >
          Use my current location
        </button>
        {locationMessage ? <p className="mt-2 text-xs leading-5 text-slate-600">{locationMessage}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_88px_120px]">
        <Field label="City" name="city" autoComplete="address-level2" placeholder="Waltham" />
        <Field label="State" name="state" autoComplete="address-level1" placeholder="MA" />
        <Field label="ZIP code" name="zip_code" autoComplete="postal-code" placeholder="02453" />
      </div>
      <Field label="Password" name="password" type="password" autoComplete="new-password" />
      <Field label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" />
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input name="terms" type="checkbox" required className="mt-1" />
        <span>
          I agree to the <Link href="/terms" className="font-semibold text-[#12355b]">Terms</Link> and{" "}
          <Link href="/privacy" className="font-semibold text-[#12355b]">Privacy Policy</Link>.
        </span>
      </label>
      <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
        Create coach account
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}
