const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * True for a syntactically-plausible email. Doesn't check deliverability —
 * that's what the (still-mocked) verification step is for.
 */
function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_PATTERN.test(email.trim());
}

/**
 * True for a string with real content once trimmed, and (optionally) no
 * longer than maxLength. Used for required-field checks.
 */
function isNonEmptyString(value, maxLength = Infinity) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

module.exports = { EMAIL_PATTERN, isValidEmail, isNonEmptyString };
