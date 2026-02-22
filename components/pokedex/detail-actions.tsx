"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type DetailActionsProps = {
  pokemonName: string;
};

async function copyCurrentUrl(): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}

export function DetailActions({ pokemonName }: DetailActionsProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyCurrentUrl();
    if (!ok) {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const onShare = async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const shareData = {
      title: `${pokemonName} | MetaDex`,
      text: `Check out ${pokemonName} on MetaDex`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      return;
    }

    await onCopy();
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button size="sm" variant="outline" onClick={onCopy} className="h-9 gap-1.5 px-2 sm:px-3" aria-label="Copy link">
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
      </Button>
      <Button size="sm" variant="outline" onClick={onShare} className="h-9 gap-1.5 px-2 sm:px-3" aria-label="Share">
        <Share2Icon className="size-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>
    </div>
  );
}
