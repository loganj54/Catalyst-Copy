-- Create a table for class documents
create table if not exists class_documents (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references classes(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  name text not null,
  file_path text not null,
  file_url text not null,
  file_size bigint not null,
  file_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table class_documents enable row level security;

-- Create policies
create policy "Users can view their own class documents." on class_documents
  for select using (auth.uid() = user_id);

create policy "Users can create their own class documents." on class_documents
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own class documents." on class_documents
  for update using (auth.uid() = user_id);

create policy "Users can delete their own class documents." on class_documents
  for delete using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists class_documents_class_id_idx on class_documents(class_id);
create index if not exists class_documents_user_id_idx on class_documents(user_id);

