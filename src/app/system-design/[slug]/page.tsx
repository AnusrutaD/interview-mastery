import { notFound } from "next/navigation";
import { getAllStudyItems, getStudyItem } from "@/server/content/studyContent";
import { StudyItemView } from "@/features/system-design/components/StudyItemView";

export function generateStaticParams() {
  return getAllStudyItems().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getStudyItem(slug);
  return {
    title: item ? `${item.title} · System Design` : "Not found",
    description: item?.summary,
  };
}

export default async function StudyItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getStudyItem(slug);
  if (!item) notFound();

  const neighbours = (() => {
    const all = getAllStudyItems();
    const index = all.findIndex((i) => i.slug === slug);
    return {
      previous: index > 0 ? { slug: all[index - 1].slug, title: all[index - 1].title } : null,
      next:
        index < all.length - 1
          ? { slug: all[index + 1].slug, title: all[index + 1].title }
          : null,
    };
  })();

  return (
    <StudyItemView
      item={{
        slug: item.slug,
        type: item.type,
        title: item.title,
        pattern: item.pattern,
        level: item.level,
        summary: item.summary,
        minutes: item.minutes,
        body: item.body,
        quiz: item.quiz,
        rubric: item.rubric,
        solution: item.solution,
      }}
      neighbours={neighbours}
    />
  );
}
