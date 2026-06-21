export function authErrorMessage(message: string): string {
  const m = message.trim().toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Nieprawidłowy email lub hasło.";
  }
  if (m.includes("email not confirmed")) {
    return "Potwierdź adres email — sprawdź skrzynkę i kliknij link aktywacyjny.";
  }
  if (m.includes("user already registered")) {
    return "Konto z tym adresem już istnieje. Zaloguj się.";
  }
  if (m.includes("password") && m.includes("least")) {
    return "Hasło musi mieć co najmniej 6 znaków.";
  }
  if (m.includes("email rate limit exceeded")) {
    return "Za dużo wiadomości na ten adres — poczekaj chwilę.";
  }
  if (
    message.trim() === "Load failed" ||
    message.trim() === "Failed to fetch" ||
    m.includes("network")
  ) {
    return "Nie można połączyć z Supabase. Sprawdź połączenie i konfigurację.";
  }

  return message;
}
