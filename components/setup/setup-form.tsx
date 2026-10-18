"use client";
import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import type { FieldErrors } from "@/lib/projects/setup-validation";

const FormContext = createContext<{
  errors: FieldErrors;
  pending: boolean;
  valid: boolean;
}>({ errors: {}, pending: false, valid: false });

function checkForm(
  element: HTMLFormElement,
  validate: (form: FormData) => FieldErrors,
) {
  const errors = validate(new FormData(element));
  for (const field of element.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input[name], select[name], textarea[name]")) {
    if (field.name && !field.validity.valid && !errors[field.name])
      errors[field.name] = field.validity.badInput
        ? "Enter a complete, valid value for this field."
        : field.validationMessage;
  }
  return errors;
}

export function FieldFeedback({
  label,
  name,
  errors,
  hint,
  children,
}: {
  label: string;
  name: string;
  errors: FieldErrors;
  hint?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId(),
    error = errors[name];
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby":
          `${hint ? `${id}-hint ` : ""}${error ? `${id}-error` : ""}`.trim() ||
          undefined,
        className: `${children.props.className || ""} ${error ? "border-destructive ring-1 ring-destructive/30" : ""}`,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SetupField(
  props: Omit<Parameters<typeof FieldFeedback>[0], "errors">,
) {
  return <FieldFeedback {...props} errors={useContext(FormContext).errors} />;
}

export function SetupSubmit({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const { pending, valid } = useContext(FormContext);
  return (
    <Button type="submit" disabled={disabled || pending || !valid}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

export function SetupForm({
  validate,
  onSave,
  disabled = false,
  resetOnSave = false,
  children,
}: {
  validate: (form: FormData) => FieldErrors;
  onSave: (form: FormData) => Promise<void>;
  disabled?: boolean;
  resetOnSave?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({ initializing: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false),
    [failure, setFailure] = useState("");
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (ref.current) setErrors(checkForm(ref.current, validate));
  }, [validate]);
  const visibleErrors = {
    ...serverErrors,
    ...Object.fromEntries(
      Object.entries(errors).filter(([key]) => touched[key]),
    ),
  };
  return (
    <FormContext.Provider
      value={{
        errors: { ...errors, ...serverErrors },
        pending,
        valid: !Object.keys(errors).length && !Object.keys(serverErrors).length,
      }}
    >
      <form
        ref={ref}
        noValidate
        className={`grid gap-5 rounded-lg ${failure ? "border border-destructive p-4" : ""}`}
        onChange={(event) => {
          const target = event.target;
          if (ref.current) {
            const next = checkForm(ref.current, validate);
            setErrors(next);
            if (
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement
            ) {
              setTouched((current) => ({
                ...current,
                [target.name]: true,
                ...(["mode", "allowance_mode"].includes(target.name)
                  ? Object.fromEntries(
                      Object.keys(next).map((key) => [key, true]),
                    )
                  : {}),
              }));
            }
          }
          setFailure("");
          setServerErrors({});
        }}
        onBlur={(e) => {
          const target = e.target;
          const name =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
              ? target.name
              : "";
          if (name) setTouched((t) => ({ ...t, [name]: true }));
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (disabled || pending) return;
          const formElement = e.currentTarget,
            form = new FormData(formElement),
            next = checkForm(formElement, validate);
          setErrors(next);
          setTouched(
            Object.fromEntries(Object.keys(next).map((k) => [k, true])),
          );
          if (Object.keys(next).length) return;
          setPending(true);
          setFailure("");
          try {
            await onSave(form);
            if (resetOnSave) {
              formElement.reset();
              setTouched({});
              setErrors(checkForm(formElement, validate));
            }
          } catch (error) {
            const problem = error as Error & {
              fieldErrors?: Record<string, string[]>;
              code?: string;
            };
            const aliases: Record<string, string> = {
              original_amount_cents: "price",
              agreed_due_date: "due",
            };
            const fields = Object.fromEntries(
              Object.entries(problem.fieldErrors || {}).map(
                ([key, messages]) => [aliases[key] || key, messages.join(". ")],
              ),
            );
            setServerErrors(fields);
            setFailure(
              problem.code === "VALIDATION"
                ? "Check the highlighted fields and try again."
                : problem.message ||
                    "This step could not be saved. Check your connection and try again.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={disabled || pending} className="grid gap-5">
          <FormContext.Provider
            value={{
              errors: visibleErrors,
              pending,
              valid:
                !Object.keys(errors).length &&
                !Object.keys(serverErrors).length,
            }}
          >
            {children}
          </FormContext.Provider>
        </fieldset>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
      </form>
    </FormContext.Provider>
  );
}
