// Dates on screen are Turkey dates. Pages render on the server (UTC container) and again in the browser (Turkey):
// without a fixed time zone a time between 21:00 and 24:00 UTC printed as two different days, and React reported a
// hydration mismatch (error #418, seen on /notlar). Use with toLocaleDateString / toLocaleString("tr-TR", ...).
export const TR_TZ = "Europe/Istanbul";
export const TR_DATE = { timeZone: TR_TZ } as const;
