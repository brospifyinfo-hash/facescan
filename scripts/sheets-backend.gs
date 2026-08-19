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

// ---------------------------------------------------------------------------
// Scan history — a second tab on the same document.
//
// One deployment and one token for both, so there is a single thing to keep
// alive. Rows are appended and never updated: a reading is a fact about a
// moment, and the only correct edit is to delete it.
// ---------------------------------------------------------------------------

var SCANS = "scans";
var SCAN_COLUMNS = [
  "id", "email", "at", "overall", "band",
  "symmetry", "eyesScore", "jawScore", "proportionsScore", "midfaceScore", "source",
  // Appended, never inserted: the existing rows keep their column order and a
  // sheet written by the previous version of this script simply has the last
  // cell empty.
  "potential",
  // The full measurement set as one JSON cell — parsed and validated by the
  // app on read, so a hand-edited cell degrades to "no detail".
  "detail",
];

function scanSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SCANS);
  if (!sh) sh = ss.insertSheet(SCANS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(SCAN_COLUMNS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function scansFor_(email) {
  var sh = scanSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, SCAN_COLUMNS.length).getValues();
  var out = [];
  var wanted = String(email || "").trim().toLowerCase();
  for (var i = 0; i < values.length; i++) {
    var o = {};
    for (var c = 0; c < SCAN_COLUMNS.length; c++) o[SCAN_COLUMNS[c]] = values[i][c];
    if (!o.id) continue;
    if (String(o.email).trim().toLowerCase() !== wanted) continue;
    out.push({
      id: String(o.id), at: Number(o.at) || 0,
      overall: Number(o.overall) || 0, band: String(o.band || ""),
      symmetry: Number(o.symmetry) || 0, eyesScore: Number(o.eyesScore) || 0,
      jawScore: Number(o.jawScore) || 0, proportionsScore: Number(o.proportionsScore) || 0,
      midfaceScore: Number(o.midfaceScore) || 0,
      source: String(o.source) === "vision" ? "vision" : "geometry",
      potential: o.potential === "" || o.potential == null ? null : Number(o.potential),
      detail: o.detail == null || o.detail === "" ? "" : String(o.detail),
    });
  }
  return out;
}

function addScan_(email, e) {
  scanSheet_().appendRow([
    e.id, email, e.at, e.overall, e.band,
    e.symmetry, e.eyesScore, e.jawScore, e.proportionsScore, e.midfaceScore, e.source,
    e.potential == null ? "" : e.potential,
    e.detail == null ? "" : e.detail,
  ]);
}


// ---------------------------------------------------------------------------
// A general key-value tab.
// ---------------------------------------------------------------------------
// Login codes and purchases live here. They were previously held in memory,
// which on serverless means: the code is written by one instance and looked
// up by another, so it is simply not there. Sign-in failed for a share of
// users at random, and every purchase would have been lost on the next cold
// start.
//
// Redis is the better tool and the app still prefers it when Upstash
// credentials are present. This is the backing that exists TODAY, on
// infrastructure already deployed, and a few hundred milliseconds is a fine
// price for a login that works.
//
// Rows carry their own expiry. Nothing sweeps them on a timer — Apps Script
// has no cron here — so writes prune opportunistically, bounded so a big tab
// cannot push a request past the execution limit.

var KV = "kv";
var KV_COLUMNS = ["key", "value", "expiresAt"];
var KV_PRUNE_SCAN = 200;

function kvSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KV);
  if (!sh) sh = ss.insertSheet(KV);
  if (sh.getLastRow() === 0) {
    sh.appendRow(KV_COLUMNS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function kvFindRow_(sh, key) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return i + 2;
  }
  return -1;
}

function kvGet_(key) {
  var sh = kvSheet_();
  var row = kvFindRow_(sh, key);
  if (row < 0) return null;
  var v = sh.getRange(row, 1, 1, KV_COLUMNS.length).getValues()[0];
  var expiresAt = Number(v[2]) || 0;
  if (expiresAt > 0 && Date.now() > expiresAt) {
    sh.deleteRow(row);
    return null;
  }
  return { value: String(v[1] || ""), expiresAt: expiresAt };
}

// A leading apostrophe forces Sheets to keep the text as text. Without it a
// value that looks like a number comes back as one — the bug that turned a
// price of "24,90 EUR" into 24.9.
function kvAsText_(v) {
  var s = String(v == null ? "" : v);
  return s.length > 0 ? "'" + s : s;
}

function kvSet_(key, value, expiresAt) {
  var sh = kvSheet_();
  var row = kvFindRow_(sh, key);
  var data = [[key, kvAsText_(value), Number(expiresAt) || 0]];
  if (row < 0) sh.appendRow(data[0]);
  else sh.getRange(row, 1, 1, KV_COLUMNS.length).setValues(data);
  kvPrune_(sh);
  return true;
}

