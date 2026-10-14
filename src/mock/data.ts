import type {
  Room,
  RoomOccupant,
} from "../types";

const occupant = (
  id: string,
  roomId: string,
  fullName: string,
  phone: string
): RoomOccupant => ({
  id,
  roomId,
  fullName,
  phone,
  isActive: true,
});

export const initialRooms: Room[] = [
  {
    id: "room-101",
    roomNumber: "101",
    floor: 1,
    status: "OCCUPIED",
    maxOccupants: 3,
    occupants: [
      occupant(
        "occupant-101-1",
        "room-101",
        "Nguyễn Văn A",
        "0901234567"
      ),
    ],
  },

  {
    id: "room-102",
    roomNumber: "102",
    floor: 1,
    status: "EMPTY",
    maxOccupants: 3,
    occupants: [],
  },

  {
    id: "room-201",
    roomNumber: "201",
    floor: 2,
    status: "EMPTY",
    maxOccupants: 3,
    occupants: [],
  },

  {
    id: "room-202",
    roomNumber: "202",
    floor: 2,
    status: "EMPTY",
    maxOccupants: 3,
    occupants: [],
  },

  {
    id: "room-301",
    roomNumber: "301",
    floor: 3,
    status: "EMPTY",
    maxOccupants: 3,
    occupants: [],
  },

  {
    id: "room-302",
    roomNumber: "302",
    floor: 3,
    status: "EMPTY",
    maxOccupants: 3,
    occupants: [],
  },
];