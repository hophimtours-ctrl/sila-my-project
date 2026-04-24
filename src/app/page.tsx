import SearchPage from "@/app/search/page";

type HomeSearchParams = {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  return <SearchPage searchParams={searchParams} showTopDeals />;
}
