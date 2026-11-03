alter table tasks
  add column if not exists reference_image_url text;
