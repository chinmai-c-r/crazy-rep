"use client";

import { Controller, type Control } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ProfileInput, ProfileValues } from "@/lib/schemas";

export type ProfileControl = Control<ProfileInput, unknown, ProfileValues>;

/** A labelled number input wired to the profile form. */
export default function NumberField({ control, name, label, decimal }: { control: ProfileControl; name: keyof ProfileInput; label: string; decimal?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            type="number"
            inputMode={decimal ? "decimal" : "numeric"}
            step={decimal ? "0.1" : "1"}
            aria-invalid={fieldState.invalid}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={(field.value as string | number | null) ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
