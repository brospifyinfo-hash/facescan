/**
 * FaceScan product catalogue — Google Sheets backend.
 *
 * SETUP (once, ~2 minutes)
 * -----------------------
 *  1. Open the spreadsheet → Extensions → Apps Script.
 *  2. Delete whatever is in Code.gs and paste this file.
 *  3. Edit TOKEN below to a long random string. Keep it.
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as:  Me
 *       Who has access:  Anyone
 *     "Anyone" is what lets the site reach it at all; TOKEN is what stops
 *     anyone else from using it. Without the token every request is refused.
 *  5. Copy the /exec URL.
 *  6. In Vercel set:
 *       SHEETS_URL    = the /exec URL
 *       SHEETS_TOKEN  = the same string as TOKEN below
 *
 * The header row is created automatically on the first write.
 *
 * WHY A SCRIPT AND NOT THE SHEETS API: the API needs a Google Cloud project,
 * a service account and a private key pasted into an env var. This needs a
 * paste and a deploy, and the credential never leaves the two places that
 * hold it.
 */

var TOKEN = "CHANGE-ME-TO-A-LONG-RANDOM-STRING";

var SHEET = "products";
var COLUMNS = [
  "id",
  "title",
  "description",
  "price",
  "imageUrl",
  "affiliateLink",
  "tags",
  "active",
  "createdAt",
  "updatedAt",
];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    // Reuse the default first sheet if it is untouched, so a fresh
    // spreadsheet does not end up with an empty "Sheet1" beside the data.
    var first = ss.getSheets()[0];
    if (ss.getSheets().length === 1 && first.getLastRow() === 0) {
      first.setName(SHEET);
      sh = first;
    } else {
      sh = ss.insertSheet(SHEET);
    }
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowToProduct_(row) {
  var o = {};
  for (var i = 0; i < COLUMNS.length; i++) o[COLUMNS[i]] = row[i];
  return {
    id: String(o.id || ""),
    title: String(o.title || ""),
    description: String(o.description || ""),
    price: String(o.price || ""),
    imageUrl: String(o.imageUrl || ""),
    affiliateLink: String(o.affiliateLink || ""),
    tags: String(o.tags || "")
      .split(",")
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; }),
    // Sheets turns TRUE/FALSE into booleans, but a hand-typed cell is a
    // string. Anything that is not explicitly false counts as active.
    active: !(o.active === false || String(o.active).toLowerCase() === "false"),
    createdAt: Number(o.createdAt) || 0,
    updatedAt: Number(o.updatedAt) || 0,
  };
}

function productToRow_(p) {
  return [
    p.id,
    p.title,
    p.description,
    p.price,
    p.imageUrl,
    p.affiliateLink,
    (p.tags || []).join(","),
    p.active === false ? false : true,
    p.createdAt,
    p.updatedAt,
  ];
}

function readAll_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue; // no id → not a record
    out.push(rowToProduct_(values[i]));
  }
  return out;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function authed_(token) {
  return typeof token === "string" && token.length > 0 && token === TOKEN;
}

function doGet(e) {
  if (!authed_(e && e.parameter && e.parameter.token)) {
    return json_({ error: "unauthorized" });
  }
  return json_({ products: readAll_(sheet_()) });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: "invalid_json" });
  }
  if (!authed_(body.token)) return json_({ error: "unauthorized" });

  var sh = sheet_();

  // A lock, because two admin tabs saving at once would otherwise read the
  // same last row and one write would land on top of the other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ error: "busy" });
  }

  try {
    if (body.action === "create") {
      sh.appendRow(productToRow_(body.product));
      return json_({ ok: true, product: body.product });
    }

    if (body.action === "update") {
      var row = findRow_(sh, body.product.id);
      if (row < 0) return json_({ error: "not_found" });
      sh.getRange(row, 1, 1, COLUMNS.length).setValues([productToRow_(body.product)]);
      return json_({ ok: true, product: body.product });
    }

    if (body.action === "delete") {
      var r = findRow_(sh, body.id);
      if (r < 0) return json_({ error: "not_found" });
      sh.deleteRow(r);
      return json_({ ok: true });
    }

    return json_({ error: "unknown_action" });
  } finally {
    lock.releaseLock();
  }
}
