-- 先建表（如果还没建）
create table if not exists votes (
  id serial primary key,
  user_id text not null,
  round int not null,
  anime_a_id int references animes,
  anime_b_id int references animes,
  winner_id int references animes not null,
  created_at timestamptz default now()
);
alter table votes drop constraint if exists votes_user_id_anime_a_id_anime_b_id_key;
alter table votes add unique(user_id, anime_a_id, anime_b_id);

-- RLS：投票表公开可读写
alter table votes enable row level security;
drop policy if exists votes_public on votes;
drop policy if exists votes_public_update on votes;
drop policy if exists votes_read_public on votes;
create policy "votes_public" on votes for insert with check (true);
create policy "votes_public_update" on votes for update using (true);
create policy "votes_read_public" on votes for select using (true);
