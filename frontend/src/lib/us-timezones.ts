// US state-code → dominant IANA timezone mapping (all 50 + DC).
// For states that span multiple zones, the most populous zone is used:
//   AK → Anchorage (Juneau / Anchorage are both there; Anchorage is largest)
//   TX → Chicago (CT covers ~all major metros; El Paso is MT but tiny share)
//   FL → New_York (Eastern covers Miami/Tampa/Orlando; Panhandle is CT)
//   TN → Chicago (Nashville/Memphis are CT; Knoxville/Chattanooga are ET but smaller)
//   KY → New_York (Louisville/Lexington are ET; western KY is CT but smaller)
//   IN → New_York (Indianapolis is ET; a few NW/SW counties are CT)
//   MI → New_York (Lower Peninsula ET dominates; UP western tip is CT)
//   KS → Chicago (most is CT; far west is MT but small)
//   NE → Chicago (most is CT; panhandle MT but small)
//   SD → Chicago (Sioux Falls CT; west river MT but smaller)
//   ND → Chicago (Fargo/Bismarck CT; west small slice MT)
//   OR → Los_Angeles (almost all PT; Malheur County MT but tiny)
//   ID → Boise (south is MT; panhandle is PT but smaller population)
//   ND/SD/etc. — same logic
export const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

/**
 * Format the local time for a US state as "2:34 PM PST" (or similar abbrev).
 * Returns null if the state code is unknown.
 *
 * @param state Two-letter state code (e.g. "CA", "NY"). Case-insensitive.
 * @param now   Optional Date — defaults to `new Date()`. Useful for tests.
 */
export function getStateLocalTime(state: string | null | undefined, now: Date = new Date()): string | null {
  if (!state) return null;
  const code = state.trim().toUpperCase();
  const tz = STATE_TZ[code];
  if (!tz) return null;
  try {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
    const zoneAbbrev = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return zoneAbbrev ? `${time} ${zoneAbbrev}` : time;
  } catch {
    return null;
  }
}

export function getStateTimezone(state: string | null | undefined): string | null {
  if (!state) return null;
  return STATE_TZ[state.trim().toUpperCase()] ?? null;
}
