/**
 * Simulated Market Data Service.
 * In production, this would fetch from an external API.
 */

export interface MarketPrice {
  name: string;
  price: number;
  unit: string;
  source: string;
}

const MARKET_DATA: Record<string, { price: number, unit: string }> = {
  "thịt bò": { price: 250000, unit: "kg" },
  "thịt lợn": { price: 120000, unit: "kg" },
  "thịt gà": { price: 90000, unit: "kg" },
  "cá hồi": { price: 450000, unit: "kg" },
  "tôm": { price: 180000, unit: "kg" },
  "hành tây": { price: 15000, unit: "kg" },
  "tỏi": { price: 40000, unit: "kg" },
  "gừng": { price: 30000, unit: "kg" },
  "trứng": { price: 3500, unit: "quả" },
  "sữa": { price: 35000, unit: "lít" },
  "bơ": { price: 200000, unit: "kg" },
  "kem tươi": { price: 150000, unit: "lít" },
  "bột mì": { price: 25000, unit: "kg" },
  "đường": { price: 20000, unit: "kg" },
  "muối": { price: 10000, unit: "kg" },
  "dầu ăn": { price: 45000, unit: "lít" },
  "gạo": { price: 18000, unit: "kg" },
  "ớt": { price: 50000, unit: "kg" },
  "chanh": { price: 20000, unit: "kg" },
  "rau muống": { price: 10000, unit: "bó" },
  "cà chua": { price: 25000, unit: "kg" }
};

export async function searchMarketPrices(ingredients: string[]): Promise<MarketPrice[]> {
  console.log(`[Market Service] Searching prices for: ${ingredients.join(", ")}`);
  
  return ingredients.map(ing => {
    const lower = ing.toLowerCase();
    const match = Object.entries(MARKET_DATA).find(([key]) => lower.includes(key));
    
    if (match) {
      return { name: ing, price: match[1].price, unit: match[1].unit, source: "Market Hub VN" };
    }
    
    // Fallback: AI Estimate simulation
    const randomPrice = Math.floor(Math.random() * 200000) + 20000;
    return { name: ing, price: randomPrice, unit: "kg", source: "AI Estimate (Simulated)" };
  });
}
