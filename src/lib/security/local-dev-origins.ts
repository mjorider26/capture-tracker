function isPrivateLanIpv4(origin: string) {
  const octets = origin.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
    )
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function localDevOrigins(value = process.env.CAPTURE_TRACKER_DEV_ORIGINS) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(isPrivateLanIpv4);
}
