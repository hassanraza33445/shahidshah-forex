-- Run this once in Supabase SQL Editor after deploying the updated files.
-- It keeps the existing public Downloads bucket and adds PDF as an allowed file type.

update storage.buckets
set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ]
where id = 'download-assets';
