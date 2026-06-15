import { notFound } from "next/navigation";
import { CoachProfile } from "@/components/CoachProfile";
import { getCoachProfileBySlug } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCoachProfileBySlug(slug);

  if (!profile) {
    return {
      title: "Coach not found | Reppy",
    };
  }

  const reviewText = profile.reviewSummary?.reviewCount
    ? `${profile.reviewSummary.averageRating?.toFixed(1)} stars from ${profile.reviewSummary.reviewCount} published Reppy review${profile.reviewSummary.reviewCount === 1 ? "" : "s"}.`
    : "No published Reppy reviews yet.";

  return {
    title: `${profile.coach.full_name} | Reppy Coach Profile`,
    description: `${profile.coach.headline ?? "Local coach on Reppy"} ${reviewText}`,
  };
}

export default async function CoachSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCoachProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <CoachProfile profile={profile} />;
}