function kvDel_(key) {
  var sh = kvSheet_();
  var row = kvFindRow_(sh, key);
  if (row > 0) sh.deleteRow(row);
  return true;
}

/**
 * Increment one field of a JSON value, atomically.
 *
 * Read-modify-write from the app would race: two parallel guesses at a login
 * code both read 4 attempts, both write 5, and the fifth attempt never trips
 * the limit — which is the entire value of a brute-force limit. Under the
 * script lock this is a single serialised operation.
 */
/**
 * Every unexpired record whose key starts with the prefix. Powers the admin
 * live view (prefix "live:") and the customer merge (prefixes "ent:" and
 * "pay:"). Bounded to 500 matches; the kv tab is pruned, not archival.
 */
function kvScan_(prefix) {
  var sh = kvSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, KV_COLUMNS.length).getValues();
  var now = Date.now();
  var out = [];
  for (var i = 0; i < values.length && out.length < 500; i++) {
    var key = String(values[i][0] || "");
    if (prefix && key.indexOf(prefix) !== 0) continue;
    var exp = Number(values[i][2]) || 0;
    if (exp > 0 && now > exp) continue;
    out.push({ key: key, value: String(values[i][1] || ""), expiresAt: exp });
  }
  return out;
}

/** Per-address aggregates over the scans tab — the admin's customer list. */
function customersFor_() {
  var sh = scanSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, SCAN_COLUMNS.length).getValues();
  var byEmail = {};
  for (var i = 0; i < values.length; i++) {
    var email = String(values[i][1] || "").trim().toLowerCase();
    if (!email) continue;
    var at = Number(values[i][2]) || 0;
    var overall = Number(values[i][3]) || 0;
    var cur = byEmail[email];
    if (!cur) {
      cur = byEmail[email] = { email: email, scans: 0, firstAt: at, lastAt: at, best: overall };
    }
    cur.scans += 1;
    if (at < cur.firstAt) cur.firstAt = at;
    if (at > cur.lastAt) cur.lastAt = at;
    if (overall > cur.best) cur.best = overall;
  }
  var out = [];
  for (var k in byEmail) out.push(byEmail[k]);
  return out;
}

function kvBump_(key, field, by) {
  var sh = kvSheet_();
  var row = kvFindRow_(sh, key);
  if (row < 0) return null;
  var cell = sh.getRange(row, 2);
  var parsed;
  try {
    parsed = JSON.parse(String(cell.getValue() || "{}"));
  } catch (err) {
    return null;
  }
  parsed[field] = (Number(parsed[field]) || 0) + (Number(by) || 1);
  cell.setValue(kvAsText_(JSON.stringify(parsed)));
  return parsed[field];
}

/** Delete expired rows, scanning only the head of the tab. */
function kvPrune_(sh) {
  var last = sh.getLastRow();
  if (last < 3) return;
  var count = Math.min(last - 1, KV_PRUNE_SCAN);
  var values = sh.getRange(2, 1, count, KV_COLUMNS.length).getValues();
  var now = Date.now();
  // Bottom-up: deleting a row shifts everything below it up.
  for (var i = values.length - 1; i >= 0; i--) {
    var exp = Number(values[i][2]) || 0;
    if (exp > 0 && now > exp) sh.deleteRow(i + 2);
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!authed_(p.token)) return json_({ error: "unauthorized" });
  if (p.action === "scans") return json_({ scans: scansFor_(p.email) });
  if (p.action === "kv-get") return json_({ record: kvGet_(String(p.key || "")) });
  if (p.action === "kv-scan") return json_({ records: kvScan_(String(p.prefix || "")) });
  if (p.action === "customers") return json_({ customers: customersFor_() });
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

  // Appending a scan touches a different tab and needs no lock dance around
  // the catalogue, so it is handled before the products branch.
  if (body.action === "scan-add") {
    addScan_(body.email, body.entry);
    return json_({ ok: true });
  }

  // The key-value actions take the lock themselves: kv-bump is only correct
  // when the read and the write are one serialised step, and the others share
  // a tab with it.
  if (body.action === "kv-set" || body.action === "kv-del" || body.action === "kv-bump") {
    var kvLock = LockService.getScriptLock();
    try {
      kvLock.waitLock(10000);
    } catch (err) {
      return json_({ error: "busy" });
    }
    try {
      if (body.action === "kv-set") {
        return json_({ ok: kvSet_(String(body.key), String(body.value), body.expiresAt) });
      }
      if (body.action === "kv-del") return json_({ ok: kvDel_(String(body.key)) });
      return json_({ value: kvBump_(String(body.key), String(body.field), body.by) });
    } finally {
      kvLock.releaseLock();
    }
  }

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
