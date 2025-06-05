import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

export async function fetchProspectsFromSheet() {
  try {
    console.log('🔍 Fetching prospects from Google Sheets...');

    const auth = new google.auth.GoogleAuth({
      keyFile: 'keys.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const spreadsheetId = '1yPxhCe6AaP19TxtwD-KE0tdjrL8TsbbClq0FkzbIT0w';
    const range = 'Sheet1!A1:Z'; // Get enough columns including headers

    console.log('📊 Calling Google Sheets API...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log('⚠️ No data found in the sheet.');
      return [];
    }

    // Get headers and data rows
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Map known headers to their indices
    const headerMap = {
      name: headers.findIndex(h => h.trim().toLowerCase() === 'name'),
      skinProblem: headers.findIndex(h => h.trim().toLowerCase() === 'skin problems'),
      phoneNumber: headers.findIndex(h => h.trim().toLowerCase() === 'phone number'),
      uniqueId: headers.findIndex(h => h.trim().toLowerCase() === 'uniqueid'),
    };

    let updated = false;

    // If uniqueId column is missing, add it
    if (headerMap.uniqueId === -1) {
      headers.push('uniqueId');
      headerMap.uniqueId = headers.length - 1;
      updated = true;

      // Also add empty cells for existing rows
      for (let row of dataRows) {
        row[headerMap.uniqueId] = '';
      }
    }

    // Process each row
    const prospects = dataRows.map((row, i) => {
      const name = row[headerMap.name]?.toString().trim() || '';
      const skinProblem = row[headerMap.skinProblem]?.toString().trim() || '';
      const phoneNumber = row[headerMap.phoneNumber]?.toString().trim() || '';
      let uniqueId = row[headerMap.uniqueId]?.toString().trim();

      if (!name || !phoneNumber) {
        console.log(`⚠️ Skipping row ${i + 2}: Missing name or phone number`);
        return null;
      }

      if (!uniqueId) {
        uniqueId = randomUUID();
        row[headerMap.uniqueId] = uniqueId;
        updated = true;
      }

      console.log(`✅ Processing: ${name} - ${skinProblem} - ${phoneNumber}`);

      return {
        name,
        phoneNumber,
        skinProblem,
        uniqueId,
        status: 'pending' as const,
      };
    }).filter(Boolean);

    // Update sheet only if any rows or headers changed
    if (updated) {
      console.log('✍️ Writing updated rows with unique IDs to the sheet...');
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A1:${String.fromCharCode(65 + headers.length - 1)}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers, ...dataRows],
        },
      });
      console.log('✅ Sheet updated successfully.');
    }

    console.log(`🎉 Successfully processed ${prospects.length} prospects`);
    return prospects;

  } catch (error) {
    console.error('❌ Error fetching prospects from Google Sheets:', error);
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error('💡 Make sure your keys.json file exists in the project root');
      } else if (error.message.includes('permission')) {
        console.error('💡 Make sure the service account email has access to the Google Sheet');
      } else if (error.message.includes('API')) {
        console.error('💡 Make sure the Google Sheets API is enabled in your Google Cloud Console');
      }
    }
    throw error;
  }
}

// Optional: Function to test the connection
export async function testGoogleSheetsConnection() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'keys.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client as any });

    // Test by getting the spreadsheet metadata
    const spreadsheetId = '1yPxhCe6AaP19TxtwD-KE0tdjrL8TsbbClq0FkzbIT0w';
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    console.log('✅ Google Sheets connection successful!');
    console.log(`📄 Sheet title: ${response.data.properties?.title}`);
    return true;
  } catch (error) {
    console.error('❌ Google Sheets connection failed:', error);
    return false;
  }
}