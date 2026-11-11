const escapeValue = (value: string): string => value.replace(/\\/g, '\\\\');

/**
 * The NetworkManager connection balenaOS reads from `system-connections/resin-wifi-01` in the boot partition.
 * balenaOS ignores `wifiSsid` and `wifiKey` inside config.json, so a drive that only gets config.json never joins
 * the Wi-Fi network. Same content the server writes into a full image. Undefined when the config has no network.
 */
export const wifiConnectionFile = (config: Record<string, unknown>): string | undefined => {
  const ssid = typeof config.wifiSsid === 'string' ? config.wifiSsid : '';
  if (!ssid) return undefined;
  const key = typeof config.wifiKey === 'string' ? config.wifiKey : '';
  const lines = ['[connection]', 'id=resin-wifi-01', 'type=wifi', '', '[wifi]', 'hidden=true', 'mode=infrastructure', `ssid=${escapeValue(ssid)}`, ''];
  if (key) lines.push('[wifi-security]', 'auth-alg=open', 'key-mgmt=wpa-psk', `psk=${escapeValue(key)}`, '');
  lines.push('[ipv4]', 'method=auto', '', '[ipv6]', 'addr-gen-mode=stable-privacy', 'method=auto', '');
  return lines.join('\n');
};
