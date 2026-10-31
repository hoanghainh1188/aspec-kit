// Pure validation rules for SCR-RES-01 conference room reservation (AC 1, AC 2, AC 3, AC 4, AC 5)

import {
  ConferenceRoomReservation,
  ERROR_MESSAGES_JP,
  ROOM_CATALOG,
  ReservationErrorCode,
  ReservationInput,
  ValidationIssue,
} from "./types";

const CORPORATE_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@example\.co\.jp$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const OPEN_MINUTES = 9 * 60; // 09:00
const CLOSE_MINUTES = 18 * 60; // 18:00
const MAX_DURATION_MINUTES = 240; // 4 hours

function issue(code: ReservationErrorCode, field: string): ValidationIssue {
  return { code, field, message: ERROR_MESSAGES_JP[code] };
}

/** Parse HH:MM into minutes since midnight, or null if invalid or not on a 30-minute boundary. */
export function parseSlotMinutes(hhmm: string): number | null {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || (minutes !== 0 && minutes !== 30)) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Check whether a YYYY-MM-DD string represents a valid calendar date and return its UTC Date. */
function parseIsoDate(ymd: string): Date | null {
  const m = DATE_RE.exec(ymd.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/**
 * Validate a reservation request against DD-RES-001 v1.1 rules (AC 1..5).
 */
export function validateReservation(
  input: ReservationInput,
  options: {
    today: string;
    existingReservations?: Pick<
      ConferenceRoomReservation,
      "roomId" | "reservationDate" | "startTime" | "endTime"
    >[];
  }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // AC 1: Corporate email (@example.co.jp)
  const email = (input.organizerEmail ?? "").trim();
  if (!email || !CORPORATE_EMAIL_RE.test(email)) {
    issues.push(issue("ERR-RES-001", "organizerEmail"));
  }

  // AC 2: Business day on or after today
  const targetDate = parseIsoDate(input.reservationDate ?? "");
  const todayDate = parseIsoDate(options.today);
  if (!targetDate || !todayDate || targetDate.getTime() < todayDate.getTime()) {
    issues.push(issue("ERR-RES-002", "reservationDate"));
  } else {
    const dow = targetDate.getUTCDay();
    if (dow === 0 || dow === 6) {
      issues.push(issue("ERR-RES-002", "reservationDate"));
    }
  }

  // AC 3: Business hours (09:00..18:00), 30-min increments, duration 30..240 mins
  const startMin = parseSlotMinutes(input.startTime ?? "");
  const endMin = parseSlotMinutes(input.endTime ?? "");
  if (
    startMin === null ||
    endMin === null ||
    startMin < OPEN_MINUTES ||
    endMin > CLOSE_MINUTES ||
    endMin <= startMin ||
    endMin - startMin > MAX_DURATION_MINUTES
  ) {
    issues.push(issue("ERR-RES-003", "startTime/endTime"));
  }

  // AC 4: Room existence & attendee capacity
  const room = ROOM_CATALOG[input.roomId];
  if (
    !room ||
    !Number.isInteger(input.attendeeCount) ||
    input.attendeeCount < 1 ||
    input.attendeeCount > room.capacity
  ) {
    issues.push(issue("ERR-RES-004", "attendeeCount"));
  }

  // AC 5: Half-open interval overlap [startMin, endMin) on the same room and date
  if (room && startMin !== null && endMin !== null && endMin > startMin) {
    const existing = options.existingReservations ?? [];
    const hasConflict = existing.some((r) => {
      if (r.roomId !== input.roomId || r.reservationDate !== input.reservationDate) {
        return false;
      }
      const exStart = parseSlotMinutes(r.startTime);
      const exEnd = parseSlotMinutes(r.endTime);
      if (exStart === null || exEnd === null) return false;
      return exStart < endMin && startMin < exEnd;
    });
    if (hasConflict) {
      issues.push(issue("ERR-RES-005", "startTime/endTime"));
    }
  }

  return issues;
}
