import { SearchPageView, type SearchPageParams } from "../search-page-view";

type SearchResultsPageProps = {
  searchParams: Promise<SearchPageParams>;
};

export default function SearchResultsPage({ searchParams }: SearchResultsPageProps) {
  return (
    <SearchPageView
      searchParams={searchParams}
      showTopDeals={false}
      resultsLayout="horizontal"
      searchActionPath="/search/results"
      enableRandomRecommended={false}
    />
  );
}
