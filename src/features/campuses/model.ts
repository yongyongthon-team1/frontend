export interface Vacation {
  startDate: string;
  endDate: string;
  label: string | null;
}

export interface University {
  id: number;
  name: string;
  shortName: string;
  campusName: string;
  address: string | null;
  lat: number;
  lng: number;
  administrativeDong: string | null;
  vacations: Vacation[];
}

export interface Insight {
  universityId: number;
  title: string;
  text: string;
  source: string;
  isPlaceholder: boolean;
}
