import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageCircle } from "lucide-react";

interface WhatsAppStatusProps {
  status?: {
    connected: boolean;
    phoneNumber?: string;
    qrRequired?: boolean;
  };
}

export default function WhatsAppStatus({ status }: WhatsAppStatusProps) {
  const isConnected = status?.connected ?? false;

  return (
    <div className="flex items-center space-x-2">
      {isConnected ? (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></div>
          WhatsApp Connected
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
          <MessageCircle className="w-3 h-3 mr-2" />
          {status?.qrRequired ? 'Scan QR Code' : 'Connecting...'}
        </Badge>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="text-slate-400 hover:text-slate-600"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );
}
