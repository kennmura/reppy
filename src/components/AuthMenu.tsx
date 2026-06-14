"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const authLinks = [
  { href: "/account/login", label: "Player/Parent Sign in" },
  { href: "/account/login?role=coach", label: "Coach Sign in" },
];

export function AuthMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        clearCloseTimer();
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearCloseTimer();
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  return (
    <div
      ref={menuRef}
      className="relative flex items-stretch"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocus={openMenu}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          scheduleClose();
        }
      }}
    >
      <Link
        href="/account/login"
        className="inline-flex h-10 items-center rounded-l-md bg-[#12355b] px-3 text-sm font-semibold text-white hover:bg-[#0d2948] focus:outline-none focus:ring-2 focus:ring-[#12355b]/30 sm:px-4"
      >
        Sign in / Sign up
      </Link>
      <button
        type="button"
        aria-label="Show account options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center justify-center rounded-r-md border-l border-white/20 bg-[#12355b] px-2 text-white hover:bg-[#0d2948] focus:outline-none focus:ring-2 focus:ring-[#12355b]/30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          className="absolute right-0 top-full z-40 mt-2 w-60 rounded-md border border-slate-200 bg-white p-2 text-sm font-medium text-slate-700 shadow-lg"
        >
          {authLinks.map((link) => (
            <Link
              key={link.href}
              role="menuitem"
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex h-10 items-center rounded-md px-3 hover:bg-slate-50 hover:text-slate-950 focus:bg-slate-50 focus:outline-none"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
