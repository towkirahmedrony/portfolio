-- Restrict the referral client-facing wrappers to authenticated users only.
-- New functions inherit EXECUTE for PUBLIC (which includes anon); these three
-- are auth.uid()-scoped or write rewards, so anon must not reach them.
-- create_referral_for_client(uuid, text) stays service/postgres-only (set in
-- 20260912120000_referral_system.sql).

revoke all on function public.claim_my_referral(text) from public;
revoke all on function public.claim_my_referral(text) from anon;
grant execute on function public.claim_my_referral(text) to authenticated;

revoke all on function public.ensure_my_referral_code() from public;
revoke all on function public.ensure_my_referral_code() from anon;
grant execute on function public.ensure_my_referral_code() to authenticated;

revoke all on function public.expire_referral_rewards() from public;
revoke all on function public.expire_referral_rewards() from anon;
grant execute on function public.expire_referral_rewards() to authenticated;
