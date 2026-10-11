import ipaddr from 'ipaddr.js';

/** Syntax-only gate. It never resolves or connects to a target. */
// eslint-disable-next-line no-control-regex -- Reject attacker-supplied ASCII controls before WHATWG parsing.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\\]/u;
export function normalizeUrl(input: string): string {
  if (
    typeof input !== 'string' ||
    input.length > 4096 ||
    CONTROL_CHARACTERS.test(input) ||
    /%(?:00|0a|0d)/i.test(input)
  )
    throw new Error('Enter a valid public HTTP or HTTPS URL (up to 4096 characters).');
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) throw new Error('Include https:// or http:// in the URL.');
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || /[%@]/.test(authority))
    throw new Error('Encoded hosts and URL credentials are not allowed.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('This URL could not be parsed.');
  }
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol))
    throw new Error('URL credentials and non-HTTP schemes are not allowed.');
  if (url.port) throw new Error('Only the default HTTP and HTTPS ports are allowed.');
  const host = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  const rawHost = authority.startsWith('[')
    ? authority.slice(1, authority.indexOf(']'))
    : authority.split(':')[0].toLowerCase();
  if (ipaddr.isValid(host)) {
    const address = ipaddr.parse(host);
    if (address.range() !== 'unicast')
      throw new Error('Private, reserved and nonpublic addresses are not allowed.');
    if (address.kind() === 'ipv4' && rawHost !== host)
      throw new Error('Ambiguous numeric IP encodings are not allowed.');
    if (address.kind() === 'ipv6' && (address as ipaddr.IPv6).isIPv4MappedAddress())
      throw new Error('Mapped IPv6 addresses are not allowed.');
  } else {
    if (
      !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|onion)$/i.test(host)
    )
      throw new Error('Internal or nonpublic hostnames are not allowed.');
    if (
      host.length > 253 ||
      host.split('.').some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))
    )
      throw new Error('The hostname is malformed.');
  }
  url.hostname = url.hostname.startsWith('[') ? `[${host}]` : host;
  url.hash = '';
  return url.toString();
}
