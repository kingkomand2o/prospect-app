import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProspectSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Baileys imports
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// WhatsApp connection state
let sock: any = null;
let qrCodeDisplayed = false;

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
      
      if (qr && !qrCodeDisplayed) {
        console.log('\n🔗 WhatsApp QR Code:');
        qrcode.generate(qr, { small: true });
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
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error);
    // Retry connection after 10 seconds
    setTimeout(initializeWhatsApp, 10000);
  }
}

// Parse CSV content
function parseCSV(csvContent: string) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const header = lines[0].toLowerCase();
  if (!header.includes('name') || !header.includes('skin problems') || !header.includes('phone')) {
    throw new Error('CSV must have columns: Name, Skin Problems, Phone number');
  }

  const prospects = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length >= 3 && values[0] && values[1] && values[2]) {
      prospects.push({
        name: values[0],
        skinProblems: values[1],
        phoneNumber: values[2].replace(/\D/g, ''), // Remove non-digits for phone
      });
    }
  }

  return prospects;
}

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

  // CSV Upload endpoint
  app.post('/api/upload-csv', upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No CSV file uploaded' });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const parsedProspects = parseCSV(csvContent);

      if (parsedProspects.length === 0) {
        return res.status(400).json({ message: 'No valid prospects found in CSV' });
      }

      // Validate each prospect
      const validatedProspects = [];
      for (const prospect of parsedProspects) {
        try {
          const validated = insertProspectSchema.parse(prospect);
          validatedProspects.push(validated);
        } catch (error) {
          console.warn('Invalid prospect data:', prospect, error);
        }
      }

      if (validatedProspects.length === 0) {
        return res.status(400).json({ message: 'No valid prospects after validation' });
      }

      // Store prospects
      const createdProspects = await storage.createManyProspects(validatedProspects);

      res.json({
        message: `Successfully uploaded ${createdProspects.length} prospects`,
        count: createdProspects.length,
        prospects: createdProspects
      });
    } catch (error) {
      console.error('CSV upload error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to process CSV file' 
      });
    }
  });

  // Get all prospects
  app.get('/api/prospects', async (req, res) => {
    try {
      const prospects = await storage.getAllProspects();
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

  // WhatsApp status endpoint
  app.get('/api/whatsapp-status', (req, res) => {
    const isConnected = sock && sock.user;
    res.json({
      connected: !!isConnected,
      phoneNumber: isConnected ? sock.user.id : null,
      qrRequired: !isConnected && !qrCodeDisplayed
    });
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

  const httpServer = createServer(app);
  return httpServer;
}
