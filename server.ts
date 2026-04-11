import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for crawling recipes
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Basic extraction logic
      const title = $("h1").first().text().trim() || $("title").text().trim();
      
      // Try to find ingredients
      let ingredients: string[] = [];
      $("li").each((i, el) => {
        const text = $(el).text().trim();
        // Simple heuristic for ingredients: contains numbers or common units
        if (text.length > 0 && text.length < 200 && (/\d/.test(text) || /gram|ml|muỗng|thìa|củ|quả|kg/i.test(text))) {
          ingredients.push(text);
        }
      });

      // Try to find instructions
      let instructions: string[] = [];
      $("p, li").each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !ingredients.includes(text)) {
          instructions.push(text);
        }
      });

      // Limit results
      ingredients = [...new Set(ingredients)].slice(0, 30);
      instructions = [...new Set(instructions)].slice(0, 20);

      res.json({
        title,
        ingredients,
        instructions,
        rawText: $("body").text().slice(0, 5000) // Fallback for AI to parse
      });
    } catch (error: any) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
