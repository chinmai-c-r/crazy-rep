"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Base<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Rendered between the input and the description, e.g. suggestion chips. */
  belowInput?: React.ReactNode;
  className?: string;
};

/** shadcn Field + Input wired to react-hook-form, showing the zod error under the input. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  belowInput,
  className,
  ...input
}: Base<T> & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input {...input} {...field} value={field.value ?? ""} id={field.name} aria-invalid={fieldState.invalid} />
          {belowInput}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...textarea
}: Base<T> & Omit<React.ComponentProps<typeof Textarea>, "name" | "value" | "onChange" | "onBlur">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea {...textarea} {...field} value={field.value ?? ""} id={field.name} aria-invalid={fieldState.invalid} />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Password input with an eye button that shows or hides what was typed. */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: Base<T> & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <div className="relative">
            <Input
              {...input}
              {...field}
              value={field.value ?? ""}
              id={field.name}
              type={visible ? "text" : "password"}
              className="pr-11"
              aria-invalid={fieldState.invalid}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="absolute top-1/2 right-1 size-9 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()} // keep the input focused so a phone keyboard stays open
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
