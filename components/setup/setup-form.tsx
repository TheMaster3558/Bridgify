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
import {
  useSetupContinue,
  type ContinueStateChange,
} from "./use-setup-continue";

const FormContext = createContext<{
  errors: FieldErrors;
  pending: boolean;
  valid: boolean;
}>({ errors: {}, pending: false, valid: false });

function sameErrors(left: FieldErrors, right: FieldErrors) {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

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
  onContinueState,
  validationKey,
  children,
}: {
  validate: (form: FormData) => FieldErrors;
  onSave: (form: FormData) => Promise<void>;
  disabled?: boolean;
  resetOnSave?: boolean;
  onContinueState?: ContinueStateChange;
  validationKey?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFields = useRef(new Set<string>());
  const [errors, setErrors] = useState<FieldErrors>({ initializing: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false),
    [failure, setFailure] = useState("");
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  useEffect(
    () => () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    },
    [],
  );
  useSetupContinue(
    !disabled &&
      !pending &&
      !Object.keys(errors).length &&
      !Object.keys(serverErrors).length,
    () => ref.current?.requestSubmit(),
    onContinueState,
  );
  useEffect(() => {
    if (ref.current) setErrors(checkForm(ref.current, validate));
  }, [validate, validationKey]);
  function applyFieldValidation(fieldNames: string[]) {
    if (!ref.current) return;
    const next = checkForm(ref.current, validate);
    const broad = fieldNames.some(
      (name) => name === "mode" || name === "allowance_mode",
    );
    setErrors((current) => (sameErrors(current, next) ? current : next));
    setTouched((current) => {
      let changed = false;
      const touched = { ...current };
      const names = broad
        ? [...fieldNames, ...Object.keys(next)]
        : fieldNames;
      for (const name of names) {
        if (!touched[name]) {
          touched[name] = true;
          changed = true;
        }
      }
      return changed ? touched : current;
    });
  }
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
          if (
            !(
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement
            ) ||
            !target.name
          )
            return;
          const fieldName = target.name;
          const broad = fieldName === "mode" || fieldName === "allowance_mode";
          pendingFields.current.add(fieldName);
          setFailure((current) => (current ? "" : current));
          setServerErrors((current) =>
            Object.keys(current).length ? {} : current,
          );
          if (validateTimer.current) clearTimeout(validateTimer.current);
          // Selects change the rules for other fields, so they validate now.
          // Text waits until the keystroke burst pauses, then renders once.
          validateTimer.current = setTimeout(() => {
            validateTimer.current = null;
            const fields = [...pendingFields.current];
            pendingFields.current.clear();
            applyFieldValidation(fields);
          }, broad ? 0 : 160);
        }}
        onBlur={(event) => {
          const target = event.target;
          if (
            !(
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement
            ) ||
            !target.name
          )
            return;
          if (validateTimer.current) {
            clearTimeout(validateTimer.current);
            validateTimer.current = null;
            const fields = [...pendingFields.current];
            pendingFields.current.clear();
            applyFieldValidation(fields.length ? fields : [target.name]);
            return;
          }
          setTouched((current) =>
            current[target.name] ? current : { ...current, [target.name]: true },
          );
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (validateTimer.current) {
            clearTimeout(validateTimer.current);
            validateTimer.current = null;
          }
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
