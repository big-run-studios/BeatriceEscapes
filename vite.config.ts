import { defineConfig, type Plugin } from "vite";
import fs from "fs";
import path from "path";

function remoteDebugPlugin(): Plugin {
  const logPath = path.resolve(__dirname, "remote-debug.log");
  return {
    name: "remote-debug",
    configureServer(server) {
      fs.writeFileSync(logPath, `--- Remote Debug Session ${new Date().toISOString()} ---\n`);
      server.middlewares.use((req, _res, next) => {
        if (req.url && !req.url.includes("node_modules") && !req.url.includes(".ts") && !req.url.includes("@vite")) {
          fs.appendFileSync(logPath, `[REQ] ${req.method} ${req.url}\n`);
        }
        next();
      });
      server.middlewares.use("/api/remote-log", (req, res) => {
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          req.on("end", () => {
            try {
              const entries = JSON.parse(body) as Array<{ ts: number; level: string; msg: string }>;
              for (const e of entries) {
                const line = `[${new Date(e.ts).toLocaleTimeString()}.${String(e.ts % 1000).padStart(3, "0")}] [${e.level}] ${e.msg}\n`;
                fs.appendFileSync(logPath, line);
              }
            } catch {
              fs.appendFileSync(logPath, `[RAW] ${body}\n`);
            }
            res.writeHead(200, {
              "Content-Type": "text/plain",
              "Access-Control-Allow-Origin": "*",
            });
            res.end("ok");
          });
        } else if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
        } else {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("remote-debug endpoint active");
        }
      });
      console.log(`\n  📡 Remote debug log: ${logPath}\n`);
    },
  };
}

export default defineConfig({
  base: "/BeatriceEscapes/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    open: true,
    host: true,
  },
  plugins: [remoteDebugPlugin()],
});
