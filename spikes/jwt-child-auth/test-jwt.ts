import "dotenv/config";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

const CHILD_A_ID = "11111111-1111-1111-1111-111111111111";
const CHILD_B_ID = "22222222-2222-2222-2222-222222222222";

function mintChildJwt(childId: string): string {
  // This is what the production API route will do after verifying the child's PIN.
  // Payload matches Supabase's expected structure:
  //   - "role" tells PostgREST which Postgres role to use
  //   - "child_id" is our custom claim for RLS policies
  //   - "iss" must be "supabase" for Supabase to accept it
  const payload = {
    role: "authenticated",
    iss: "supabase",
    child_id: childId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

function createSupabaseClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  // Step 1: Mint a child JWT
  process.stdout.write("[1/5] Minting child JWT...         ");
  try {
    const token = mintChildJwt(CHILD_A_ID);
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    if (decoded.child_id !== CHILD_A_ID) throw new Error("child_id mismatch");
    if (decoded.role !== "authenticated") throw new Error("role mismatch");
    console.log(`OK (token: ${token.slice(0, 20)}...)`);
    passed++;
  } catch (e) {
    console.log(`FAIL: ${e}`);
    failed++;
    console.log("\nRESULT: FAIL at step 1 -- JWT minting broken.");
    process.exit(1);
  }

  // Step 2: Verify tables exist (using anon key, which should fail RLS = tables exist)
  process.stdout.write("[2/5] Checking test tables...       ");
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: tableCheck } = await anonClient.from("children").select("id").limit(1);
  if (tableCheck && tableCheck.code === "42P01") {
    console.log("FAIL: children table does not exist. Run setup-db.ts first (or paste SQL into Supabase SQL Editor).");
    failed++;
    process.exit(1);
  }
  console.log("OK");
  passed++;

  // Step 3: Verify test data exists (using service role would be ideal, but we'll check via child JWT)
  process.stdout.write("[3/5] Verifying test data...        ");
  const childAToken = mintChildJwt(CHILD_A_ID);
  const childAClient = createSupabaseClient(childAToken);
  const { data: ownRow, error: ownError } = await childAClient
    .from("children")
    .select("id, name")
    .eq("id", CHILD_A_ID);

  if (ownError) {
    console.log(`FAIL: ${ownError.message} (code: ${ownError.code})`);
    failed++;

    if (ownError.message.includes("JWT") || ownError.code === "401" || ownError.message.includes("invalid")) {
      console.log("\n========================================");
      console.log("RESULT: FAIL -- Supabase REJECTS externally-minted JWTs.");
      console.log("The custom JWT was signed correctly but Supabase refused it.");
      console.log("FALLBACK: Use service_role key in API routes + manual auth checks.");
      console.log("========================================");
    } else {
      console.log("\nUnexpected error. Check SUPABASE_URL and SUPABASE_JWT_SECRET in .env.");
    }
    process.exit(1);
  }
  console.log("OK");
  passed++;

  // Step 4: Child A can read own row
  process.stdout.write("[4/5] Child reads own row (RLS)...  ");
  if (!ownRow || ownRow.length === 0) {
    console.log("FAIL: query returned 0 rows. RLS may be blocking or test data missing.");
    console.log("     If RLS is enabled but the policy isn't matching the JWT claim,");
    console.log("     check that the policy uses: ((current_setting('request.jwt.claims', true)::json)->>'child_id')::uuid");
    failed++;
  } else if (ownRow[0].id !== CHILD_A_ID) {
    console.log(`FAIL: returned wrong child (${ownRow[0].id})`);
    failed++;
  } else {
    console.log(`OK (name: "${ownRow[0].name}")`);
    passed++;
  }

  // Step 5: Child A CANNOT read Child B's row (RLS isolation)
  process.stdout.write("[5/5] Cross-child blocked (RLS)... ");
  const { data: otherRow } = await childAClient
    .from("children")
    .select("id, name")
    .eq("id", CHILD_B_ID);

  if (otherRow && otherRow.length > 0) {
    console.log("FAIL: Child A can read Child B's row! RLS is not isolating.");
    failed++;
  } else {
    console.log("OK (0 rows returned, RLS blocks cross-child read)");
    passed++;
  }

  // Summary
  console.log("");
  if (failed === 0) {
    console.log("========================================");
    console.log("RESULT: PASS -- Supabase accepts externally-minted JWTs for RLS.");
    console.log("Proceed with custom JWT architecture for child auth.");
    console.log("========================================");
  } else {
    console.log("========================================");
    console.log(`RESULT: ${failed} test(s) failed. See output above.`);
    console.log("========================================");
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
