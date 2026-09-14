truncate table messages;

update team_progress
set current_index = 1,
    history = '[]'::jsonb,
    updated_at = now();
