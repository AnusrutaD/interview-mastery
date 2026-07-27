// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns a Date representing the start of today (midnight) in IST,
 * expressed as a UTC timestamp — works correctly on both server and client.
 */
export function getISTMidnight() {
  const now = new Date();
  // Shift to IST "clock time" in UTC fields
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  // Midnight of that IST day (in UTC fields)
  const istMidnight = new Date(Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
    0, 0, 0, 0
  ));
  // Shift back to real UTC
  return new Date(istMidnight.getTime() - IST_OFFSET_MS);
}

/**
 * Returns the IST date key string "YYYY-M-D" for a given Date.
 * Used for streak calculation.
 */
export function istDayKey(date) {
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${ist.getUTCMonth()}-${ist.getUTCDate()}`;
}
