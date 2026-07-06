import { Projector, Monitor, Presentation, AirVent, Tv } from "lucide-react";
import type { RoomFeature } from "@/types/rooms";

// Icon per room feature — shared by the modal, room cards, and timetable tooltips.
export const FEATURE_ICON: Record<RoomFeature, React.ElementType> = {
  projector: Projector,
  computers: Monitor,
  whiteboard: Presentation,
  ac: AirVent,
  tv: Tv,
};
