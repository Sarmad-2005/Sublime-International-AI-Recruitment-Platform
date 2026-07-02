"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ImportResult } from "@/types";

interface CSVImporterProps {
  /** Authoritative import — parses + validates + inserts server-side. */
  onImport: (csvText: string) => Promise<ImportResult>;
  /** Called after a successful import (to refresh the list). */
  onImported?: () => void;
}

const TEMPLATE_HEADER =
  "type,question,points,option1,option2,option3,option4,option5,option6,correct";
const TEMPLATE_ROWS = [
  'MCQ,"Which tool measures voltage?",1,Multimeter,Hammer,Wrench,Pliers,,,1',
  'MULTI_SELECT,"Select all safety gear",1,Helmet,Gloves,Sandals,Goggles,,,"1;2;4"',
  'SCENARIO,"A wire sparks on contact. First action?",2,Cut the main power,Touch it,Pour water,Ignore it,,,1',
];

/** Naive line preview (server does the authoritative parse). */
function previewRows(text: string): string[][] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 6)
    .map((line) => line.split(","));
}

/** Bulk-import questions from a CSV file, with a downloadable template. */
export function CSVImporter({ onImport, onImported }: CSVImporterProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const content = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question-bank-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please select a .csv file");
      return;
    }
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText) return;
    setImporting(true);
    try {
      const res = await onImport(csvText);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} question${res.imported === 1 ? "" : "s"}`);
        onImported?.();
      }
      if (res.imported === 0 && res.failed > 0) {
        toast.error("No questions imported — check the errors");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFileName(null);
    setCsvText(null);
    setResult(null);
  }

  const preview = csvText ? previewRows(csvText) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <FileUp className="size-4" />
          Import from CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Questions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV of questions. Download the template to see the expected
            format. Correct answers are 1-based option numbers, separated by
            semicolons for multi-select.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              Download Template
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onSelectFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {fileName ? "Choose Another File" : "Choose CSV File"}
            </Button>
          </div>

          {fileName && (
            <p className="text-muted-foreground text-sm">
              Selected: <span className="text-foreground font-medium">{fileName}</span>
            </p>
          )}

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <tbody className="divide-y">
                  {preview.map((row, i) => (
                    <tr key={i} className={i === 0 ? "bg-muted/50 font-medium" : ""}>
                      {row.slice(0, 10).map((cell, j) => (
                        <td key={j} className="max-w-[140px] truncate px-2 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2 rounded-md border p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-green-700">
                <CheckCircle2 className="size-4" />
                {result.imported} imported
                {result.failed > 0 && (
                  <span className="text-red-600">· {result.failed} failed</span>
                )}
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                      <AlertCircle className="mt-0.5 size-3 shrink-0" />
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={importing}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
              onClick={handleImport}
              disabled={!csvText || importing}
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
