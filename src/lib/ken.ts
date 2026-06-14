import type { CoachProfileData } from "./types";

const now = new Date().toISOString();
const coachId = "00000000-0000-0000-0000-000000000001";

export const kenProfile: CoachProfileData = {
  coach: {
    id: coachId,
    slug: "ken-murakawa",
    full_name: "Kenshin Murakawa",
    email: null,
    phone: null,
    sport: "Soccer",
    category: "Soccer Training",
    headline: "Private Soccer Training in Greater Boston",
    current_affiliation: "Brandeis University Men's Soccer Student-Athlete",
    bio: `My name is Kenshin Murakawa, and I am a student-athlete at Brandeis University studying Economics and Computer Science. I currently play for the Brandeis Men's Soccer team and have experience as a long-time starter, captain, and competitive player across club and college environments.

I offer private soccer training for local players who want to improve their technical ability, confidence, decision-making, and understanding of the game.`,
    location: "Greater Boston / Middlesex County",
    public_location: "Waltham, MA",
    city: "Waltham",
    state: "MA",
    zip_code: "02453",
    latitude: 42.3765,
    longitude: -71.2356,
    service_radius_miles: 30,
    service_area:
      "Watertown, Newton, Waltham, Lexington, Cambridge, Belmont, Boston, and nearby areas.",
    pricing_text: "Pricing available upon request.",
    profile_photo_url: null,
    banner_image_url: null,
    instagram_url: null,
    video_url: null,
    booking_url: null,
    is_published: true,
    is_featured: true,
    subscription_status: "manual",
    created_at: now,
    updated_at: now,
  },
  services: [
    {
      id: "service-technical",
      coach_id: coachId,
      title: "1-on-1 Technical Training",
      description:
        "First touch, passing, receiving, ball control, dribbling, and game-realistic technique.",
      duration: null,
      price: null,
      sort_order: 1,
      created_at: now,
    },
    {
      id: "service-wide",
      coach_id: coachId,
      title: "Fullback / Wide Player Training",
      description:
        "Position-specific training for outside backs and wide players, including defending, overlapping, crossing, scanning, and 1v1 situations.",
      duration: null,
      price: null,
      sort_order: 2,
      created_at: now,
    },
    {
      id: "service-group",
      coach_id: coachId,
      title: "Small Group Training",
      description:
        "High-intensity sessions for 2-4 players focused on technical quality, competition, and game speed.",
      duration: null,
      price: null,
      sort_order: 3,
      created_at: now,
    },
    {
      id: "service-fitness",
      coach_id: coachId,
      title: "Speed, Agility & Soccer Fitness",
      description:
        "Footwork, change of direction, acceleration, body positioning, and soccer-specific movement.",
      duration: null,
      price: null,
      sort_order: 4,
      created_at: now,
    },
    {
      id: "service-college",
      coach_id: coachId,
      title: "College Soccer Guidance",
      description:
        "Advice for players interested in college soccer, including recruiting, training habits, communication, and what the college environment is like.",
      duration: null,
      price: null,
      sort_order: 5,
      created_at: now,
    },
  ],
  audiences: [
    "Middle school players",
    "High school players",
    "Club soccer players",
    "Players trying to make a team",
    "Players preparing for college soccer",
    "Motivated beginners who want structured training",
  ].map((label, index) => ({
    id: `audience-${index + 1}`,
    coach_id: coachId,
    label,
    sort_order: index + 1,
    created_at: now,
  })),
  testimonials: [],
};
