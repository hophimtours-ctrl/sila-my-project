import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseImageIndex(value?: string, maxLength = 0) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  if (maxLength <= 0) {
    return 0;
  }

  return Math.min(parsed, maxLength - 1);
}

export default async function HotelGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ image?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const hotel = await prisma.hotel.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      images: true,
    },
  });

  if (!hotel || hotel.status !== "APPROVED") {
    return notFound();
  }

  const images = parseImages(hotel.images);
  const selectedImageIndex = parseImageIndex(query.image, images.length);
  const selectedImage = images[selectedImageIndex] ?? "";
  const sharedHotelQuery = new URLSearchParams();
  if (query.checkIn) {
    sharedHotelQuery.set("checkIn", query.checkIn);
  }
  if (query.checkOut) {
    sharedHotelQuery.set("checkOut", query.checkOut);
  }
  if (query.guests) {
    sharedHotelQuery.set("guests", query.guests);
  }
  const hotelDetailsHref = sharedHotelQuery.toString()
    ? `/hotels/${hotel.id}?${sharedHotelQuery.toString()}`
    : `/hotels/${hotel.id}`;
  const buildImageHref = (imageIndex: number) => {
    const galleryQuery = new URLSearchParams(sharedHotelQuery);
    galleryQuery.set("image", String(imageIndex));
    return `/hotels/${hotel.id}/gallery?${galleryQuery.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">גלריית תמונות · {hotel.name}</h1>
        <Link
          href={hotelDetailsHref}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          חזרה לעמוד המלון
        </Link>
      </div>

      {images.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          אין תמונות זמינות למלון זה כרגע.
        </div>
      ) : (
        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            <img src={selectedImage} alt={`${hotel.name} - תמונה ${selectedImageIndex + 1}`} className="h-[520px] w-full object-cover" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((imageUrl, index) => (
              <Link
                key={`${imageUrl}-${index}`}
                href={buildImageHref(index)}
                className={`block overflow-hidden rounded-xl border ${
                  index === selectedImageIndex ? "border-[var(--color-primary-light)]" : "border-slate-200"
                }`}
              >
                <img src={imageUrl} alt={`${hotel.name} - תמונה ${index + 1}`} className="h-28 w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
