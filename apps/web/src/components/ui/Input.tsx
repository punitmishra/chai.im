import { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

const fieldBase =
  'w-full rounded-xl bg-dark-900 border text-white placeholder-dark-400 transition-colors ' +
  'px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-primary-500/60';

interface FieldCommon {
  label?: string;
  hint?: string;
  error?: string;
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    FieldCommon {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-dark-100">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(fieldBase, error ? 'border-red-500/70' : 'border-dark-600', className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-err`} className="text-sm text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-dark-300">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldCommon {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref
) {
  const autoId = useId();
  const taId = id ?? autoId;
  const describedBy = error ? `${taId}-err` : hint ? `${taId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={taId} className="text-sm font-medium text-dark-100">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={taId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(fieldBase, 'resize-none', error ? 'border-red-500/70' : 'border-dark-600', className)}
        {...props}
      />
      {error ? (
        <p id={`${taId}-err`} className="text-sm text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${taId}-hint`} className="text-sm text-dark-300">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
