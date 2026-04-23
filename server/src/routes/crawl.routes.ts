import { Router } from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { ParserService } from '../services/parser.service';

const router = Router();
// ... (fetchWithTimeout remains as internal helper or moved to utils)

async function fetchWithTimeout(url: string, options: any = {}, timeout: number = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

router.post('/', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!ParserService.isValidPublicUrl(url)) {
    return res.status(400).json({ error: "URL không hợp lệ hoặc bị chặn vì lý do bảo mật." });
  }

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    }, 15000);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim() || $("title").text().trim();
    let ingredients: string[] = [];
    $("li").each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 0 && text.length < 200 && (/\d/.test(text) || /gram|ml|muỗng|thìa|củ|quả|kg/i.test(text))) {
        ingredients.push(text);
      }
    });

    let instructions: string[] = [];
    $("p, li").each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !ingredients.includes(text)) {
        instructions.push(text);
      }
    });

    res.json({
      title,
      ingredients: [...new Set(ingredients)].slice(0, 30),
      instructions: [...new Set(instructions)].slice(0, 20),
      rawText: $("body").text().slice(0, 5000)
    });
  } catch (error: any) {
    logger.error("Crawl error: %o", error);
    res.status(500).json({ error: `Không thể lấy dữ liệu từ URL này: ${error.message}` });
  }
});

export default router;
