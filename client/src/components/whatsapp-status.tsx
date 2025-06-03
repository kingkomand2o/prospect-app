import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, MessageCircle, QrCode } from "lucide-react";

interface WhatsAppStatusProps {
  status?: {
    connected: boolean;
    phoneNumber?: string;
    qrRequired?: boolean;
    qrCode?: string;
  };
}

export default function WhatsAppStatus({ status }: WhatsAppStatusProps) {
  const [showQrDialog, setShowQrDialog] = useState(false);
  const isConnected = status?.connected ?? false;
  const hasQrCode = status?.qrCode && !isConnected;

  return (
    <>
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></div>
            WhatsApp Connected
          </Badge>
        ) : (
          <Badge 
            variant="secondary" 
            className="bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
            onClick={() => hasQrCode && setShowQrDialog(true)}
          >
            <QrCode className="w-3 h-3 mr-2" />
            {hasQrCode ? 'Click to Scan QR' : 'Connecting...'}
          </Badge>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-slate-600"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code to Connect WhatsApp</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone, go to Settings {'>'}  Linked Devices {'>'} Link a Device, and scan this QR code.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center py-6">
            {status?.qrCode ? (
              <div className="bg-white p-4 rounded-lg border">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(status.qrCode)}`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48"
                />
              </div>
            ) : (
              <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Generating QR code...</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
