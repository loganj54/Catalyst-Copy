/*
  # Database Schema

  1.  **Users** (formerly Profiles)
      *   `id` (uuid, primary key) - Matches auth.users id
      *   `email` (text)
      *   `full_name` (text)
      *   `avatar_url` (text)
      *   `created_at` (timestamp)
      *   `updated_at` (timestamp)

  2.  **Classes**
      *   `id` (uuid, primary key)
      *   `user_id` (uuid, foreign key to users.id)
      *   `name` (text) - e.g., "Calculus I"
      *   `professor` (text) - e.g., "Dr. Smith"
      *   `semester` (text) - e.g., "Fall 2023"
      *   `description` (text)
      *   `created_at` (timestamp)
      *   `updated_at` (timestamp)

  3.  **Blueprints (Class Plans)**
      *   `id` (uuid, primary key)
      *   `class_id` (uuid, foreign key to classes.id)
      *   `user_id` (uuid, foreign key to users.id)
      *   `task_type` (text) - e.g., "Understand a concept"
      *   `goal_type` (text) - e.g., "Deep understanding"
      *   `content` (text/json) - The generated plan/response
      *   `created_at` (timestamp)
*/

-- Create a table for public users (formerly profiles)
create table users (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table users enable row level security;

create policy "Public users are viewable by everyone." on users
  for select using (true);

create policy "Users can insert their own profile." on users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on users
  for update using (auth.uid() = id);

-- Create a table for classes
create table classes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) not null,
  name text not null,
  professor text,
  semester text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table classes enable row level security;

create policy "Users can view their own classes." on classes
  for select using (auth.uid() = user_id);

create policy "Users can create their own classes." on classes
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own classes." on classes
  for update using (auth.uid() = user_id);

create policy "Users can delete their own classes." on classes
  for delete using (auth.uid() = user_id);

-- Create a table for blueprints/tasks
create table blueprints (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references classes(id) on delete cascade,
  user_id uuid references users(id) not null,
  task_type text not null,
  goal_type text not null,
  content jsonb, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table blueprints enable row level security;

create policy "Users can view their own blueprints." on blueprints
  for select using (auth.uid() = user_id);

create policy "Users can create their own blueprints." on blueprints
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own blueprints." on blueprints
  for update using (auth.uid() = user_id);

create policy "Users can delete their own blueprints." on blueprints
  for delete using (auth.uid() = user_id);

-- Set up triggers for updated_at
create or replace function public.handle_updated_at() 
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at 
  before update on users
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at 
  before update on classes
  for each row execute procedure public.handle_updated_at();

-- Set up a trigger to create a user entry when a new user signs up
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
