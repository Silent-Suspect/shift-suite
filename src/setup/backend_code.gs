// ==========================================
// SHIFT SUITE LOGIC v2.1 (Split Config)
// ==========================================

// READ (GET)
function doGet(e) {
  // Check Password (API_PASSWORD comes from config.gs)
  if (e.parameter.password !== API_PASSWORD) {
    return createJSONOutput({ error: "Wrong Password" });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1); 

  // Mapping: A=Code, B=Name, C=ShortName, D=Lat, E=Lng
  const stations = rows.map(row => ({
    c: row[0], 
    n: row[1],
    s: row[2] || "",
    lat: row[3] || null, // Spalte D
    lng: row[4] || null  // Spalte E
  })).filter(r => r.c);

  return createJSONOutput({ data: stations });
}

// WRITE (POST)
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    
    if (params.password !== API_PASSWORD) {
      return createJSONOutput({ error: "Wrong Password" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const code = params.code;
    
    // Suche den Code in Spalte A
    const finder = sheet.getRange("A:A").createTextFinder(code).matchEntireCell(true).matchCase(true);
    const result = finder.findNext();

    if (result) {
      const row = result.getRow();
      
      // Handle Deletion (Empty Strings)
      // Check explicitly if values are empty strings
      if (params.lat === "" || params.lat === null) {
         sheet.getRange(row, 4).clearContent(); // Clear Lat
      } else {
         sheet.getRange(row, 4).setValue(params.lat);
      }

      if (params.lng === "" || params.lng === null) {
         sheet.getRange(row, 5).clearContent(); // Clear Lng
      } else {
         sheet.getRange(row, 5).setValue(params.lng);
      }
      
      return createJSONOutput({ success: true, message: `Updated ${code}` });
    } else {
      return createJSONOutput({ error: "Station not found" });
    }
  } catch (err) {
    return createJSONOutput({ error: err.toString() });
  }
}

function createJSONOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
