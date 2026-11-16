alter table public.sales_log add column if not exists cost_each int check (cost_each is null or cost_each between 0 and 99999999);
