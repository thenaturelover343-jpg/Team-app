declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    VAPID_SUBJECT?: string;
    VAPID_SERVER_PUBLIC_KEY?: string;
    VAPID_SERVER_PRIVATE_KEY?: string;
  }
}
