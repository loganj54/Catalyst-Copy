-- Create table for chat threads
create table if not exists chat_threads (
  id uuid default gen_random_uuid() primary key,
  blueprint_id uuid references blueprints(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  title text default 'New Conversation',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for chat_threads
alter table chat_threads enable row level security;

create policy "Users can view their own threads." on chat_threads
  for select using (auth.uid() = user_id);

create policy "Users can create their own threads." on chat_threads
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own threads." on chat_threads
  for update using (auth.uid() = user_id);

create policy "Users can delete their own threads." on chat_threads
  for delete using (auth.uid() = user_id);


-- Create table for chat messages
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references chat_threads(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for chat_messages
alter table chat_messages enable row level security;

create policy "Users can view their own messages." on chat_messages
  for select using (
    exists (
      select 1 from chat_threads
      where chat_threads.id = chat_messages.thread_id
      and chat_threads.user_id = auth.uid()
    )
  );

create policy "Users can create their own messages." on chat_messages
  for insert with check (
    exists (
      select 1 from chat_threads
      where chat_threads.id = chat_messages.thread_id
      and chat_threads.user_id = auth.uid()
    )
  );

-- Trigger for updated_at on threads
create trigger handle_updated_at 
  before update on chat_threads
  for each row execute procedure public.handle_updated_at();
