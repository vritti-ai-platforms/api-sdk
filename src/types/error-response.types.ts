/**
 * RFC 9457 Problem Details field-specific error structure.
 *
 * Used for validation errors or other field-specific issues.
 * The `field` property is required to ensure clear association.
 */
export interface FieldError {
  /** The field name (e.g., 'email', 'password') - REQUIRED */
  field: string;
  /** The error message for this field */
  message: string;
}

/**
 * RFC 9457 Problem Details standard fields.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9457.html
 */
export interface ProblemDetails {
  /** Problem type URI (default: "about:blank") */
  type: string;
  /** HTTP status phrase (e.g., "Unauthorized", "Not Found") */
  title: string;
  /** HTTP status code */
  status: number;
  /** Root error heading (extension member, maps to AlertTitle in frontend) */
  label?: string;
  /** Detailed error description (maps to AlertDescription in frontend) */
  detail: string;
  /** Request path where the error occurred */
  instance?: string;
}

/**
 * Complete API error response following RFC 9457 Problem Details format.
 *
 * Extends ProblemDetails with field-specific errors.
 */
export interface ApiErrorResponse extends ProblemDetails {
  /** Field-specific errors (field is required in each FieldError) */
  errors: FieldError[];
}
