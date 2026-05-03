export type ConnectorPullHotelsParams = {
  providerId: string;
  checkIn?: Date;
  checkOut?: Date;
  guests?: number;
  includeAvailability?: boolean;
};
export type ConnectorPullAvailabilityParams = {
  externalHotelIds: string[];
  checkIn: Date;
  checkOut: Date;
  guests: number;
};

export interface PmsConnector {
  providerCode: string;
  pullHotels(params: ConnectorPullHotelsParams): Promise<unknown[]>;
  pullAvailability(params: ConnectorPullAvailabilityParams): Promise<unknown>;
  createReservation?(payload: unknown): Promise<unknown>;
}
