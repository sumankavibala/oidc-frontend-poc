export async function generatePKCE() {
  const random  = new Uint8Array(32)
  const randomBytes = crypto.getRandomValues(random);
  const codeVerifier = base64UrlEncode(randomBytes);
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenege = base64UrlEncode(digest);
  return { codeVerifier, codeChallenege, codeChallenegeMethod: "S256" };
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}