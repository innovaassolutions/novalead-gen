"use client";

import { useState } from "react";
import { CsvUploader } from "@/components/upload/csv-uploader";
import { CompanyUploader } from "@/components/upload/company-uploader";
import { Button } from "@/components/ui/button";
import { Users, Building2 } from "lucide-react";

type Mode = "contacts" | "companies";

export default function UploadPage() {
  const [mode, setMode] = useState<Mode>("contacts");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import CSV</h1>
        <p className="text-muted-foreground">
          Import contacts directly, or import companies and let AI find the contacts.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 rounded-lg border p-1 w-fit">
        <Button
          variant={mode === "contacts" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("contacts")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Import Contacts
        </Button>
        <Button
          variant={mode === "companies" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("companies")}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          Import Companies
        </Button>
      </div>

      {mode === "contacts" ? <CsvUploader /> : <CompanyUploader />}
    </div>
  );
}
