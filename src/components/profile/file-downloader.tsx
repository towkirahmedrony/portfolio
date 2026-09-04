"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function FileDownloader({ bucketName, storagePath }: { bucketName: string; storagePath: string; }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch {
      alert("Failed to download file. It might be unavailable.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center justify-center rounded-md border border-card-border bg-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed">
      {downloading ? "Opening..." : "Download"}
    </button>
  );
}
