import { getAllStudyItems } from "@/server/content/studyContent";
import { TrackPicker } from "@/features/tracks/components/TrackPicker";

export default function HomePage() {
  // Only slug + title cross to the client; bodies and solutions stay server-side.
  const studyItems = getAllStudyItems().map((item) => ({
    slug: item.slug,
    title: item.title,
  }));

  return <TrackPicker studyItems={studyItems} />;
}
