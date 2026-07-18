-- Bookie App - Full Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now() not null,
  created_by uuid references auth.users(id) on delete set null
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null,
  nickname text not null,
  avatar_emoji text not null default '📚',
  is_child boolean default false not null,
  color text not null default '#3B6E52',
  gender text,
  created_at timestamptz default now() not null
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade not null,
  invited_by uuid references public.family_members(id) on delete set null,
  name text,
  email text,
  phone text,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz default (now() + interval '7 days') not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade not null,
  title text not null,
  author text,
  isbn text,
  cover_url text,
  cover_storage_path text,
  page_count integer,
  added_by uuid references public.family_members(id) on delete set null,
  created_at timestamptz default now() not null
);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade not null,
  member_id uuid references public.family_members(id) on delete cascade not null,
  current_page integer default 0 not null,
  status text default 'want_to_read' not null check (status in ('want_to_read', 'reading', 'finished')),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz default now() not null,
  unique(book_id, member_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade not null,
  member_id uuid references public.family_members(id) on delete cascade not null,
  parent_rating integer check (parent_rating between 1 and 5),
  reader_rating integer check (reader_rating between 1 and 5),
  review text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(book_id, member_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invites enable row level security;
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.ratings enable row level security;

-- Helper: get the authenticated user's family_id
create or replace function public.get_my_family_id()
returns uuid language sql security definer stable
as $$
  select family_id from public.family_members
  where user_id = auth.uid()
  limit 1;
$$;

-- Families
create policy "View own family" on public.families for select
  using (id = public.get_my_family_id());
create policy "Create family" on public.families for insert
  with check (created_by = auth.uid());
create policy "Update own family" on public.families for update
  using (id = public.get_my_family_id());

-- Family members
create policy "View family members" on public.family_members for select
  using (family_id = public.get_my_family_id());
create policy "Insert family members" on public.family_members for insert
  with check (family_id = public.get_my_family_id() or user_id = auth.uid());
create policy "Update family members" on public.family_members for update
  using (family_id = public.get_my_family_id());
create policy "Delete child profiles" on public.family_members for delete
  using (family_id = public.get_my_family_id() and is_child = true);

-- Invites: anyone authenticated can read by token (for invite acceptance)
create policy "View invites" on public.invites for select
  using (
    family_id = public.get_my_family_id()
    or (accepted_at is null and expires_at > now())
  );
create policy "Create invites" on public.invites for insert
  with check (family_id = public.get_my_family_id());
create policy "Update invites" on public.invites for update
  using (family_id = public.get_my_family_id() or accepted_at is null);

-- Books
create policy "View books" on public.books for select
  using (family_id = public.get_my_family_id());
create policy "Insert books" on public.books for insert
  with check (family_id = public.get_my_family_id());
create policy "Update books" on public.books for update
  using (family_id = public.get_my_family_id());
create policy "Delete books" on public.books for delete
  using (family_id = public.get_my_family_id());

-- Reading progress
create policy "View reading progress" on public.reading_progress for select
  using (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );
create policy "Insert reading progress" on public.reading_progress for insert
  with check (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );
create policy "Update reading progress" on public.reading_progress for update
  using (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );

-- Ratings
create policy "View ratings" on public.ratings for select
  using (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );
create policy "Insert ratings" on public.ratings for insert
  with check (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );
create policy "Update ratings" on public.ratings for update
  using (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );

-- ============================================================
-- STORAGE
-- ============================================================

-- Run in Storage section or SQL:
insert into storage.buckets (id, name, public)
  values ('book-covers', 'book-covers', true)
  on conflict do nothing;

create policy "Public book cover reads" on storage.objects for select
  using (bucket_id = 'book-covers');

create policy "Authenticated uploads" on storage.objects for insert
  with check (bucket_id = 'book-covers' and auth.role() = 'authenticated');

create policy "Authenticated deletes" on storage.objects for delete
  using (bucket_id = 'book-covers' and auth.role() = 'authenticated');

-- ============================================================
-- MILESTONE CELEBRATIONS
-- ============================================================

create table if not exists public.milestone_celebrations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.family_members(id) on delete cascade not null,
  milestone_type text not null check (milestone_type in ('books', 'pages')),
  milestone_value integer not null,
  celebrated_at timestamptz default now() not null,
  unique(member_id, milestone_type, milestone_value)
);

alter table public.milestone_celebrations enable row level security;

create policy "View family milestones" on public.milestone_celebrations for select
  using (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );

create policy "Insert family milestones" on public.milestone_celebrations for insert
  with check (
    member_id in (
      select id from public.family_members
      where family_id = public.get_my_family_id()
    )
  );

-- ============================================================
-- AGE GROUPS
-- ============================================================

alter table public.family_members
  add column if not exists age_group text;

-- ============================================================
-- SUPER ADMIN
-- Run this once to register yourself as super admin:
--   insert into public.super_admins (user_id)
--   values ((select id from auth.users where email = 'your@email.com'));
-- ============================================================

create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  created_at timestamptz default now() not null
);

