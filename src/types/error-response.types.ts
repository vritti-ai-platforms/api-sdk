export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  label?: string;
  detail: string;
  instance?: string;
}

export interface ApiErrorResponse extends ProblemDetails {
  errors: FieldError[];
}
