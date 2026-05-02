/**
 * Adres dla `emailRedirectTo` (Magic Link). Domyślnie: dokładnie to, co widzi przeglądarka
 * — na Vercel (`https://fueled-ten.vercel.app` itd.) działa bez dodatkowych zmiennych.
 *
 * Ustaw `NEXT_PUBLIC_SITE_URL` tylko gdy masz stałą domenę prod i chcesz wymusić ją nad
 * origin przeglądarki (albo przy nietypowych reverse proxy).
 * W Supabase ustaw taką samą bazę w Authentication → Site URL oraz Redirect URLs
 * (`…/auth/callback`). Bez tego Magic Link się nie zamknie sesją na Twojej aplikacji.
 *
 * Przykład lokalnie: http://127.0.0.1:3000 (bez końcowego /)
 */
export function getPublicSiteUrl(browserOrigin: string): string {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "").trim()
      : "";

  return fromEnv || browserOrigin.replace(/\/$/, "");
}
