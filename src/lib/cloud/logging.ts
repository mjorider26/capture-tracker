import "server-only";

export function logServerEvent(event: string, fields: Record<string, string | number | boolean> = {}) {
  const allowed = Object.fromEntries(Object.entries(fields).filter(([key]) => !/url|secret|password|token|key|body/i.test(key)));
  console.log(JSON.stringify({ event, ...allowed }));
}
