// Mirror of backend/passwordPolicy.js — keep the two in sync.
export const PW_MIN = 8;

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < PW_MIN) return 'password_too_short';
  if (!/[A-Z]/.test(pw))                            return 'password_no_upper';
  if (!/[^A-Za-z0-9]/.test(pw))                     return 'password_no_special';
  return null;
}
