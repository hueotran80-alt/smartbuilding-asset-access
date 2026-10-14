import { supabase } from './supabase';
import type { Room, RoomStatus, RoomOccupant } from '../types';

export async function getRooms(): Promise<Room[]> {
  if (!supabase) {
    throw new Error('Supabase chua duoc cau hinh.');
  }

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id,room_number,floor,status,max_occupants')
    .order('floor', { ascending: true })
    .order('room_number', { ascending: true });

  if (roomsError) {
    throw new Error(
      'Khong doc duoc danh sach phong: ' + roomsError.message
    );
  }

  const { data: occupants, error: occupantsError } = await supabase
    .from('room_occupants')
    .select(
      'id,room_id,full_name,phone,date_of_birth,identity_number,is_active,created_at,updated_at'
    )
    .order('created_at', { ascending: true });

  if (occupantsError) {
    throw new Error(
      'Khong doc duoc danh sach nguoi o: ' + occupantsError.message
    );
  }

  return (rooms ?? []).map((room) => ({
    id: room.id,
    roomNumber: room.room_number,
    floor: room.floor,
    status: room.status as RoomStatus,
    maxOccupants: room.max_occupants,
    occupants: (occupants ?? [])
      .filter(
        (occupant) =>
          occupant.room_id === room.id && occupant.is_active !== false
      )
      .map(
        (occupant): RoomOccupant => ({
          id: occupant.id,
          roomId: occupant.room_id,
          fullName: occupant.full_name,
          phone: occupant.phone ?? '',
          dateOfBirth: occupant.date_of_birth ?? null,
          identityNumber: occupant.identity_number ?? null,
          isActive: occupant.is_active,
          createdAt: occupant.created_at,
          updatedAt: occupant.updated_at,
        })
      ),
  }));
}

/**
 * Giữ function này để tương thích với App hiện tại.
 *
 * Trạng thái phòng thực tế được database tự động cập nhật
 * dựa trên số lượng room_occupants đang active.
 */
export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase chua duoc cau hinh.');
  }

  const { error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', roomId);

  if (error) {
    throw new Error(
      'Khong the cap nhat trang thai phong: ' + error.message
    );
  }
}

/**
 * Lưu một người ở vào room_occupants.
 *
 * Lưu ý:
 * - Occupant không phải tài khoản Gmail.
 * - Email/userId không còn được lưu trong bảng này.
 * - rooms.status được trigger database tự động cập nhật.
 */
export async function saveOccupantToRoom(
  roomId: string,
  occupant: RoomOccupant
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase chua duoc cau hinh.');
  }

  const { error } = await supabase
    .from('room_occupants')
    .upsert(
      {
        id: occupant.id,
        room_id: roomId,
        full_name: occupant.fullName.trim(),
        phone: occupant.phone.trim() || null,
        date_of_birth: occupant.dateOfBirth || null,
        identity_number: occupant.identityNumber?.trim() || null,
        is_active: occupant.isActive,
      },
      {
        onConflict: 'id',
      }
    );

  if (error) {
    throw new Error(
      'Khong the luu nguoi o: ' + error.message
    );
  }
}

/**
 * Giữ tên cũ tạm thời để App hiện tại không phải sửa ngay.
 *
 * Bên trong đã chuyển sang schema room_occupants mới.
 */
export const saveTenantToRoom = saveOccupantToRoom;

export function subscribeRooms(onChange: () => void): () => void {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('rooms-and-occupants')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_occupants',
      },
      () => onChange()
    )
    .subscribe((status) =>
      console.log('[Realtime rooms/room_occupants]', status)
    );

  return () => {
    void supabase.removeChannel(channel);
  };
}