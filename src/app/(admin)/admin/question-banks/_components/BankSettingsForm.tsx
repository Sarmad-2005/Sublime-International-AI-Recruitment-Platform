"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { updateBankAction } from "../actions";
import type { QuestionBankDetail, QuestionBankSettings } from "@/types";

export function BankSettingsForm({ bank }: { bank: QuestionBankDetail }) {
  const [settings, setSettings] = useState<QuestionBankSettings>({
    title: bank.title,
    description: bank.description,
    timeLimitMinutes: bank.timeLimitMinutes,
    passingScore: bank.passingScore,
    allowRetake: bank.allowRetake,
    retakeCooldownDays: bank.retakeCooldownDays,
    randomizeQuestions: bank.randomizeQuestions,
    randomizeAnswers: bank.randomizeAnswers,
    isActive: bank.isActive,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof QuestionBankSettings>(
    key: K,
    value: QuestionBankSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateBankAction(bank.id, settings);
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
        <h2 className="text-base font-semibold">Bank Settings</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-sm">Name</Label>
          <Input value={settings.title} onChange={(e) => set("title", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1 block text-sm">Description</Label>
          <Textarea
            value={settings.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
            placeholder="Optional instructions shown before the assessment…"
            rows={2}
          />
        </div>

        <div>
          <Label className="mb-1 block text-sm">Time Limit (minutes)</Label>
          <Input
            type="number"
            min={1}
            max={300}
            value={settings.timeLimitMinutes}
            onChange={(e) => set("timeLimitMinutes", Number(e.target.value) || 1)}
          />
        </div>

        <div>
          <Label className="mb-1 block text-sm">Pass Score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={settings.passingScore}
            onChange={(e) => set("passingScore", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Retake policy */}
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-medium">Retake Policy</p>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={settings.allowRetake}
            onCheckedChange={(c) => set("allowRetake", c === true)}
          />
          Allow candidates to retake this assessment
        </label>
        {settings.allowRetake && (
          <div className="max-w-xs pl-7">
            <Label className="mb-1 block text-xs">Cooldown between retakes (days)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={settings.retakeCooldownDays}
              onChange={(e) => set("retakeCooldownDays", Number(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Randomization + active */}
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-medium">Delivery</p>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={settings.randomizeQuestions}
            onCheckedChange={(c) => set("randomizeQuestions", c === true)}
          />
          Randomize question order per candidate
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={settings.randomizeAnswers}
            onCheckedChange={(c) => set("randomizeAnswers", c === true)}
          />
          Randomize answer-option order
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={settings.isActive}
            onCheckedChange={(c) => set("isActive", c === true)}
          />
          Active (candidates can take this assessment)
        </label>
      </div>

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
