"use client";

import { useMemo, useState } from "react";
import { importRosterCsvAction } from "@/lib/passportActions";
import { primaryButton } from "./PassportComponents";

const requiredColumns = [
  "player_name",
  "parent_email",
  "player_school_email",
  "player_personal_email",
  "position",
  "jersey_number",
  "graduation_year",
  "height",
];

function parseRows(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return { headers: [], rows: [] as Record<string, string>[] };
  }

  const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
  return {
    headers,
    rows: rows.slice(0, 25).map((line) => {
      const cells = line.split(",").map((cell) => cell.trim());
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    }),
  };
}

function isEmail(value: string | undefined) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RosterCsvPreview({ teamId, returnTo }: { teamId: string; returnTo: string }) {
  const [csvText, setCsvText] = useState("");
  const preview = useMemo(() => parseRows(csvText), [csvText]);
  const missingPlayerNames = preview.rows.filter((row) => !row.player_name).length;
  const missingContacts = preview.rows.filter(
    (row) => !row.parent_email && !row.player_school_email && !row.player_personal_email,
  ).length;
  const invalidEmails = preview.rows.filter(
    (row) =>
      !isEmail(row.parent_email) ||
      !isEmail(row.player_school_email) ||
      !isEmail(row.player_personal_email),
  ).length;
  const duplicateContacts = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of preview.rows) {
      for (const key of ["parent_email", "player_school_email", "player_personal_email"]) {
        const email = row[key]?.toLowerCase();
        if (!email) continue;
        if (seen.has(email)) duplicates += 1;
        seen.add(email);
      }
    }
    return duplicates;
  }, [preview.rows]);
  const canImport = preview.rows.length > 0 && missingPlayerNames === 0 && missingContacts === 0 && invalidEmails === 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Roster CSV import</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Paste CSV with columns: {requiredColumns.join(", ")}. Preview validates contact emails before import.
      </p>
      <form action={importRosterCsvAction} className="mt-4 grid gap-4">
        <input type="hidden" name="team_id" value={teamId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <textarea
          name="csv_text"
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          rows={8}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
          placeholder="player_name,parent_email,player_school_email,player_personal_email,position,jersey_number,graduation_year,height"
        />
        <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
          <p className="rounded-md bg-slate-50 p-3">Rows: {preview.rows.length}</p>
          <p className="rounded-md bg-slate-50 p-3">Missing names: {missingPlayerNames}</p>
          <p className="rounded-md bg-slate-50 p-3">Missing contacts: {missingContacts}</p>
          <p className="rounded-md bg-slate-50 p-3">Duplicate contacts: {duplicateContacts}</p>
        </div>
        {invalidEmails ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {invalidEmails} row(s) include invalid email formatting.
          </p>
        ) : null}
        {preview.rows.length ? (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {preview.headers.slice(0, 8).map((header) => (
                    <th key={header} className="px-3 py-2">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {preview.rows.slice(0, 5).map((row, index) => (
                  <tr key={`${row.player_name}-${index}`}>
                    {preview.headers.slice(0, 8).map((header) => (
                      <td key={header} className="px-3 py-2">{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <button disabled={!canImport} className={`${primaryButton} disabled:cursor-not-allowed disabled:bg-slate-300`}>
          Import roster
        </button>
      </form>
    </section>
  );
}
