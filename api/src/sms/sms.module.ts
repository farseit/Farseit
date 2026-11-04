import { Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 01XXXXXXXXX -> 8801XXXXXXXXX (gateway ei format chay) */
const intl = (p: string) => {
  const d = String(p).replace(/\D/g, '');
  if (d.startsWith('880')) return d;
  if (d.startsWith('0')) return `88${d}`;
  return `880${d}`;
};

@Injectable()
export class SmsService {
  private log = new Logger('SMS');

  constructor(private config: ConfigService) {}

  get enabled() {
    return (
      this.config.get<string>('SMS_ENABLED') === 'true' &&
      !!this.config.get<string>('SMS_API_KEY') &&
      !!this.config.get<string>('SMS_SENDER_ID')
    );
  }

  /** Kokhono throw kore na. Fail hole { ok: false, error } dey. */
  async send(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled) return { ok: false, error: 'SMS is off' };
    try {
      const base = this.config.get<string>('SMS_API_URL') || 'https://bulksmsbd.net/api/smsapi';
      const params = new URLSearchParams({
        api_key: this.config.get<string>('SMS_API_KEY') as string,
        type: 'text',
        number: intl(phone),
        senderid: this.config.get<string>('SMS_SENDER_ID') as string,
        message,
      });
      const res = await fetch(`${base}?${params.toString()}`, { signal: AbortSignal.timeout(10000) });
      const raw = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(raw);
      } catch {
        /* json na hole raw text-i error hishebe dekhabo */
      }
      // BulkSMSBD: response_code 202 = success
      if (res.ok && Number(json?.response_code) === 202) return { ok: true };
      const error = String(json?.error_message || json?.message || raw || `HTTP ${res.status}`).slice(0, 200);
      this.log.warn(`SMS to ${phone} failed: ${raw.slice(0, 300)}`);
      return { ok: false, error };
    } catch (e: any) {
      this.log.warn(`SMS to ${phone} error: ${e?.message}`);
      return { ok: false, error: String(e?.message || e).slice(0, 200) };
    }
  }
}

@Module({ providers: [SmsService], exports: [SmsService] })
export class SmsModule {}