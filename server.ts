import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
// @ts-ignore
import { app as apiApp } from "./netlify/functions/api.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse incoming JSON
  app.use(express.json());

  // Mount the serverless express app directly
  app.use(apiApp);

  // Vite middleware for dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
