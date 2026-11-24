"use client";

import { Button } from "@/components/ui/button";

export function PrintReportCardButton() {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => window.print()}
    >
      Print Report Card
    </Button>
  );
}
