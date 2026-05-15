import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

export async function mintChildJwt(childId: string): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    iss: "supabase",
    child_id: childId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function verifyChildJwt(
  token: string
): Promise<{ childId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "supabase",
    });
    const childId = payload.child_id as string;
    if (!childId) return null;
    return { childId };
  } catch {
    return null;
  }
}
