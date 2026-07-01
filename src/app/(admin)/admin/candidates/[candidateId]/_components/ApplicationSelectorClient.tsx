"use client";

import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ApplicationOption = {
  id: string;
  jobTitle: string;
  appliedAt: string;
};

export function ApplicationSelectorClient({
  applications,
  selectedId,
}: {
  applications: ApplicationOption[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(id: string) {
    router.push(`${pathname}?applicationId=${id}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Viewing application:</span>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {applications.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.jobTitle} — {format(new Date(a.appliedAt), "d MMM yyyy")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
