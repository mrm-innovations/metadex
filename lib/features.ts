function isTrue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

/**
 * Premium preview mode is enabled by default so product/design can iterate
 * before billing/auth flows are added. Set to `false`/`0` to hide candidates.
 */
export function isPremiumPreviewEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_PREMIUM_PREVIEW;
  if (raw === undefined) {
    return true;
  }
  return isTrue(raw);
}