-- Security: only accessible via SECURITY DEFINER functions below
alter table public.super_admins enable row level security;

-- Check if caller is super admin (used internally by other admin RPCs)
create or replace function public.is_super_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from public.super_admins where user_id = auth.uid())
$$;

-- Overview stats: all-time counts across entire platform
create or replace function public.admin_overview_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized';
  end if;
  return jsonb_build_object(
    'total_families',            (select count(*)::int from families),
    'total_members',             (select count(*)::int from family_members),
    'total_children',            (select count(*)::int from family_members where is_child),
    'total_books',               (select count(distinct id)::int from books),
    'total_finished',            (select count(*)::int from reading_progress where status = 'finished'),
    'total_reading',             (select count(*)::int from reading_progress where status = 'reading'),
    'total_want_to_read',        (select count(*)::int from reading_progress where status = 'want_to_read'),
    'pages_read',                (
      select coalesce(sum(coalesce(b.page_count, rp.current_page)), 0)::bigint
      from reading_progress rp join books b on b.id = rp.book_id
      where rp.status = 'finished'
    ),
    'total_reviews',             (select count(*)::int from ratings where review is not null and review <> ''),
    'avg_rating',                (select round(avg(reader_rating)::numeric, 1) from ratings where reader_rating is not null),
    'members_without_age_group', (select count(*)::int from family_members where age_group is null),
    'total_milestones',          (select count(*)::int from milestone_celebrations)
  );
end;
$$;

-- Per-book stats aggregated across all families
create or replace function public.admin_books_report()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',                b.id,
        'title',             b.title,
        'author',            coalesce(b.author, 'Unknown'),
        'cover_url',         b.cover_url,
        'page_count',        b.page_count,
        'finished_count',    count(rp.id) filter (where rp.status = 'finished'),
        'reading_count',     count(rp.id) filter (where rp.status = 'reading'),
        'want_to_read_count',count(rp.id) filter (where rp.status = 'want_to_read'),
        'total_interactions',count(rp.id),
        'avg_rating',        round(avg(r.reader_rating)::numeric, 1),
        'review_count',      count(r.id) filter (where r.review is not null and r.review <> ''),
        'age_groups',        (
          select coalesce(jsonb_agg(distinct fm2.age_group) filter (where fm2.age_group is not null), '[]'::jsonb)
          from reading_progress rp2
          join family_members fm2 on fm2.id = rp2.member_id
          where rp2.book_id = b.id
        ),
        'latest_activity_at', max(rp.updated_at)
      ) as row_data
      from books b
      left join reading_progress rp on rp.book_id = b.id
      left join ratings r on r.book_id = b.id
      group by b.id
      order by count(rp.id) filter (where rp.status = 'finished') desc nulls last, b.title
    ) sub
  );
end;
$$;

-- Top authors ranked by finishes across all families
create or replace function public.admin_top_authors()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'author',        b.author,
        'book_count',    count(distinct b.id)::int,
        'total_reads',   count(rp.id)::int,
        'finished_count',count(rp.id) filter (where rp.status = 'finished')::int,
        'avg_rating',    round(avg(r.reader_rating)::numeric, 1),
        'age_groups',    (
          select coalesce(jsonb_agg(distinct fm.age_group) filter (where fm.age_group is not null), '[]'::jsonb)
          from reading_progress rp2
          join books b2 on b2.id = rp2.book_id
          join family_members fm on fm.id = rp2.member_id
          where b2.author = b.author
        )
      ) as row_data
      from books b
      left join reading_progress rp on rp.book_id = b.id
      left join ratings r on r.book_id = b.id
      where b.author is not null and b.author <> ''
      group by b.author
      order by count(rp.id) filter (where rp.status = 'finished') desc nulls last, count(distinct b.id) desc
      limit 25
    ) sub
  );
end;
$$;

-- Reading activity broken down by reader age group
create or replace function public.admin_age_breakdown()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'age_group',        coalesce(fm.age_group, 'Unknown'),
        'member_count',     count(distinct fm.id)::int,
        'books_finished',   count(rp.id) filter (where rp.status = 'finished')::int,
        'books_reading',    count(rp.id) filter (where rp.status = 'reading')::int,
        'books_want_to_read',count(rp.id) filter (where rp.status = 'want_to_read')::int,
        'pages_read',       coalesce(sum(coalesce(b.page_count, rp.current_page)) filter (where rp.status = 'finished'), 0)::int
      ) as row_data
      from family_members fm
      left join reading_progress rp on rp.member_id = fm.id
      left join books b on b.id = rp.book_id
      group by fm.age_group
      order by count(rp.id) filter (where rp.status = 'finished') desc nulls last
    ) sub
  );
end;
$$;
