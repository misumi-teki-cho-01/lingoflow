"use client";

import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JsonValidationState } from "@/hooks/use-json-validation";

interface JsonValidationBadgeProps {
  validation: JsonValidationState;
  onJump: () => void;
  validLabel?: string;
}

export function JsonValidationBadge({
  validation,
  onJump,
  validLabel,
}: JsonValidationBadgeProps) {
  if (validation.status === "idle") return null;

  if (validation.status === "valid") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{validLabel ?? "JSON 格式正确"}</span>
      </div>
    );
  }

  // invalid
  const location =
    validation.errorLine != null
      ? `第 ${validation.errorLine} 行, 第 ${validation.errorCol} 列`
      : null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-300/70 bg-red-50 px-3 py-2 text-xs text-red-700">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {location && <span className="font-medium">{location} — </span>}
        <span className="break-all">{validation.errorMessage ?? "JSON 格式错误"}</span>
      </div>
      {validation.errorLine != null && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onJump}
          className="h-6 px-2 text-xs text-red-700 hover:bg-red-100 shrink-0 gap-1"
        >
          <ArrowRight className="h-3 w-3" />
          跳转
        </Button>
      )}
    </div>
  );
}
