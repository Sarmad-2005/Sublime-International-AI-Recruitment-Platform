"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addCandidateToPoolAction } from "@/app/(admin)/admin/candidates/actions";
import type { SaudiClientSummary } from "@/types";

interface AddToPoolModalProps {
  applicationId: string;
  saudiClients: SaudiClientSummary[];
  candidateName: string;
}

export function AddToPoolModal({
  applicationId,
  saudiClients,
  candidateName,
}: AddToPoolModalProps) {
  const t = useTranslations("admin.candidates.poolModal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function toggle(clientId: string) {
    setSelected((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const results = await Promise.all(
        selected.map((clientId) => addCandidateToPoolAction(applicationId, clientId)),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(t("successToast", { count: selected.length }));
        setOpen(false);
        setSelected([]);
        router.refresh();
      } else {
        toast.error(t("failToast"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          {t.rich("prompt", {
            name: candidateName,
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>

        <div className="max-h-64 space-y-2 overflow-y-auto py-1">
          {saudiClients.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            saudiClients.map((client) => (
              <label
                key={client.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
              >
                <Checkbox
                  id={`client-${client.id}`}
                  checked={selected.includes(client.id)}
                  onCheckedChange={() => toggle(client.id)}
                />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Building2 className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{client.companyName}</p>
                    <p className="text-muted-foreground text-xs">{client.city}</p>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || selected.length === 0}
          >
            {isPending
              ? t("adding")
              : selected.length === 1
                ? t("add", { count: 1 })
                : t("addPlural", { count: selected.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
