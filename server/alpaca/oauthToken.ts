type TokenErrorJson = { message?: string; error?: string };

export async function exchangeAlpacaAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch("https://api.alpaca.markets/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as TokenErrorJson).message === "string"
        ? (json as TokenErrorJson).message
        : `Alpaca token exchange failed (${res.status})`;
    throw new Error(msg);
  }

  const access =
    typeof json === "object" &&
    json !== null &&
    "access_token" in json &&
    typeof (json as { access_token?: string }).access_token === "string"
      ? (json as { access_token: string }).access_token
      : undefined;

  if (!access) {
    throw new Error("Alpaca token response did not include access_token.");
  }

  return { access_token: access };
}
