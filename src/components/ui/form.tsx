"use client";

import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  readonly label: string;
  readonly id?: string;
  readonly hint?: string;
  readonly error?: string | null;
}

/**
 * Labelled text input with hint and error text wired through
 * `aria-describedby` / `aria-invalid` (docs/UI_UX_DOCUMENTATION.md 10, 11).
 *
 * Client Component: it generates a stable id with `useId` so the label and the
 * input are always associated, even when several fields share a form. A caller
 * may still pass an explicit `id` when it needs to target the control itself.
 */
export function TextField({
  label,
  id,
  hint,
  error,
  required,
  className,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        id={fieldId}
        className={[
          "field__input",
          error ? "field__input--invalid" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "children"
> {
  readonly label: string;
  readonly id?: string;
  readonly hint?: string;
  readonly error?: string | null;
  readonly options: readonly SelectOption[];
}

/** Labelled select control, otherwise identical to {@link TextField}. */
export function SelectField({
  label,
  id,
  hint,
  error,
  required,
  options,
  className,
  ...rest
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <select
        id={fieldId}
        className={[
          "field__input",
          error ? "field__input--invalid" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
