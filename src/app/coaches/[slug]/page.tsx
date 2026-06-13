import { notFound } from "next/navigation";
import { CoachProfile } from "@/components/CoachProfile";
import { getCoachProfileBySlug } from "@/lib/data";

export default async function CoachSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCoachProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <CoachProfile profile={profile} />;
}
