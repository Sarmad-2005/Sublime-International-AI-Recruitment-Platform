"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { updateInterviewSetAction } from "../actions";
import type { InterviewSetDetail, InterviewSetSettings } from "@/types";

export function InterviewSetSettingsForm({ set }: { set: InterviewSetDetail }) {
  const [settings, setSettings] = useState<InterviewSetSettings>({
    title: set.title,
    description: set.description,
    maxDurationMinutes: set.maxDurationMinutes,
    questionTimeLimitSeconds: set.questionTimeLimitSeconds,
    isActive: set.isActive,
  });
  const [saving, setSaving] = useState(false);

  function set_<K extends keyof InterviewSetSettings>(
    key: K,
    value: InterviewSetSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateInterviewSetAction(set.id, settings);
      if (result.ok) toast.success("Settings saved");
      else toast.error(result.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="text-muted-foreground size-4" />
        <h2 className="text-base font-semibold">Set Settings</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-sm">Name</Label>
          <Input value={settings.title} onChange={(e) => set_("title", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1 block text-sm">Description</Label>
          <Textarea
            value={settings.description ?? ""}
            onChange={(e) => set_("description", e.target.value || null)}
            placeholder="Optional notes about this interview set…"
            rows={2}
          />
        </div>

        <div>
          <Label className="mb-1 block text-sm">Max Duration (minutes)</Label>
          <Input
            type="number"
            min={1}
            max={180}
            value={settings.maxDurationMinutes}
            onChange={(e) => set_("maxDurationMinutes", Number(e.target.value) || 1)}
          />
        </div>

        <div>
          <Label className="mb-1 block text-sm">Default Question Time Limit (seconds)</Label>
          <Input
            type="number"
            min={15}
            max={600}
            value={settings.questionTimeLimitSeconds}
            onChange={(e) => set_("questionTimeLimitSeconds", Number(e.target.value) || 15)}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox
          checked={settings.isActive}
          onCheckedChange={(c) => set_("isActive", c === true)}
        />
        Active (used for the AI interview of the linked job)
      </label>

      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Settings
        </Button>
      </div>
    </section>
  );
}
