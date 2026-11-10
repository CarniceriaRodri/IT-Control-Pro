/** Operaciones IPv4 deterministas, sin utilizar la red. */
export interface IPv4Analysis {
  ip: string;
  prefix: number;
  mask: string;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  usable: number;
  type: string;
  gateway?: string;
  gatewayStatus?: string;
}
export function ipv4Number(value: string): number | undefined {
  const parts = value.trim().split(".");
  if (parts.length !== 4 || parts.some((part) =>
    !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255
  )) return undefined;
  return parts.reduce((n, part) => n * 256 + Number(part), 0) >>> 0;
}
export const ipv4Text = (value: number) =>
  [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
export function prefixNumber(mask: string): number | undefined {
  const value = mask.trim().replace(/^\//, "");
  if (/^(0|[1-9][0-9]?)$/.test(value)) {
    const n = Number(value);
    return n <= 32 ? n : undefined;
  }
  const parsed = ipv4Number(value);
  if (parsed === undefined) return undefined;
  const bits = (parsed >>> 0).toString(2).padStart(32, "0");
  if (!/^1*0*$/.test(bits)) return undefined;
  return bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
}
export function analyzeIPv4(ip: string, prefixOrMask = "24", gateway = ""): IPv4Analysis {
  const address = ipv4Number(ip);
  const prefix = prefixNumber(prefixOrMask);
  if (address === undefined) throw Error("Escribe una dirección IPv4 válida, por ejemplo 192.168.1.10.");
  if (prefix === undefined) throw Error("Máscara inválida. Ejemplos: 24, /24 o 255.255.255.0.");
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const first = prefix >= 31 ? network : (network + 1) >>> 0;
  const last = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
  const firstOctet = address >>> 24;
  const second = (address >>> 16) & 255;
  let type = "Pública o de uso especial";
  if (firstOctet === 10 || (firstOctet === 172 && second >= 16 && second <= 31) ||
    (firstOctet === 192 && second === 168)) type = "Privada (RFC 1918)";
  else if (firstOctet === 127) type = "Loopback (equipo local)";
  else if (firstOctet === 169 && second === 254) type = "Local de enlace (APIPA)";
  else if (firstOctet >= 224 && firstOctet <= 239) type = "Multidifusión";
  const result: IPv4Analysis = {
    ip: ipv4Text(address), prefix, mask: ipv4Text(mask),
    network: ipv4Text(network), broadcast: ipv4Text(broadcast),
    first: ipv4Text(first), last: ipv4Text(last),
    usable: prefix === 32 ? 1 : prefix === 31 ? 2 : 2 ** (32 - prefix) - 2, type,
  };
  if (gateway.trim()) {
    const gw = ipv4Number(gateway);
    if (gw === undefined) throw Error("La puerta de enlace no es una IPv4 válida.");
    result.gateway = ipv4Text(gw);
    result.gatewayStatus = (gw & mask) >>> 0 !== network
      ? "La puerta de enlace no pertenece a la misma subred."
      : prefix < 31 && (gw === network || gw === broadcast)
        ? "La puerta de enlace es una dirección reservada de esta subred."
        : gw === address
          ? "La puerta de enlace coincide con la dirección del equipo."
          : "La puerta de enlace está en la misma subred.";
  }
  return result;
}
