/**
 * Użyj NEXT_PUBLIC_SITE_URL w .env.local, żeby ten sam adres co w Supabase
 * (Authentication → Site URL). Bez tego działa window.location.origin.
 *
 * Przykład: http://127.0.0.1:3000  (bez ukośnika na końcu)
 */
export function getPublicSiteUrl(browserOrigin: string): string {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "").trim()
      : "";

  return fromEnv || browserOrigin.replace(/\/$/, "");
}
