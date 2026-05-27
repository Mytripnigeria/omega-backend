import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

/** Result of a best-effort ESC/POS delivery. Never throws — see usage in PrintersService. */
export interface EscPosDeliveryResult {
  ok: boolean;
  error?: string;
  /** Resolved host:port we attempted to connect to, for logging. */
  target?: string;
}

/** Default ESC/POS over IP port. Standard for receipt printers. */
const DEFAULT_PORT = 9100;
/** Hard cap on connection + write attempts. */
const SOCKET_TIMEOUT_MS = 3_000;

/**
 * Minimal ESC/POS payload builder + TCP delivery for network thermal printers.
 *
 * For non-network printers we don't attempt delivery here — the print job stays
 * in `queued` status for whatever downstream worker is responsible for USB/Bluetooth
 * delivery (e.g. a per-store agent). That keeps the cloud backend simple and
 * delivery-method agnostic.
 */
@Injectable()
export class EscPosSender {
  private readonly logger = new Logger(EscPosSender.name);

  /**
   * Builds a tiny ESC/POS test-page payload: initialize, three centered title
   * lines (printer name + timestamp + a marker), then feed + cut.
   */
  buildTestPayload(printerName: string, now = new Date()): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;
    const buf: number[] = [];

    // ESC @ — initialize printer
    buf.push(ESC, 0x40);
    // ESC a 1 — center align
    buf.push(ESC, 0x61, 0x01);
    // GS ! 0x11 — double height & width
    buf.push(GS, 0x21, 0x11);
    this.appendText(buf, 'TEST PRINT\n');
    // GS ! 0x00 — reset size
    buf.push(GS, 0x21, 0x00);
    this.appendText(buf, `${printerName}\n`);
    this.appendText(buf, `${now.toISOString()}\n`);
    this.appendText(buf, '------------------------\n');
    this.appendText(buf, 'If you can read this,\nthe printer is online.\n\n\n');
    // GS V 1 — partial cut (works on most ESC/POS thermal printers)
    buf.push(GS, 0x56, 0x01);

    return Buffer.from(buf);
  }

  /**
   * Parses a printer address into host + port. Accepts:
   *   "192.168.1.100"        → host with default port (9100)
   *   "192.168.1.100:9100"   → explicit port
   *   "[2001:db8::1]:9100"   → IPv6 with port
   */
  parseAddress(address: string): { host: string; port: number } | null {
    if (!address) return null;
    const trimmed = address.trim();
    if (!trimmed) return null;

    // IPv6 form [host]:port
    const v6 = /^\[(.+)\]:(\d+)$/.exec(trimmed);
    if (v6) return { host: v6[1], port: Number.parseInt(v6[2], 10) };

    // host:port (only if there's exactly one colon — IPv6 bare addresses must use [])
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const port = Number.parseInt(parts[1], 10);
      if (Number.isFinite(port) && port > 0) return { host: parts[0], port };
    }
    if (parts.length === 1) return { host: parts[0], port: DEFAULT_PORT };
    // 2+ colons without brackets → invalid IPv6.
    return null;
  }

  /**
   * Best-effort delivery. Always resolves — failures come back as `ok: false`.
   */
  async sendOverTcp(address: string, payload: Buffer): Promise<EscPosDeliveryResult> {
    const parsed = this.parseAddress(address);
    if (!parsed) {
      return { ok: false, error: `Invalid printer address: "${address}"` };
    }
    const target = `${parsed.host}:${parsed.port}`;

    return new Promise<EscPosDeliveryResult>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (result: EscPosDeliveryResult) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        resolve(result);
      };

      socket.setTimeout(SOCKET_TIMEOUT_MS);
      socket.once('error', (err) => {
        this.logger.warn(`Print delivery error ${target}: ${err.message}`);
        finish({ ok: false, error: err.message, target });
      });
      socket.once('timeout', () => {
        finish({ ok: false, error: 'Connection timeout', target });
      });
      socket.once('connect', () => {
        socket.write(payload, (writeErr) => {
          if (writeErr) {
            finish({ ok: false, error: writeErr.message, target });
            return;
          }
          // Give the printer a beat to consume the buffer before we close.
          socket.end(() => finish({ ok: true, target }));
        });
      });

      try {
        socket.connect(parsed.port, parsed.host);
      } catch (err) {
        finish({
          ok: false,
          error: (err as Error).message ?? 'connect threw',
          target,
        });
      }
    });
  }

  private appendText(buf: number[], text: string) {
    for (let i = 0; i < text.length; i++) {
      buf.push(text.charCodeAt(i));
    }
  }
}
