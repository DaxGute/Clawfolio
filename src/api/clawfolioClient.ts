import type {
  ClawfolioInvestorProfile,
  ClawfolioLatestResponse,
  ClawfolioProfileResponse,
  ClawfolioRunResponse,
} from "../types/clawfolio";

export const CLAWFOLIO_PROFILE_DRAFT_KEY = "clawfolio.investorProfileDraft";

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
  const profileDraft = window.localStorage.getItem(CLAWFOLIO_PROFILE_DRAFT_KEY);
  let profile: ClawfolioInvestorProfile | undefined;
  if (profileDraft) {
    try {
      profile = JSON.parse(profileDraft) as ClawfolioInvestorProfile;
    } catch {
      window.localStorage.removeItem(CLAWFOLIO_PROFILE_DRAFT_KEY);
    }
  }
  const res = await fetch(`/api/clawfolio/run${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force, profile }),
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
