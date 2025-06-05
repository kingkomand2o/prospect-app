import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, MessageCircle, Trash2, Download } from "lucide-react";
import type { Prospect } from "@shared/schema";

interface ProspectsTableProps {
  prospects: Prospect[];
  isLoading: boolean;
  onStatusUpdate: () => void;
}

export default function ProspectsTable({ prospects, isLoading, onStatusUpdate }: ProspectsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const { toast } = useToast();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
const [isSendingOne, setIsSendingOne] = useState(false);
const [customMessage, setCustomMessage] = useState("");
const openModal = (prospect: Prospect) => {
  setSelectedProspect(prospect);
  setCustomMessage(prospect.generatedMessage || "");
};

const closeModal = () => {
  setSelectedProspect(null);
  setCustomMessage("");
};


  const filteredProspects = prospects.filter(prospect =>
    prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.skinProblems.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.phoneNumber.includes(searchTerm)
  );

  const handleBulkSend = async () => {
    const pendingCount = prospects.filter(p => p.status === 'pending').length;
    
    if (pendingCount === 0) {
      toast({
        title: "No pending messages",
        description: "All messages have already been sent or failed.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingBulk(true);
    
    try {
      const response = await apiRequest('POST', '/api/send-bulk');
      const result = await response.json();
      
      toast({
        title: "Bulk send completed",
        description: `Sent: ${result.sent}, Failed: ${result.failed}`,
      });
      
      onStatusUpdate();
    } catch (error) {
      toast({
        title: "Bulk send failed",
        description: error instanceof Error ? error.message : "Failed to send messages",
        variant: "destructive",
      });
    } finally {
      setIsSendingBulk(false);
    }
  };
  const handleSendOne = async () => {
  if (!selectedProspect) return;

  setIsSendingOne(true);

  try {
    const response = await apiRequest("POST", "/api/send-single", {
      phoneNumber: selectedProspect.phoneNumber,
      message: customMessage,
    });

    const result = await response.json();

    toast({
      title: "Message Sent",
      description: `Message sent to ${selectedProspect.name}.`,
    });

    closeModal();
    onStatusUpdate();
  } catch (error) {
    toast({
      title: "Failed to send message",
      description: error instanceof Error ? error.message : "Something went wrong",
      variant: "destructive",
    });
  } finally {
    setIsSendingOne(false);
  }
};


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getSkinProblemColor = (problem: string) => {
    const colors = [
      'bg-amber-100 text-amber-800',
      'bg-purple-100 text-purple-800',
      'bg-blue-100 text-blue-800',
      'bg-pink-100 text-pink-800',
      'bg-green-100 text-green-800',
    ];
    const index = problem.length % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Prospect List</h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search prospects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button 
              onClick={handleBulkSend}
              disabled={isSendingBulk || prospects.filter(p => p.status === 'pending').length === 0}
              className="bg-violet-500 hover:bg-violet-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              {isSendingBulk ? 'Sending...' : 'Send Bulk Messages'}
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredProspects.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No prospects found</h3>
            <p className="text-slate-500">
              {prospects.length === 0 
                ? "Upload a CSV file to get started" 
                : "No prospects match your search criteria"
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Name</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Skin Problems</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Phone Number</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Generated Message</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.map((prospect) => (
                  <tr key={prospect.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">{prospect.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={`${getSkinProblemColor(prospect.skinProblems)} text-xs font-medium`}>
                        {prospect.skinProblems}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-600 font-mono text-sm">{prospect.phoneNumber}</span>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <p className="text-sm text-slate-600 truncate" title={prospect.generatedMessage}>
                        {prospect.generatedMessage}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={`${getStatusColor(prospect.status)} text-xs font-medium capitalize`}>
                        {prospect.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary-600 hover:text-primary-700 p-1"
                          onClick={() => openModal(prospect)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredProspects.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing {filteredProspects.length} of {prospects.length} prospects
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" className="bg-primary-500 text-white">
                1
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {selectedProspect && (
  <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
      <h3 className="text-lg font-semibold mb-4">Send Message to {selectedProspect.name}</h3>
      <textarea
        className="w-full border rounded p-2 text-sm h-32"
        value={customMessage}
        onChange={(e) => setCustomMessage(e.target.value)}
      />
      <div className="mt-4 flex justify-end space-x-2">
        <Button variant="outline" onClick={closeModal}>Cancel</Button>
        <Button onClick={handleSendOne} disabled={isSendingOne}>
          {isSendingOne ? "Sending..." : "Send Message"}
        </Button>
      </div>
    </div>
  </div>
)}
    </>
  );
}
