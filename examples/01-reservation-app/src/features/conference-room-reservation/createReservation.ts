// Reservation creation workflow implementing AC 1..6 and client decisions Q-001-01 / Q-001-02

import {
  ConferenceRoomReservation,
  ROOM_CATALOG,
  ReservationInput,
  ReservationStatus,
  ValidationIssue,
} from "./types";
import { validateReservation } from "./validateReservation";

export type CreateReservationResult =
  | { ok: true; reservation: ConferenceRoomReservation }
  | { ok: false; errors: ValidationIssue[] };

const APPROVAL_ATTENDEE_THRESHOLD = 10;

/**
 * Validate and create a conference room reservation record (AC 1..6).
 */
export function createReservation(
  input: ReservationInput,
  options: {
    today: string;
    existingReservations?: ConferenceRoomReservation[];
    nextId?: string;
  }
): CreateReservationResult {
  const errors = validateReservation(input, options);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const room = ROOM_CATALOG[input.roomId];

  // AC 6 (Q-001-01): ROOM-EXEC or attendeeCount > 10 requires manager approval
  const status: ReservationStatus =
    room.alwaysRequiresApproval || input.attendeeCount > APPROVAL_ATTENDEE_THRESHOLD
      ? "PENDING_APPROVAL"
      : "CONFIRMED";

  // AC 6 (Q-001-02): ROOM-EXEC has a permanent projector so requiresProjector is always true
  const requiresProjector = room.fixedProjector ? true : Boolean(input.requiresProjector);

  const reservation: ConferenceRoomReservation = {
    id: options.nextId ?? `RES-${input.reservationDate.replace(/-/g, "")}-001`,
    roomId: input.roomId,
    organizerEmail: input.organizerEmail.trim().toLowerCase(),
    reservationDate: input.reservationDate,
    startTime: input.startTime,
    endTime: input.endTime,
    attendeeCount: input.attendeeCount,
    requiresProjector,
    status,
  };

  return { ok: true, reservation };
}
