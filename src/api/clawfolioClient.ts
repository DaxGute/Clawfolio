import type {
  ClawfolioInvestorProfile,
  ClawfolioLatestResponse,
  ClawfolioProfileResponse,
  ClawfolioRunResponse,
} from "../types/clawfolio";

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    const message =
      body.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export async function fetchClawfolioLatest(): Promise<ClawfolioLatestResponse> {
  const res = await fetch("/api/clawfolio/latest");
  return parseJson<ClawfolioLatestResponse>(res);
}

export async function runClawfolioDaily(
  force = false,
): Promise<ClawfolioRunResponse> {
  const q = force ? "?force=true" : "";
  const res = await fetch(`/api/clawfolio/run${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  return parseJson<ClawfolioRunResponse>(res);
}

export async function fetchInvestorProfile(): Promise<ClawfolioInvestorProfile> {
  const res = await fetch("/api/clawfolio/profile");
  const body = await parseJson<ClawfolioProfileResponse>(res);
  return body.profile;
}

export async function saveInvestorProfile(
  profile: ClawfolioInvestorProfile,
): Promise<ClawfolioInvestorProfile> {
  const res = await fetch("/api/clawfolio/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  const body = await parseJson<ClawfolioProfileResponse>(res);
  return body.profile;
}
