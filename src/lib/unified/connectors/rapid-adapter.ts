import { fetchNormalizedHotelsForProvider } from "@/lib/hotel-api";
import type {
  ConnectorPullAvailabilityParams,
  ConnectorPullHotelsParams,
  PmsConnector,
} from "@/lib/unified/connectors/types";

export class RapidPmsConnector implements PmsConnector {
  providerCode = "rapid";

  async pullHotels(params: ConnectorPullHotelsParams): Promise<unknown[]> {
    const result = await fetchNormalizedHotelsForProvider({
      providerId: params.providerId,
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      guests: params.guests,
      includeAvailability: params.includeAvailability,
    });

    return result.hotels;
  }

  async pullAvailability(params: ConnectorPullAvailabilityParams): Promise<unknown> {
    return {
      providerCode: this.providerCode,
      externalHotelIds: params.externalHotelIds,
      checkIn: params.checkIn.toISOString(),
      checkOut: params.checkOut.toISOString(),
      guests: params.guests,
      mode: "included-in-pullHotels",
    };
  }
}
