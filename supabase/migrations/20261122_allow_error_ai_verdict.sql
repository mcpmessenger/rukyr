alter table proofs drop constraint if exists proofs_ai_verdict_check;
alter table proofs add constraint proofs_ai_verdict_check check (ai_verdict in ('pass', 'fail', 'unsure', 'error'));
