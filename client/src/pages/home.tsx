import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CsvUpload from "@/components/csv-upload";
import ProspectsTable from "@/components/prospects-table";
import WhatsAppStatus from "@/components/whatsapp-status";
import StatsCards from "@/components/stats-cards";
import type { Prospect } from "@shared/schema";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: prospects = [], isLoading, refetch } = useQuery<Prospect[]>({
    queryKey: ['/api/prospects', refreshTrigger],
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ['/api/whatsapp-status'],
    refetchInterval: 5000, // Check status every 5 seconds
  });

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleStatusUpdate = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-800">Beauty Salon Prospect Manager</h1>
            </div>
            <WhatsAppStatus status={whatsappStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CSV Upload Section */}
        <CsvUpload onUploadSuccess={handleUploadSuccess} />

        {/* Stats Cards */}
        <StatsCards prospects={prospects} />

        {/* Prospects Table */}
        <ProspectsTable 
          prospects={prospects} 
          isLoading={isLoading}
          onStatusUpdate={handleStatusUpdate}
        />
      </main>
    </div>
  );
}
