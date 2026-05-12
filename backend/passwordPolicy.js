'use strict';

// Single source of truth for password strength on the server. The frontend
// keeps an identical copy at frontend/src/passwordPolicy.js — change both
// together if the rules evolve.
const PW_MIN = 8;

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < PW_MIN) return 'password_too_short';
  if (!/[A-Z]/.test(pw))                            return 'password_no_upper';
  if (!/[^A-Za-z0-9]/.test(pw))                     return 'password_no_special';
  return null;
}

module.exports = { PW_MIN, validatePassword };
