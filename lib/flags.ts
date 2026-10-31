/**
 * LaunchDarkly boolean flags. Create both in LaunchDarkly with these keys and tick
 * "SDKs using Client-side ID" so the browser can read them.
 *   sign-in-users  who can use the app after signing in (off = signed out with a message)
 *   admin-users    who is an admin: sees "API test" in the sidebar and can call its API
 */
export type BoolFlag = "sign-in-users" | "admin-users";

export type FlagUser = { id: string; email?: string | null };

export const NO_ACCESS_MESSAGE = "Your account doesn't have access right now. Please contact support.";

/** The landing page's request access section, with the email filled in. */
export const requestAccessUrl = (email?: string | null) => `/${email ? `?email=${encodeURIComponent(email)}` : ""}#access`;

/** Value used when LaunchDarkly isn't configured or can't be reached: nobody is an admin. */
export function flagDefault(key: BoolFlag): boolean {
  return key !== "admin-users";
}

/**
 * The LaunchDarkly context for a signed-in user. Target people by email.
 * Email is private: it can be used in targeting rules but isn't stored in LaunchDarkly.
 */
export function flagContext(user: FlagUser) {
  return {
    kind: "user" as const,
    key: user.id,
    email: user.email ?? undefined,
    _meta: { privateAttributes: ["email"] },
  };
}
