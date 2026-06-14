"use client";

import Link from "next/link";
import { useState } from "react";

type AccountRegisterFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  next: string;
  defaultValues?: {
    display_name?: string;
    email?: string;
    phone?: string;
    role?: "parent" | "adult_player";
  };
};

export function AccountRegisterForm({ action, next, defaultValues }: AccountRegisterFormProps) {
  const [clientError, setClientError] = useState("");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        if (formData.get("password") !== formData.get("confirm_password")) {
          event.preventDefault();
          setClientError("Passwords do not match.");
        }
      }}
      className="mt-6 grid gap-4"
    >
      <input type="hidden" name="next" value={next} />
      {clientError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {clientError}
        </p>
      ) : null}
      <Field
        label="Full name"
        name="display_name"
        defaultValue={defaultValues?.display_name ?? ""}
        autoComplete="name"
        onChange={() => setClientError("")}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        defaultValue={defaultValues?.email ?? ""}
        autoComplete="email"
        onChange={() => setClientError("")}
      />
      <Field
        label="Mobile phone number"
        name="phone"
        type="tel"
        defaultValue={defaultValues?.phone ?? ""}
        autoComplete="tel"
        onChange={() => setClientError("")}
      />
      <label className="text-sm font-medium text-slate-800">
        Account type
        <select
          name="role"
          defaultValue={defaultValues?.role ?? "parent"}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
        >
          <option value="parent">Parent or guardian</option>
          <option value="adult_player">Adult player</option>
        </select>
      </label>
      <Field
        label="Password"
        name="password"
        type="password"
        defaultValue=""
        autoComplete="new-password"
        onChange={() => setClientError("")}
      />
      <Field
        label="Confirm password"
        name="confirm_password"
        type="password"
        defaultValue=""
        autoComplete="new-password"
        onChange={() => setClientError("")}
      />
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          name="terms"
          type="checkbox"
          required
          className="mt-1"
        />
        <span>
          I agree to the <Link href="/terms" className="font-semibold text-[#12355b]">Terms</Link>.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          name="privacy"
          type="checkbox"
          required
          className="mt-1"
        />
        <span>
          I agree to the <Link href="/privacy" className="font-semibold text-[#12355b]">Privacy Policy</Link>.
        </span>
      </label>
      <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
        Create account
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  autoComplete,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  autoComplete?: string;
  onChange: () => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        onChange={onChange}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}
