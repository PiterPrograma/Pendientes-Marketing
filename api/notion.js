const https = require("https");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-notion-token, x-database-id");
}

function notionRequest(path, method, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.notion.com",
      path: `/v1${path}`,
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  const token = req.headers["x-notion-token"];
  const dbId = req.headers["x-database-id"];
  if (!token) { res.status(400).json({ error: "Falta x-notion-token" }); return; }
  const { action } = req.query;
  try {
    let result;
    if (action === "query" && req.method === "POST") {
      result = await notionRequest(`/databases/${dbId}/query`, "POST", token, req.body);
    } else if (action === "create" && req.method === "POST") {
      result = await notionRequest("/pages", "POST", token, req.body);
    } else if (action === "update" && req.method === "PATCH") {
      const { pageId } = req.query;
      result = await notionRequest(`/pages/${pageId}`, "PATCH", token, req.body);
    } else if (action === "delete" && req.method === "PATCH") {
      const { pageId } = req.query;
      result = await notionRequest(`/pages/${pageId}`, "PATCH", token, { archived: true });
    } else {
      res.status(400).json({ error: "Accion no reconocida" }); return;
    }
    res.status(result.status).json(result.body);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
