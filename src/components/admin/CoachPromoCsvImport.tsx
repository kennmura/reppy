"use client";

import { useMemo, useState } from "react";
import { importCoachAccessOffersAction } from "@/lib/coachPromoActions";

type PreviewStatus = "valid" | "invalid email" | "will update existing" | "skipped";

type PreviewRow = {
  email: string;
  offerType: string;
  duration: string;
  notes: string;
  status: PreviewStatus;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CoachPromoCsvImport({
  activeOfferKeys,
}: {
  activeOfferKeys: string[];
}) {
  const [csvText, setCsvText] = useState("");
  const activeKeys = useMemo(() => new Set(activeOfferKeys), [activeOfferKeys]);
  const preview = useMemo(() => buildPreview(csvText, activeKeys), [csvText, activeKeys]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">CSV import</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Supported columns: email, offer_type, duration, notes, invite_token.
          </p>
        </div>
      </div>
      <form action={importCoachAccessOffersAction} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            Default offer type
            <select
              name="default_offer_type"
              defaultValue="free_premium"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            >
              <option value="free_premium">Free premium access</option>
              <option value="founding_599">$5.99 founding subscription</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">
            Default duration
            <select
              name="default_duration"
              defaultValue="3"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </label>
        </div>
        <label className="text-sm font-medium text-slate-800">
          Upload CSV
          <input
            name="csv_file"
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                setCsvText(await file.text());
              }
            }}
            className="mt-2 block w-full rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#12355b] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Paste CSV
          <textarea
            name="csv_text"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={7}
            placeholder="email,offer_type,duration,notes,invite_token"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          />
        </label>

        {preview.length ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Offer type</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {preview.slice(0, 25).map((row, index) => (
                  <tr key={`${row.email}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-950">{row.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.offerType || "default"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.duration || "default"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.notes || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.status === "valid"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "will update existing"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 25 ? (
              <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Showing first 25 of {preview.length} rows.
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
            Confirm import
          </button>
        </div>
      </form>
    </section>
  );
}

function buildPreview(text: string, activeKeys: Set<string>): PreviewRow[] {
  const rows = parseCsv(text);
  const seen = new Set<string>();

  return rows.map((row) => {
    const email = (row.email ?? "").trim().toLowerCase();
    const offerType = (row.offer_type ?? "").trim() || "free_premium";
    const duration = (row.duration ?? "").trim() || "3";
    const key = `${email}::${offerType}`;
    let status: PreviewStatus = "valid";

    if (!emailPattern.test(email)) {
      status = "invalid email";
    } else if (seen.has(key)) {
      status = "skipped";
    } else if (activeKeys.has(key)) {
      status = "will update existing";
    }

    seen.add(key);

    return {
      email,
      offerType,
      duration,
      notes: row.notes ?? "",
      status,
    };
  });
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const first = splitCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const hasHeader = first.includes("email");
  const headers = hasHeader ? first : ["email", "offer_type", "duration", "notes", "invite_token"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
