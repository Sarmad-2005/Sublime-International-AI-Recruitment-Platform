import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Company Profile — Sublime International",
};

/** Read-only company/contact profile for the Saudi client (Server Component). */
export default async function ClientProfilePage() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const profile = await clientPortalService.getClientProfile(user.id);
  if (!profile) notFound();

  const company = [
    { icon: Building2, label: "Company Name", value: profile.companyName },
    {
      icon: Building2,
      label: "Registration Number",
      value: profile.companyRegNumber,
    },
    {
      icon: MapPin,
      label: "Location",
      value: [profile.city, profile.country].filter(Boolean).join(", "),
    },
    { icon: MapPin, label: "Address", value: profile.address },
    { icon: Globe, label: "Website", value: profile.website },
  ];

  const contact = [
    { icon: User, label: "Contact Name", value: profile.contactName },
    { icon: User, label: "Designation", value: profile.designation },
    { icon: Phone, label: "Phone", value: profile.contactPhone },
    { icon: Mail, label: "Account Email", value: profile.email },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Company Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your organisation&apos;s details on file with Sublime International.
        </p>
      </div>

      {/* Identity banner */}
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16 rounded-lg border">
            {profile.logoUrl && (
              <AvatarImage
                src={profile.logoUrl}
                alt={profile.companyName}
                className="object-contain"
              />
            )}
            <AvatarFallback className="bg-navy/10 text-navy rounded-lg text-lg font-bold">
              {profile.companyName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {profile.companyName}
            </h2>
            <p className="text-muted-foreground text-sm">
              {[profile.city, profile.country].filter(Boolean).join(", ")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <FieldCard title="Company Details" fields={company} />
        <FieldCard title="Primary Contact" fields={contact} />
      </div>

      <p className="text-muted-foreground text-xs">
        To update any of these details, please message the Sublime International
        team.
      </p>
    </div>
  );
}

function FieldCard({
  title,
  fields,
}: {
  title: string;
  fields: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | null;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.label} className="flex items-start gap-3">
              <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">{f.label}</p>
                <p className="text-sm font-medium break-words">
                  {f.value || "—"}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
