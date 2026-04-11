import React from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmExplainModalProps {
  visible: boolean;
  title: string;
  description: string;
  cancelText: string;
  submitText: string;
  onCancel: () => void;
  onSubmit: () => void;
}

export function ConfirmExplainModal({
  visible,
  title,
  description,
  cancelText,
  submitText,
  onCancel,
  onSubmit
}: ConfirmExplainModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {description}
        </p>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button onClick={onSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600">
            {submitText}
          </Button>
        </div>
      </div>
    </div>
  );
}
