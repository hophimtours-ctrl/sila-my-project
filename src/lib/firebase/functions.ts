import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "@/lib/firebase/client";
import type {
  CreateBookingRequest,
  CreateBookingResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  SearchHotelsRequest,
  SearchHotelsResponse,
} from "@/lib/firebase/contracts";

export async function searchHotels(request: SearchHotelsRequest) {
  const callable = httpsCallable<SearchHotelsRequest, SearchHotelsResponse>(
    firebaseFunctions,
    "searchHotels",
  );
  const response = await callable(request);
  return response.data;
}

export async function createBooking(request: CreateBookingRequest) {
  const callable = httpsCallable<CreateBookingRequest, CreateBookingResponse>(
    firebaseFunctions,
    "createBooking",
  );
  const response = await callable(request);
  return response.data;
}

export async function createPaymentIntent(request: CreatePaymentIntentRequest) {
  const callable = httpsCallable<CreatePaymentIntentRequest, CreatePaymentIntentResponse>(
    firebaseFunctions,
    "createPaymentIntent",
  );
  const response = await callable(request);
  return response.data;
}
