export type GeolocatedCase = {
  id: string;
  reference: string;
  description: string;
  priority: string;
  status: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
};

export type GeolocatedReport = {
  id: string;
  description: string | null;
  status: string;
  latitude: number;
  longitude: number;
  submittedAt: Date | null;
};

export type GeolocatedIntervention = {
  id: string;
  startedAt: Date | null;
  endedAt: Date | null;
  status: string;
  result: string | null;
  assignmentId: string;
  assignedAt: Date;
  teamName: string;
  caseReference: string;
  caseDescription: string | null;
  casePriority: string;
  latitude: number;
  longitude: number;
};

export type NonGeolocatedReport = {
  id: string;
  description: string | null;
  locationDescription: string | null;
  status: string;
  submittedAt: Date | null;
};

export type MapData = {
  cases: GeolocatedCase[];
  reports: GeolocatedReport[];
  interventions: GeolocatedIntervention[];
  nonGeolocatedReports: NonGeolocatedReport[];
};

export interface CarteStatsRepository {
  getMapData(): Promise<MapData>;
  countReports(): Promise<number>;
  countCases(): Promise<number>;
  countResolvedCases(): Promise<number>;
  countAssignments(): Promise<number>;
  countCompletedInterventions(): Promise<number>;
  countVerifiedResolutions(): Promise<number>;
  countReopenings(): Promise<number>;
}
