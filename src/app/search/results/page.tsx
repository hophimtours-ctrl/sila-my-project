import SearchPage, { type SearchPageParams } from "../page";

type SearchResultsPageProps = {
  searchParams: Promise<SearchPageParams>;
};

export default function SearchResultsPage({ searchParams }: SearchResultsPageProps) {
  return (
    <SearchPage
      searchParams={searchParams}
      showTopDeals={false}
      resultsLayout="horizontal"
      searchActionPath="/search/results"
      enableRandomRecommended={false}
    />
  );
}
