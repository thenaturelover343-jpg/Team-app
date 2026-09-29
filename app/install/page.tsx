"use client";

import { useEffect } from "react";

export default function InstallPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    window.location.replace(invite ? `/?invite=${encodeURIComponent(invite)}` : "/");
  }, []);
  return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">App openen…</div>;
}
