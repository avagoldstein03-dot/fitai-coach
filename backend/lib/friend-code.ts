// Excludes ambiguous characters (O/0, I/1) so codes are easy to read aloud or
// type in by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateFriendCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// Takes a DB-lookup callback rather than a Prisma client directly, so this
// stays a pure, easily-testable function — the caller decides how "taken" is
// determined.
export async function generateUniqueFriendCode(
  isCodeTaken: (code: string) => Promise<boolean>,
  maxAttempts = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateFriendCode();
    if (!(await isCodeTaken(code))) return code;
  }
  throw new Error("Could not generate a unique friend code after several attempts");
}
