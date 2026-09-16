-- Private bucket for authorized staff Tap-to-Pay APK downloads.
-- Objects are never public. Admins receive short-lived signed URLs from
-- /api/admin/pos-app after requireActiveAdmin. No anon/authenticated
-- storage policies on purpose.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sr-staff-pos-app',
  'sr-staff-pos-app',
  false,
  157286400,
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
