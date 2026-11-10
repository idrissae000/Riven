/** Turns Supabase Auth errors into messages a person can act on. */
export function friendlyAuthError(err: { code?: string; message: string; status?: number }): string {
  switch (err.code) {
    case "over_email_send_rate_limit":
      return "We can’t send another email right now: the site’s email sender has hit its hourly limit. Try again in about an hour.";
    case "email_address_not_authorized":
      return "The site’s email sender isn’t allowed to email this address yet. This is a setup issue on our side, not something you did.";
    case "invalid_credentials":
      return "Wrong email or password. If you created this account with “Email me a magic link”, it may have no password — use the magic link instead.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "That password is too weak. Use at least 6 characters.";
    case "email_address_invalid":
      return "That email address doesn’t look valid.";
    default:
      return err.message;
  }
}

/**
 * Supabase hides whether an address is already registered: signing up with an existing (confirmed) email "succeeds"
 * but sends NO email and returns a user with no identities.
 */
export const isExistingAccount = (user: { identities?: unknown[] | null } | null | undefined): boolean =>
  !!user && Array.isArray(user.identities) && user.identities.length === 0;
