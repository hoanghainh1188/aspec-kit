// Unit tests for 001-conference-room-reservation covering AC 1..6

import { describe, expect, it } from "vitest";
import { createReservation } from "./createReservation";
import { ConferenceRoomReservation, ReservationInput } from "./types";

const TODAY = "2026-11-02"; // Monday

function validInput(overrides: Partial<ReservationInput> = {}): ReservationInput {
  return {
    roomId: "ROOM-A",
    organizerEmail: "taro.tanaka@example.co.jp",
    reservationDate: "2026-11-04", // Wednesday
    startTime: "10:00",
    endTime: "11:30",
    attendeeCount: 6,
    requiresProjector: false,
    ...overrides,
  };
}

describe("001-conference-room-reservation", () => {
  it("AC 1: rejects empty or non-corporate organizerEmail with ERR-RES-001", () => {
    const emptyRes = createReservation(validInput({ organizerEmail: "   " }), { today: TODAY });
    expect(emptyRes.ok).toBe(false);
    if (!emptyRes.ok) {
      expect(emptyRes.errors.map((e) => e.code)).toContain("ERR-RES-001");
    }

    const externalRes = createReservation(validInput({ organizerEmail: "user@gmail.com" }), {
      today: TODAY,
    });
    expect(externalRes.ok).toBe(false);
    if (!externalRes.ok) {
      expect(externalRes.errors.map((e) => e.code)).toContain("ERR-RES-001");
    }
  });

  it("AC 2: rejects past dates and weekends with ERR-RES-002", () => {
    const pastRes = createReservation(validInput({ reservationDate: "2026-10-30" }), {
      today: TODAY,
    });
    expect(pastRes.ok).toBe(false);
    if (!pastRes.ok) {
      expect(pastRes.errors.map((e) => e.code)).toContain("ERR-RES-002");
    }

    const saturdayRes = createReservation(validInput({ reservationDate: "2026-11-07" }), {
      today: TODAY,
    });
    expect(saturdayRes.ok).toBe(false);
    if (!saturdayRes.ok) {
      expect(saturdayRes.errors.map((e) => e.code)).toContain("ERR-RES-002");
    }
  });

  it("AC 3: rejects non-30-min slots, out-of-hours, or duration > 240 mins with ERR-RES-003", () => {
    const oddSlot = createReservation(validInput({ startTime: "10:15", endTime: "11:00" }), {
      today: TODAY,
    });
    expect(oddSlot.ok).toBe(false);
    if (!oddSlot.ok) {
      expect(oddSlot.errors.map((e) => e.code)).toContain("ERR-RES-003");
    }

    const tooLong = createReservation(validInput({ startTime: "09:00", endTime: "13:30" }), {
      today: TODAY,
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.errors.map((e) => e.code)).toContain("ERR-RES-003");
    }
  });

  it("AC 4: rejects attendeeCount < 1 or exceeding room capacity with ERR-RES-004", () => {
    const zeroAttendees = createReservation(validInput({ attendeeCount: 0 }), { today: TODAY });
    expect(zeroAttendees.ok).toBe(false);
    if (!zeroAttendees.ok) {
      expect(zeroAttendees.errors.map((e) => e.code)).toContain("ERR-RES-004");
    }

    const overRoomB = createReservation(validInput({ roomId: "ROOM-B", attendeeCount: 9 }), {
      today: TODAY,
    });
    expect(overRoomB.ok).toBe(false);
    if (!overRoomB.ok) {
      expect(overRoomB.errors.map((e) => e.code)).toContain("ERR-RES-004");
    }
  });

  it("AC 5: rejects overlapping time slots with ERR-RES-005 and allows back-to-back bookings", () => {
    const existing: ConferenceRoomReservation[] = [
      {
        id: "RES-20261104-001",
        roomId: "ROOM-A",
        organizerEmail: "hanako.suzuki@example.co.jp",
        reservationDate: "2026-11-04",
        startTime: "10:00",
        endTime: "11:00",
        attendeeCount: 4,
        requiresProjector: false,
        status: "CONFIRMED",
      },
    ];

    const overlap = createReservation(validInput({ startTime: "10:30", endTime: "11:30" }), {
      today: TODAY,
      existingReservations: existing,
    });
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) {
      expect(overlap.errors.map((e) => e.code)).toContain("ERR-RES-005");
    }

    const adjacent = createReservation(validInput({ startTime: "11:00", endTime: "12:00" }), {
      today: TODAY,
      existingReservations: existing,
    });
    expect(adjacent.ok).toBe(true);
  });

  it("AC 6: assigns CONFIRMED vs PENDING_APPROVAL and normalizes ROOM-EXEC projector (Q-001-01, Q-001-02)", () => {
    // Exactly 10 attendees in ROOM-A -> CONFIRMED
    const tenInRoomA = createReservation(validInput({ roomId: "ROOM-A", attendeeCount: 10 }), {
      today: TODAY,
    });
    expect(tenInRoomA.ok).toBe(true);
    if (tenInRoomA.ok) {
      expect(tenInRoomA.reservation.status).toBe("CONFIRMED");
    }

    // 11 attendees in ROOM-A -> PENDING_APPROVAL
    const elevenInRoomA = createReservation(validInput({ roomId: "ROOM-A", attendeeCount: 11 }), {
      today: TODAY,
    });
    expect(elevenInRoomA.ok).toBe(true);
    if (elevenInRoomA.ok) {
      expect(elevenInRoomA.reservation.status).toBe("PENDING_APPROVAL");
    }

    // ROOM-EXEC with 4 attendees and requiresProjector: false -> PENDING_APPROVAL & requiresProjector: true
    const execRoom = createReservation(
      validInput({ roomId: "ROOM-EXEC", attendeeCount: 4, requiresProjector: false }),
      { today: TODAY }
    );
    expect(execRoom.ok).toBe(true);
    if (execRoom.ok) {
      expect(execRoom.reservation.status).toBe("PENDING_APPROVAL");
      expect(execRoom.reservation.requiresProjector).toBe(true);
    }
  });
});
