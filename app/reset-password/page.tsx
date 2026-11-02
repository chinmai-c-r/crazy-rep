"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { AuthShell } from "@/components/AuthShell";
import { PasswordField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { newPasswordSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const form = useForm<z.input<typeof newPasswordSchema>, unknown, z.output<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    const { error } = await createClient().auth.updateUser({ password });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    router.replace("/dashboard");
  });

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <PasswordField control={form.control} name="password" label="New password" autoComplete="new-password" />
          <PasswordField control={form.control} name="confirm" label="Confirm password" autoComplete="new-password" />
          <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save password
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
