import { NextResponse } from "next/server";

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "BookMeNow Mock PMS API",
    version: "1.0.0",
    description:
      "Mock hotel booking API for SiteMinder / Opera Cloud / Optima style integrations. Includes 50 realistic hotels with dynamic availability, reservation lifecycle, and inventory webhook simulation.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
    {
      url: "https://bookmenow-7f4f2.web.app",
      description: "Firebase Hosting",
    },
  ],
  tags: [
    { name: "Hotels", description: "Hotel catalog endpoints" },
    { name: "Availability", description: "Date-based inventory and pricing" },
    { name: "Reservations", description: "Booking create/cancel operations" },
    { name: "Webhooks", description: "Inventory and price update simulation" },
  ],
  paths: {
    "/api/hotels": {
      get: {
        tags: ["Hotels"],
        summary: "List hotels",
        description: "Returns up to 50 hotels in provider-flavored schema (siteminder/opera/optima).",
        parameters: [
          {
            name: "provider",
            in: "query",
            schema: { $ref: "#/components/schemas/Provider" },
            required: false,
          },
          { name: "city", in: "query", schema: { type: "string" }, required: false },
          { name: "stars", in: "query", schema: { type: "integer", minimum: 1, maximum: 5 }, required: false },
          { name: "minPrice", in: "query", schema: { type: "number", minimum: 0 }, required: false },
          { name: "maxPrice", in: "query", schema: { type: "number", minimum: 0 }, required: false },
        ],
        responses: {
          "200": {
            description: "Hotel list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HotelsResponse" },
                examples: {
                  siteminder: {
                    value: {
                      endpoint: "/hotels",
                      success: true,
                      provider: "siteminder",
                      total: 50,
                      properties: [
                        {
                          propertyId: "SMPROP-00001",
                          hotelId: "HTL-0001",
                          name: "Royal Tel Aviv Hotel",
                          shortDescription:
                            "Royal Tel Aviv Hotel offers premium hospitality in Tel Aviv with strong business and leisure facilities.",
                          address: {
                            line1: "8 HaYarkon St",
                            line2: "Hospitality District",
                            city: "Tel Aviv",
                            state: "Tel Aviv District",
                            postalCode: "54501",
                            country: "Israel",
                            countryCode: "IL",
                          },
                          starRating: 3,
                          amenities: ["Free Wi-Fi", "Pool", "Spa"],
                          images: [
                            "https://source.unsplash.com/1600x1000/?luxury%20hotel,HTL-0001-hotel-1",
                          ],
                          location: { latitude: 32.0705, longitude: 34.7575 },
                          roomTypes: [
                            {
                              roomTypeId: "SMRT-HTL-0001-1",
                              internalRoomTypeId: "HTL-0001-RT-01",
                              name: "Classic Room",
                              ratePerNight: 370,
                              currency: "ILS",
                              availableUnits: 4,
                              maxGuests: 2,
                            },
                          ],
                        },
                      ],
                      dataset: { hotels: 50, rooms: 223, activeReservations: 0 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/hotel/{id}": {
      get: {
        tags: ["Hotels"],
        summary: "Get hotel by ID",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Hotel ID (for example HTL-0001)",
          },
          {
            name: "provider",
            in: "query",
            schema: { $ref: "#/components/schemas/Provider" },
            required: false,
          },
        ],
        responses: {
          "200": {
            description: "Hotel details (includes room types and images)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HotelDetailsResponse" },
                examples: {
                  opera: {
                    value: {
                      endpoint: "/hotel/HTL-0001",
                      status: "SUCCESS",
                      provider: "opera-cloud",
                      count: 1,
                      hotels: [
                        {
                          hotelCode: "OPR-H0001",
                          hotelId: "HTL-0001",
                          name: "Royal Tel Aviv Hotel",
                          roomTypes: [
                            {
                              roomTypeCode: "OPR-1-1",
                              roomTypeId: "HTL-0001-RT-01",
                              name: "Classic Room",
                              baseRate: 370,
                              availableUnits: 4,
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Hotel not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: { success: false, error: "Hotel not found" },
              },
            },
          },
        },
      },
    },
    "/api/availability": {
      get: {
        tags: ["Availability"],
        summary: "Get availability and prices by date range",
        parameters: [
          {
            name: "checkIn",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
          {
            name: "checkOut",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
          {
            name: "provider",
            in: "query",
            required: false,
            schema: { $ref: "#/components/schemas/Provider" },
          },
          {
            name: "hotelId",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "guests",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "units",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "includeSoldOut",
            in: "query",
            required: false,
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": {
            description: "Availability data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AvailabilityResponse" },
                examples: {
                  optima: {
                    value: {
                      endpoint: "/availability",
                      checkIn: "2026-06-20",
                      checkOut: "2026-06-23",
                      ok: true,
                      provider: "optima",
                      data: [
                        {
                          hotelId: "HTL-0001",
                          available: true,
                          rooms: [
                            {
                              roomTypeId: "HTL-0001-RT-01",
                              roomName: "Classic Room",
                              available: true,
                              unitsLeft: 4,
                              unitsRequested: 1,
                              totalPrice: 1326,
                              currency: "ILS",
                              nights: [
                                {
                                  date: "2026-06-20",
                                  nightlyPrice: 442,
                                  currency: "ILS",
                                  availableUnits: 4,
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid date range or query",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/reservation": {
      post: {
        tags: ["Reservations"],
        summary: "Create reservation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReservationRequest" },
              example: {
                provider: "siteminder",
                hotelId: "HTL-0001",
                roomTypeId: "HTL-0001-RT-01",
                checkIn: "2026-06-20",
                checkOut: "2026-06-23",
                units: 1,
                guests: 2,
                customer: {
                  firstName: "Dana",
                  lastName: "Levi",
                  email: "dana.levi@example.com",
                  phone: "+972-54-1234567",
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reservation created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReservationCreateResponse" },
                example: {
                  endpoint: "/reservation",
                  success: true,
                  provider: "siteminder",
                  reservation: {
                    reservationId: "RSV-1777998560698-8267",
                    supplierReservationId: "SM-RSV-1777998560698-8267",
                    status: "CONFIRMED",
                    hotelId: "HTL-0001",
                    roomTypeId: "HTL-0001-RT-01",
                    checkIn: "2026-06-20",
                    checkOut: "2026-06-23",
                    units: 1,
                    guests: 2,
                    totalPrice: 1353,
                    currency: "ILS",
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "409": {
            description: "Room unavailable",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },
    "/api/reservation/cancel": {
      post: {
        tags: ["Reservations"],
        summary: "Cancel reservation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CancelReservationRequest" },
              example: {
                provider: "siteminder",
                reservationId: "RSV-1777998560698-8267",
                reason: "Customer changed plans",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reservation cancelled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReservationCancelResponse" },
              },
            },
          },
          "404": {
            description: "Reservation not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Already cancelled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/webhook/inventory-update": {
      post: {
        tags: ["Webhooks"],
        summary: "Inventory/price webhook",
        description:
          "Applies inventory and pricing overrides across date ranges to simulate PMS push updates.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InventoryWebhookRequest" },
              example: {
                provider: "opera",
                eventId: "evt-demo-001",
                updates: [
                  {
                    hotelId: "HTL-0001",
                    roomTypeId: "HTL-0001-RT-01",
                    startDate: "2026-06-20",
                    endDate: "2026-06-22",
                    availableUnits: 2,
                    pricePerNight: 990,
                    stopSell: false,
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook processed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InventoryWebhookResponse" },
                example: {
                  endpoint: "/webhook/inventory-update",
                  status: "SUCCESS",
                  provider: "opera-cloud",
                  appliedUpdates: 3,
                  processedAt: "2026-05-05T16:29:20.699Z",
                  eventId: "evt-demo-001",
                },
              },
            },
          },
          "400": {
            description: "Invalid webhook payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Provider: {
        type: "string",
        enum: ["siteminder", "opera", "optima"],
        default: "siteminder",
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" },
          details: {},
        },
        required: ["error"],
      },
      HotelsResponse: {
        type: "object",
        description: "Provider-flavored response object (siteminder/opera/optima).",
      },
      HotelDetailsResponse: {
        type: "object",
        description: "Provider-flavored single-hotel response object.",
      },
      AvailabilityResponse: {
        type: "object",
        description: "Provider-flavored availability response object.",
      },
      CreateReservationRequest: {
        type: "object",
        required: ["hotelId", "roomTypeId", "checkIn", "checkOut", "customer"],
        properties: {
          provider: { $ref: "#/components/schemas/Provider" },
          hotelId: { type: "string" },
          roomTypeId: { type: "string" },
          checkIn: { type: "string", format: "date" },
          checkOut: { type: "string", format: "date" },
          units: { type: "integer", minimum: 1, default: 1 },
          guests: { type: "integer", minimum: 1, default: 2 },
          customer: {
            type: "object",
            required: ["firstName", "lastName", "email", "phone"],
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string" },
            },
          },
        },
      },
      ReservationCreateResponse: {
        type: "object",
        description: "Provider-flavored reservation create response object.",
      },
      CancelReservationRequest: {
        type: "object",
        required: ["reservationId"],
        properties: {
          provider: { $ref: "#/components/schemas/Provider" },
          reservationId: { type: "string" },
          reason: { type: "string" },
        },
      },
      ReservationCancelResponse: {
        type: "object",
        description: "Provider-flavored reservation cancellation response object.",
      },
      InventoryWebhookRequest: {
        type: "object",
        required: ["updates"],
        properties: {
          provider: { $ref: "#/components/schemas/Provider" },
          eventId: { type: "string" },
          updates: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["hotelId", "roomTypeId", "startDate", "endDate"],
              properties: {
                hotelId: { type: "string" },
                roomTypeId: { type: "string" },
                startDate: { type: "string", format: "date" },
                endDate: { type: "string", format: "date" },
                availableUnits: { type: "integer", minimum: 0 },
                pricePerNight: { type: "number", minimum: 0 },
                stopSell: { type: "boolean" },
              },
            },
          },
        },
      },
      InventoryWebhookResponse: {
        type: "object",
        description: "Provider-flavored webhook processing response object.",
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(openApiDocument);
}
