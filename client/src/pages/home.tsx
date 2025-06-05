import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProspectsTable from "@/components/prospects-table";
import WhatsAppStatus from "@/components/whatsapp-status";
import StatsCards from "@/components/stats-cards";
import type { Prospect } from "@shared/schema";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const { data: prospects = [], isLoading, refetch } = useQuery<Prospect[]>({
    queryKey: ['/api/prospects', refreshTrigger],
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ['/api/whatsapp-status'],
  });
  const handleStatusUpdate = () => {
    refetch();
  };

  // refresh prospects from Google Sheets
  const refreshFromGoogleSheets = async () => {
    try {
      const res = await fetch('/api/import-sheets', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error("Failed to import prospects from Google Sheets");
      }

      // Trigger the react-query to refetch the updated data
      await refetch();
    } catch (error) {
      console.error("Refresh failed:", error);
    }
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
        {/* Stats Cards */}
        <StatsCards prospects={prospects} />

        {/* Refresh button and possible error message */}
        <div className="mb-4 flex items-center space-x-4">
          <button
            onClick={refreshFromGoogleSheets}
            disabled={isRefreshing}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-black rounded border-black border-2"
          >
            {isRefreshing ? "Refreshing..." : "Refresh from Google Sheets"}
          </button>
          {refreshError && <p className="text-red-600">{refreshError}</p>}
        </div>

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
