-- Profile lists project_requests where client_id = auth.uid().
-- Keep that RLS condition, but attach orphaned rows to the matching auth user
-- so a submitted order is visible on /profile without waiting for conversion.

create or replace function public.prepare_project_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.client_id := coalesce(auth.uid(), new.client_id);
  new.status := 'new';
  new.submitted_at := now();
  new.updated_at := now();
  new.referral_code_id := null;

  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number := public.generate_request_number();
  end if;

  return new;
end;
$$;

update public.project_requests as pr
set client_id = p.id
from public.profiles as p
join auth.users as u on u.id = p.id
where pr.client_id is null
  and u.email is not null
  and lower(btrim(pr.email)) = lower(btrim(u.email::text));
