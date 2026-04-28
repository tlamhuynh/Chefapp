// src/lib/quota-tracker.ts

export interface QuotaConfig {
  rpm: number;
  rpd: number | null;
  tpm: number | null;
}

export type RequestCheck = {
  allowed: boolean;
  reason: string;
};

export class QuotaTracker {
  private static instance: QuotaTracker;
  
  private defaultQuotas: Record<string, QuotaConfig> = {
    "google:gemini-2.0-flash-lite": { rpm: 15, rpd: 1000, tpm: 250000 },
    "google:gemini-2.0-pro": { rpm: 5, rpd: 100, tpm: 250000 },
    "google:gemini-2.0-flash": { rpm: 10, rpd: 250, tpm: 250000 },
    "groq:llama-3.1-8b-instant": { rpm: 30, rpd: 14400, tpm: 6000 },
    "groq:llama-3.3-70b-versatile": { rpm: 30, rpd: 14400, tpm: 6000 },
    "openrouter:default": { rpm: 20, rpd: 200, tpm: null },
    "cerebras:default": { rpm: 30, rpd: null, tpm: 1000000 },
    "mistral:default": { rpm: 2, rpd: null, tpm: null },
    "cohere:default": { rpm: 20, rpd: null, tpm: null },
    "ai21:default": { rpm: 200, rpd: null, tpm: null },
    "sambanova:default": { rpm: 10, rpd: null, tpm: null },
  };

  private constructor() {}

  public static getInstance(): QuotaTracker {
    if (!QuotaTracker.instance) {
      QuotaTracker.instance = new QuotaTracker();
    }
    return QuotaTracker.instance;
  }

  private getMinuteBucket(): string {
    const now = new Date();
    // format yyyy-mm-dd_hh:mm
    return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}:${now.getMinutes()}`;
  }

  private getDayBucket(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  }

  private getInt(key: string): number {
    try {
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  private setInt(key: string, val: number) {
    try {
      localStorage.setItem(key, val.toString());
    } catch {
      // ignore
    }
  }

  public canRequest(provider: string, model: string, tokens: number = 0): RequestCheck {
    const key = `${provider}:${model}`;
    const quota = this.defaultQuotas[key] || this.defaultQuotas[`${provider}:default`] || { rpm: 10, rpd: 100, tpm: 100000 };

    const minuteBucket = this.getMinuteBucket();
    const dayBucket = this.getDayBucket();

    // Check RPM
    const rpmKey = `quota_${key}:rpm:${minuteBucket}`;
    const currentRpm = this.getInt(rpmKey);
    if (currentRpm >= quota.rpm) {
      return { allowed: false, reason: `RPM limit: ${currentRpm}/${quota.rpm}` };
    }

    // Check RPD
    if (quota.rpd !== null) {
      const rpdKey = `quota_${key}:rpd:${dayBucket}`;
      const currentRpd = this.getInt(rpdKey);
      if (currentRpd >= quota.rpd) {
        return { allowed: false, reason: `RPD limit: ${currentRpd}/${quota.rpd}` };
      }
    }

    // Check TPM
    if (quota.tpm !== null && tokens > 0) {
      const tpmKey = `quota_${key}:tpm:${minuteBucket}`;
      const currentTpm = this.getInt(tpmKey);
      if (currentTpm + tokens > quota.tpm) {
        return { allowed: false, reason: `TPM would exceed: ${currentTpm + tokens}/${quota.tpm}` };
      }
    }

    return { allowed: true, reason: "OK" };
  }

  public recordRequest(provider: string, model: string, tokens: number = 0) {
    const key = `${provider}:${model}`;
    const minuteBucket = this.getMinuteBucket();
    const dayBucket = this.getDayBucket();

    // RPM
    const rpmKey = `quota_${key}:rpm:${minuteBucket}`;
    this.setInt(rpmKey, this.getInt(rpmKey) + 1);

    // RPD
    const rpdKey = `quota_${key}:rpd:${dayBucket}`;
    this.setInt(rpdKey, this.getInt(rpdKey) + 1);

    const tpmKey = `quota_${key}:tpm:${minuteBucket}`;
    // TPM
    if (tokens > 0) {
      this.setInt(tpmKey, this.getInt(tpmKey) + tokens);
    }
    
    try {
      localStorage.setItem('quota_last_request', new Date().toISOString());
      
      // Save stats globally
      let statsRaw = localStorage.getItem('quota_stats');
      let stats = statsRaw ? JSON.parse(statsRaw) : {};
      if (!stats[provider]) stats[provider] = {};
      if (!stats[provider][model]) stats[provider][model] = { rpm: 0, rpd: 0, tpm: 0 };
      
      stats[provider][model].rpm = this.getInt(rpmKey);
      stats[provider][model].rpd = this.getInt(rpdKey);
      if (tokens > 0) {
          stats[provider][model].tpm = this.getInt(tpmKey);
      }
      localStorage.setItem('quota_stats', JSON.stringify(stats));
    } catch {}
  }
  
  public getStats(): any {
    try {
      const statsRaw = localStorage.getItem('quota_stats');
      return statsRaw ? JSON.parse(statsRaw) : {};
    } catch {
      return {};
    }
  }
}
