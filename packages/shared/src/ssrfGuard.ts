import dns from 'dns/promises';
import { BadRequestError } from './errors.js';

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-Local / Cloud Metadata)
  if (a === 169 && b === 254) return true;
  // Broadcast
  if (a === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true;
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.includes('::ffff:')) {
    const v4 = lower.split('::ffff:')[1];
    if (v4 && isPrivateIPv4(v4)) return true;
  }
  return false;
}

export async function validateSafeUrl(urlString: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new BadRequestError('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError(`Protocol ${parsed.protocol} is not supported. Use http or https.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new BadRequestError(`Internal hostname "${hostname}" is forbidden for security.`);
  }

  try {
    const lookup = await dns.lookup(hostname, { all: true });

    if (!lookup || lookup.length === 0) {
      throw new BadRequestError(`Could not resolve hostname "${hostname}".`);
    }

    for (const record of lookup) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        throw new BadRequestError(
          `URL resolves to private IPv4 address (${record.address}). Access denied.`
        );
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        throw new BadRequestError(
          `URL resolves to private IPv6 address (${record.address}). Access denied.`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
  }

  parsed.hash = '';
  return parsed.toString();
}
