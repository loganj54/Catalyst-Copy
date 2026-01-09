-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store document chunks and their embeddings
create table if not exists document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references class_documents(id) on delete cascade not null,
  content text not null, -- The actual text chunk
  embedding vector(1536), -- OpenAI text-embedding-3-small output dimensions
  chunk_index integer, -- To keep order
  token_count integer, -- Approximation for context window management
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table document_chunks enable row level security;

-- Create policies securely linked to the parent document's user
create policy "Users can view their own document chunks" on document_chunks
  for select using (
    exists (
      select 1 from class_documents cd
      where cd.id = document_chunks.document_id
      and cd.user_id = auth.uid()
    )
  );

create policy "Users can insert their own document chunks" on document_chunks
  for insert with check (
    exists (
      select 1 from class_documents cd
      where cd.id = document_chunks.document_id
      and cd.user_id = auth.uid()
    )
  );

create policy "Users can delete their own document chunks" on document_chunks
  for delete using (
    exists (
      select 1 from class_documents cd
      where cd.id = document_chunks.document_id
      and cd.user_id = auth.uid()
    )
  );

-- Create a similarity search function (RPC)
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  and document_chunks.document_id = filter_document_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create an index for faster vector similarity search
-- using HNSW (Hierarchical Navigable Small World) for performance
create index if not exists document_chunks_embedding_idx 
  on document_chunks 
  using hnsw (embedding vector_cosine_ops);

-- Index for faster lookups by document
create index if not exists document_chunks_document_id_idx 
  on document_chunks(document_id);
