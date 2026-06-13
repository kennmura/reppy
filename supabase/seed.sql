with ken as (
  insert into coaches (
    slug,
    full_name,
    sport,
    category,
    headline,
    bio,
    location,
    service_area,
    pricing_text,
    is_published,
    is_featured
  )
  values (
    'ken-murakawa',
    'Kenshin Murakawa',
    'Soccer',
    'Soccer Training',
    'Private Soccer Training in Greater Boston',
    'My name is Kenshin Murakawa, and I am a student-athlete at Brandeis University studying Economics and Computer Science. I currently play for the Brandeis Men''s Soccer team and have experience as a long-time starter, captain, and competitive player across club and college environments.

I offer private soccer training for local players who want to improve their technical ability, confidence, decision-making, and understanding of the game.',
    'Greater Boston / Middlesex County',
    'Watertown, Newton, Waltham, Lexington, Cambridge, Belmont, Boston, and nearby areas.',
    'Pricing available upon request.',
    true,
    true
  )
  on conflict (slug) do update set
    full_name = excluded.full_name,
    sport = excluded.sport,
    category = excluded.category,
    headline = excluded.headline,
    bio = excluded.bio,
    location = excluded.location,
    service_area = excluded.service_area,
    pricing_text = excluded.pricing_text,
    is_published = excluded.is_published,
    is_featured = excluded.is_featured,
    updated_at = now()
  returning id
),
target as (
  select id from ken
  union
  select id from coaches where slug = 'ken-murakawa'
  limit 1
)
insert into coach_services (coach_id, title, description, sort_order)
select target.id, service.title, service.description, service.sort_order
from target
cross join (
  values
    ('1-on-1 Technical Training', 'First touch, passing, receiving, ball control, dribbling, and game-realistic technique.', 1),
    ('Fullback / Wide Player Training', 'Position-specific training for outside backs and wide players, including defending, overlapping, crossing, scanning, and 1v1 situations.', 2),
    ('Small Group Training', 'High-intensity sessions for 2-4 players focused on technical quality, competition, and game speed.', 3),
    ('Speed, Agility & Soccer Fitness', 'Footwork, change of direction, acceleration, body positioning, and soccer-specific movement.', 4),
    ('College Soccer Guidance', 'Advice for players interested in college soccer, including recruiting, training habits, communication, and what the college environment is like.', 5)
) as service(title, description, sort_order)
where not exists (
  select 1 from coach_services where coach_services.coach_id = target.id and coach_services.title = service.title
);

with target as (
  select id from coaches where slug = 'ken-murakawa' limit 1
)
insert into coach_audiences (coach_id, label, sort_order)
select target.id, audience.label, audience.sort_order
from target
cross join (
  values
    ('Middle school players', 1),
    ('High school players', 2),
    ('Club soccer players', 3),
    ('Players trying to make a team', 4),
    ('Players preparing for college soccer', 5),
    ('Motivated beginners who want structured training', 6)
) as audience(label, sort_order)
where not exists (
  select 1 from coach_audiences where coach_audiences.coach_id = target.id and coach_audiences.label = audience.label
);
