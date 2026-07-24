/**
 * Dev-only helper: prints a one-time localhost sign-in link and a sign-in
 * code for the owner, bypassing the email round-trip (and its rate limit).
 * The code works on any device via "I already have a code" on the login
 * screen. Uses the service-role key from .env.local.
 *
 *   npx tsx scripts/dev-signin.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const email = process.env.NEXT_PUBLIC_OWNER_EMAIL!;

async function main() {
  // idempotent: ensure the single owner user exists
  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr && !/already/i.test(createErr.message)) {
    console.error("createUser:", createErr.message);
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) {
    console.error("generateLink:", error.message);
    process.exit(1);
  }
  console.log(
    `localhost link:  http://localhost:3000/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`
  );
  console.log(
    `sign-in code:    ${data.properties.email_otp}  (type it into any deployed login via "I already have a code")`
  );
}

main();
