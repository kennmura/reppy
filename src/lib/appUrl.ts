export function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL.");
  }

  return configured.replace(/\/+$/, "");
}

export function optionalAppBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : null;
}

export function appUrl(path: string) {
  return new URL(path, `${appBaseUrl()}/`).toString();
}
