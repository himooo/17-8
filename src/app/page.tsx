import HomePageClient from "./page-client";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  return <HomePageClient studentBroadcast={params.view === "student"} />;
}
