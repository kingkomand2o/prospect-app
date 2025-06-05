import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchProspectsFromSheet } from './googleSheets';

// Baileys imports
import * as baileys from '@whiskeysockets/baileys';
const { makeWASocket, DisconnectReason, useMultiFileAuthState } = baileys;
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

// Removed CSV upload functionality - using Google Sheets directly

// WhatsApp connection state
let sock: any = null;
let qrCodeDisplayed = false;
let currentQrCode: string | null = null;

// Initialize WhatsApp connection
async function initializeWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n🔗 WhatsApp QR Code:');
        qrcode.generate(qr, { small: true });
        currentQrCode = qr;
        qrCodeDisplayed = true;
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(initializeWhatsApp, 3000);
        }
        qrCodeDisplayed = false;
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully');
        qrCodeDisplayed = false;
        currentQrCode = null;
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error);
    // Retry connection after 10 seconds
    setTimeout(initializeWhatsApp, 10000);
  }
}

// Removed CSV parsing - using Google Sheets directly

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  if (!sock) {
    throw new Error('WhatsApp not connected');
  }

  try {
    // Format phone number for WhatsApp (remove + and add country code if needed)
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    const whatsappId = formattedNumber.includes('@s.whatsapp.net') 
      ? formattedNumber 
      : `${formattedNumber}@s.whatsapp.net`;

    await sock.sendMessage(whatsappId, { text: message });
    return true;
  } catch (error) {
    console.error(`Failed to send message to ${phoneNumber}:`, error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize WhatsApp on startup
  initializeWhatsApp();

  // Google Sheets Import endpoint - Main data source
  // --- Automatically import prospects from Google Sheets on server start ---
(async () => {
  try {
    console.log('🔄 Automatically importing prospects from Google Sheets on startup...');
    const sheetProspects = await fetchProspectsFromSheet();

    const cleanProspects = sheetProspects
      .filter(p => p && p.name && p.phoneNumber && p.skinProblem)
      .map(p => ({
        name: p.name.trim(),
        phoneNumber: p.phoneNumber.trim(),
        skinProblems: p.skinProblem.trim(),
        // Don't assign status here because this is the sheet raw data
        uniqueId: p.uniqueId || null,
      }));

    if (cleanProspects.length === 0) {
      console.log('⚠️ No valid prospects found in Google Sheets on startup.');
      return;
    }

    const existingProspects = await storage.getAllProspects();
    const existingMap = new Map(existingProspects.map(p => [p.uniqueId, p]));

    const processedUniqueIds = new Set<string>();
    const results: Array<Promise<Prospect>> = [];

    for (const prospectData of cleanProspects) {
      if (prospectData.uniqueId && existingMap.has(prospectData.uniqueId)) {
        const existing = existingMap.get(prospectData.uniqueId)!;

        // Check if any core data has changed, but ignore status here
        const hasChanged =
          existing.name !== prospectData.name ||
          existing.phoneNumber !== prospectData.phoneNumber ||
          existing.skinProblems !== prospectData.skinProblems;

        if (hasChanged) {
          const updated: Prospect = {
            ...existing,
            name: prospectData.name,
            phoneNumber: prospectData.phoneNumber,
            skinProblems: prospectData.skinProblems,
            generatedMessage: `Hi ${prospectData.name}, we are here to help you with ${prospectData.skinProblems}.`
          };
          results.push(storage.updateProspect(updated));
        } else {
          // No changes, keep as is without update
          results.push(Promise.resolve(existing));
        }
        processedUniqueIds.add(prospectData.uniqueId);
      } else {
        // New prospect, create with status "pending"
        results.push(storage.createProspect({
          ...prospectData,
          uniqueId: undefined,
          status: "pending"
        }));
      }
    }

    const createdOrUpdated = await Promise.all(results);

    // Delete prospects no longer in the sheet
    for (const existing of existingProspects) {
      if (!processedUniqueIds.has(existing.uniqueId)) {
        await storage.deleteProspect(existing.id);
      }
    }

    console.log(`✅ Synced ${createdOrUpdated.length} prospects automatically from Google Sheets.`);
  } catch (error) {
    console.error('❌ Automatic import from Google Sheets failed:', error);
  }
})();



// API endpoint

app.post('/api/import-sheets', async (req, res) => {
  try {
    console.log('🔄 Manual import: Fetching from Google Sheets...');
    const sheetProspects = await fetchProspectsFromSheet();

    const cleanProspects = sheetProspects
      .filter(p => p && p.name && p.phoneNumber && p.skinProblem)
      .map(p => ({
        name: p.name.trim(),
        phoneNumber: p.phoneNumber.trim(),
        skinProblems: p.skinProblem.trim(),
        uniqueId: p.uniqueId || null,
      }));

    if (cleanProspects.length === 0) {
      return res.status(200).json({ message: 'No valid prospects found in the sheet.' });
    }

    const existingProspects = await storage.getAllProspects();
    const existingMap = new Map(existingProspects.map(p => [p.uniqueId, p]));

    const processedUniqueIds = new Set<string>();
    const results: Array<Promise<Prospect>> = [];

    for (const prospectData of cleanProspects) {
      if (prospectData.uniqueId && existingMap.has(prospectData.uniqueId)) {
        const existing = existingMap.get(prospectData.uniqueId)!;

        const hasChanged =
          existing.name !== prospectData.name ||
          existing.phoneNumber !== prospectData.phoneNumber ||
          existing.skinProblems !== prospectData.skinProblems;

        if (hasChanged) {
          const updated: Prospect = {
            ...existing,
            name: prospectData.name,
            phoneNumber: prospectData.phoneNumber,
            skinProblems: prospectData.skinProblems,
            status: existing.status,
            generatedMessage: `Hi ${prospectData.name}, we are here to help you with ${prospectData.skinProblems}.`
          };
          results.push(storage.updateProspect(updated));
        } else {
          results.push(Promise.resolve(existing));
        }
        processedUniqueIds.add(prospectData.uniqueId);
      } else {
        results.push(storage.createProspect({
          ...prospectData,
          uniqueId: undefined,
          status: "pending"
        }));
      }
    }

    const createdOrUpdated = await Promise.all(results);

    // Delete prospects no longer in the sheet
    for (const existing of existingProspects) {
      if (!processedUniqueIds.has(existing.uniqueId)) {
        await storage.deleteProspect(existing.id);
      }
    }

    console.log(`✅ Synced ${createdOrUpdated.length} prospects manually from Google Sheets.`);
    return res.json({
      message: `Synced ${createdOrUpdated.length} prospects from Google Sheets.`,
      count: createdOrUpdated.length
    });

  } catch (err) {
    console.error('❌ Manual import failed:', err);
    return res.status(500).json({ message: 'Import failed' });
  }
});


  // Get all prospects
  app.get('/api/prospects', async (req, res) => {
    try {
      const prospects = await storage.getAllProspects();
      console.log(`📋 Fetched ${prospects.length} prospects from database`);
      res.json(prospects);
    } catch (error) {
      console.error('Error fetching prospects:', error);
      res.status(500).json({ message: 'Failed to fetch prospects' });
    }
  });

  // Send bulk WhatsApp messages
  app.post('/api/send-bulk', async (req, res) => {
    try {
      if (!sock) {
        return res.status(503).json({ message: 'WhatsApp not connected. Please scan QR code first.' });
      }

      const prospects = await storage.getAllProspects();
      const pendingProspects = prospects.filter(p => p.status === 'pending');

      if (pendingProspects.length === 0) {
        return res.json({ message: 'No pending messages to send', sent: 0, failed: 0 });
      }

      let sentCount = 0;
      let failedCount = 0;

      // Send messages with delay between each
      for (const prospect of pendingProspects) {
        try {
          const success = await sendWhatsAppMessage(prospect.phoneNumber, prospect.generatedMessage);
          
          if (success) {
            await storage.updateProspectStatus(prospect.id, 'sent');
            sentCount++;
          } else {
            await storage.updateProspectStatus(prospect.id, 'failed');
            failedCount++;
          }

          // 2-second delay between messages to avoid rate limiting
          if (pendingProspects.indexOf(prospect) < pendingProspects.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to send message to ${prospect.name}:`, error);
          await storage.updateProspectStatus(prospect.id, 'failed');
          failedCount++;
        }
      }

      res.json({
        message: `Bulk send completed. Sent: ${sentCount}, Failed: ${failedCount}`,
        sent: sentCount,
        failed: failedCount
      });
    } catch (error) {
      console.error('Bulk send error:', error);
      res.status(500).json({ message: 'Failed to send bulk messages' });
    }
  });

  app.post('/api/send-single', async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      const prospect = await storage.getProspectByPhoneNumber(phoneNumber);
      if (!prospect) {
        return res.status(404).json({ message: 'Prospect not found' });
      }

      // Use the message sent from frontend if available, else fallback
      const textToSend = message && message.trim() !== '' ? message : prospect.generatedMessage;

      const success = await sendWhatsAppMessage(prospect.phoneNumber, textToSend);

      if (success) {
        await storage.updateProspectStatus(prospect.id, 'sent');
        return res.json({ message: `Message sent to ${prospect.name}` });
      } else {
        await storage.updateProspectStatus(prospect.id, 'failed');
        return res.status(500).json({ message: 'Failed to send message' });
      }
    } catch (error) {
      console.error('Single send error:', error);
      return res.status(500).json({ message: 'Server error while sending message' });
    }
  });


  // WhatsApp status endpoint
  app.get('/api/whatsapp-status', (req, res) => {
    const isConnected = sock && sock.user;
    res.json({
      connected: !!isConnected,
      phoneNumber: isConnected ? sock.user.id : null,
      qrRequired: !isConnected && !qrCodeDisplayed,
      qrCode: currentQrCode
    });
  });

  // Test Google Sheets connection endpoint
  app.get('/api/test-sheets', async (req, res) => {
    try {
      const { testGoogleSheetsConnection } = await import('./googleSheets');
      const isConnected = await testGoogleSheetsConnection();
      
      if (isConnected) {
        res.json({ message: 'Google Sheets connection successful!' });
      } else {
        res.status(500).json({ message: 'Google Sheets connection failed' });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({ 
        message: 'Error testing connection', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update prospect status
  app.patch('/api/prospects/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'sent', 'failed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const updatedProspect = await storage.updateProspectStatus(parseInt(id), status);
      
      if (!updatedProspect) {
        return res.status(404).json({ message: 'Prospect not found' });
      }

      res.json(updatedProspect);
    } catch (error) {
      console.error('Error updating prospect status:', error);
      res.status(500).json({ message: 'Failed to update prospect status' });
    }
  });

  // Delete prospect
  app.delete('/api/prospects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProspect(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: 'Prospect not found' });
      }

      res.json({ message: 'Prospect deleted successfully' });
    } catch (error) {
      console.error('Error deleting prospect:', error);
      res.status(500).json({ message: 'Failed to delete prospect' });
    }
  });

  // console logging removed (but keeping the middleware for non-status endpoints)
  app.use((req, res, next) => {
    if (req.path !== "/api/whatsapp-status") {
      console.log(`${req.method} ${req.path}`);
    }
    next();
  });

  const httpServer = createServer(app);
  return httpServer;
}