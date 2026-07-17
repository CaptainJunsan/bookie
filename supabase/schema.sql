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
