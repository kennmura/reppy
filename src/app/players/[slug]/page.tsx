import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPlayerProfileView } from "@/components/passport/PassportComponents";
import { getPublicPlayerProfileBySlug } from "@/lib/passportData";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicPlayerProfileBySlug(slug);
  if (!profile) {
    return {
      title: "Player profile not found | Reppy Passport",
    };
  }

  return {
    title: `${profile.display_name} | Reppy Passport`,
    description: `${profile.display_name}'s public Reppy Passport profile for ${profile.sport} development clips, strengths, and achievements.`,
  };
}

export default async function PublicPlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicPlayerProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <PublicPlayerProfileView profile={profile} />;
}
