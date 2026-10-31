// Domain types and room catalog for 001-conference-room-reservation (AC 1..6)

export type RoomId = "ROOM-A" | "ROOM-B" | "ROOM-EXEC";

export type ReservationStatus = "CONFIRMED" | "PENDING_APPROVAL";

export type ReservationErrorCode =
  | "ERR-RES-001"
  | "ERR-RES-002"
  | "ERR-RES-003"
  | "ERR-RES-004"
  | "ERR-RES-005";

export interface RoomSpec {
  id: RoomId;
  nameJp: string;
  capacity: number;
  alwaysRequiresApproval: boolean;
  fixedProjector: boolean;
}

export const ROOM_CATALOG: Record<RoomId, RoomSpec> = {
  "ROOM-A": {
    id: "ROOM-A",
    nameJp: "大会議室A",
    capacity: 20,
    alwaysRequiresApproval: false,
    fixedProjector: false,
  },
  "ROOM-B": {
    id: "ROOM-B",
    nameJp: "小会議室B",
    capacity: 8,
    alwaysRequiresApproval: false,
    fixedProjector: false,
  },
  "ROOM-EXEC": {
    id: "ROOM-EXEC",
    nameJp: "役員会議室",
    capacity: 12,
    alwaysRequiresApproval: true,
    fixedProjector: true,
  },
};

export const ERROR_MESSAGES_JP: Record<ReservationErrorCode, string> = {
  "ERR-RES-001": "社内メールアドレス（@example.co.jp）を入力してください。",
  "ERR-RES-002": "利用日は本日以降の営業日を指定してください。",
  "ERR-RES-003": "利用時間は09:00〜18:00の間で30分単位、最大4時間以内で指定してください。",
  "ERR-RES-004": "参加人数が会議室の定員を超えています。",
  "ERR-RES-005": "指定された時間帯は既に予約されています。",
};

export interface ReservationInput {
  roomId: RoomId;
  organizerEmail: string;
  reservationDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  attendeeCount: number;
  requiresProjector?: boolean;
}

export interface ConferenceRoomReservation {
  id: string;
  roomId: RoomId;
  organizerEmail: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  requiresProjector: boolean;
  status: ReservationStatus;
}

export interface ValidationIssue {
  code: ReservationErrorCode;
  field: string;
  message: string;
}
