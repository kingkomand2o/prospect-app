import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle } from "lucide-react";

interface CsvUploadProps {
  onUploadSuccess: () => void;
}

export default function CsvUpload({ onUploadSuccess }: CsvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('csv', file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Upload successful",
        description: `${result.count} prospects uploaded successfully`,
      });

      onUploadSuccess();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload CSV",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [toast, onUploadSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Upload Prospects</h2>
            <p className="text-sm text-slate-600 mt-1">
              Import your prospect list via CSV file (Name, Skin Problems, Phone number)
            </p>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging 
              ? 'border-primary-400 bg-primary-50' 
              : 'border-slate-300 hover:border-primary-400'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => document.getElementById('csv-file-input')?.click()}
        >
          <div className="space-y-4">
            {isUploading ? (
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            ) : (
              <Upload className="w-12 h-12 text-slate-400 mx-auto" />
            )}
            
            <div>
              <p className="text-lg font-medium text-slate-700 mb-2">
                {isUploading ? 'Uploading...' : 'Drop your CSV file here'}
              </p>
              {!isUploading && (
                <p className="text-sm text-slate-500 mb-4">or click to browse and select a file</p>
              )}
            </div>

            {!isUploading && (
              <Button className="bg-primary-500 hover:bg-primary-600">
                <FileText className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            )}

            {!isUploading && (
              <p className="text-xs text-slate-400 mt-3">Supports CSV files up to 10MB</p>
            )}
          </div>
        </div>

        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Uploading...</span>
              <span className="text-sm text-slate-500">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* CSV Format Guide */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <h3 className="text-sm font-medium text-slate-900 mb-2 flex items-center">
            <FileText className="w-4 h-4 mr-2 text-slate-400" />
            CSV Format
          </h3>
          <div className="text-xs text-slate-600 font-mono bg-white p-2 rounded border">
            Name, Skin Problems, Phone number<br />
            <span className="text-slate-400">Sarah Johnson, Acne, +1234567890</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
