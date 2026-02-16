import { CsvUploader } from "@/components/upload/csv-uploader";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Leads</h1>
        <p className="text-muted-foreground">
          Import leads from a CSV file with automatic column detection
        </p>
      </div>
      <CsvUploader />
    </div>
  );
}
