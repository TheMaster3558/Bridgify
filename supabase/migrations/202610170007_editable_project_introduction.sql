-- Keep the actual introduction sent during setup available when reviewing setup.
alter table public.chat_bindings add column introduction_text text
  check (introduction_text is null or length(trim(introduction_text)) between 1 and 4000);
